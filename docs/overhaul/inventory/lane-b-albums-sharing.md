# Lane B Inventory — Albums & Sharing

Read-only discovery from `reference-app/` (Svelte web + NestJS server). Behavior/data-model/API-shape only; no verbatim source. Find currently has **no** albums or sharing primitives.

---

## 1. Album behaviors

- **Create** — album has a name (default `"Untitled Album"`), optional description, optional initial users (with roles) and initial asset IDs. Creating user becomes `owner` (enforced via a unique index allowing exactly one `owner` row per album). `reference-app/server/src/controllers/album.controller.ts:46`, `dtos/album.dto.ts:32` (CreateAlbumSchema), `schema/tables/album-user.table.ts:23` (`album_user_unique_owner`).
- **List / get** — list all albums available to user, with filters: `id`, `name` (exact), `isOwned` (owned vs shared-with-me), `isShared`, `assetId` (albums containing an asset). Single-album get is also reachable via a shared link. `album.controller.ts:33,60`, `dtos/album.dto.ts:66` (GetAlbumsSchema).
- **Update (metadata only)** — name, description, **cover** (`albumThumbnailAssetId`), `isActivityEnabled`, and `order` (asset sort). Explicitly not for adding/removing assets or users. `album.controller.ts:71`, `dtos/album.dto.ts:56` (UpdateAlbumSchema).
- **Delete** — soft-delete (trashed via `deletedAt`) then background hard-delete. `album.controller.ts:88`, `schema/tables/album.table.ts:41` (`deletedAt`).
- **Membership (assets)** — add assets to one album; add assets to many albums at once (`PUT /albums/assets` with album+asset ID lists); remove assets. Bulk responses report per-asset success/error (duplicate / no-permission). `album.controller.ts:111,126,138`, `dtos/album.dto.ts:42` (AlbumsAddAssetsSchema).
- **Membership (users) / roles** — share album with users at a role; update a user's role; remove a user (use `me` to leave a shared album). `album.controller.ts:152,170,189`. Roles: `owner`, `editor`, `viewer` — `enum.ts:65`.
- **Cover** — single nullable thumbnail asset FK, `ON DELETE SET NULL`. `schema/tables/album.table.ts:25`.
- **Ordering** — album-level `order` enum (asc/desc by date); response derives `startDate`/`endDate` from member assets. `schema/tables/album.table.ts:48`, `dtos/album.dto.ts:175` (mapAlbum).
- **Statistics** — counts of owned / shared / not-shared albums. `album.controller.ts:54`.
- **Map markers** — per-album geo markers (shared-link accessible). `album.controller.ts:104`.
- **Activity feed** — likes + comments on an album or on an asset-in-album, toggled by `isActivityEnabled`. Like is unique per (asset,user,album); a row is either a comment or a like (DB check constraint). Create/list/delete/statistics. `controllers/activity.controller.ts:30,46,66,78`, `schema/tables/activity.table.ts:24,28`.
- **Response shape** — `albumUsers` ordered owner-first then auth-user then alphabetical; flags `shared`, `hasSharedLink`; `assetCount`. `dtos/album.dto.ts:108` (AlbumResponseSchema).

## 2. Sharing behaviors

### Shared links — `controllers/shared-link.controller.ts`, `services/shared-link.service.ts`, `dtos/shared-link.dto.ts`
- **Two types** — `ALBUM` (shares a whole album) and `INDIVIDUAL` (a set of assets not necessarily in an album). `enum.ts:312`.
- **Create** requires access check on the target: `AlbumShare` permission for album links, `AssetShare` for individual. A random 50-byte `key` is generated per link (base64url in responses). `shared-link.service.ts:68,93`.
- **Per-link options** — `description`, `password` (optional), custom `slug` (unique), `expiresAt` (nullable), `allowUpload` (default false on table / true in create path), `allowDownload` (default true), `showMetadata`/`showExif` (default true). Rule: if `showMetadata=false` then `allowDownload` is forced false. `dtos/shared-link.dto.ts:21`, `shared-link.service.ts:97`.
- **Update / delete** — owner-scoped edit of the same fields; delete. `shared-link.controller.ts:120,140`.
- **Individual-link asset membership** — add/remove assets (only for `INDIVIDUAL` type), with per-asset access check and duplicate/not-found reporting. `shared-link.controller.ts:155,177`, `shared-link.service.ts:148,191`.
- **Public access path** — link is consumed via a `key` query param (and/or `slug`) carried as headers `x-immich-share-key` / `x-immich-share-slug`; auth guard resolves it to a `sharedLink` auth context. Endpoints opt in with `sharedLink: true` (e.g. album get, map markers, asset thumbnail). `enum.ts:23,32`, `album.controller.ts:60`.
- **Password flow** — for password-protected links: `POST /shared-links/login` checks the password, then issues a token stored in cookie `immich_shared_link_token` (comma-joined to support multiple links). `GET /shared-links/me` returns the current link, rejecting if password set and token absent. Token = `sha256(id-password)` base64. `shared-link.service.ts:26,46`, `controllers/shared-link.controller.ts:70` (login), `:92` (me).
- **Metadata stripping** — when `showExif=false`, asset metadata is stripped from responses; OpenGraph preview tags are suppressed for password-protected links. `shared-link.service.ts:60,209`.
- **List / search** — list all of a user's links, filter by `albumId` or `id`. `shared-link.controller.ts:62`.

### Partner sharing — `controllers/partner.controller.ts`, `dtos/partner.dto.ts`
- **Model** — directional: a user (`sharedById`) shares their whole library with another user (`sharedWithId`); PK is the pair. `schema/tables/partner.table.ts:25`.
- **Create / remove** — start/stop sharing with a partner (by `sharedWithId`). A deprecated `POST /partners/:id` variant exists. `partner.controller.ts:36,67`.
- **Update** — `inTimeline` toggle: whether the partner's assets appear in the user's main timeline. `partner.controller.ts:55`, `dtos/partner.dto.ts:16`.
- **List** — by `direction` (shared-by-me vs shared-with-me). `partner.controller.ts:23`, `dtos/partner.dto.ts:21`.
- **Access** — partner-shared assets are readable by the partner via an access-repo join (`partner.sharedWithId = userId`). `repositories/access.repository.ts:201`.

## 3. Data model (abstract)

| Table | Key columns | Notes |
|---|---|---|
| `album` | id, albumName (default), description, albumThumbnailAssetId (FK asset, SET NULL), order (enum), isActivityEnabled (bool), createdAt, updatedAt, deletedAt (soft delete) | cover + ordering live here. `album.table.ts` |
| `album_asset` | (albumId, assetId) composite PK, createdAt | membership join; CASCADE on both FKs. `album-asset.table.ts` |
| `album_user` | (albumId, userId) composite PK, role enum (owner/editor/viewer) | unique partial index: one `owner` per album. `album-user.table.ts` |
| `shared_link` | id, userId (FK), key (bytea, unique), type (ALBUM/INDIVIDUAL), albumId (nullable FK), description, password (nullable), slug (nullable unique), expiresAt (nullable), allowUpload, allowDownload, showExif | one row per link. `shared-link.table.ts` |
| `shared_link_asset` | (assetId, sharedLinkId) composite PK | for INDIVIDUAL links. `shared-link-asset.table.ts` |
| `partner` | (sharedById, sharedWithId) composite PK, inTimeline (bool), createdAt | directional library share. `partner.table.ts` |
| `activity` | id, albumId (FK), userId (FK), assetId (nullable FK), comment (nullable), isLiked (bool) | like XOR comment (check constraint); unique like per (asset,user,album). `activity.table.ts` |

(Reference also keeps `*_audit` tables for sync; not needed for parity.)

## 4. API surface

Albums (`/albums`):
- `GET /albums` (list, filters) · `POST /albums` (create) · `GET /albums/statistics` · `GET /albums/:id` (sharedLink-accessible) · `PATCH /albums/:id` (metadata/cover/order) · `DELETE /albums/:id`
- `GET /albums/:id/map-markers` · `PUT /albums/:id/assets` (add) · `PUT /albums/assets` (multi-album add) · `DELETE /albums/:id/assets` (remove)
- `PUT /albums/:id/users` (share) · `PUT /albums/:id/user/:userId` (role) · `DELETE /albums/:id/user/:userId` (remove/leave)

Shared links (`/shared-links`):
- `GET /shared-links` (list) · `POST /shared-links` (create) · `GET /shared-links/:id` · `PATCH /shared-links/:id` · `DELETE /shared-links/:id`
- `POST /shared-links/login` (password) · `GET /shared-links/me` (current link) · `PUT /shared-links/:id/assets` · `DELETE /shared-links/:id/assets`

Partners (`/partners`):
- `GET /partners?direction=` · `POST /partners` · `POST /partners/:id` (deprecated) · `PUT /partners/:id` (inTimeline) · `DELETE /partners/:id`

Activities (`/activities`):
- `GET /activities` (by album/asset) · `POST /activities` (like/comment) · `GET /activities/statistics` · `DELETE /activities/:id`

## 5. Find today + GAP

Find routers present: auth, cluster(s), config, duplicates, feedback, gallery, people, search, status, upload, vault. Models: cluster, face, feedback, invite, join_request, media, person, session, user, vault. **No album, album_asset, album_user, shared_link, partner, or activity** — entire lane is greenfield.

- `invite.py` (`InviteToken`) and `join_request.py` (`JoinRequest`) are **instance-onboarding**, not content sharing: an admin mints a single-use, SHA-256-hashed invite token; a prospective user submits a join request (username + bcrypt-style password hash + optional invite FK + pending/approved status) for admin approval. They share *nothing* with the album/shared-link/partner model and should not be conflated. (`backend/src/find_api/models/invite.py`, `join_request.py`.)
- **GAP — everything**: album CRUD + membership + roles + cover + ordering; shared links (album & individual, password/expiry/slug/upload/download/metadata flags + public key/slug access); partner sharing; optional activity feed. Permission model and per-resource access checks must be built; Find has only user/session auth today.

## 6. Security notes

- **Shared-link password is stored and compared in plaintext** in the reference (`password !== dto.password`, `shared-link.service.ts:38`). **Do not copy this.** Find should hash share-link passwords (the codebase already hashes invite tokens with SHA-256 and join-request passwords — reuse that discipline). At minimum constant-time compare; preferably a slow hash.
- **Capability key** — the random 50-byte `key` is the bearer capability for public access; it must be unguessable (CSPRNG), unique-indexed, and never logged. Slugs are public/guessable, so slug access must still resolve to the same scoped permissions, not bypass them.
- **Access scoping** — every shared-link/album read must be scoped to exactly the linked album/assets; the reference enforces this via an access repository join layer (`access.repository.ts`). Public (shared-link) auth must never widen to the owner's whole library. Album endpoints that accept `sharedLink: true` must strip metadata when `showExif=false` and block download when `allowDownload=false`.
- **Permission enforcement** — reference uses fine-grained permissions (`album.*`, `albumAsset.*`, `albumUser.*`, `sharedLink.*`, `partner.*`, `AlbumShare`, `AssetShare`). Find needs an equivalent owner/editor/viewer check on every album mutation and an ownership check on every shared-link mutation.
- **Expiry** — `expiresAt` must be enforced server-side on every access, not just hidden in UI.
- **Partner direction** — partner access is one-directional; ensure `sharedWithId` can read but not mutate the sharer's assets.

## 7. Effort estimate

| Feature | Size | Rationale |
|---|---|---|
| Album CRUD + cover + ordering | **M** | 2 tables, soft delete, metadata update |
| Album asset membership (incl. bulk/multi-album) | **M** | join table + per-asset result reporting |
| Album user roles / sharing | **M** | role enum, owner-uniqueness, access checks |
| Shared links (album + individual, all flags) | **L** | key gen, slug uniqueness, password hashing, public access path, metadata stripping, expiry, asset membership |
| Partner sharing | **S–M** | one table, directional access join, timeline toggle |
| Activity feed (likes/comments) | **M** | constraints, statistics, optional for v1 |
| Permission/access-control layer (shared dep) | **L** | cross-cutting; gates all of the above |
