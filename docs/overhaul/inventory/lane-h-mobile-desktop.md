# Lane H — Mobile & Desktop Client Surface (Foundation Planning)

Read-only discovery. Reference = Immich-style Flutter app at `reference-app/mobile/`. Find = Tauri desktop shell + React/Next.js web UI, no mobile app yet. This is foundation-only (Phase 8) planning; nothing here is committed scope.

## 1. Reference mobile feature surface

Feature areas, enumerated from folder/file names (not implementation):

- **Timeline / library** — main photo grid, folders, locked (private) area, partner sharing. `reference-app/mobile/lib/pages/library/` (`folder`, `locked`, `partner`, `shared_link`)
- **Backup / upload** — album-selection backup, upload detail, backup options. `reference-app/mobile/lib/pages/backup/`
- **Login / multi-server / auth** — login, change password. `reference-app/mobile/lib/pages/login/` + `services/auth.service.dart`, `oauth.service.dart`, `server_info.service.dart`
- **Search (incl. map)** — search surface with map view. `reference-app/mobile/lib/pages/search/map/` + `services/search.service.dart`, `map.service.dart`
- **Settings** — app settings, sync status, custom request headers. `reference-app/mobile/lib/pages/settings/` + `pages/common/headers_settings.page.dart`
- **Share intent** — receive shared content from other apps. `reference-app/mobile/lib/pages/share_intent/` + `services/share_intent_service.dart`
- **Shared links** — public/shared link viewing. `reference-app/mobile/lib/pages/library/shared_link/` + `services/shared_link.service.dart`
- **Common shell** — tab shell, splash, app logs, download panel. `reference-app/mobile/lib/pages/common/`
- **Cross-cutting services** — activity feed, downloads, people/faces, casting (gcast), local auth (biometric), localization, network/connectivity, home-screen widgets, deep links. `reference-app/mobile/lib/services/`

## 2. Mobile-specific capabilities (future Find scope)

Things only a native mobile app does — these have no desktop/web equivalent and would be net-new for Find:

- **Background auto-backup / upload** of camera roll. `services/background_upload.service.dart`, `foreground_upload.service.dart`, `platform/background_worker_api.g.dart`
- **Local device photo sync & native gallery access** — reading on-device albums/assets, native thumbnails. `platform/native_sync_api.g.dart`, `local_image_api.g.dart`, `thumbnail_api.g.dart`
- **Device albums** — selecting which local albums to back up. `pages/backup/drift_backup_album_selection.page.dart`
- **Share-to (OS share sheet ingest)** — receiving images from other apps. `pages/share_intent/`, `platform/view_intent_api.g.dart`
- **OS integrations** — runtime permissions, connectivity awareness, biometric lock, home-screen widgets, casting. `platform/permission_api.g.dart`, `connectivity_api.g.dart`, `services/local_auth.service.dart`, `widget.service.dart`, `gcast.service.dart`

These are the hard parts of any mobile client; the photo-browsing UI itself is comparatively cheap.

## 3. Desktop (Tauri) path

Find already has a working Tauri 2 shell that wraps the existing React/Next.js web UI — a desktop client is largely free:

- `frontend/src-tauri/` confirmed: `tauri.conf.json` (productName "Find", `frontendDist: ../out`, `devUrl: localhost:3000`, `bundle.targets: all`), Rust `src/{main,lib}.rs`, `capabilities/default.json`, `icons/`, `gen/`, `build.rs`.
- The web UI (React 19 / Next 16 / Tailwind / Zustand / TanStack Query / axios) renders inside the Tauri webview unchanged — same components serve web and desktop.

What's still needed for a real desktop client (small, incremental):
- Static export pipeline feeding `../out` (Next config / build step).
- Tauri capability/permission tuning in `capabilities/default.json` for any native calls.
- Desktop niceties: native file dialogs for upload, optional folder-watch / local import, auto-update, window/menu polish.
- CI to bundle per-OS installers (`targets: all` already set).

Verdict: desktop is a cheap win — reuse the web UI, add file/import affordances. No second codebase.

## 4. Mobile spike recommendation — RN vs Flutter

Find's entire stack is React/TypeScript (React 19, Zustand, TanStack Query, axios) and the desktop client already reuses those components. For a mobile spike I recommend **React Native (with Expo)** over Flutter. Rationale: RN lets us reuse the team's existing React/TS skills, share non-UI logic (API client, types, query/state layer, validation) with the web and Tauri apps, and keep one language across the whole product. Flutter would be a separate Dart codebase and skillset with near-zero shared code, despite the reference app being Flutter — copying its architecture is not a reason to adopt its language. The main RN caveat is that the mobile-specific hard parts (background upload, native gallery/album sync, share intents, biometric lock) lean on native modules; Expo covers media library, image picker, background tasks, and secure store, but background auto-backup is the one area where RN needs care and possibly custom native modules. That risk exists in any framework. Recommendation: a thin RN/Expo spike that proves login (multi-server), timeline browsing against Find's API, and a basic manual upload — defer background auto-backup to a later milestone.

## 5. Effort estimate

Foundation-only, Phase 8. Desktop (Tauri) is **small** — the shell exists and the web UI drops in; mostly export pipeline + file affordances + installer CI. Mobile is **large** if pursued fully: a new RN/Expo app, native modules for the device-sync/backup/share-intent capabilities in section 2, and parity work on timeline/search/albums/sharing. Recommend scoping the mobile effort as a narrow spike first (browse + manual upload) and treating background auto-backup as its own large follow-on.
