# Lane A — Timeline & Grid Inventory

Scope: justified grid layout, fast date-scrubber scrollbar, segment/bucket preview, virtualized rendering.
Reference app: `reference-app/web/src/lib/` (Svelte 5 runes + Immich-style SDK). Read-only.

---

## 1. Behaviors

Justified grid layout
- Per-row justified layout from per-asset aspect ratios; ratios packed into a `Float32Array`, fed to either a WASM layout engine or the JS `justified-layout` lib. Options: target `rowHeight`, container `rowWidth`, `spacing`, `heightTolerance`. `layout-utils.ts:30-116`.
- Layout exposes a box-geometry interface (`getTop/getLeft/getWidth/getHeight/getPosition(boxIdx)`, `containerWidth/Height`) so render code positions each tile absolutely. `layout-utils.ts:13-21`.
- Two-level layout: each **month** lays out its **day groups** independently, then day groups are flowed into rows within the month, wrapping when `cumulativeWidth + itemWidth > viewportWidth`, accumulating `month.height`. Each day group carries `row/col/start(left)/top`. `layout-support.svelte.ts:23-70`.
- Default tunables: `rowHeight=235`, `headerHeight=48`, `gap=12`, `spacing=2`, `heightTolerance=0.5`. `VirtualScrollManager.svelte.ts:22-34,145`.

Height estimation before load (skeleton geometry)
- For not-yet-loaded months, height is *estimated* without real ratios: `unwrappedWidth = 1.5 * assetCount * rowHeight * 0.7`, `rows = ceil(unwrappedWidth / viewportWidth)`, `height = headerHeight + max(1,rows)*rowHeight`. This lets the full scroll height + scrubber exist before any bucket is fetched. `layout-support.svelte.ts:10-19`.

Virtualized rendering (windowing)
- Total scroll height = `topSectionHeight + bodySectionHeight + bottomSectionHeight`; `bodySectionHeight` = sum of all `month.height`. `VirtualScrollManager.svelte.ts:12`, `timeline-manager.svelte.ts:53-59`.
- A `visibleWindow {top,bottom}` derives from `scrollTop` + `viewportHeight`. `VirtualScrollManager.svelte.ts:14-17`.
- Each month gets a `ViewportProximity` of `InViewport | NearViewport | FarFromViewport`, computed by intersecting `[month.top, month.top+height]` against the window expanded by `INTERSECTION_EXPAND_TOP/BOTTOM` tunables. Only in/near months are laid out for real and rendered; far months keep estimated height only. `intersection-support.svelte.ts:31-55`.
- Scroll handler updates the sliding window (`updateSlidingWindow`) which recomputes proximities only when `scrollTop` actually changed. `VirtualScrollManager.svelte.ts:155-161`.
- Deferred layout: far months defer real justified layout; cleared (`clearDeferredLayout`) when they come near viewport. `intersection-support.svelte.ts:52-54`.

Lazy data load per month (buckets)
- Months are created empty from a bucket-count list at init (count only, no assets). `timeline-manager.svelte.ts:247-266`.
- Asset detail for a month is fetched on demand via `loadTimelineMonth` → `loadFromTimeBuckets` when the month enters/nears the viewport (or is iterated). Each fetch is a `CancellableTask` so off-screen loads can abort. `timeline-manager.svelte.ts:351-372`, `load-support.svelte.ts:8-60`.
- On successful load, real geometry is computed and proximities refreshed. `timeline-manager.svelte.ts:368-371`.

Scrub-to-date scrollbar (the fast scrubber)
- Scrubber renders one **segment per month**, segment height proportional to that month's share of total scroll height (`month.height / scrubberTimelineHeight`). `Scrubber.svelte:144-192`, `timeline-manager.svelte.ts:340-349`.
- Sparse labels/dots: walking months newest→oldest, a year label is placed only when the year changes AND accumulated span > `MIN_YEAR_LABEL_DISTANCE(16px)`; a dot only when segment >5px tall and span > `MIN_DOT_DISTANCE(8px)`. Prevents label crowding. `Scrubber.svelte:144-192`.
- Has lead-in (top offset / header) and lead-out (bottom) pseudo-segments. `Scrubber.svelte:100-126`, `Timeline.svelte:333-340`.
- Two-way binding: (a) dragging/hovering the scrubber → `onScrub` callback maps the cursor's segment + intra-segment percent to a `scrollTop` and calls `timelineManager.scrollTo`. `Timeline.svelte:268-307`. (b) on normal scroll, the timeline computes which month is at the viewport top and the percent through it (`viewportTopMonth`, `viewportTopMonthScrollPercent`) and feeds the scrubber thumb position. `Timeline.svelte:316-363`, `Scrubber.svelte:95-129`.
- Hover shows a floating date label for the segment under the cursor; padding zones above/below clamp to first/last month label. `Scrubber.svelte:195-243`.
- Mobile vs desktop: scrubber width 20px (mobile, only visible while scrolling) vs 60px (desktop); widens to full viewport while dragging. `Scrubber.svelte:71-90`.
- "limitedScroll" edge case (content barely taller than viewport, `maxScrollPercent < 0.5`): falls back to a single overall scroll percent instead of per-month mapping. `timeline-manager.svelte.ts:76`, `Timeline.svelte:316-322`.

Scroll-to-asset / scroll-to-date
- Programmatic scroll to a given asset: find its month, ensure loaded, compute box top/bottom, scroll to whichever of align-top/align-bottom is nearer. `Timeline.svelte:128-197`.
- Random/jump-to-date loads the target month then scrolls. `timeline-manager.svelte.ts:412-442`.

Multi-select
- Selection state: a `Map<id, asset>` plus selected day-groups set, `selectAll` flag, and `startAsset` for range anchoring. Derived flags: `selectionActive`, `isAllFavorite/Trashed/Archived/UserOwned`, `ownedAssets`. `asset-multi-select-manager.svelte.ts:10-105`.
- Range/candidate selection: holding shift sets a start anchor; hovering computes a candidate range between anchor and current asset (`candidates`), committed on click. `asset-multi-select-manager.svelte.ts:83-93`, `Timeline.svelte:366-494` (shift handling at 474,494).
- Reset on navigation event. `asset-multi-select-manager.svelte.ts:38-40`.

Realtime updates
- Websocket support upserts/updates/deletes assets into the right month, recomputing geometry; pending-change queue types Add/Update/Delete/Trash. `types.ts:55-75`, manager `connect()`/`upsertAssets` `timeline-manager.svelte.ts:172-178,374-377`.

---

## 2. Data needs (endpoint contracts, abstract)

The reference timeline rests on **two** contracts. Find currently has neither in this shape.

A. Bucket-count list (the timeline skeleton) — REQUIRED, highest priority
- Request: timeline filter params (owner/album/person/visibility/tag, sort order) + a bucket granularity (month).
- Response: ordered list of `{ timeBucket: ISO-date (month start), count: number }`, sorted by the active order (newest- or oldest-first).
- Purpose: lets the client build every month, estimate total scroll height, and render the full scrubber **before fetching a single photo**. This is what makes scrub-to-date instant. Used at `timeline-manager.svelte.ts:247-263`.

B. Per-bucket asset window — REQUIRED
- Request: same filter params + a single `timeBucket` (the month key) + size.
- Response: the assets for exactly that month. Reference uses a columnar/struct-of-arrays bucket payload (parallel arrays keyed off the response) decoded into `TimelineAsset[]`. `load-support.svelte.ts:19-49`.
- Per-asset fields the layout/UI actually need (`types.ts:18-41`): `id`, `ratio` (aspect ratio — **critical for justified layout**), `thumbhash` (blur placeholder), `localDateTime`, `isVideo/isImage`, `duration`, `isFavorite/isTrashed`, `visibility`, `ownerId`, optionally `city/country/people/lat/long`, stack info.

Key contract note: granularity is **month buckets**, ordering is server-controlled and stable, and counts come separately from assets. The whole virtualization + scrubber design depends on knowing per-month counts up front.

---

## 3. Find today + the gap

What Find has (`frontend/src/components/virtualized-grid.tsx`, `app/gallery/page.tsx`, `store/galleryStore.ts`, `lib/api.ts`):
- `VirtualizedGrid`: a CSS-grid windower. Reads `grid-template-columns` to count columns, assumes a **uniform** `estimateRowHeight + gap` row stride, computes start/end rows from `getBoundingClientRect().top` vs `window.innerHeight`, renders a top/bottom spacer + the visible slice. Listens to window + scroll-parent scroll/resize + ResizeObserver. `virtualized-grid.tsx:63-194`.
- Data: offset pagination via `getGallery({page,limit,sortOrder,dateRange,dateStart,dateEnd})` → `GalleryResponse {items, total, page, limit}`, consumed with React Query `useInfiniteQuery` (page N+1 when `page*limit < total`). `api.ts:265-296`, `page.tsx:439-455`.
- Sorting newest/oldest + a date-range *filter* (presets + custom start/end) already exist in `galleryStore` and the URL. `galleryStore.ts:4-26`, `api.ts:21-27`.
- `MediaItem` has `width`/`height` (so aspect ratio is derivable) but **no thumbhash/blur placeholder, no per-asset localDate grouping field used client-side**. `api.ts:33-60`.
- Counts endpoint exists but returns only status totals (`all/indexed/processing/failed`), **not per-date counts**. `api.ts:106-111,298-307`.

GAP vs reference:
1. **No justified layout.** Find uses a fixed-column square/uniform grid; reference packs variable-aspect rows. Tiles' real `width/height` are unused for layout.
2. **No time-bucket data model.** Find paginates by offset/page; there's no month-bucket count list, so the full timeline height and the scrubber can't be known up front. This is the central architectural gap.
3. **No date scrubber at all.** No fast scrub-to-date, no month segments, no hover-date preview, no scroll↔scrubber two-way sync.
4. **No month/day headers or grouping** in the grid; reference groups by month and by day with sticky-ish headers and per-group geometry.
5. **Uniform-height virtualization only.** Find's windower assumes every row is the same height; it cannot represent variable month heights or justified rows. It also relies on `window`/`getBoundingClientRect` rather than an owned scroll container with a derived sliding window.
6. **No proximity/deferred-layout tier.** Find renders a flat slice; there's no "near vs far" distinction, no per-month lazy fetch, no cancellable off-screen loads.
7. **Multi-select** exists in reference with range/shift + group selection; verify Find's gallery selection (not in scope files read) matches — at minimum range-by-shift and select-whole-day are reference behaviors to match.

---

## 4. Port notes (Svelte 5 → React 19 / Next 16)

State model
- Reference leans on Svelte runes (`$state/$derived/$effect`) inside plain manager classes. In React, the cleanest port is a framework-agnostic `TimelineManager` plain class holding mutable geometry + a small store (Zustand, matching existing `galleryStore`) for the few reactive scalars the UI reads (`months`, `scrubberMonths`, `scrollTop`, `visibleWindow`, selection). Keep heavy geometry off React state; expose an imperative `subscribe`/snapshot so the grid reads positions without re-rendering every tile.

Algorithms to reimplement (these are the load-bearing pieces)
- Justified row packing from aspect ratios → box geometry. Use the `justified-layout` npm package (same one reference falls back to) rather than the WASM module to start; WASM is an optimization, not required. `layout-utils.ts:102-116`.
- Two-level month→day-group flow + month height accumulation. `layout-support.svelte.ts:23-70`.
- Pre-load height estimate formula (so the scrubber exists before fetch). `layout-support.svelte.ts:10-19`.
- Viewport-proximity intersection with top/bottom expansion + deferred layout clearing. `intersection-support.svelte.ts:31-55`.
- Scrubber segment building (sparse label/dot placement). `Scrubber.svelte:144-192`.
- Bidirectional scroll↔scrubber mapping (segment+percent → scrollTop and viewport-top-month detection). `Timeline.svelte:268-363`, `Scrubber.svelte:95-129`.

Virtualization approach
- Own the scroll container (don't ride `window`). Absolute-position month sections at their cumulative `top`; within a section, absolute-position rows/tiles from box geometry. Render only In/Near months. Spacer-free since each section has an explicit height.
- React 19 / Next 16: this is a client component (`"use client"`). Avoid `ResizeObserver`-driven full re-layouts on every scroll; throttle layout to width changes, and only recompute proximities (cheap) on scroll. The current `virtualized-grid.tsx`'s reliance on `getBoundingClientRect` per scroll should be replaced by reading the owned container's `scrollTop`.
- thumbhash/blur placeholders need a decode util on the React side (or fall back to a CSS blur of `thumbnail_url`) if the backend can't emit thumbhash soon.

Backend dependency
- The month-bucket count endpoint and per-bucket asset endpoint must land in `lib/api.ts` + the Go/Python backend before the timeline can be built. This is the long pole and should be specced with the API/backend lane. Without it, only a degraded "estimate from total count" timeline is possible.

---

## 5. Effort estimate (S/M/L)

| Behavior | Size | Notes |
|---|---|---|
| Month-bucket count endpoint + per-bucket asset endpoint (backend + api.ts) | **L** | Blocking dependency; new data model + backend work |
| Justified layout (ratios → box geometry) | **M** | Use `justified-layout` lib; ratio from `width/height` |
| Two-level month→day-group flow + height accumulation | **M** | Direct port of layout-support |
| Pre-load height estimation | **S** | One formula |
| Owned-container virtualization + proximity tiers + deferred layout | **L** | Core rewrite of `virtualized-grid.tsx`; variable section heights |
| Lazy per-month fetch with cancellable off-screen loads | **M** | Ties windowing to data layer |
| Date scrubber: segments + sparse labels/dots | **M** | Port `calculateSegments` |
| Scrubber ↔ scroll two-way sync (incl. limitedScroll edge case) | **M** | Fiddly mapping math |
| Hover-date preview + mobile/desktop width behavior | **S** | UI polish on the scrubber |
| Month/day headers + grouping | **S–M** | New render structure |
| Multi-select range/shift + whole-group select | **M** | Confirm against Find's existing selection first |
| thumbhash blur placeholders | **S** | Or CSS-blur fallback if no backend support |
| Realtime websocket upsert into months | **M** | Only if Find has/plans websockets; otherwise defer |
