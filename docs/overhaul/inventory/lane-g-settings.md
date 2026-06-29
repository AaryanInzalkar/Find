# Lane G — Settings Panel Inventory & Spec

Read-only discovery of the reference app's settings architecture, compared against Find's
current config surface, to drive Find's Phase 5 settings spec.

Reference settings split into two tiers:
- **User preferences** (per-user, self-service) — `web/src/routes/(user)/user-settings/`
  backed by `server/src/dtos/user-preferences.dto.ts`.
- **System config** (admin-only, instance-wide) — `web/src/routes/admin/system-settings/`
  backed by `server/src/dtos/system-config.dto.ts` (`SystemConfigSchema`).

---

## 1. Reference Settings Taxonomy

### 1A. User preferences (per-user)

Panels: `web/src/routes/(user)/user-settings/UserSettingsList.svelte:50-107` mounts each
section in a `SettingAccordion`. Field schema: `server/src/dtos/user-preferences.dto.ts`.

| Group | Field | Control | Purpose | Cite |
|---|---|---|---|---|
| **App / Appearance** | theme: system vs light/dark | Switch + theme manager | Color theme preference | `AppSettings.svelte:67-71` |
| | use browser locale | Switch | Auto-detect language | `AppSettings.svelte:76-77` |
| | custom locale | Combobox (locale list) | Manual language pick | `AppSettings.svelte:81-87` |
| | display original photos | Switch | Show originals vs thumbnails | `AppSettings.svelte:92` |
| | video hover autoplay | Switch | Hover-to-play | `AppSettings.svelte:96` |
| | video viewer autoplay / loop / play original | Switch ×3 | Video playback prefs | `AppSettings.svelte:101-111` |
| | permanent deletion warning | Switch | Confirm-on-delete | `AppSettings.svelte:115` |
| **Account** | profile (name, email, avatar color) | Text + color picker | Identity | `UserProfileSettings.svelte`; avatar color `user-preferences.dto.ts:14-19` |
| | change password | Form | Credential rotation | `ChangePasswordSettings.svelte` |
| | PIN code (create/change) | Form | Vault/secure-folder PIN | `PinCodeSettings.svelte` |
| **API keys** | key list (create/revoke) | Grid/list | Programmatic access tokens | `UserApiKeyList.svelte` |
| **Authorized devices** | session/device list | List + revoke | Active session management | `DeviceList.svelte`, `DeviceCard.svelte` |
| **Download** | archive size (bytes) | Number | Max zip size | `user-preferences.dto.ts:78-84` |
| | include embedded videos | Switch | Bundle motion-photo video | same |
| **Features** (per-user toggles) | folders (enabled, sidebarWeb) | Switch ×2 | Folder view | `user-preferences.dto.ts:36-42` |
| | people (enabled, sidebarWeb, minimumFaces) | Switch ×2 + Number | Face/people UI | `user-preferences.dto.ts:44-51` |
| | tags (enabled, sidebarWeb) | Switch ×2 | Tag UI | `user-preferences.dto.ts:61-67` |
| | sharedLinks (enabled, sidebarWeb) | Switch ×2 | Shared-link UI | `user-preferences.dto.ts:53-59` |
| | memories (enabled, duration) | Switch + Number | Memories feature | `user-preferences.dto.ts:21-27` |
| | ratings (enabled) | Switch | Star ratings | `user-preferences.dto.ts:29-34` |
| | cast (gCastEnabled) | Switch | Google Cast | `user-preferences.dto.ts:94-99` |
| | albums (defaultAssetOrder) | Select (asc/desc) | Default sort | `user-preferences.dto.ts:6-12` |
| **Notifications** | email notifications (enabled, albumInvite, albumUpdate) | Switch ×3 | Email opt-in | `user-preferences.dto.ts:69-76` |
| **OAuth** | unlink OAuth account | Button | Per-user identity link | `OauthSettings.svelte` |
| **Partner sharing** | partner list | List | Share whole library w/ partner | `PartnerSettings.svelte` |
| **Purchase** | support badge, hide-buy-until | Switch + date | Donation nag (skip for Find) | `user-preferences.dto.ts:86-92` |

### 1B. System config (admin, instance-wide)

Root: `SystemConfigSchema` `system-config.dto.ts:401-427`. Panels in
`web/src/routes/admin/system-settings/*.svelte` (one file per group).

| Group | Key fields | Control types | Cite |
|---|---|---|---|
| **Machine Learning** | enabled; urls[]; availabilityChecks(enabled/timeout/interval); clip; duplicateDetection; facialRecognition; ocr | Switch, URL-list, nested model-config | `system-config.dto.ts:173-183`; per-model `model-config.dto.ts` (modelName, enabled, minScore, maxDistance) |
| **Image / Thumbnails** | thumbnail(format/quality/size/progressive); preview(same); fullsize(enabled/format/quality); colorspace; extractEmbedded | Select, Number(1-100 quality), Switch | `system-config.dto.ts:360-386` |
| **FFmpeg / Transcode** | crf, threads, preset, target/accepted video+audio codecs, containers, resolution, maxBitrate, bframes, refs, gopSize, temporalAQ, cqMode, twoPass, **preferredHwDevice**, transcode policy, **accel (HW accel)**, accelDecode, tonemap, realtime.enabled | Number, Select, multi-Select, Switch, **HW-accel Select** | `system-config.dto.ts:92-121`; accel enum `enum.ts:502-513` |
| **Jobs / Concurrency** | per-job-type concurrency: thumbnailGeneration, metadataExtraction, videoConversion, faceDetection, smartSearch, ocr, search, library, sidecar, migration, backgroundTask, notifications, workflow, editor, integrityCheck | Number (min 1) each | `system-config.dto.ts:38-42,123-141` |
| **Storage Template** | enabled; hashVerificationEnabled; template string (year/month/day/preset tokens) | Switch + template editor | `system-config.dto.ts:335-354`; UI `admin-settings/StorageTemplateSettings.svelte` |
| **Library** | scan(enabled, cronExpression); watch(enabled) | Switch + cron | `system-config.dto.ts:143-156` |
| **Server** | externalDomain, loginPageMessage, publicUsers | Text/URL, Switch | `system-config.dto.ts:287-298` |
| **OAuth (system)** | enabled, issuerUrl, clientId/Secret, scope, prompt, autoLaunch, autoRegister, buttonText, signing algos, claims, mobile override/redirect, timeout, allowInsecure, defaultStorageQuota | Switch, Text, Number | `system-config.dto.ts:220-272` |
| **Password login** | enabled | Switch | `system-config.dto.ts:274-276` |
| **Notifications (SMTP)** | smtp(enabled, from, replyTo, transport{host,port,secure,username,password,ignoreCert}) | Switch, Text, Number | `system-config.dto.ts:300-322` |
| **Templates (email)** | albumInvite/welcome/albumUpdate templates | Textarea | `system-config.dto.ts:324-333` |
| **Trash** | enabled, days | Switch + Number | `system-config.dto.ts:388-393` |
| **Backup (DB)** | database(enabled, cronExpression, keepLastAmount) | Switch, cron, Number | `system-config.dto.ts:58-90` |
| **Nightly tasks** | startTime; databaseCleanup, missingThumbnails, clusterNewFaces, generateMemories, syncQuotaUsage | Time + Switch ×5 | `system-config.dto.ts:204-218` |
| **Integrity checks** | missingFiles/untrackedFiles (enabled+cron); checksumFiles (+timeLimit, percentageLimit) | Switch, cron, Number | `system-config.dto.ts:66-88` |
| **Logging** | enabled, level | Switch + Select | `system-config.dto.ts:158-163` |
| **Map** | enabled, lightStyle URL, darkStyle URL | Switch + URL | `system-config.dto.ts:185-191` |
| **Reverse geocoding** | enabled | Switch | `system-config.dto.ts:278-280` |
| **Metadata** | faces.import | Switch | `system-config.dto.ts:282-285` |
| **New version check** | enabled, channel (stable/RC) | Switch + Select | `system-config.dto.ts:200-202` |
| **Theme (system)** | customCss | Textarea | `system-config.dto.ts:356-358` |
| **User (system)** | deleteDelay | Number | `system-config.dto.ts:395-399` |

---

## 2. Find Settings Spec (proposed Phase 5)

Find is a small-team / self-host photo app. Collapse the reference's two-tier
(user-prefs + 20-group admin) model into **6 pragmatic groups**. Single settings page
with sections; admin-only sections gated by role.

### General
- Appearance handled separately below. Server identity: external URL / login message — **skip for now** (YAGNI until multi-instance).
- New-version check (enabled) — **keep** (open-source, useful). Channel — skip.

### Library / Storage
- Storage backend display (minio/local) — read-only status (already in `core/config.py:77`).
- Trash: enabled + retention days — **keep** (map `SystemConfigTrashSchema`).
- Storage template — **YAGNI-skip** Phase 5 (Find uses object-store keys, not path templates).
- Library scan/watch cron — **skip** unless Find adds external-library import.
- Upload limits (max size, bulk count) — surface read-only from `core/config.py:58-61`.

### Machine Learning
- ML enabled toggle.
- **ML mode**: full / mock / remote (Find already has `ML_MODE` `core/config.py:43`).
- Remote ML: URL + API key + features + strip-EXIF (Find already has these `core/config.py:44-47`).
- Per-task toggles: captioning, detection, OCR, face clustering, embedding — map to Find's
  `REMOTE_ML_FEATURES` and `ml/*` modules. Confidence thresholds (minScore/maxDistance) —
  optional advanced.
- Model names (CLIP/BLIP/YOLO) — advanced/read-only (`core/config.py:50-53`).
- **Hardware acceleration toggle lives here** (see §3).

### Sharing
- Shared links: enabled, default expiry — **keep** (Find has sharing per Lane B).
- Partner sharing — **YAGNI-skip** Phase 5.
- Public users / OAuth — **skip** Phase 5 (Find auth is small-team session-based,
  `core/config.py:72-74`); revisit if OAuth added.

### Appearance (per-user)
- Theme: system / light / dark (map `AppSettings.svelte:67`).
- Language / locale (map `AppSettings.svelte:76-87`).
- Display original vs thumbnail, video autoplay/loop/hover (map `AppSettings.svelte:92-111`).
- Default gallery sort order (map `albums.defaultAssetOrder`) — fits Find's existing
  gallery sort (recent commit #249).
- Permanent-deletion confirm toggle.

### Advanced
- Job concurrency — single global or a few sliders (Find has `CLUSTERING_N_JOBS`
  `core/config.py:69`, `BATCH_SIZE`, `WORKER_TIMEOUT`). Map a subset, not all 15 reference job types.
- Model lifecycle: idle TTL, max loaded models (Find has `ML_MODEL_IDLE_TTL_SECONDS`,
  `ML_MAX_LOADED_MODELS` `core/config.py:48-49`).
- Custom CSS, logging level — optional.

**Skip wholesale for Phase 5**: FFmpeg/transcode (Find is photo-first — no video transcode
pipeline yet), SMTP/email templates, DB backup cron, integrity checks, nightly tasks, map,
reverse geocoding, purchase/donation, Google Cast, API-key grid (unless Find ships API keys),
storage template, OAuth system config.

---

## 3. Hardware-Acceleration Placement (Auto / GPU / CPU)

**Toggle lives in: Machine Learning settings group**, as a top-level "Compute device"
control — NOT under transcode. Find is photo/ML-first; the reference puts HW accel under
FFmpeg (`system-config.dto.ts:112` `accel`) because its accel is for *video transcode*.
Find's accel is for *ML inference* (CLIP/YOLO/Florence), so it belongs with ML.

- **Control**: 3-option Select/segmented — `Auto` | `GPU` | `CPU`.
  - `Auto` = detect CUDA/MPS, fall back to CPU (recommended default).
  - `GPU` = force CUDA/accelerator (error if unavailable).
  - `CPU` = force CPU.
- **Maps to Find's existing `USE_GPU` bool** (`core/config.py:54`) — upgrade from bool to
  tri-state enum (`Auto/GPU/CPU`). Also gates `YOLO_HALF` (`core/config.py:55`,
  GPU-only fp16) and informs `CLUSTERING_BACKEND` (`core/config.py:70`).
- **Backend capability report needed** — a new endpoint (extend `routers/config.py`, which
  today returns only `ml_mode`) returning:
  ```
  { "accel": {
      "available_devices": ["cpu", "cuda:0"],   # detected
      "cuda_available": bool, "mps_available": bool,
      "device_names": ["NVIDIA RTX ...", ...],
      "current_mode": "auto|gpu|cpu",
      "effective_device": "cuda:0|cpu",          # what Auto resolved to
      "fp16_supported": bool
  }}
  ```
  Detection source: `torch.cuda.is_available()` / `torch.backends.mps.is_available()`,
  used by `core/model_manager.py` (already references device/cuda). The UI uses this to
  disable "GPU" when no accelerator is present and to show the resolved device under "Auto".

---

## 4. Find Today + GAP

**`backend/src/find_api/routers/config.py` (entire file, 21 lines)** exposes a single
read-only endpoint `GET /config` returning only `{ "ml_mode": settings.ML_MODE }`.
No write/update endpoint, no user preferences, no system config surface.

**Existing accel / ML config** in `backend/src/find_api/core/config.py` (env/Pydantic, not
user-editable at runtime):
- `ML_MODE` full/mock/remote (43); `REMOTE_ML_URL`/`_API_KEY`/`_STRIP_EXIF`/`_FEATURES` (44-47);
  remote-ml validated by `validate_remote_ml_config` model_validator (101-121); tested in
  `test_remote_ml_config.py`.
- `USE_GPU: bool` (54), `YOLO_HALF` (55) — the only accel knobs today, env-only, boolean.
- Model lifecycle `ML_MODEL_IDLE_TTL_SECONDS`, `ML_MAX_LOADED_MODELS` (48-49); model names (50-53).
- Clustering `CLUSTERING_N_JOBS`, `CLUSTERING_BACKEND` (69-70); `BATCH_SIZE`, `WORKER_TIMEOUT` (62-63).
- Storage `STORAGE_BACKEND` + aliases (76-86); trash has **no** config (gap vs reference).

**GAP**: No settings UI anywhere. `frontend/src/app/` has clusters, duplicates, gallery,
people, search, upload, vault — **no `settings/` route** (confirmed). All config is
env-var / Pydantic only; nothing user-editable at runtime; no per-user preferences concept;
`/config` is read-only and exposes one field.

---

## 5. Persistence Note

Two tiers, like the reference:

- **System config** (ML mode, accel device, trash days, job concurrency, model lifecycle):
  persist in DB (new `app_config` / `system_config` table, single-row or key-value JSON),
  layered over env defaults from `core/config.py`. On startup, env provides defaults; DB
  overrides where set. Expose via new authenticated `GET/PUT /config/system` (extend
  `routers/config.py`). Reference does exactly this — `system-config.service.ts` persists the
  `SystemConfigSchema` and merges with env/file defaults.
- **User preferences** (theme, locale, gallery sort, video autoplay, deletion confirm):
  per-user row/JSON column on the user table; `GET/PUT /config/preferences`. For appearance
  prefs that are purely client-side (theme, locale), localStorage is acceptable Phase 5,
  with DB sync as a later enhancement.

Keep the read-only public `GET /config` for unauthenticated bootstrap (ml_mode, accel
capability, feature flags); gate writes by auth/role.

---

## 6. Effort Estimate

**M (Medium).**
- New DB table + migration for system config + user prefs JSON: S.
- Backend: extend `routers/config.py` with authenticated GET/PUT for system + preferences,
  accel capability report (torch device detection), wire `USE_GPU` → tri-state: S–M.
- Frontend: brand-new settings route + 6 accordion sections, forms wired to API: M (largest
  piece — no existing settings UI to extend).
- Total ~M; the accel tri-state + capability endpoint is the only novel backend logic, the
  rest is CRUD + form plumbing. Scoping to the 6 groups (and skipping FFmpeg/SMTP/backup/etc.)
  keeps it out of L territory.
