# Find

Find is a local-first AI image intelligence platform for uploading, indexing, searching, and clustering images on your own machine.

All image processing, vector generation, and search stay inside your local stack.

## What It Does

- Upload individual images or ZIP archives
- Extract captions, detected objects, OCR text, EXIF metadata, and image dimensions
- Generate hybrid image embeddings for semantic search
- Automatically cluster related images after indexing completes
- Browse a gallery, inspect image details, like/delete media, and review cluster members

## Stack

- Frontend: Next.js 16.2, React 19, React Query, Tailwind CSS, Biome
- Backend: FastAPI, SQLAlchemy, PostgreSQL, pgvector, Redis, RQ, MinIO
- ML pipeline:
  - Object detection: YOLOv10
  - Captioning: Florence-2
  - OCR: PaddleOCR
  - Embeddings: SigLIP via `open-clip`
  - Clustering: HDBSCAN

## Architecture

```text
Next.js frontend
    |
    v
FastAPI API
    |
    +--> PostgreSQL + pgvector  (metadata, embeddings, clusters)
    +--> MinIO                  (image object storage)
    +--> Redis + RQ             (background analysis and clustering jobs)
            |
            v
        ML worker
```

## Core Flow

1. The frontend uploads images to `/api/upload` or `/api/upload/bulk`.
2. The backend stores files in MinIO and creates `media` rows in PostgreSQL.
3. Each upload is queued for background processing through RQ.
4. The worker extracts metadata and generates the hybrid embedding.
5. After indexing succeeds, the backend automatically queues a clustering job.
6. The frontend polls job status and updates gallery/search/cluster views.

## One-Command Start

From the repository root:

```bash
docker compose up --build
```

This is the intended demo command.

Notes:

- The current Docker setup is GPU-oriented and expects NVIDIA GPU access.
- If you already have a root `.env`, Docker Compose will use it.
- If you do not have a `.env`, the compose file now provides sensible defaults for local demo startup.

## URLs

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- MinIO API: `http://localhost:9000`
- MinIO console: `http://localhost:9001`

## Configuration

The included `.env.example` matches the current stack.

Important variables:

```env
DATABASE_URL=postgresql://find:find123@db:5432/find

MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=images
MINIO_SECURE=false
MINIO_PUBLIC_READ=false
MINIO_PUBLIC_ENDPOINT=http://localhost:9000/images

REDIS_URL=redis://redis:6379

NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MINIO_BUCKET=images
NEXT_PUBLIC_MINIO_URL=http://localhost:9000

CLIP_MODEL=ViT-B-16-SigLIP
CLIP_PRETRAINED=webli
BLIP_MODEL=microsoft/Florence-2-base
YOLO_MODEL=yolov10b.pt
USE_GPU=true
```

## Privacy Model

- Images stay in your local MinIO instance
- Search embeddings stay in your local PostgreSQL database
- The frontend now uses backend-issued image URLs, so private MinIO mode works correctly
- Public object access is optional and disabled by default

## Main Pages

- `/upload`
  - Upload individual files or ZIP archives
  - Live job status polling for indexing progress
  - Automatic clustering notice and post-upload shortcuts
- `/gallery`
  - Paginated media browser
  - Like, download, delete, and image detail modal
  - Detail view includes caption, objects, OCR text, and metadata
- `/search`
  - Natural-language semantic search over indexed images
  - Similarity score and overlay metadata in results
- `/clusters`
  - Automatic cluster discovery view
  - Manual re-clustering trigger with job status
  - Cluster detail modal with member previews and captions

## Backend Endpoints

- `POST /api/upload`
- `POST /api/upload/bulk`
- `GET /api/status/{job_id}`
- `GET /api/gallery`
- `GET /api/image/{media_id}`
- `POST /api/image/{media_id}/like`
- `DELETE /api/image/{media_id}`
- `GET /api/search?q=...`
- `GET /api/clusters`
- `GET /api/cluster/{cluster_id}`
- `POST /api/cluster/run`

## Data Model

### `media`

Stores:

- file hash
- object storage key
- filename and content type
- processing status
- EXIF metadata
- AI metadata JSON
- liked flag
- cluster ID
- pgvector embedding

### `clusters`

Stores:

- cluster type
- optional label and description
- member image IDs
- member count
- centroid vector

## Clustering Behavior

- Clustering runs automatically after indexing jobs finish.
- Manual clustering is still exposed in the frontend for demos and refreshes.
- Each clustering run rebuilds cluster state from the current indexed dataset.
- Stale cluster rows and stale `cluster_id` references are cleared before rebuilding.

## Local Development

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Database Notes

- The backend creates tables on startup.
- PostgreSQL `vector` extension is enabled automatically when available.
- `backend/migrate_db.py` is included for vector column maintenance tasks.

## Demo Tips

- Upload a small themed batch first, such as pets, street scenes, or documents.
- Wait for upload jobs to finish indexing on the upload page.
- Show gallery detail view to demonstrate extracted caption, objects, and OCR text.
- Run a semantic search with a natural language sentence.
- Open the clusters page to show automatic grouping and drill into a cluster.

## Troubleshooting

### Images do not render

- Confirm the API is returning image `url` values from MinIO.
- If you enabled public MinIO reads, set `MINIO_PUBLIC_ENDPOINT` consistently.

### Clusters do not appear

- Make sure multiple images have completed indexing.
- Check the worker logs.
- Trigger clustering manually from `/clusters` if you want an immediate rerun.

### Slow first run

- Model downloads happen on the first startup.
- Cached models are stored in the Docker volume mounted at `model_cache`.

## License

MIT
