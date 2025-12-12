import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import JSZip from "jszip";

// Use service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { artistId } = await req.json();

    if (!artistId) {
      return NextResponse.json(
        { error: "artistId is required" },
        { status: 400 }
      );
    }

    // Fetch all ready training items for this artist
    const { data: trainingItems, error: fetchError } = await supabase
      .from("training_items")
      .select("*")
      .eq("artist_id", artistId)
      .eq("status", "ready")
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("Error fetching training items:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch training items" },
        { status: 500 }
      );
    }

    if (!trainingItems || trainingItems.length === 0) {
      return NextResponse.json(
        { error: "No ready training items found" },
        { status: 404 }
      );
    }

    // Get artist slug for dataset path
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

    const artistSlug = artist.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Create zip archive
    const zip = new JSZip();
    const datasetFolder = zip.folder("dataset");

    if (!datasetFolder) {
      return NextResponse.json(
        { error: "Failed to create zip folder" },
        { status: 500 }
      );
    }

    // Download and add each item to the zip
    // Replicate requires audio and text files to have the SAME base name
    // e.g., track-0001.mp3 and track-0001.txt
    let itemIndex = 0;
    const exportedIds: string[] = [];

    for (const item of trainingItems) {
      const baseName = `track-${String(itemIndex + 1).padStart(4, "0")}`;

      // Download audio
      if (item.audio_path) {
        const { data: audioData, error: audioError } = await supabase.storage
          .from("dawa-exports")
          .download(item.audio_path);

        if (audioError) {
          console.error(`Error downloading audio for item ${item.id}:`, audioError);
          continue; // Skip this item but continue with others
        }

        const audioBuffer = await audioData.arrayBuffer();
        // Use matching base name for Replicate compatibility
        datasetFolder.file(`${baseName}.mp3`, audioBuffer);
      }

      // Add prompt text with matching base name
      if (item.prompt_text) {
        datasetFolder.file(`${baseName}.txt`, item.prompt_text);
      } else if (item.prompt_path) {
        // Fallback: download from storage
        const { data: promptData, error: promptError } = await supabase.storage
          .from("dawa-exports")
          .download(item.prompt_path);

        if (!promptError && promptData) {
          const promptText = await promptData.text();
          datasetFolder.file(`${baseName}.txt`, promptText);
        }
      }

      exportedIds.push(item.id);
      itemIndex++;
    }

    if (itemIndex === 0) {
      return NextResponse.json(
        { error: "No items could be exported" },
        { status: 500 }
      );
    }

    // Generate zip buffer
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    // Upload zip to storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const zipPath = `artists/${artistSlug}/datasets/dataset-${timestamp}.zip`;

    const { error: uploadError } = await supabase.storage
      .from("dawa-exports")
      .upload(zipPath, zipBuffer, {
        contentType: "application/zip",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading zip:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload dataset" },
        { status: 500 }
      );
    }

    // Get public URL for the dataset
    const { data: urlData } = supabase.storage
      .from("dawa-exports")
      .getPublicUrl(zipPath);

    // Update training items status to exported
    const { error: updateError } = await supabase
      .from("training_items")
      .update({ status: "exported", updated_at: new Date().toISOString() })
      .in("id", exportedIds);

    if (updateError) {
      console.error("Error updating training items status:", updateError);
      // Don't fail the request, the zip was already uploaded
    }

    return NextResponse.json({
      success: true,
      datasetUrl: urlData.publicUrl,
      zipPath,
      itemCount: itemIndex,
      exportedIds,
    });
  } catch (error) {
    console.error("Train export API error:", error);
    return NextResponse.json(
      { error: "Failed to export dataset" },
      { status: 500 }
    );
  }
}

