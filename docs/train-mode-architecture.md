# Train Mode Architecture

This document explains how Train Mode works in the DAWA Dashboard, including database relationships, the prompt generation flow, and the export process.

---

## Database Schema

The Train Mode uses four main tables. The `training_items` table stores each audio + prompt pair.

```mermaid
erDiagram
    artists ||--o{ als_summaries : has
    artists ||--|| artist_profiles : has
    artists ||--o{ training_items : has
    als_summaries ||--o{ training_items : references

    artists {
        uuid id PK
        text name
    }

    artist_profiles {
        uuid id PK
        uuid artist_id FK
        jsonb master_schema
    }

    als_summaries {
        uuid id PK
        uuid artist_id FK
        text parse_id
        text als_filename
        jsonb summary
    }

    training_items {
        uuid id PK
        uuid artist_id FK
        uuid als_summary_id FK
        text parse_id
        text audio_path
        text prompt_path
        text prompt_text
        text status
    }
```

---

## Prompt Generation Flow

The `/api/train` route generates training prompts by combining the artist's style profile with track-specific data.

```mermaid
flowchart LR
    subgraph database [Supabase Database]
        AP[artist_profiles.master_schema]
        AS[als_summaries.summary]
    end

    subgraph api ["/api/train Route"]
        SP[TRAIN_SYSTEM_PROMPT]
        CTX[Context Message]
        OAI[OpenAI gpt-4o-mini]
    end

    AP -->|"global style"| CTX
    AS -->|"track data"| CTX
    SP -->|"system instructions"| OAI
    CTX -->|"user message"| OAI
    OAI --> OUT[prompt.txt]
```

### What Each Input Provides

| Input | Source | Purpose |
|-------|--------|---------|
| `master_schema` | `artist_profiles` table | Global artist style: genre, vocabulary, emotional tone, creative constraints |
| `summary` | `als_summaries` table | Track-specific: BPM, plugins, instruments, arrangement, density |
| `TRAIN_SYSTEM_PROMPT` | Hardcoded in route | Output format rules, example style, constraints |

### System Prompt Structure

The `TRAIN_SYSTEM_PROMPT` instructs the model to:
1. Output plain text only (no JSON, no markdown)
2. Write 1-2 dense, sync-ready sentences
3. End with `BPM: <number>`
4. Use `master_schema` for stylistic language
5. Use `summary` for track-specific details

---

## Full Train Mode Sequence

This diagram shows the complete user workflow from selecting a track to exporting the dataset.

```mermaid
sequenceDiagram
    participant User
    participant Dashboard
    participant TrainAPI as /api/train
    participant SaveAPI as /api/train/save
    participant ExportAPI as /api/train/export
    participant DB as Supabase DB
    participant Storage as Supabase Storage
    participant OpenAI

    User->>Dashboard: Select ALS from Project Library
    User->>Dashboard: Upload MP3 file
    User->>Dashboard: Click "Generate Prompt"

    Dashboard->>TrainAPI: POST {artistId, parseId}
    TrainAPI->>DB: SELECT master_schema FROM artist_profiles
    TrainAPI->>DB: SELECT summary FROM als_summaries
    TrainAPI->>OpenAI: system=TRAIN_SYSTEM_PROMPT, user=context
    OpenAI-->>TrainAPI: prompt text
    TrainAPI-->>Dashboard: {prompt, model, version}

    User->>Dashboard: Click "Save & Next"
    Dashboard->>SaveAPI: POST {audioBase64, promptText, ...}
    SaveAPI->>Storage: Upload audio.mp3
    SaveAPI->>Storage: Upload prompt.txt
    SaveAPI->>DB: INSERT INTO training_items
    SaveAPI-->>Dashboard: {success, trainingItemId}

    Note over User,Dashboard: Repeat for each track

    User->>Dashboard: Click "Export Dataset"
    Dashboard->>ExportAPI: POST {artistId}
    ExportAPI->>DB: SELECT * FROM training_items WHERE status=ready
    ExportAPI->>Storage: Download all audio + prompt files
    ExportAPI->>ExportAPI: Create zip with track-0001.mp3/txt naming
    ExportAPI->>Storage: Upload dataset.zip
    ExportAPI->>DB: UPDATE status=exported
    ExportAPI-->>Dashboard: {datasetUrl}
```

---

## Storage Structure

Files are organized by artist in the `dawa-exports` bucket:

```
dawa-exports/
└── artists/{artist-slug}/
    ├── training/{training-item-id}/
    │   ├── audio.mp3       ← uploaded by /api/train/save
    │   └── prompt.txt      ← uploaded by /api/train/save
    └── datasets/
        └── dataset-{timestamp}.zip   ← created by /api/train/export
```

---

## Export Dataset Format

Replicate requires audio and text files to share the same base name. The export route renames files automatically:

```mermaid
flowchart LR
    subgraph storage [Individual Files in Storage]
        A1[training/abc123/audio.mp3]
        P1[training/abc123/prompt.txt]
        A2[training/def456/audio.mp3]
        P2[training/def456/prompt.txt]
    end

    subgraph zip [Zipped Dataset]
        Z1[track-0001.mp3]
        Z2[track-0001.txt]
        Z3[track-0002.mp3]
        Z4[track-0002.txt]
    end

    A1 --> Z1
    P1 --> Z2
    A2 --> Z3
    P2 --> Z4
```

Final zip structure:
```
dataset/
  track-0001.mp3
  track-0001.txt
  track-0002.mp3
  track-0002.txt
  ...
```

---

## API Routes Reference

| Route | Method | Input | Output |
|-------|--------|-------|--------|
| `/api/train` | POST | `{artistId, parseId}` | `{prompt, model, version}` |
| `/api/train/save` | POST | `{artistId, parseId, audioBase64, promptText, ...}` | `{success, trainingItemId}` |
| `/api/train/export` | POST | `{artistId}` | `{datasetUrl, itemCount}` |

---

## Related Files

- [`app/api/train/route.ts`](../app/api/train/route.ts) — Prompt generation
- [`app/api/train/save/route.ts`](../app/api/train/save/route.ts) — File upload + DB insert
- [`app/api/train/export/route.ts`](../app/api/train/export/route.ts) — Zip creation + upload
- [`app/dashboard/page.tsx`](../app/dashboard/page.tsx) — Train mode UI
- [`supabase/migrations/001_training_items.sql`](../supabase/migrations/001_training_items.sql) — Table schema

