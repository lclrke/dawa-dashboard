import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPTS: Record<string, string> = {
  production: `You are a music production co-pilot for DAWA. Help the user with their Ableton Live workflow, mixing, sound design, arrangement, and creative decisions. Be concise and practical.`,
  train: `You are a DAWA assistant helping users prepare datasets for MusicGen fine-tuning. Guide them through selecting tracks, preparing audio files, and understanding the training process. Be clear and step-by-step.`,
  generate: `You are a DAWA assistant helping users generate music with trained AI models. Help them craft effective prompts, understand generation parameters, and refine their results. Be creative and inspiring.`,
};

export async function POST(req: NextRequest) {
  try {
    const { mode, messages } = await req.json();

    if (!mode || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.production;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      max_tokens: 500,
    });

    const reply = completion.choices[0]?.message?.content ?? "No response";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}

