# Replicate MusicGen Fine-Tuner — Training Reference

Training-only technical reference for `sakemin/musicgen-fine-tuner` on Replicate.

---

## What "Training" Means

Training is a **one-shot fine-tuning job** that:
- Starts from a base Meta MusicGen checkpoint
- Fine-tunes only the **MusicGen autoregressive Transformer**
- Produces a **new model version** under a destination model you own

> Each training run is isolated. You cannot resume or incrementally fine-tune from a prior run.

---

## Hardware & Cost

- 8× NVIDIA A100 (80GB)
- **$0.0112 / second**
- Default runtime: ~15 minutes

Post-run metrics:
- `metrics.predict_time` (compute only)
- `metrics.total_time` (wall time)

---

## Authentication

```bash
export REPLICATE_API_TOKEN=r8_**********************************
```

Each training requires a **destination model** you own: `<owner>/<model-name>`

---

## API Endpoints

### Create Training

```
POST /v1/models/{model_owner}/{model_name}/versions/{version_id}/trainings
```

**Required:** `destination`, `input`  
**Optional:** `webhook`, `webhook_events_filter`

### Get Training (Polling)

```
GET /v1/trainings/{training_id}
```

Returns: `status`, `output.version`, `output.weights`, `metrics.*`

### List Trainings

```
GET /v1/trainings
```

---

## Training Status

| Status | Meaning |
|--------|---------|
| `starting` | Worker allocation / container startup |
| `processing` | Training executing |
| `succeeded` | Completed successfully |
| `failed` | Error during training |
| `canceled` | User-initiated cancellation |

---

## Polling vs Webhooks

**Polling** (recommended for most UIs):
- Store `training.id`
- Poll `/v1/trainings/{id}`
- Stop on terminal state

**Webhooks** (optional):
- HTTPS only, no redirects
- Requests may retry → handlers must be idempotent
- Events: `start`, `output`, `logs`, `completed`

---

## Dataset Requirements

### Accessibility (Hard Requirement)

> `dataset_path` **must** be publicly fetchable over HTTPS.

✅ Public bucket URLs, signed URLs (S3, R2, Supabase)  
❌ Auth-only endpoints, localhost, private buckets

### Format

Accepted: `.zip`, `.tar`, `.gz`, `.tgz` containing `.wav`, `.mp3`, `.flac`

**Duration rules:**
- Minimum: >5 seconds
- Auto-chunked at 30s
- Recommend: ≥30s per file

---

## Audio Preprocessing

The pipeline automatically:
- Resamples & normalizes
- Chunks at 30s
- Optional Demucs vocal removal (`"drop_vocals": true`, default enabled)
- Creates training manifest

---

## Text Conditioning

**Auto-labeling** extracts: genre, mood, instrumentation, key, BPM

**Manual options:**
- `one_same_description` — single description for all files
- Per-file `.txt` — `songname.mp3` + `songname.txt`
- Empty string `""` — auto-labels only

> **Critical:** Inference prompts must overlap training descriptions to activate learned style.

---

## Model Variants

| Variant | Notes |
|---------|-------|
| `small` | Fastest, supports continuation |
| `medium` | Better quality, supports continuation |
| `melody` | Melody-conditioned, 30s max, no continuation |
| `stereo-small` | Stereo output |
| `stereo-medium` | Stereo, max batch 8 |
| `stereo-melody` | Stereo, 30s max, no continuation |

Large model is **not trainable**.

---

## Hyperparameters

**Defaults:**
```json
{ "epochs": 3, "updates_per_epoch": 100, "lr": 1 }
```

**For reduced overfitting:**
```json
{ "epochs": 5, "updates_per_epoch": 1000, "lr": 0.0001 }
```

**Batch size:** Must be divisible by 8. Medium/stereo-medium max: 8.

---

## Training Pipeline

```
Audio ZIP
  → preprocess (resample, normalize)
  → chunk / label
  → AudioCraft training (Dora + Hydra)
  → trained_model.tar
  → new Replicate model version
```

---

## Output Artifact

Produces `trained_model.tar` containing:
- `xp.cfg`
- Transformer weights

Availability may depend on account permissions.

---

## UI Parameter Mapping

| UI Label | API Field | Notes |
|----------|-----------|-------|
| Dataset URL | `dataset_path` | Public HTTPS required |
| Model Type | `model_version` | small / medium / melody |
| Description | `one_same_description` | Optional global prompt |
| Remove Vocals | `drop_vocals` | Default true |
| Epochs | `epochs` | Cost lever |
| Steps/Epoch | `updates_per_epoch` | Quality lever |

---

## Common Pitfalls

- **Private dataset URLs** — must be publicly accessible
- **Prompt mismatch** — inference prompts must echo training descriptions
- **Overfitting** — `lr=1` default is aggressive; reduce for better generalization
- **Batch size** — auto-floors to valid multiple of 8
- **Melody duration** — capped at 30s for melody variants
