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
    <main className="min-h-screen bg-background px-6 py-12 md:px-12 lg:px-24">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          {userEmail && (
            <p className="text-sm text-muted-foreground">{userEmail}</p>
          )}
        </header>

        {/* Artist Card */}
        <Card>
          <CardHeader>
            <CardTitle>Artist Profile</CardTitle>
            <CardDescription>
              {artistId
                ? "Your linked artist identity"
                : "Link your artist identity to access your DAW data"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {artistId ? (
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>{" "}
                  <span className="font-medium">{artistName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">ID:</span>{" "}
                  <span className="font-mono text-xs">{artistId}</span>
                </div>
              </div>
            ) : (
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
            )}
          </CardContent>
        </Card>

        {/* ALS Summaries Card */}
        <Card>
          <CardHeader>
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
          <CardContent>
            {!artistId && (
              <p className="text-sm text-muted-foreground">
                Link an artist first to see your projects.
              </p>
            )}

            {parsesError && (
              <p className="text-sm text-destructive">
                Error loading projects: {parsesError}
              </p>
            )}

            {artistId && !parsesLoading && parses.length === 0 && !parsesError && (
              <p className="text-sm text-muted-foreground">
                No projects found yet for this artist.
              </p>
            )}

            {parses.length > 0 && (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-6 font-medium text-muted-foreground">
                        Project
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                        Session
                      </th>
                      <th className="text-left py-3 px-6 font-medium text-muted-foreground">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {parses.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-3 px-6 font-medium">
                          {row.project_name ?? "—"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs">
                            {row.als_filename ?? "—"}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-xs text-muted-foreground">
                          {row.parse_timestamp
                            ? new Date(row.parse_timestamp).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
