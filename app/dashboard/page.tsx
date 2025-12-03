"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

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
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-8 py-12 text-white bg-black">
      <h1 className="text-5xl font-bold mb-8">Dashboard</h1>

      {userEmail && <p className="mb-4 text-lg">User: {userEmail}</p>}

      <p className="mb-2 text-lg">
        Current artist name: {artistName ?? "None yet"}
      </p>
      <p className="mb-8 text-lg">Current artist ID: {artistId ?? "—"}</p>

      {/* Artist form */}
      <form onSubmit={handleSaveArtist} className="max-w-md space-y-4 mb-12">
        <label className="block">
          <span className="block mb-1">Set artist name</span>
          <input
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            className="w-full px-3 py-2 rounded border border-gray-600 bg-black text-white"
            placeholder='e.g. "Love Thy Brother"'
          />
        </label>

        {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded border border-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save artist"}
        </button>
      </form>

      {/* ALS summaries */}
      <section className="border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-semibold">ALS Parses</h2>
          {parsesLoading && (
            <span className="text-xs text-gray-400">Loading parses…</span>
          )}
        </div>

        {!artistId && (
          <p className="text-sm text-gray-400">
            Link an artist first to see ALS parses.
          </p>
        )}

        {parsesError && (
          <p className="text-sm text-red-400">
            Error loading parses: {parsesError}
          </p>
        )}

        {artistId && !parsesLoading && parses.length === 0 && !parsesError && (
          <p className="text-sm text-gray-400">
            No parses found yet for this artist.
          </p>
        )}

        {parses.length > 0 && (
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 pr-4">Project</th>
                  <th className="text-left py-2 pr-4">ALS Filename</th>
                  <th className="text-left py-2 pr-4">Parse ID</th>
                  <th className="text-left py-2 pr-4">Parsed At</th>
                  <th className="text-left py-2 pr-4">
                    Tracks / Tempo (summary)
                  </th>
                </tr>
              </thead>
              <tbody>
                {parses.map((row) => {
                  const overview = row.summary?.overview ?? {};
                  const tempo = overview.tempo;
                  const totalTracks = overview.total_tracks;

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-gray-800 align-top"
                    >
                      <td className="py-2 pr-4 font-medium">
                        {row.project_name ?? "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <span className="font-mono text-xs">
                          {row.als_filename ?? "—"}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <span className="font-mono text-xs">
                          {row.parse_id ?? "—"}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {row.parse_timestamp
                          ? new Date(row.parse_timestamp).toLocaleString()
                          : "—"}
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {totalTracks != null && (
                          <div>Tracks: {String(totalTracks)}</div>
                        )}
                        {tempo != null && <div>Tempo: {String(tempo)}</div>}
                        {totalTracks == null && tempo == null && (
                          <div className="text-gray-500">
                            No overview fields in summary.
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}