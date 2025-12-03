"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type ArtistRow = {
  artist_id: string;
  artists: { name: string } | null;
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
      <main className="min-h-screen flex items-center justify-center">
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-8 py-12 text-white bg-black">
      <h1 className="text-5xl font-bold mb-8">Dashboard</h1>

      {userEmail && (
        <p className="mb-4 text-lg">User: {userEmail}</p>
      )}

      <p className="mb-2 text-lg">
        Current artist name: {artistName ?? "None yet"}
      </p>
      <p className="mb-8 text-lg">
        Current artist ID: {artistId ?? "—"}
      </p>

      <form onSubmit={handleSaveArtist} className="max-w-md space-y-4">
        <label className="block">
          <span className="block mb-1">Set artist name</span>
          <input
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            className="w-full px-3 py-2 rounded border border-gray-600 bg-black text-white"
            placeholder='e.g. "Love Thy Brother"'
          />
        </label>

        {errorMsg && (
          <p className="text-red-400 text-sm">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded border border-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save artist"}
        </button>
      </form>
    </main>
  );
}