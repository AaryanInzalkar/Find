# Lane D — Asset Viewer & Slideshow Inventory

Read-only behavioral extraction from the reference app (Immich-style Svelte 5 web) compared against Find's current `image-preview-modal.tsx`. Reference paths are relative to `reference-app/web/src/lib/`. No source copied — behaviors only.

Key reference files:
- `components/asset-viewer/AssetViewer.svelte` — shell: layout, navigation, slideshow orchestration, stack, preload wiring.
- `components/asset-viewer/PhotoViewer.svelte` — the photo surface: zoom action, swipe, dblclick, keyboard (z/s/copy), face/OCR overlays, cast hook.
- `components/AdaptiveImage.svelte` — progressive thumbnail→preview→original rendering + GPU raster sizing.
- `utils/adaptive-image-loader.svelte.ts` — `AdaptiveImageLoader` quality-chain state machine.
- `components/asset-viewer/PreloadManager.svelte.ts` — neighbor preloading.
- `actions/zoom-image.ts` — wheel/pinch zoom via `@zoom-image/core`.
- `managers/asset-viewer-manager.svelte.ts` — zoom state, animated zoom, panel state.
- `components/asset-viewer/SlideshowBar.svelte` — slideshow controls, progress bar, auto-hide.
- `stores/slideshow.store.ts` — persisted slideshow settings + state machine.
- `utils/slideshow-history.ts` — shuffle history (back/forward).
- `components/asset-viewer/SlideshowMetadataOverlay.svelte` — slideshow caption/date/location overlay.
- `managers/cast-manager.svelte.ts` — Google Cast (note only).

---

## 1. Viewer behaviors

### Open / close
- Viewer is a full-screen fixed `<section>` grid (`AssetViewer.svelte:488-493`), `bg-black`, with `focusTrap` action and `contain: layout`.
- On open: adds `asset-viewer-open` class to `document.body` (`AssetViewer.svelte:152-153, 373-377`); on destroy resets activity, panel state, removes the class, and tears down preloaders (`:177-182`).
- Close: `closeViewer()` calls `onClose?.(asset.id)` (`:184-186`). Bound to `Escape` and to the back-arrow button in the nav bar (`AssetViewerNavBar.svelte:78` — `shortcuts: [{ key: 'Escape' }]`).

### Next / previous navigation
- `navigateAsset(order?)` is the single nav entry point (`AssetViewer.svelte:198-250`). Guards re-entrancy with an `InvocationTracker` (`:197, 209-213`) so rapid presses don't stack.
- Calls `preloadManager.cancelBeforeNavigation(order)` first (`:207`) to drop the now-irrelevant neighbor preload.
- Non-slideshow: forward = `navigateToAsset(cursor.nextAsset)`, back = `cursor.previousAsset` (`:229-231`).
- Prev/next on-screen affordances are `PreviousAssetAction` / `NextAssetAction` components, only shown when `showNavigation`, not editing, and a neighbor exists (`:526-530, 604-608`).
- Stack navigation: ArrowUp/ArrowDown move within an asset stack (`:252-266, 483-485`).

### Zoom
- Wheel/pinch zoom is the `zoomImageAction` (`actions/zoom-image.ts:11-16`) using `@zoom-image/core` `createZoomImageWheel`, `maxZoom: 10`, seeded from `assetViewerManager.zoomState`. Applied on the photo container (`PhotoViewer.svelte:220`).
- Double-click / double-tap toggles zoom between 1x and 2x via `onZoom` → `assetViewerManager.animatedZoom(targetZoom)` (`PhotoViewer.svelte:103-106, 219`); `animatedZoom` is a 300ms `cubicOut` rAF tween (`asset-viewer-manager.svelte.ts:143-161`).
- Keyboard `z` also toggles zoom (`PhotoViewer.svelte:206`).
- Synthetic dblclick from touch double-tap is suppressed so it doesn't double-fire with the zoom lib (`zoom-image.ts:103-125`).
- Zoom state resets on every asset change (`PhotoViewer.svelte:50-54`, `AdaptiveImage.svelte:138-142`).

### Pan
- Pan is handled internally by `@zoom-image/core` (position tracked as `currentPositionX/Y` in `zoomState`, `asset-viewer-manager.svelte.ts:24-30`). No separate pan code — pointer drag while zoomed pans.
- `node.style.touchAction = 'none'` set so the browser doesn't intercept pan/pinch (`zoom-image.ts:128`).
- Pointerdown cancels any running zoom animation so a drag feels immediate (`zoom-image.ts:26`).

### Keyboard shortcuts (each key)
| Key | Action | Source |
|-----|--------|--------|
| `Escape` | Close viewer (or exit slideshow when in slideshow) | `AssetViewerNavBar.svelte:78`; `SlideshowBar.svelte:144` |
| `ArrowLeft` | Previous asset (slideshow bar binds it too) | `SlideshowBar.svelte:145`; viewer prev via affordance |
| `ArrowRight` | Next asset | `SlideshowBar.svelte:146` |
| `ArrowUp` | Previous in stack | `AssetViewer.svelte:483` |
| `ArrowDown` | Next in stack | `AssetViewer.svelte:484` |
| `z` | Toggle zoom (1x ↔ 2x) | `PhotoViewer.svelte:206` |
| `s` | Start slideshow | `PhotoViewer.svelte:207` |
| `Ctrl/Cmd + c` | Copy image to clipboard (skipped if a text range is selected) | `PhotoViewer.svelte:208-209, 117-124` |
| `Space` | Pause/resume slideshow progress (photos only; videos keep native space) | `SlideshowBar.svelte:150-162` |
- Shortcuts are registered via a `use:shortcuts` action bound to `svelte:document` (`PhotoViewer.svelte:204-211`, `AssetViewer.svelte:480-486`).

### Swipe / touch
- `useSwipe` from `svelte-gestures` wraps the photo container (`PhotoViewer.svelte:23, 221`).
- `onSwipe` (`AssetViewer.svelte:458-474`): swipe left → next, swipe right → previous. Suppressed when `zoom > 1` (so panning a zoomed image doesn't navigate) and when an OCR overlay is active.
- Slideshow bar has its own swipe: `pan-x` touch action, `onswipedown` re-shows the control bar (`SlideshowBar.svelte:135-140, 171`).

### Thumbnail → full-res progressive load
- `AdaptiveImage.svelte` stacks up to three `<ImageLayer>` elements (thumbnail, preview, original) and shows/hides them by load state (`:251-286`).
- Order: thumbhash placeholder (instant, from `asset.thumbhash`) → thumbnail → preview → original. The thumbhash blur shows until any real layer succeeds (`:185-196`).
- `afterThumbnail` decides the next fetch: if `zoom > 1` jump straight to `original`, else fetch `preview` (`AdaptiveImage.svelte:96-102`). Preview error falls back to original (`:116`).
- Original is only triggered lazily — when the user zooms past 1x (`AdaptiveImage.svelte:202-206`), not on initial display. This is the core loading-discipline rule.

---

## 2. Slideshow behaviors

### Start / stop
- Start: pressing `s` or the nav action sets `slideshowState = PlaySlideshow` (`PhotoViewer.svelte:114, 207`). A subscription in `AssetViewer.onMount` resets shuffle history, queues the current asset, and runs `handlePlaySlideshow()` (`AssetViewer.svelte:154-162`).
- `handlePlaySlideshow` records `slideshowStartAssetId` and requests fullscreen on the viewer element; failure to enter fullscreen aborts to `StopSlideshow` (`:284-292`).
- Stop: `StopSlideshow` state → `handleStopSlideshow()` exits fullscreen and resets state to `None` (`:294-305`). Exiting fullscreen via the browser also stops the slideshow (`SlideshowBar.svelte:115-133`).

### Interval / progress / autoplay
- A `ProgressBar` drives advancement; `onDone` → `handleDone()` advances next (or previous for ascending order) (`SlideshowBar.svelte:98-106, 237-246`).
- Duration is `slideshowDelay` (default 5s), with `slideshowAutoplay` (default true) and `showProgressBar` (default true) (`slideshow.store.ts:44-47`, bound `SlideshowBar.svelte:238-244`).
- `Space` toggles pause/play of the progress bar (`SlideshowBar.svelte:150-162`).
- On each successful navigation while playing, `restartProgress` is fired to reset the bar (`AssetViewer.svelte:237-240, 275`).
- Video slides: the progress bar is hidden and the native video element handles playback; `handleVideoStarted` stops progress (`AssetViewer.svelte:278-282`, `SlideshowBar.svelte:42, 190-199, 237`).
- Controls auto-hide after 2.5s of no mouse movement and hide the cursor; any mousemove re-shows them (`SlideshowBar.svelte:51-69, 168`).

### Transitions / look
- `slideshowTransition` (default true) toggles fly transitions on the control bar (`slideshow.store.ts:46`; `fly` used `SlideshowBar.svelte:178`).
- `SlideshowLook` (`slideshow.store.ts:16-31`): `Contain` (default), `Cover` (object-cover), `BlurredBackground` (object-contain over a blurred thumbhash backdrop). Look feeds `objectFit` and the blurred backdrop in `PhotoViewer.svelte:152-154, 227, 240-244`.

### Shuffle / repeat / order
- `SlideshowNavigation` (`slideshow.store.ts:10-14`): `Shuffle`, `AscendingOrder` (backward), `DescendingOrder` (forward, default).
- Shuffle uses `SlideshowHistory` (`utils/slideshow-history.ts`) — a back/forward stack so previous re-walks visited assets; when it runs out it calls `onRandom?.()` to pull a new random asset and queues it (`AssetViewer.svelte:214-227`, `slideshow-history.ts:21-39`).
- `slideshowRepeat` (default false): when navigation exhausts the list, jumps back to `slideshowStartAssetId` and restarts; otherwise stops (`AssetViewer.svelte:242-248`).

### Slideshow settings & metadata overlay
- All settings live in `SlideshowSettingsModal.svelte` (delay, progress bar, navigation, look, transition, autoplay, repeat, metadata overlay + mode), all persisted to localStorage via `svelte-persisted-store` (`slideshow.store.ts:37-53`, modal `:42-50, 85-88`).
- Optional metadata overlay (`SlideshowMetadataOverlay.svelte`): two modes — `DescriptionOnly` or `Full` (description + date + city/state/country) (`:18-35`).

---

## 3. Loading discipline

Quality chain is thumbnail → preview → original, modeled by `AdaptiveImageLoader` (`utils/adaptive-image-loader.svelte.ts:34-126`).

Rules:
1. **Thumbhash first.** `asset.thumbhash` renders an instant blurred placeholder with zero network (`AdaptiveImage.svelte:242-249`).
2. **Thumbnail is the entry fetch**, then `onAfterLoad`/`onAfterError` chains to the next quality (`adaptive-image-loader` quality configs; `AdaptiveImage.svelte:104-121`).
3. **Preview is the default display quality** at zoom = 1 (`afterThumbnail` triggers `preview`, `AdaptiveImage.svelte:96-102`).
4. **Original is deferred** — only fetched when the user zooms past 1x (`AdaptiveImage.svelte:202-206`, `PhotoViewer.svelte` zoom path), or when preview fails (`:116`). Avoids paying full-res bytes for casual browsing.
5. **Error fallbacks cascade**: thumbnail error → still try preview; preview error → original; original error → BrokenAsset (`AdaptiveImage.svelte:185-196, 289-291`).

Neighbor preloading (`PreloadManager.svelte.ts`):
- On viewer mount, preloads both `previousAsset` and `nextAsset` to thumbnail+preview (not original) (`:89-96, 23-42`).
- After each navigation, `updateAfterNavigation` keeps the preloader heading the same direction and discards the stale one; `cancelBeforeNavigation` aborts the opposite-direction preload before moving (`:54-87`, called `AssetViewer.svelte:207, 400-412`).
- Preloaders are torn down on viewer destroy (`AssetViewer.svelte:181`).

GPU/raster note (Chromium HDR seam workaround): `AdaptiveImage` sizes the image div near native resolution and counter-scales with `will-change: transform`, capping raster pixels by GPU `MAX_TEXTURE_SIZE` (`AdaptiveImage.svelte:1-49, 152-180`). Niche — low priority for Find port.

---

## 4. Find today + GAP

Find's `image-preview-modal.tsx` is a metadata-rich detail dialog, not a real viewer.

What it does today:
- Split layout: image stage on the left, a long metadata sidebar (file info, caption, objects, OCR, analysis stages, like/download/delete/reprocess) (`image-preview-modal.tsx:368-884`).
- Single `<Image>` with `object-contain`, `unoptimized`, one resolution from `resolveMediaUrl` (`:387-410`). No thumbnail/preview/original tiering.
- Keyboard: only `Escape` (close), `ArrowLeft`/`ArrowRight` (prev/next, gated on `hasPrevious`/`hasNext`) (`:345-366`).
- Prev/next chevron buttons (`:412-437`). No swipe/touch.
- Detail data via React Query with stale/refresh tuned to MinIO URL expiry, polling faster while pending/processing (`:236-248`).

GAP vs reference:
- **No zoom** (no `z`, no double-tap, no pinch/wheel). Biggest gap.
- **No pan.**
- **No progressive loading** — loads one resolution; no thumbhash/blur placeholder, no preview→original tiering, so large originals block the stage behind a spinner (`:388-391`).
- **No neighbor preloading** — next/prev navigation re-fetches cold every time.
- **No swipe/touch navigation.**
- **No slideshow at all** — no play, interval, shuffle, repeat, transitions, fullscreen, or settings.
- **No copy-to-clipboard of the image** (`Ctrl/Cmd+c`); Find only copies caption/OCR text.
- **No fullscreen** mode for the image.
- **No re-entrancy guard** on rapid arrow presses (reference uses `InvocationTracker`).
- Find's media layer (`lib/media.ts`) only distinguishes a thumbnail endpoint (`/api/image/:id/thumbnail`) vs the full object URL — there is no "preview" (mid-res) tier, so a true thumbnail→preview→original chain needs a backend preview endpoint or an agreed two-tier (thumbnail→original) compromise.

---

## 5. Port notes (React)

- **Zoom/pan**: don't hand-roll. Use a maintained React lib:
  - `react-zoom-pan-pinch` (most popular; wheel+pinch+double-tap, `TransformWrapper`/`TransformComponent`, programmatic `zoomToElement`/reset) — closest drop-in for the reference's wheel+dblclick behavior.
  - Alternatives: `@use-gesture/react` + `@react-spring/web` for full control (matches the rAF-tweened `animatedZoom`), or wrap the same `@zoom-image/core` the reference uses (framework-agnostic) behind a small hook.
  - Recommendation: `react-zoom-pan-pinch` for speed; reset transform on asset change, gate swipe-nav on `scale === 1`.
- **Keyboard**: a single `useEffect` window `keydown` listener already exists in Find (`:345-366`); extend it with `z` (zoom toggle), `s` (slideshow), and `Space` (slideshow pause). Keep `Escape` context-aware (exit slideshow before closing viewer). Consider `react-hotkeys-hook` if the map grows.
- **Swipe**: `@use-gesture/react` `useDrag`/`useSwipe`, or `react-swipeable`. Mirror the "disabled when zoomed" rule.
- **Progressive image**: render layered `<img>` (or two stacked `next/image`) — thumbnail src shown immediately, swap/overlay preview on its `onLoad`, lazy-load original only on zoom. A thumbhash/blurhash placeholder needs a stored hash per asset (Find has none today — either add one or use the existing thumbnail endpoint as the blur source). Avoid `next/image` optimization here; the reference already serves pre-sized variants (`unoptimized` is already set in Find).
- **Preloading**: on asset change, `new Image()` (or prefetch) the next/prev preview URLs; cancel via clearing `.src`. Port `PreloadManager`'s direction-aware keep/discard logic as a small class or hook.
- **Slideshow**: a reducer/state machine (`none | playing | stopped`) + persisted settings (localStorage, e.g. `zustand` `persist` or a tiny `useLocalStorage`). Fullscreen via the Fullscreen API (`element.requestFullscreen()` + `fullscreenchange` listener, exactly as `SlideshowBar.svelte:115-133`). Progress bar = a CSS/rAF timer keyed to `slideshowDelay`.
- **Casting**: reference uses Google Cast SDK via `cast-manager.svelte.ts` (`loadMedia(url)` when `isCasting`, casts the current preview URL — `PhotoViewer.svelte:128-150`). **Note only — out of scope for the initial Find port.** If pursued later, use the Cast Web Sender SDK and cast the resolved original/preview URL.

---

## 6. Effort estimate (S/M/L)

| Behavior | Effort | Notes |
|----------|--------|-------|
| Zoom (wheel + double-tap toggle) | **M** | Drop in `react-zoom-pan-pinch`; wire reset-on-change. |
| Pan | **S** | Free with the zoom lib. |
| Keyboard shortcuts (z/s/space + context Escape) | **S** | Extend existing keydown effect. |
| Swipe/touch navigation | **S–M** | Add gesture lib; gate on scale. |
| Progressive thumbnail→preview→original | **M–L** | L if a backend preview tier / thumbhash must be added; M if two-tier (thumbnail→original). |
| Neighbor preloading | **S–M** | Port direction-aware preloader. |
| Re-entrancy guard on nav | **S** | Small flag/tracker. |
| Copy image to clipboard | **S** | Canvas → `ClipboardItem`. |
| Fullscreen mode | **S** | Fullscreen API. |
| Slideshow core (play/stop/interval/progress/autoplay) | **M** | State machine + timer + fullscreen. |
| Slideshow shuffle + history (back/forward) | **M** | Port `SlideshowHistory` + `onRandom`. |
| Slideshow repeat + ascending/descending order | **S** | Branching in advance logic. |
| Slideshow looks (contain/cover/blurred) | **S–M** | Blurred needs a thumbhash/blur source. |
| Slideshow settings modal + persistence | **M** | New modal + localStorage. |
| Slideshow metadata overlay (2 modes) | **S** | Find already has caption/date/location data. |
| Casting | **L** | Out of scope — note only. |
