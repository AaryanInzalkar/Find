# Lane C — Archive, Favorites, Trash (and Restore)

Read-only discovery. Reference = `reference-app/` (NestJS server). Target = Find (`backend/src/find_api/`).
Reference behavior/state-model/scoping extracted; no source copied.

---

## 1. State model

The reference asset carries **three orthogonal flags**, not one. Archive and Trash are NOT booleans — they are values on two enums; only Favorite is a boolean.

| Concept | Column | Type | Default | Reference |
|---|---|---|---|---|
| Favorite | `isFavorite` | boolean | false | `reference-app/server/src/schema/tables/asset.table.ts:83-84` |
| Archive / Timeline visibility | `visibility` | enum `asset_visibility_enum` | `timeline` | `asset.table.ts:137-138` |
| Soft-delete timestamp | `deletedAt` | timestamptz, nullable | null | `asset.table.ts:119-120` |
| Lifecycle status | `status` | enum `assets_status_enum` | `active` | `asset.table.ts:131-132` |

Enum values:
- `AssetVisibility` = `archive` | `timeline` | `hidden` | `locked` — `reference-app/server/src/enum.ts:1137-1145`. **Archive is a visibility value**, not a separate flag. `timeline` = shows in main grid; `archive` = archived (hidden from timeline, still owned/searchable in archive view).
- `AssetStatus` = `active` | `trashed` | `deleted` — `reference-app/server/src/enum.ts:390-393`. `trashed` = in trash (recoverable); `deleted` = marked for permanent purge.

Key insight: **trash uses two coordinated fields** — `status` (active/trashed/deleted) AND `deletedAt` (timestamp). `deletedAt IS NOT NULL` means "in trash"; `status` distinguishes recoverable trash (`trashed`) from queued-for-purge (`deleted`). The `deletedAt` timestamp drives auto-purge timing.

A partial index optimizes the hot path: `visibility = 'timeline' AND "deletedAt" IS NULL` — `asset.table.ts:58-62`.

---

## 2. Transitions

All bulk mutations flow through `updateAll` / `deleteAll`.

- **Favorite / Unfavorite** — set `isFavorite` via bulk update. `AssetService.updateAll` extracts `isFavorite` from DTO and persists it (`reference-app/server/src/services/asset.service.ts:130-174`, esp. `:133, :146, :172-173`).
- **Archive / Unarchive** — set `visibility` to `archive` (archive) or `timeline` (unarchive) via the same `updateAll` path (`asset.service.ts:134, :146, :172-173`). Setting `visibility=locked` additionally strips the asset from all albums (`asset.service.ts:176-178`).
- **Trash (soft delete)** — `deleteAll` with `force=false`: sets `deletedAt = now()` and `status = trashed`, then emits `AssetTrashAll` (`asset.service.ts:370-382`, esp. `:374-377`).
- **Permanent delete (skip trash)** — `deleteAll` with `force=true`: sets `deletedAt = now()` and `status = deleted`, emits `AssetDeleteAll` (`asset.service.ts:374-378`).
- **Restore (single/bulk)** — set `status = active`, `deletedAt = null` for given ids where `status = trashed` (`reference-app/server/src/repositories/trash.repository.ts:38-52`; service `reference-app/server/src/services/trash.service.ts:12-25`).
- **Restore all** — same, scoped to one owner where `status = trashed` (`trash.repository.ts:14-24`; `trash.service.ts:27-33`).
- **Empty trash** — flips all owner's `trashed` rows to `status = deleted` (`trash.repository.ts:26-36`), then queues the `AssetEmptyTrash` background job which streams every `status = deleted` id and queues real `AssetDelete` (disk + DB) jobs (`trash.service.ts:35-84`, esp. getDeletedIds `trash.repository.ts:10-12`).
- **Auto-purge after N days** — `AssetDeleteCheck` background job: computes `trashedBefore = now() − config.trash.days` (disabled ⇒ 0 days), streams assets with `deletedAt <= trashedBefore`, queues `AssetDelete` (`asset.service.ts:273-305`, esp. `:276-279, :294`; query `reference-app/server/src/repositories/asset-job.repository.ts:410-414` filters `asset.deletedAt <= trashedBefore`). `AssetDelete` does the irreversible file+row removal (`asset.service.ts:307+`).

---

## 3. Query scoping — THE KEY PART

Two independent predicates gate almost every "normal" asset query:
1. **`deletedAt IS NULL`** — excludes anything in trash (trashed or queued-for-delete).
2. **`visibility IN ('timeline','archive')`** — excludes `hidden` and `locked`; archived assets are NOT excluded by default visibility.

The default-visibility helper: `withDefaultVisibility` = `where visibility IN ('archive','timeline')` (`reference-app/server/src/utils/database.ts:82-84`).

**Main timeline** (the photo grid): `visibility = 'timeline' AND deletedAt IS NULL` — archived assets ARE excluded here because timeline requires `= 'timeline'` exactly (`asset.repository.ts:481, :490`; bucket builder `:967-972, :985-987`; search repo timeline `reference-app/server/src/repositories/search.repository.ts:388-390, :404-406, :499-500`).

**Archive view**: `visibility = 'archive' AND deletedAt IS NULL` (timeline query parameterized by `visibility`, `asset.repository.ts:767, :842`).

**Favorites view**: `isFavorite = true` plus the standard `deletedAt IS NULL` and a visibility filter (`asset.repository.ts:782, :868`).

**Trash view**: inverts the trash predicate — `deletedAt IS NOT NULL AND status != 'deleted'` (recoverable trash only, excludes purge-queued rows) (`asset.repository.ts:712-713, :750-751, :840, :899`).

**Search** scoping (`search.repository.ts`): options carry `visibility`, `isFavorite`, `withDeleted` (`:27, :32-35`). Search applies `visibility = 'timeline'` + `deletedAt IS NULL` by default, with `isFavorite` available as a filter (`:388-390, :191-275, :499-500`).

**Statistics** mirror the same gates with toggles: `withDefaultVisibility` when no explicit visibility, optional `isFavorite`, and trash inversion (`asset.repository.ts:701-714`).

Summary scoping rule: a row is "in the main timeline" iff **`visibility = 'timeline'` AND `deletedAt IS NULL`**. Archive flips visibility to `'archive'`; trash sets `deletedAt`; both naturally drop the row from the timeline grid.

---

## 4. API surface

Trash controller — `reference-app/server/src/controllers/trash.controller.ts`:
- `POST /trash/empty` — permanently delete all trashed items (queues purge) (`:16-25`).
- `POST /trash/restore` — restore all trashed items for the user (`:28-37`).
- `POST /trash/restore/assets` — restore specific asset ids from trash (body = BulkIdsDto) (`:40-49`).

Asset controller — `reference-app/server/src/controllers/asset.controller.ts`:
- `PUT /assets` — bulk update; carries `isFavorite` and `visibility` (archive/unarchive, favorite/unfavorite) (`:56-70`).
- `PATCH /assets` — same handler, v3 (`:72-78`).
- `DELETE /assets` — bulk soft-delete (trash) or `force` permanent delete (`:80-90`).
- `PUT /assets/:id` — single-asset update (favorite/visibility) (`:141`).

(Background jobs, not HTTP: `AssetEmptyTrash`, `AssetDeleteCheck`, `AssetDelete`.)

---

## 5. Find today + GAP

**`backend/src/find_api/models/media.py`** has:
- `liked` boolean (default false) — `media.py:39-41`. This is Find's favorite equivalent (already exists).
- `is_hidden` boolean + `hidden_at` + `vault_state` (`visible`/...) + `encrypted_at` — `media.py:43-54`. This is the vault/hidden system (Lane B's concern), NOT archive/trash.
- `status` String = `pending|processing|indexed|failed` — `media.py:57-58`. **This is processing status, a totally different axis** from reference's `active/trashed/deleted` lifecycle. Cannot be reused for trash.
- **No `is_archived`, no `deleted_at`/`trashed_at`, no archive/trash lifecycle.** Confirmed: Find has NO trash, NO archive today. Favorites exist as `liked`.

**`backend/src/find_api/routers/gallery.py` scoping today**: gallery list filters only `Media.is_hidden.is_(False)` then applies `scope_media_query` (ownership/IDOR) + optional `status`/`liked`/metadata/date filters (`gallery.py:194, :355-358; core/dependencies.py:75-87`). `liked` is an optional filter, not a separate view. Search scopes by `status='indexed' AND vector IS NOT NULL AND is_hidden = false` (`routers/search.py:128, :262, :311`).

**GAP:**
- Add `is_archived` (boolean, default false, indexed) and `deleted_at` (timestamptz nullable, indexed) to `media.py`. Optionally a `trash` lifecycle marker, but `deleted_at IS NULL/NOT NULL` plus an "empty-trash purge" pass is sufficient for a single-user app (status enum can be deferred — YAGNI). Favorites already covered by `liked`.
- Gallery base query must add `Media.deleted_at.is_(None)` (exclude trash) AND `Media.is_archived.is_(False)` (exclude archive) to the existing `is_hidden == False` gate.
- New views: archive = `is_archived == True, deleted_at IS NULL`; trash = `deleted_at IS NOT NULL`; favorites = existing `liked == True` (+ default scoping).
- Search query must also gain `deleted_at IS NULL` and `is_archived = false` (currently filters only `is_hidden`).
- New endpoints: trash/restore/empty + archive toggle + (existing) like toggle. Add an auto-purge job (delete rows where `deleted_at <= now − N days`).

---

## 6. Effort estimate

**M (Medium).** Two new columns + Alembic migration + small backfill. Scoping changes are mechanical but touch every list/search/count query (gallery, search, stats, duplicates, people) — the risk is missing a query and leaking trashed/archived rows. New trash/archive/restore endpoints + one auto-purge background task. Favorites is already done (`liked`). No new infra. Bulk of effort is auditing every existing query for the two new predicates and adding the purge job.
