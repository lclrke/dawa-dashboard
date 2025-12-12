"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ArtistRow = {
  artist_id: string;
  artists: { name: string } | null;
};

type AlsSummaryRow = {
  id: string | number;
  project_name: string | null;
  als_filename: string | null;
  parse_id: string | null;
  parse_timestamp: string;
  summary: any; // jsonb
};

export default function Dashboard() {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [artistName, setArtistName] = useState<string | null>(null);
  const [artistId, setArtistId] = useState<string | null>(null);

  const [inputName, setInputName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [parses, setParses] = useState<AlsSummaryRow[]>([]);
  const [parsesLoading, setParsesLoading] = useState(false);
  const [parsesError, setParsesError] = useState<string | null>(null);

  const [selectedParse, setSelectedParse] = useState<AlsSummaryRow | null>(null);

  // Chat state
  type ChatMode = "production" | "train" | "generate";
  type ChatMessage = { role: "user" | "assistant"; content: string };
  const [chatMode, setChatMode] = useState<ChatMode>("production");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Train mode state
  const [trainAudioFile, setTrainAudioFile] = useState<File | null>(null);
  const [trainPrompt, setTrainPrompt] = useState<string | null>(null);
  const [trainLoading, setTrainLoading] = useState(false);
  const [trainSaving, setTrainSaving] = useState(false);
  const [trainError, setTrainError] = useState<string | null>(null);
  const [trainSuccess, setTrainSuccess] = useState<string | null>(null);

  // Training items list
  type TrainingItem = {
    id: string;
    als_filename: string | null;
    status: string;
    prompt_text: string | null;
  };
  const [trainingItems, setTrainingItems] = useState<TrainingItem[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [datasetUrl, setDatasetUrl] = useState<string | null>(null);

  const handleModeChange = (newMode: ChatMode) => {
    if (newMode !== chatMode) {
      setChatMode(newMode);
      setChatMessages([]);
      setChatInput("");
      // Reset train state when switching modes
      setTrainAudioFile(null);
      setTrainPrompt(null);
      setTrainError(null);
      setTrainSuccess(null);
    }
  };

  // Fetch training items when in train mode
  useEffect(() => {
    const fetchTrainingItems = async () => {
      if (chatMode !== "train" || !artistId) return;
      
      const { data, error } = await supabase
        .from("training_items")
        .select("id, als_filename, status, prompt_text")
        .eq("artist_id", artistId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setTrainingItems(data as TrainingItem[]);
      }
    };

    fetchTrainingItems();
  }, [chatMode, artistId, trainSuccess]);

  // Handle audio file selection
  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      setTrainAudioFile(file);
      setTrainError(null);
    } else if (file) {
      setTrainError("Please select an audio file (MP3, WAV, etc.)");
    }
  };

  // Generate training prompt
  const handleGeneratePrompt = async () => {
    if (!selectedParse || !artistId) {
      setTrainError("Please select a track from the Project Library first");
      return;
    }

    setTrainLoading(true);
    setTrainError(null);
    setTrainPrompt(null);

    try {
      const res = await fetch("/api/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId,
          parseId: selectedParse.parse_id,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate prompt");

      const data = await res.json();
      setTrainPrompt(data.prompt);
    } catch (err) {
      console.error(err);
      setTrainError("Failed to generate prompt. Please try again.");
    } finally {
      setTrainLoading(false);
    }
  };

  // Save training item
  const handleSaveTrainingItem = async () => {
    if (!trainAudioFile || !trainPrompt || !selectedParse || !artistId) {
      setTrainError("Missing audio file, prompt, or selected track");
      return;
    }

    setTrainSaving(true);
    setTrainError(null);

    try {
      // Convert audio file to base64
      const arrayBuffer = await trainAudioFile.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      const res = await fetch("/api/train/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistId,
          alsSummaryId: selectedParse.id,
          parseId: selectedParse.parse_id,
          alsFilename: selectedParse.als_filename,
          projectName: selectedParse.project_name,
          audioBase64: base64,
          promptText: trainPrompt,
        }),
      });

      if (!res.ok) throw new Error("Failed to save training item");

      setTrainSuccess(`Saved: ${selectedParse.als_filename?.replace(/\.als$/i, "")}`);
      // Reset for next item
      setTrainAudioFile(null);
      setTrainPrompt(null);
      setSelectedParse(null);
    } catch (err) {
      console.error(err);
      setTrainError("Failed to save training item. Please try again.");
    } finally {
      setTrainSaving(false);
    }
  };

  // Export dataset
  const handleExportDataset = async () => {
    if (!artistId) return;

    setExportLoading(true);
    setDatasetUrl(null);

    try {
      const res = await fetch("/api/train/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId }),
      });

      if (!res.ok) throw new Error("Failed to export dataset");

      const data = await res.json();
      setDatasetUrl(data.datasetUrl);
      // Refresh training items list
      setTrainSuccess(`Exported ${data.itemCount} items`);
    } catch (err) {
      console.error(err);
      setTrainError("Failed to export dataset. Please try again.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleSendMessage = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: chatMode,
          messages: [...chatMessages, userMessage],
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const data = await res.json();
      const assistantMessage: ChatMessage = { role: "assistant", content: data.reply };
      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error(err);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // initial load: auth + artist
  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        router.replace("/");
        return;
      }

      setUserEmail(user.email ?? null);

      // get first artist linked to this user (if any)
      const { data, error: artistError } = await supabase
        .from("user_artists")
        .select("artist_id, artists(name)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle<ArtistRow>();

      if (!artistError && data) {
        setArtistId(data.artist_id);
        const name = data.artists?.name ?? null;
        setArtistName(name);
        if (name) setInputName(name);
      }

      setLoading(false);
    };

    load();
  }, [router]);

  // fetch ALS summaries whenever artistId is known / changes
  useEffect(() => {
    const fetchParses = async () => {
      if (!artistId) {
        setParses([]);
        return;
      }

      setParsesLoading(true);
      setParsesError(null);

      const { data, error } = await supabase
        .from("als_summaries")
        .select(
          "id, project_name, als_filename, parse_id, parse_timestamp, summary"
        )
        .eq("artist_id", artistId)
        .order("parse_timestamp", { ascending: false });

      if (error) {
        console.error(error);
        setParsesError(error.message);
        setParses([]);
      } else {
        setParses((data ?? []) as AlsSummaryRow[]);
      }

      setParsesLoading(false);
    };

    fetchParses();
  }, [artistId]);

  const handleSaveArtist = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmed = inputName.trim();
    if (!trimmed) {
      setErrorMsg("Artist name cannot be empty.");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }

      // 1) Ensure artist exists (name is UNIQUE in artists table)
      const { data: artistRow, error: upsertError } = await supabase
        .from("artists")
        .upsert({ name: trimmed }, { onConflict: "name" })
        .select("id, name")
        .maybeSingle();

      if (upsertError || !artistRow) {
        throw upsertError ?? new Error("Artist upsert returned no row");
      }

      const newArtistId = artistRow.id as string;

      // 2) Link user ↔ artist in user_artists
      const { error: linkError } = await supabase
        .from("user_artists")
        .upsert(
          {
            user_id: user.id,
            artist_id: newArtistId,
            role: "owner",
          },
          { onConflict: "user_id,artist_id" }
        );

      if (linkError) throw linkError;

      setArtistId(newArtistId);
      setArtistName(artistRow.name);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message ?? "Failed to save artist");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* App Bar */}
      <header className="px-4 py-4">
        <span className="text-xl font-bold tracking-tight">DAWA</span>
      </header>
      <div className="border-b border-border" />

      {/* Main Content */}
      <main className="px-6 py-12 md:px-12 lg:px-24">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Artist Profile */}
        {artistId ? (
          <div className="flex items-center gap-6">
            <div className="size-20 rounded-full bg-muted flex items-center justify-center text-3xl font-semibold text-muted-foreground shrink-0">
              {artistName?.charAt(0).toUpperCase() ?? "?"}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-bold tracking-tight">{artistName}</span>
              <span className="text-sm text-muted-foreground/70">{userEmail}</span>
            </div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Artist Profile</CardTitle>
              <CardDescription>
                Link your artist identity to access your DAW data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <form onSubmit={handleSaveArtist} className="flex gap-3 max-w-md">
                  <Input
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    placeholder='e.g. "Love Thy Brother"'
                    className="flex-1"
                  />
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </form>

                {errorMsg && (
                  <p className="text-sm text-destructive">{errorMsg}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Workspace */}
        <Card className="max-w-xl">
          <CardHeader className="pb-3">
            <CardTitle>AI Workspace</CardTitle>
            <CardDescription>
              {chatMode === "train" 
                ? "Create training pairs for MusicGen fine-tuning"
                : "Choose a mode and start chatting"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Mode buttons */}
            <div className="flex gap-2">
              <Button
                variant={chatMode === "production" ? "default" : "outline"}
                className="h-8 px-3 text-xs"
                onClick={() => handleModeChange("production")}
              >
                Production
              </Button>
              <Button
                variant={chatMode === "train" ? "default" : "outline"}
                className="h-8 px-3 text-xs"
                onClick={() => handleModeChange("train")}
              >
                Train
              </Button>
              <Button
                variant={chatMode === "generate" ? "default" : "outline"}
                className="h-8 px-3 text-xs"
                onClick={() => handleModeChange("generate")}
              >
                Generate
              </Button>
            </div>

            {/* Train Mode UI */}
            {chatMode === "train" ? (
              <div className="flex flex-col gap-4">
                {/* Instructions */}
                <div className="text-sm text-muted-foreground">
                  {!selectedParse && "1. Select a track from the Project Library"}
                  {selectedParse && !trainAudioFile && "2. Upload the audio file for this track"}
                  {selectedParse && trainAudioFile && !trainPrompt && "3. Generate a training prompt"}
                  {selectedParse && trainAudioFile && trainPrompt && "4. Save and continue to next track"}
                </div>

                {/* Selected Track */}
                {selectedParse && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium">
                      {selectedParse.als_filename?.replace(/\.als$/i, "")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedParse.project_name}
                    </p>
                  </div>
                )}

                {/* Audio Upload */}
                {selectedParse && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Audio File</label>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioFileChange}
                      className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    />
                    {trainAudioFile && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {trainAudioFile.name}
                      </p>
                    )}
                  </div>
                )}

                {/* Generate Prompt Button */}
                {selectedParse && trainAudioFile && !trainPrompt && (
                  <Button
                    onClick={handleGeneratePrompt}
                    disabled={trainLoading}
                  >
                    {trainLoading ? "Generating..." : "Generate Prompt"}
                  </Button>
                )}

                {/* Generated Prompt Display */}
                {trainPrompt && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Generated Prompt:</p>
                    <p className="text-sm">{trainPrompt}</p>
                  </div>
                )}

                {/* Save Button */}
                {trainPrompt && (
                  <Button
                    onClick={handleSaveTrainingItem}
                    disabled={trainSaving}
                  >
                    {trainSaving ? "Saving..." : "Save & Next"}
                  </Button>
                )}

                {/* Error/Success Messages */}
                {trainError && (
                  <p className="text-sm text-destructive">{trainError}</p>
                )}
                {trainSuccess && (
                  <p className="text-sm text-green-600">{trainSuccess}</p>
                )}

                {/* Training Items List */}
                {trainingItems.length > 0 && (
                  <div className="border-t border-border pt-4 mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">
                        Training Items ({trainingItems.filter(t => t.status === "ready").length} ready)
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleExportDataset}
                        disabled={exportLoading || trainingItems.filter(t => t.status === "ready").length === 0}
                      >
                        {exportLoading ? "Exporting..." : "Export Dataset"}
                      </Button>
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {trainingItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded">
                          <span className="truncate">{item.als_filename?.replace(/\.als$/i, "") ?? "Unknown"}</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-medium",
                            item.status === "ready" && "bg-green-100 text-green-800",
                            item.status === "exported" && "bg-blue-100 text-blue-800",
                            item.status === "failed" && "bg-red-100 text-red-800"
                          )}>
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                    {datasetUrl && (
                      <div className="mt-2 p-2 bg-green-50 rounded text-xs">
                        <p className="font-medium text-green-800">Dataset exported!</p>
                        <a href={datasetUrl} target="_blank" rel="noopener noreferrer" className="text-green-600 underline break-all">
                          {datasetUrl}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Chat messages (Production/Generate modes) */}
                <div className="h-64 overflow-y-auto border border-border rounded-lg p-3 bg-muted/30">
                  {chatMessages.length === 0 && !chatLoading && (
                    <p className="text-sm text-muted-foreground">
                      {chatMode === "production" && "Ask me anything about your production workflow..."}
                      {chatMode === "generate" && "Describe the music you want to generate..."}
                    </p>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`mb-3 text-sm ${
                        msg.role === "user" ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <span className="font-semibold">
                        {msg.role === "user" ? "You: " : "AI: "}
                      </span>
                      {msg.content}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="text-sm text-muted-foreground italic">
                      Thinking…
                    </div>
                  )}
                </div>

                {/* Input row */}
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1"
                    disabled={chatLoading}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={chatLoading || !chatInput.trim()}
                  >
                    Send
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ALS Summaries + Slide-out */}
        <div className="flex items-stretch gap-0 h-[600px]">
          <Card
            className={cn(
              "w-[520px] h-full flex flex-col overflow-hidden gap-0",
              selectedParse && "rounded-r-none border-r-0"
            )}
          >
            <CardHeader className="pb-0 shrink-0">
              <div className="flex items-center justify-between h-9">
                <CardTitle>Project Library</CardTitle>
                {parsesLoading && (
                  <span className="text-xs text-muted-foreground">
                    Loading…
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between min-w-0 gap-4">
                <span className="text-sm text-muted-foreground truncate">
                  Your connected Ableton Live projects
                </span>
                <span className="text-sm text-muted-foreground shrink-0">Date</span>
              </div>
            </CardHeader>
            <div className="border-b border-border mx-6 mt-4 shrink-0" />
            <CardContent className="flex-1 overflow-y-auto px-6 py-0">
              {!artistId && (
                <p className="text-sm text-muted-foreground py-4">
                  Link an artist first to see your projects.
                </p>
              )}

              {parsesError && (
                <p className="text-sm text-destructive py-4">
                  Error loading projects: {parsesError}
                </p>
              )}

              {artistId && !parsesLoading && parses.length === 0 && !parsesError && (
                <p className="text-sm text-muted-foreground py-4">
                  No projects found yet for this artist.
                </p>
              )}

              {parses.length > 0 && (
                <div className="flex flex-col divide-y divide-border">
                    {parses.map((row) => {
                      const alsDisplayName = row.als_filename
                        ? row.als_filename.replace(/\.als$/i, "")
                        : "—";

                      return (
                        <div
                          key={row.id}
                          className="flex items-center justify-between gap-4 py-3"
                        >
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span
                              onClick={() => setSelectedParse(row)}
                              className="text-sm font-semibold leading-none tracking-tight truncate cursor-pointer hover:underline decoration-foreground"
                            >
                              {alsDisplayName}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {row.project_name ?? "—"}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {row.parse_timestamp
                              ? new Date(row.parse_timestamp).toLocaleDateString()
                              : "—"}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Divider - always mounted */}
          <div
            className={cn(
              "w-px bg-border self-stretch transition-opacity duration-200",
              selectedParse ? "opacity-100" : "opacity-0"
            )}
          />

          {/* Summary Slide-out - always mounted, width toggles */}
          <div
            className={cn(
              "h-full overflow-hidden transition-all duration-200",
              selectedParse ? "w-[520px]" : "w-0"
            )}
          >
            <Card className="w-[520px] h-full flex flex-col overflow-hidden border-l-0 rounded-l-none gap-0">
              <CardHeader className="pb-0 shrink-0">
                <div className="flex items-center justify-between h-9">
                  <CardTitle>Summary</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedParse(null)}
                    className="shrink-0 h-9 w-9"
                  >
                    <span className="text-lg">×</span>
                  </Button>
                </div>
                <div className="flex items-center justify-between min-w-0 gap-4">
                  <span className="text-sm text-muted-foreground truncate">
                    {selectedParse?.als_filename?.replace(/\.als$/i, "") ?? "\u00A0"}
                  </span>
                  {/* keep structure identical to left header row */}
                  <span className="text-sm text-muted-foreground opacity-0 select-none shrink-0">
                    Date
                  </span>
                </div>
              </CardHeader>
              <div className="border-b border-border mx-6 mt-4 shrink-0" />
              <CardContent className="flex-1 overflow-y-auto overflow-x-hidden p-3">
                {selectedParse?.summary ? (
                  <pre className="m-0 text-xs font-mono whitespace-pre-wrap [overflow-wrap:anywhere] break-words">
                    {JSON.stringify(selectedParse.summary, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">No summary data available.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}
