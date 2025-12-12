"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
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

        {/* ALS Summaries + Slide-out */}
        <div className="flex items-start gap-0 max-h-[600px]">
        <Card className="flex-1 gap-0 max-h-[600px] overflow-hidden flex flex-col">
          <CardHeader className="py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle>Project Library</CardTitle>
                <CardDescription>
                  Your connected Ableton Live projects
                </CardDescription>
              </div>
              {parsesLoading && (
                <span className="text-xs text-muted-foreground">
                  Loading…
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-6 py-0 flex-1 overflow-y-auto">
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
              <div className="flex flex-col">
                <div className="flex items-center justify-between py-2 text-xs font-medium text-muted-foreground">
                  <span>Session</span>
                  <span>Date</span>
                </div>
                <div className="border-b border-border" />
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
              </div>
            )}
          </CardContent>
        </Card>

          {/* Summary Slide-out */}
          {selectedParse && (
            <>
            <div className="w-px bg-border" />
            <Card className="w-[520px] max-h-[600px] flex flex-col overflow-hidden border-l-0 rounded-l-none">
              <CardHeader className="py-4 border-b border-border shrink-0">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle>
                      {selectedParse.als_filename?.replace(/\.als$/i, "") ?? "Summary"}
                    </CardTitle>
                    <CardDescription>
                      {selectedParse.project_name ?? "Project details"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedParse(null)}
                    className="shrink-0"
                  >
                    <span className="text-lg">×</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto py-4 px-6">
                {selectedParse.summary ? (
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                    {JSON.stringify(selectedParse.summary, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">No summary data available.</p>
                )}
              </CardContent>
            </Card>
            </>
          )}
        </div>
        </div>
      </main>
    </div>
  );
}
