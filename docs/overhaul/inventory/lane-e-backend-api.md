# Lane E — Backend / API Surface Inventory

Read-only discovery. Reference = NestJS (`reference-app/server/src`). Find = FastAPI (`backend/src/find_api`). All paths under reference are prefixed `/api` in deployment; controller decorators below show the route segment.

---

## 1. Reference route surface (by domain)

### Timeline — `@Controller('timeline')`
| Method | Path | Purpose |
|---|---|---|
| GET | `/timeline/buckets` | List time buckets (bucket id + asset count) for a filtered set |
| GET | `/timeline/bucket` | All assets in one bucket as columnar arrays |

### Album — `@Controller('albums')`
| Method | Path | Purpose |
|---|---|---|
| GET | `/albums` | List albums (filter by `?shared`, `?assetId`) |
| POST | `/albums` | Create album (with optional initial assetIds) |
| GET | `/albums/statistics` | Owned/shared/notShared counts |
| GET | `/albums/:id` | Album detail + assets |
| PATCH | `/albums/:id` | Update name/description/order/activity/thumbnail |
| DELETE | `/albums/:id` | Delete album |
| GET | `/albums/:id/map-markers` | Geo markers for album assets |
| PUT | `/albums/:id/assets` | Add assets to album |
| PUT | `/albums/assets` | Add assets to *multiple* albums |
| DELETE | `/albums/:id/assets` | Remove assets from album |
| PUT | `/albums/:id/users` | Add shared users (with role) |
| PUT | `/albums/:id/user/:userId` | Update a user's role |
| DELETE | `/albums/:id/user/:userId` | Remove shared user |

### Shared-link — `@Controller('shared-links')`
| Method | Path | Purpose |
|---|---|---|
| GET | `/shared-links` | List my shared links |
| POST | `/shared-links/login` | Authenticate against a password-protected link |
| GET | `/shared-links/me` | Resolve current link context (by key/slug/password) |
| GET | `/shared-links/:id` | Get one link |
| POST | `/shared-links` | Create link (type ALBUM or INDIVIDUAL) |
| PATCH | `/shared-links/:id` | Edit link (password/expiry/permissions/slug) |
| DELETE | `/shared-links/:id` | Delete link |
| PUT | `/shared-links/:id/assets` | Add assets to an individual link |
| DELETE | `/shared-links/:id/assets` | Remove assets from a link |

### Partner — `@Controller('partners')`
| Method | Path | Purpose |
|---|---|---|
| GET | `/partners` | List partners (`?direction=shared-by`/`shared-with`) |
| POST | `/partners` | Create partner share |
| POST | `/partners/:id` | (legacy create-by-id) |
| PUT | `/partners/:id` | Update `inTimeline` flag |
| DELETE | `/partners/:id` | Remove partner |

### Asset-state — `@Controller(Asset)` (`/assets`) + `trash` + `download`
| Method | Path | Purpose |
|---|---|---|
| GET | `/assets/statistics` | Counts by favorite/archive/total |
| PUT | `/assets` | Bulk update: `ids[]` + isFavorite / visibility / dateTimeOriginal / lat-lng / rating / description / duplicateId |
| DELETE | `/assets` | Bulk soft-delete (trash) or force delete |
| PATCH | `/assets` | Bulk patch |
| GET/PUT/PATCH | `/assets/:id` | Get / replace / patch single asset (isFavorite, visibility, etc.) |
| POST | `/trash/empty` | Permanently delete all trashed |
| POST | `/trash/restore` | Restore all trashed |
| POST | `/trash/restore/assets` | Restore specific ids |
| POST | `/download/info` | Compute archive size/contents |
| POST | `/download/archive` | Stream zip of selected assets |

> `visibility` enum = `archive | timeline | hidden | locked`. Favorite = `isFavorite` flag. Trash = soft-delete via `DELETE /assets` then `/trash/*`. So **archive, favorite, and trash are all properties of the asset**, not separate collections.

### User / Auth — `@Controller('auth')`, `@Controller(User)`, `@Controller('sessions')`
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login`, `/auth/logout`, `/auth/admin-sign-up`, `/auth/validateToken`, `/auth/change-password` | Auth lifecycle |
| GET/POST/PUT/DELETE | `/auth/pin-code`, `/auth/session/lock`, `/auth/session/unlock` | PIN + locked-folder session |
| GET | `/users`, `/users/me`, `/users/:id` | User listing/self |
| GET/PUT | `/users/me/preferences` | User preferences (incl. UI/timeline prefs) |
| GET | `/users/me/calendar-heatmap` | Activity heatmap for timeline scrubber |
| various | `/users/me/license`, `/users/me/onboarding`, `/users/profile-image` | Profile bits |
| POST/GET/DELETE/PUT/PATCH | `/sessions...` | Device session management |

### Adjacent (relevant context, not in scope to port)
- `@Controller('memories')`, `@Controller('stacks')`, `@Controller('activities')`, `@Controller('view')` (folder browsing). Activities back album comments/likes.

---

## 2. Timeline contract (PRIORITY — Phase 3 consumer)

Source: `reference-app/server/src/dtos/time-bucket.dto.ts`, `controllers/timeline.controller.ts`.

### GET `/timeline/buckets` — bucket count list
Query (`TimeBucketDto`, all optional unless noted):
```
userId, albumId, personId, tagId          (uuid)
isFavorite, isTrashed                       (bool)
withStacked, withPartners, withCoordinates  (bool)
order        = ASC | DESC                   (within-bucket sort)
orderBy      = takenAt | createdAt          (grouping date)
visibility   = archive | timeline | hidden | locked
bbox         = "west,south,east,north"     (WGS84)
key, slug                                   (shared-link context)
```
Response: `TimeBucketsResponseDto[]`
```jsonc
[ { "timeBucket": "2024-01-01",   // YYYY-MM-DD, start of period (month granularity)
    "count": 42 } ]
```

### GET `/timeline/bucket` — assets in one bucket (columnar)
Query = same base as above **plus required** `timeBucket: "YYYY-MM-DD"`.
Response `TimeBucketAssetResponseDto` — **parallel arrays, all same length, indexed positionally** (not a list of objects; chosen for payload size):
```jsonc
{
  "id":            ["..."],      // asset ids
  "ownerId":       ["..."],
  "ratio":         [1.5],        // width/height aspect ratio
  "isFavorite":    [true],
  "visibility":    ["timeline"],
  "isTrashed":     [false],
  "isImage":       [true],       // false => video
  "thumbhash":     ["...", null],// base64 blurhash for placeholder
  "createdAt":     ["ISO ts"],   // upload time (UTC)
  "fileCreatedAt": ["ISO ts"],   // capture time (UTC)
  "localOffsetHours": [5.5],     // signed, fractional; apply to fileCreatedAt for local time
  "duration":      [12000, null],// ms; null for stills
  "stack":         [["stackId", 3], null],  // optional [stackId, count] tuple
  "projectionType":[null],       // 360 content
  "livePhotoVideoId":[null],
  "city":   [null],   "country": [null],     // optional, only when withCoordinates
  "latitude":[null],  "longitude":[null]     // optional, only when withCoordinates
}
```
Note: response sent with explicit `Content-Type: application/json` header (large preserialized payload). Both endpoints allow shared-link auth.

---

## 3. Find route surface (today)

| Router | Routes |
|---|---|
| auth | `POST /auth/setup`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST+GET /auth/invites`, `POST /auth/join`, `GET /auth/join-requests`, `POST /auth/join-requests/{id}/approve`, `.../reject` |
| gallery | `GET /gallery/counts`, `GET /gallery`, `GET /image/{id}`, `GET /image/{id}/thumbnail`, `POST /thumbnails/backfill`, `POST /image/{id}/like`, `POST /image/{id}/reprocess`, `DELETE /image/{id}`, `POST /images/bulk-delete` |
| search | `GET /search` |
| people | `GET /people`, `GET /people/{id}/images`, `PATCH /people/{id}`, `POST /people/cluster` |
| clusters | `GET /clusters`, `GET /cluster/{id}`, `PATCH /cluster/{id}`, `POST /cluster/run`, `POST /cluster/trigger` |
| duplicates | `GET /api/duplicates`, `POST /api/image/{id}/keep` |
| feedback | search/caption/object rating + correction endpoints, `GET /feedback/stats`, `GET /people/feedback` |
| vault | `POST /vault/unlock`, `GET /vault/list`, `POST /vault/lock`, `POST /vault/hide`, `GET /vault/stream/{id}` |
| upload | `POST /upload`, `POST /upload/bulk` |
| status | `GET /status/models`, `GET /status/{job_id}` |
| config | `GET /config` |

`GET /gallery` supports rich filtering already: `skip/limit`, `status` (processing-state only), `liked`, `sort_order`, date-range presets + custom `date_start/date_end` + `date_from/date_to`, camera make/model, min width/height, `file_type`, `orientation`. `GET /gallery/counts` returns only processing-state buckets (`all/indexed/processing/failed`).

---

## 4. Gap table

| Domain | Status in Find | Notes |
|---|---|---|
| **Timeline buckets** | **Missing** | No bucket-count or bucket-window endpoint. `GET /gallery` is offset-paginated, not month-bucketed. This is the #1 Phase 3 build. |
| **Albums** | **Missing** | No album model, router, or asset-album join. Entire domain absent. |
| **Shared links** | **Missing** | No public/anonymous link sharing. Find sharing is multi-user within one instance only (invites/join). |
| **Partner sharing** | **Missing** | No partner concept. |
| **Favorites** | **Partial** | `liked` column + `POST /image/{id}/like`; no bulk toggle, no `isFavorite` filter parity with timeline params. |
| **Archive** | **Missing** | No archive visibility state. Only `is_hidden`/`vault_state` (vault) exists, which is a different concept. |
| **Trash** | **Partial / hard-delete** | `DELETE /image/{id}` and `/images/bulk-delete` are hard deletes. No soft-delete/`deleted_at`, no restore, no trash list/empty. |
| **Asset bulk state update** | **Missing** | No `PUT /assets` bulk endpoint (favorite/visibility/date/rating/description). |
| **Calendar heatmap** | **Missing** | Needed if timeline scrubber wants density data. |
| **Auth/users** | **Partial** | Find has its own invite/join model (different from reference). User prefs endpoint absent. |
| **Download archive (zip)** | **Missing** | No multi-asset zip download. |

---

## 5. Schema diff (tables/columns Find must add)

Consolidated; other lanes own field-level detail.

**Media (existing table) — add columns:**
- `is_archived` (bool) **or** a `visibility` enum (`timeline|archive|hidden|locked`) — reconcile with existing `is_hidden`/`vault_state`.
- `deleted_at` (timestamptz, nullable) for soft-delete/trash + index; retention for auto-empty.
- `taken_at` / `file_created_at` (timestamptz) — capture time distinct from `created_at` (upload). Timeline buckets group by capture date; currently only `created_at` exists. Likely derivable from `exif_json` but should be a first-class indexed column for bucket queries.
- `local_offset_hours` (float, nullable) for `localOffsetHours` in the bucket response.
- `thumbhash`/blurhash (string, nullable) for placeholder rendering (timeline contract field).

**New tables:**
- `albums` (id, owner_user_id, name, description, order, is_activity_enabled, album_thumbnail_media_id, created_at, updated_at).
- `album_media` (album_id, media_id, added_at) — many-to-many.
- `album_users` (album_id, user_id, role: `editor|viewer`) — album sharing.
- `shared_links` (id, owner_user_id, type `album|individual`, album_id?, key/slug, password_hash?, expires_at, allow_upload, allow_download, show_metadata, created_at).
- `shared_link_media` (shared_link_id, media_id) — for individual-asset links.
- `partners` (shared_by_id, shared_with_id, in_timeline) — optional, lower priority.

**Users:** reference has rich preferences; Find's `users` table is minimal. A `user_preferences` (JSON) column or table may be needed for timeline/UI prefs.

Migrations: Find has 4 alembic versions today (vault schema, vault state metadata, duplicate_of, hnsw index). New work needs additive migrations on `media` plus the new tables above.

---

## 6. Sequencing note (backend-before-frontend)

1. **Media schema additions first** — `taken_at`, `deleted_at`, `is_archived`/`visibility`, `local_offset_hours`, `thumbhash`. Everything else depends on these columns.
2. **Timeline bucket endpoints** (`/timeline/buckets`, `/timeline/bucket`) — highest priority; Phase 3 frontend timeline cannot start until the columnar contract exists. Depends on `taken_at` + state columns being filterable.
3. **Asset-state mutations** — bulk `PUT /assets` (favorite/archive/visibility) + soft-delete/trash (`deleted_at`, restore, empty). Timeline filters (`isFavorite`, `isTrashed`, `visibility`) and the archive/favorites/trash views all consume these.
4. **Albums** — model + CRUD + asset add/remove, then album sharing (album_users). Album view and album-scoped timeline (`albumId` filter) depend on this.
5. **Shared links** — depends on albums (for ALBUM type) and assets (INDIVIDUAL type). Public-link auth path is independent of internal user auth — flag: anonymous/password access surface, design carefully.
6. **Partners** — lowest priority; independent, can land anytime after asset-state.

Frontend can build the timeline shell against a mocked bucket contract, but real data needs steps 1-2. Archive/favorites/trash views need step 3. Albums/sharing UI need steps 4-5.
