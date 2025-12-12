---
name: Train Mode Architecture Diagram
overview: "Create a Mermaid diagram documenting how the Train Mode works: database relationships, API flows, system prompt injection, and export process."
todos:
  - id: create-table
    content: Create training_items table in Supabase with expanded schema
    status: completed
  - id: train-api
    content: Create /api/train route with master_schema + summary + provenance
    status: completed
  - id: save-api
    content: Create /api/train/save route (server-side uploads with service role)
    status: completed
  - id: export-api
    content: Create /api/train/export route (zip + upload + return URL)
    status: completed
  - id: train-ui
    content: Add Train mode UI with queue state, file upload, progress display
    status: completed
  - id: update-schema-docs
    content: Document training_items table in supabase-schema.md
    status: completed
---

# Train Mode Architecture Diagram

## Deliverable

Create a new file: [`docs/train-mode-architecture.md`](docs/train-mode-architecture.md)

This will contain Mermaid diagrams showing:

1. **Database Entity Relationships** - How `artist_profiles`, `als_summaries`, `training_items`, and `artists` tables connect
2. **Prompt Generation Flow** - How `TRAIN_SYSTEM_PROMPT` receives `master_schema` + `summary` and outputs a training prompt
3. **Full Train Workflow** - User actions → API calls → Storage → Export

## Proposed Diagrams

### 1. Database Schema (ERD)

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

### 2. Prompt Generation Flow

```mermaid
flowchart LR
    subgraph inputs [Inputs]
        MS[master_schema]
        SUM[als_summary.summary]
    end

    subgraph api ["/api/train"]
        SP[TRAIN_SYSTEM_PROMPT]
        CTX[Context Message]
        OAI[OpenAI gpt-4o-mini]
    end

    MS --> CTX
    SUM --> CTX
    SP --> OAI
    CTX --> OAI
    OAI --> OUT[prompt.txt]
```

### 3. Full Train Mode Sequence

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

    User->>Dashboard: Select ALS from library
    User->>Dashboard: Upload MP3
    User->>Dashboard: Click Generate Prompt

    Dashboard->>TrainAPI: POST artistId, parseId
    TrainAPI->>DB: SELECT master_schema FROM artist_profiles
    TrainAPI->>DB: SELECT summary FROM als_summaries
    TrainAPI->>OpenAI: TRAIN_SYSTEM_PROMPT + context
    OpenAI-->>TrainAPI: prompt text
    TrainAPI-->>Dashboard: prompt, model, version

    User->>Dashboard: Click Save
    Dashboard->>SaveAPI: POST audioBase64, promptText
    SaveAPI->>Storage: Upload audio.mp3
    SaveAPI->>Storage: Upload prompt.txt
    SaveAPI->>DB: INSERT training_items
    SaveAPI-->>Dashboard: success

    Note over User,Dashboard: Repeat for more tracks

    User->>Dashboard: Click Export Dataset
    Dashboard->>ExportAPI: POST artistId
    ExportAPI->>DB: SELECT * FROM training_items WHERE status=ready
    ExportAPI->>Storage: Download all audio + prompts
    ExportAPI->>ExportAPI: Create zip with track-0001.mp3/txt format
    ExportAPI->>Storage: Upload dataset.zip
    ExportAPI->>DB: UPDATE status=exported
    ExportAPI-->>Dashboard: datasetUrl
```

## File Structure

The markdown file will include:

- Brief intro explaining Train Mode purpose
- All three diagrams with explanatory text
- Reference to relevant code files