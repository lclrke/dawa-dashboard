import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Use service role for server-side queries
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SYSTEM_PROMPT_VERSION = "train-v1";
const MODEL_NAME = "gpt-4o-mini";

const TRAIN_SYSTEM_PROMPT = `You are the DAWA Train Assistant.

Your task is to generate ONE training prompt text for ONE track at a time.

You will receive:
1) ARTIST_MASTER_SCHEMA (artist_profiles.master_schema)
2) ALS_SUMMARY (full als_summaries.summary JSON for the current track)

Rules:
- Output plain text only.
- Output exactly ONE paragraph.
- Do NOT include JSON.
- Do NOT include markdown.
- Do NOT include labels, headings, or explanations.
- Do NOT reference file names, parse IDs, or Ableton explicitly.

Use the ARTIST_MASTER_SCHEMA to determine:
- stylistic language
- genre space
- emotional tone
- production vocabulary
- what to emphasize or avoid (creative_policy.no_go_zones)

Use the ALS_SUMMARY to determine:
- BPM (from overview.tempo)
- instrumentation and texture (plugin_usage, track_breakdown, sample_index)
- energy, density, and arrangement character
- notable production signatures

Write in the style of this example:

"Dark and cinematic electronic with 80s DNA. Gated reverb drums, airy synth pads, and an emotional, suspenseful energy reminiscent of 'In the Air Tonight'. Brooding atmosphere, gated tom fills, pulsating bass, and moody textures. BPM: 95"

Constraints:
- 1–2 sentences maximum
- Dense, descriptive, sync-ready language
- End with: BPM: <number>

Return only the final prompt text.`;

export async function POST(req: NextRequest) {
  try {
    const { artistId, parseId } = await req.json();

    if (!artistId || !parseId) {
      return NextResponse.json(
        { error: "artistId and parseId are required" },
        { status: 400 }
      );
    }

    // Fetch artist master schema
    const { data: artistProfile, error: artistError } = await supabase
      .from("artist_profiles")
      .select("master_schema")
      .eq("artist_id", artistId)
      .limit(1)
      .single();

    if (artistError) {
      console.error("Error fetching artist profile:", artistError);
      return NextResponse.json(
        { error: "Failed to fetch artist profile" },
        { status: 500 }
      );
    }

    // Fetch ALS summary
    const { data: alsSummary, error: alsError } = await supabase
      .from("als_summaries")
      .select("summary, als_filename, project_name, id")
      .eq("parse_id", parseId)
      .limit(1)
      .single();

    if (alsError) {
      console.error("Error fetching ALS summary:", alsError);
      return NextResponse.json(
        { error: "Failed to fetch ALS summary" },
        { status: 500 }
      );
    }

    // Build the context message
    const contextMessage = `ARTIST_MASTER_SCHEMA:
${JSON.stringify(artistProfile?.master_schema || {}, null, 2)}

ALS_SUMMARY:
${JSON.stringify(alsSummary?.summary || {}, null, 2)}`;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: TRAIN_SYSTEM_PROMPT },
        { role: "user", content: contextMessage },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const prompt = completion.choices[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({
      prompt,
      model: MODEL_NAME,
      version: SYSTEM_PROMPT_VERSION,
      alsSummaryId: alsSummary?.id,
      alsFilename: alsSummary?.als_filename,
      projectName: alsSummary?.project_name,
    });
  } catch (error) {
    console.error("Train API error:", error);
    return NextResponse.json(
      { error: "Failed to generate training prompt" },
      { status: 500 }
    );
  }
}

