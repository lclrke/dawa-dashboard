-- Training Items Table for DAWA Train Mode
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS training_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid REFERENCES artists(id) ON DELETE CASCADE,
  als_summary_id uuid REFERENCES als_summaries(id) ON DELETE SET NULL,
  
  -- Denormalized for easier querying (avoids joins)
  parse_id text NOT NULL,
  als_filename text,
  project_name text,
  
  -- File paths in Storage
  audio_path text,           -- artists/{slug}/training/{id}/audio.mp3
  prompt_path text,          -- artists/{slug}/training/{id}/prompt.txt
  prompt_text text,          -- Cached for UI display
  
  -- Status workflow: needs_audio | needs_prompt | ready | exported | failed
  status text DEFAULT 'needs_audio',
  
  -- Prompt provenance (for reproducibility)
  system_prompt_version text,  -- e.g., "train-v1"
  model_name text,             -- e.g., "gpt-4o-mini"
  generated_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for queue queries
CREATE INDEX IF NOT EXISTS idx_training_items_artist_status 
ON training_items(artist_id, status);

-- Index for parse_id lookups
CREATE INDEX IF NOT EXISTS idx_training_items_parse_id 
ON training_items(parse_id);

-- RLS Policy: Users can only access training_items for their linked artists
ALTER TABLE training_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own training items"
ON training_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_artists ua
    WHERE ua.user_id = auth.uid() AND ua.artist_id = training_items.artist_id
  )
);

CREATE POLICY "Users can insert training items for their artists"
ON training_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_artists ua
    WHERE ua.user_id = auth.uid() AND ua.artist_id = training_items.artist_id
  )
);

CREATE POLICY "Users can update their own training items"
ON training_items FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_artists ua
    WHERE ua.user_id = auth.uid() AND ua.artist_id = training_items.artist_id
  )
);

-- Comment for documentation
COMMENT ON TABLE training_items IS 'Stores training pairs (audio + prompt) for MusicGen fine-tuning';

