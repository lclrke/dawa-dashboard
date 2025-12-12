import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use service role for server-side uploads (bypasses RLS on Storage)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const {
      artistId,
      alsSummaryId,
      parseId,
      alsFilename,
      projectName,
      audioBase64,
      promptText,
      model,
      version,
    } = await req.json();

    if (!artistId || !parseId || !audioBase64 || !promptText) {
      return NextResponse.json(
        { error: "Missing required fields: artistId, parseId, audioBase64, promptText" },
        { status: 400 }
      );
    }

    // Generate a unique ID for this training item
    const trainingItemId = crypto.randomUUID();

    // Get artist slug for storage path
    const { data: artist, error: artistError } = await supabase
      .from("artists")
      .select("name")
      .eq("id", artistId)
      .limit(1)
      .single();

    if (artistError) {
      console.error("Error fetching artist:", artistError);
      return NextResponse.json(
        { error: "Failed to fetch artist" },
        { status: 500 }
      );
    }

    // Create a URL-safe slug from artist name
    const artistSlug = artist.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Storage paths
    const basePath = `artists/${artistSlug}/training/${trainingItemId}`;
    const audioPath = `${basePath}/audio.mp3`;
    const promptPath = `${basePath}/prompt.txt`;

    // Decode base64 audio and upload
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const { error: audioUploadError } = await supabase.storage
      .from("dawa-exports")
      .upload(audioPath, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (audioUploadError) {
      console.error("Error uploading audio:", audioUploadError);
      return NextResponse.json(
        { error: "Failed to upload audio file" },
        { status: 500 }
      );
    }

    // Upload prompt text
    const promptBuffer = Buffer.from(promptText, "utf-8");
    const { error: promptUploadError } = await supabase.storage
      .from("dawa-exports")
      .upload(promptPath, promptBuffer, {
        contentType: "text/plain",
        upsert: false,
      });

    if (promptUploadError) {
      console.error("Error uploading prompt:", promptUploadError);
      // Cleanup audio if prompt upload fails
      await supabase.storage.from("dawa-exports").remove([audioPath]);
      return NextResponse.json(
        { error: "Failed to upload prompt file" },
        { status: 500 }
      );
    }

    // Insert training_items row
    const { data: trainingItem, error: insertError } = await supabase
      .from("training_items")
      .insert({
        id: trainingItemId,
        artist_id: artistId,
        als_summary_id: alsSummaryId || null,
        parse_id: parseId,
        als_filename: alsFilename,
        project_name: projectName,
        audio_path: audioPath,
        prompt_path: promptPath,
        prompt_text: promptText,
        status: "ready",
        system_prompt_version: version || "train-v1",
        model_name: model || "gpt-4o-mini",
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting training item:", insertError);
      // Cleanup uploaded files
      await supabase.storage.from("dawa-exports").remove([audioPath, promptPath]);
      return NextResponse.json(
        { error: "Failed to save training item" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      trainingItemId,
      audioPath,
      promptPath,
    });
  } catch (error) {
    console.error("Train save API error:", error);
    return NextResponse.json(
      { error: "Failed to save training item" },
      { status: 500 }
    );
  }
}

