# Hardware Acceleration Guide

Find runs its machine-learning pipelines (semantic embeddings, captioning,
object detection, face detection) on a GPU when one is available and **falls
back to CPU automatically** otherwise. This guide explains the acceleration
modes, how detection and fallback work, and how to configure them.

> **Design goal:** Find must run acceptably **with or without a GPU**, across
> macOS, Linux, Windows, and low-power/edge devices. There is no hard GPU
> dependency — a forced-GPU configuration with no GPU present quietly resolves
> to CPU instead of crashing.

## Acceleration modes

The mode is controlled by the `ACCEL_MODE` setting (and surfaced as a toggle in
the **Settings → Hardware acceleration** panel):

| Mode | Behavior |
|---|---|
| `auto` (default) | Use the best available accelerator; fall back to CPU silently when none is present. CPU is the expected baseline, not a failure. |
| `gpu` | Prefer the GPU. If no GPU execution path is available, **automatically fall back to CPU** and surface a non-blocking notice. |
| `cpu` | Force CPU regardless of available hardware. Works on any machine. |

## What gets detected

On startup (and whenever the settings panel requests it), Find probes the host
for accelerators. Every probe is failure-safe — a missing driver or library
degrades to "not available" rather than raising:

- **ONNX Runtime execution providers** — CUDA, ROCm, CoreML (Apple), DirectML
  (Windows). Used by the face-detection pipeline (InsightFace / ONNX).
- **PyTorch devices** — CUDA and MPS (Apple Metal). Used by the embedding
  (open_clip / SigLIP), captioning (Florence-2), and object-detection (YOLO)
  pipelines.
- **CPU** — always present as the floor.

You can inspect the detected capabilities and the resolved plan for the current
mode at:

```
GET /api/config/hardware
```

which returns the detected providers, whether a GPU is present, the resolved
device/provider list, and whether the current mode fell back to CPU (with a
human-readable notice when it did).

## How resolution + fallback works

Find separates **detection** (probe the host) from **resolution** (map the
requested mode + detected capabilities to what actually runs). Resolution is
deterministic:

- **PyTorch models** resolve to a device string: `auto`/`gpu` → `cuda` (or
  `mps` on Apple) when available, else `cpu`; `cpu` is always `cpu`.
- **ONNX models** resolve to an ordered execution-provider list. The list
  always ends with `CPUExecutionProvider`, so ONNX Runtime can fall back
  per-operator even if a GPU provider fails to initialize at session time.

When `gpu` is requested but no accelerator is available, the resolved plan sets
a fallback flag and a notice (shown in the settings panel) — the workload still
runs, on CPU.

## Configuration

Set the mode via environment variable (see `.env.example`):

```bash
# auto (default) | gpu | cpu
ACCEL_MODE=auto
```

Or change it at runtime from **Settings → Hardware acceleration**.

### Legacy `USE_GPU`

Earlier versions used a boolean `USE_GPU`. For backward compatibility,
`USE_GPU=false` is still honored as a hard CPU pin when `ACCEL_MODE` is left at
`auto`. New deployments should prefer `ACCEL_MODE`.

## CPU-only deployments

On a machine with no GPU, no configuration is required — `auto` resolves to CPU
and the full pipeline runs. For the lightest footprint, set `ACCEL_MODE=cpu`
explicitly. (CPU-friendly model variants such as a quantized embedding model are
tracked as a follow-on; the current models run on CPU, just slower than on GPU.)

## Troubleshooting

- **"Using CPU" when I expected GPU.** Check `GET /api/config/hardware`: if
  `capabilities.has_gpu` is `false`, the host's drivers/runtime aren't visible
  to Find (e.g. CUDA toolkit or `onnxruntime-gpu` not installed). The app still
  works on CPU.
- **A GPU is present but unused.** Confirm the matching runtime is installed
  (CUDA build of PyTorch / `onnxruntime-gpu`), then ensure `ACCEL_MODE` is
  `auto` or `gpu`.
- **Switching modes seems to have no effect.** Model handles are cached per
  mode; the cache key includes `ACCEL_MODE`, so a switch reloads the model on
  next use rather than mid-inference.
