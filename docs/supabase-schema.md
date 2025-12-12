# DAWA Database Schema

> **Database:** PostgreSQL 17.4 (Supabase)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE                                  │
├─────────────────────────────────────────────────────────────────┤
│  auth.users ──────┐                                              │
│                   │                                              │
│                   ▼                                              │
│  ┌─────────────────────┐    ┌──────────────────┐                │
│  │    user_artists     │───▶│     artists      │                │
│  │  (user_id, artist_id)│    │  (id, name)      │                │
│  └─────────────────────┘    └────────┬─────────┘                │
│                                      │                           │
│                    ┌─────────────────┼─────────────────┐        │
│                    ▼                 ▼                 ▼        │
│          ┌─────────────────┐ ┌─────────────────┐               │
│          │ artist_profiles │ │  als_summaries  │               │
│          │ (master_schema) │ │ (parsed .als)   │               │
│          └─────────────────┘ └─────────────────┘               │
│                                                                  │
│  Storage: dawa-exports bucket                                    │
│    └── artists/{slug}/daw-data/{project}/{als}/{parse}/         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tables

### `artists`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `name` | text | NO | — |
| `created_at` | timestamptz | YES | `now()` |

- PK: `id`
- Unique: `name`

---

### `artist_profiles`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `artist_id` | uuid | NO | — |
| `name` | text | YES | — |
| `master_schema` | jsonb | NO | `'{}'` |
| `created_at` | timestamptz | YES | `now()` |
| `updated_at` | timestamptz | YES | `now()` |

- PK: `artist_id`
- FK: `artist_id` → `artists.id` (CASCADE)
- One-to-one with `artists`

---

### `user_artists`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `user_id` | uuid | NO | — |
| `artist_id` | uuid | NO | — |
| `role` | text | NO | `'owner'` |
| `created_at` | timestamptz | YES | `now()` |

- PK: `(user_id, artist_id)`
- FK: `artist_id` → `artists.id` (CASCADE)

---

### `als_summaries`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `project_name` | text | YES | — |
| `als_filename` | text | NO | — |
| `parse_id` | text | NO | — |
| `parse_timestamp` | timestamptz | NO | `now()` |
| `summary` | jsonb | NO | — |
| `export_path` | text | YES | — |
| `artist_id` | uuid | YES | — |
| `created_at` | timestamptz | YES | `now()` |

- PK: `id`
- Unique: `(als_filename, parse_id)`
- Unique: `(artist_id, parse_id)` — NULLs allowed
- FK: `artist_id` → `artists.id` (SET NULL)

---

## JSONB Schemas

### `als_summaries.summary`

```typescript
interface AlsSummary {
  // Identification
  als_stem: string;
  als_filename: string;
  project_name: string;
  project_folder: string;
  artist_name: string;

  // Session overview
  overview: {
    tempo: number;
    time_signature: string;
    midi_tracks: number;
    audio_tracks: number;
    group_tracks: number;
    return_tracks: number;
    total_tracks: number;
  };

  // Plugin analysis
  plugin_usage: { [pluginName: string]: number };
  plugins_by_track: { [trackName: string]: string[] };

  // Sample library
  sample_index: {
    [sampleFilename: string]: {
      path: string;
      tracks: string[];
    };
  };

  // Track details
  track_breakdown: {
    [trackName: string]: {
      type: "MIDI" | "Audio";
      clips: number;
      group: string | null;
      devices: number;
      plugins: string[];
      sample_files: string[];
      has_automation: boolean;
    };
  };

  // Organization
  track_hierarchy: Array<{
    name: string;
    type: "MIDI" | "Audio" | "Group";
    index: number;
    level: number;
    children?: Array<{ name: string; type: string; index: number; level: number }>;
  }>;

  genre_indicators: string[];
}
```

### `artist_profiles.master_schema`

```typescript
interface ArtistMasterSchema {
  schema_version: string;
  
  uuids: { name: string; artist_id: string };

  artist: {
    name: string;
    origin: { city: string; country: string };
    members: string[];
    brand_narrative: { tone: string[]; description: string };
    core_identities: {
      tempo_center: string;
      energy_profile: string[];
      primary_genre_space: string[];
      secondary_spaces: string[];
      melodic_character: string[];
      sound_design_signature: string[];
      sync_pitch_identity: string[];
    };
  };

  catalog: Array<{
    work_id: string;
    title: string;
    primary_artist: string;
    release_role: "original" | "remix";
    remixer?: string;
    label?: string;
    tempo_bpm: number;
    key_center: string;
    energy_arc: string;
    core_tags: string[];
    mood_profile: string[];
    sync_notes: string[];
    daw_summary_id?: string;
  }>;

  semantic_views: {
    by_mood: { [id: string]: { description: string; typical_elements: string[]; suitable_for: string[] } };
    by_usage: { [id: string]: { description: string; features: string[]; ideal_for?: string[] } };
    by_energy_arc: { [id: string]: { description: string; structure_traits: string[] } };
  };

  creative_policy: {
    keep_foreground: string[];
    no_go_zones: string[];
    production_guides: string[];
    sync_specific_notes: string[];
  };

  daw_fingerprint_aggregates: {
    core_bpm_range: { min: number; max: number; cluster_centers: number[] };
    keys_and_modes: { common_keys: string[]; modal_tendencies: string[] };
    drum_palette: { kick_character: string[]; snare_clap_character: string[]; percussion_notes: string[] };
    bass_workflow: string[];
    core_synth_palette: string[];
    frequent_plugins_tools: string[];
    arrangement_habits: string[];
    tempo_tendencies: string[];
  };

  provenance: {
    last_refreshed: string;
    sources: { daw: string[]; metadata_provided: string[] };
  };
}
```

---

## Relationships

| From | To | Type | On Delete |
|------|----|----|-----------|
| `user_artists.artist_id` | `artists.id` | Many-to-One | CASCADE |
| `artist_profiles.artist_id` | `artists.id` | One-to-One | CASCADE |
| `als_summaries.artist_id` | `artists.id` | Many-to-One | SET NULL |

---

## Row Level Security

### Enabled
- `als_summaries` — users read only their linked artists

```sql
CREATE POLICY "read summaries for my artists" 
ON public.als_summaries FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM user_artists ua
    WHERE ua.user_id = auth.uid() AND ua.artist_id = als_summaries.artist_id
  )
);
```

> ⚠️ Summaries with `artist_id IS NULL` are invisible under this policy.

### Not Yet Enabled
- `artists`, `artist_profiles`, `user_artists` — add RLS for production

---

## Storage

**Bucket:** `dawa-exports` (private)

**Structure:**
```
artists/{artist-slug}/daw-data/{project}/{als}/{parse-id}/
├── summary.json
└── timeline_visualizer.png
```

**Policies:** Public read/insert/update on `dawa-exports` bucket.

---

## Client Examples

```typescript
// Get user's artists
const { data: artists } = await supabase
  .from('artists')
  .select(`*, user_artists!inner(role), artist_profiles(master_schema)`)

// Get summaries for an artist
const { data: summaries } = await supabase
  .from('als_summaries')
  .select('*')
  .eq('artist_id', artistId)
  .order('parse_timestamp', { ascending: false })
```
