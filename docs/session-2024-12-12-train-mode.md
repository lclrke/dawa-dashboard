# Session Summary: Train Mode Implementation
**Date:** December 12, 2024

## What We Built

### Train Mode for MusicGen Dataset Preparation
A complete workflow for creating audio + prompt training pairs that can be exported as datasets for Replicate's MusicGen fine-tuning.

---

## New Files Created

| File | Purpose |
|------|---------|
| `app/api/train/route.ts` | Generates training prompts using OpenAI (master_schema + ALS summary) |
| `app/api/train/save/route.ts` | Server-side upload of audio + prompt files to Supabase Storage |
| `app/api/train/export/route.ts` | Zips all ready items into a Replicate-compatible dataset |
| `supabase/migrations/001_training_items.sql` | SQL for the `training_items` table (already applied to Supabase) |

---

## Database Changes

### New Table: `training_items`

```sql
CREATE TABLE training_items (
  id uuid PRIMARY KEY,
  artist_id uuid,
  als_summary_id uuid,
  parse_id text NOT NULL,
  als_filename text,
  project_name text,
  audio_path text,
  prompt_path text,
  prompt_text text,
  status text DEFAULT 'needs_audio',  -- needs_audio | ready | exported | failed
  system_prompt_version text,
  model_name text,
  generated_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);
```

RLS policies added for authenticated users.

---

## UI Changes (`app/dashboard/page.tsx`)

- Added **Train mode** to AI Workspace (alongside Production and Generate)
- Step-by-step workflow:
  1. Select track from Project Library
  2. Upload MP3 audio file
  3. Click "Generate Prompt" → AI creates sync-ready description
  4. Click "Save & Next" → uploads to Supabase
- Training items list with status badges
- "Export Dataset" button → creates Replicate-compatible zip

---

## Storage Structure

```
dawa-exports/artists/{artist-slug}/
├── training/{training-item-id}/
│   ├── audio.mp3
│   └── prompt.txt
└── datasets/
    └── dataset-{timestamp}.zip
```

---

## Export Format (Replicate-Compatible)

The zip contains flat files with matching names:

```
dataset/
  track-0001.mp3
  track-0001.txt
  track-0002.mp3
  track-0002.txt
  ...
```

This format is required by Replicate for MusicGen training.

---

## Configuration Applied

- Made `dawa-exports` bucket **public** in Supabase Storage settings
- Added `jszip` npm dependency for server-side zip creation

---

## How to Use Train Mode

1. Go to Dashboard → AI Workspace → click **Train**
2. Click a track in the Project Library
3. Upload the matching MP3 file
4. Click **Generate Prompt** (AI creates description from ALS summary + artist style)
5. Click **Save & Next** to save and prepare for next track
6. Repeat for all tracks
7. Click **Export Dataset** to download Replicate-ready zip

---

## Next Steps (Future Work)

- [ ] Connect to Replicate API to start training jobs directly
- [ ] Add prompt editing before saving
- [ ] Batch upload multiple MP3s at once
- [ ] Progress indicator for large dataset exports

