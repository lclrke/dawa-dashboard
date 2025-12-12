# DAWA Dashboard — Project Overview

_Last updated: 2025-12-12_

This document defines the **architecture, goals, and invariants** of the `dawa-dashboard` repository.  
Written for **Cursor, LLMs, and contributors** to understand system boundaries.

---

## What `dawa-dashboard` Is

`dawa-dashboard` is the **user-facing web UI** for DAWA data and workflows.

**Stack**
- Next.js (App Router)
- Hosted on Vercel
- Supabase for auth, database, and storage
- Replicate for model training and inference

**Primary responsibilities**
- Authenticate users via Supabase Auth (Google OAuth)
- Resolve artist identity from `user_artists`
- Browse Ableton project summaries from `als_summaries`
- Provide assistant-driven workflows
- Orchestrate dataset creation and model training
- Generate music from trained models

**Explicit non-responsibility**
- Parsing `.als` files — handled by `dawa-portable`, which writes results to Supabase
- The dashboard only *consumes* those results

---

## Repo Layout

```text
dawa-dashboard/
├── app/
│   ├── dashboard/
│   │   └── page.tsx        # Main authenticated UI
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Landing (Google sign-in)
├── lib/
│   └── supabaseClient.ts   # Browser client (anon key)
├── .env.local              # NEXT_PUBLIC_SUPABASE_* (not committed)
└── ...
```

---

## Core Supabase Data Model

### `artists`
Canonical artist entities.
- `id` (uuid, PK), `name` (text, unique), `created_at`

### `user_artists`
Maps authenticated users to artists.
- `user_id` → `auth.users.id`
- `artist_id` → `artists.id`
- `role` (default: `'owner'`)
- Composite PK on `(user_id, artist_id)`

### `als_summaries`
One row per Ableton parse run.
- `id`, `project_name`, `als_filename`
- `parse_id` — **opaque string**, do not parse or depend on format
- `parse_timestamp`, `summary` (jsonb), `export_path`, `artist_id`

### `artist_profiles`
Extended artist data.
- `artist_id` (PK, FK → artists)
- `master_schema` (jsonb) — see below

### `artist_profiles.master_schema` — Critical Concept

The **canonical high-level artist context** shared across **all assistants**.

Used for:
- Music production co-pilot reasoning
- Dataset prompt generation
- Inference-time prompt shaping
- Any assistant requiring artist identity

Contains: artist description, genres, tools/plugins, stylistic tendencies, creative identity.

This **complements** low-level DAW summaries and is *not* limited to model training.

---

## Security & Execution Model

### Row Level Security (RLS)

**Client-side (browser)**
- Uses Supabase anon key
- Subject to RLS — can only read permitted rows

**Server-side (Vercel)**
- Uses service role key + Replicate API key
- Required for: Storage writes, ZIP creation, signed URLs, Replicate training/inference

**Rule**: Any operation requiring secrets or elevated privileges must happen server-side.

### Current RLS Status
- `als_summaries`: RLS enabled — users read only their linked artists
- `artists`, `artist_profiles`, `user_artists`: RLS **not yet enabled** — add for production

---

## Dashboard Structure: 3 Core Assistants

### 1. Music Production Co-Pilot

ChatGPT-style assistant grounded in DAWA data.

**Flow**
1. Assistant asks: "Continue a project or start new?"
2. If continuing: display card carousel from `als_summaries`
3. User selects project → selects specific `.als` file
4. Assistant uses DAW summary + `master_schema` for reasoning

**Constraints**
- Never assume `parse_id` structure
- Handle missing `summary` fields defensively

### 2. Train a Model

Build MusicGen fine-tuning dataset and trigger training.

**Dataset Flow**
1. User selects `.als` entries
2. User uploads MP3 files
3. For each MP3, a matching `.txt` is created:
   - `songname.mp3` + `songname.txt`
4. Prompts generated from `als_summaries.summary` + `master_schema`

**Readiness Rules**
- Minimum **8 valid MP3+TXT pairs**
- ZIP uploaded to: `artists/<slug>/datasets/<id>/dataset.zip`
- Public or signed URL for Replicate

**Training Trigger**
- Server-side calls Replicate fine-tuner
- Passes dataset ZIP URL
- Stores training metadata

### 3. Generate Music

Generate audio from trained models.

**Flow**
1. User selects trained model
2. User enters text prompt
3. Server calls Replicate inference
4. UI displays playable result

---

## Storage Conventions

- DAW artifacts: `artists/{slug}/daw-data/{project}/{als}/{parse}/`
- Dataset ZIPs: `artists/{slug}/datasets/{id}/dataset.zip`
- `export_path` is the only reliable pointer — do not infer folder layout

---

## Key Invariants — Do Not Break

1. `artist_profiles.master_schema` is shared across all assistants
2. DAW summary JSON may be incomplete — code defensively
3. Privileged operations must be server-side
4. `parse_id` is **opaque** — treat as display string only
5. Dashboard does not parse `.als` files

---

## Extending the Dashboard

**Safe patterns**
- Use `artist_id` from `user_artists` as main filter
- Treat `parse_id` as opaque (for URLs, display, joins)
- Use `summary` JSON for richer UI, handle missing fields
- Use `export_path` + server route for signed URLs

**Example extensions**
- Detail page: `/dashboard/parses/[id]`
- Timeline viewer via signed URL to `export_path + "/timeline_visualizer.png"`
- Filters by `project_name`, date range, tempo
