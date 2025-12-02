"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Artist = {
  id: string;
  name: string | null;
};

export default function Dashboard() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [artistNameInput, setArtistNameInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // keep user id around for createArtist handler
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const init = async () => {
      // 1) Who is logged in?
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }

      userIdRef.current = user.id;
      setUserEmail(user.email ?? null);

      // 2) Do we already have an artist linked to this user?
      //    (for now, just load the first one)
      const { data, error } = await supabase
        .from("user_artists")
        .select("artist:artists(id, name)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading user_artists", error);
        setLoading(false);
        return;
      }

      if (data && (data as any).artist) {
        setArtist((data as any).artist as Artist);
      }

      setLoading(false);
    };

    init();
  }, [router]);

  const handleCreateArtist = async () => {
    if (!userIdRef.current) return;
    const trimmed = artistNameInput.trim();
    if (!trimmed) return;

    setSaving(true);

    // 3) Create a new artist row
    const { data: insertedArtist, error: insertError } = await supabase
      .from("artists")
      .insert({ name: trimmed })
      .select()
      .single();

    if (insertError || !insertedArtist) {
      console.error("Error creating artist", insertError);
      setSaving(false);
      return;
    }

    // 4) Link this user to that artist
    const { error: linkError } = await supabase.from("user_artists").insert({
      user_id: userIdRef.current,
      artist_id: insertedArtist.id,
      role: "owner",
    });

    if (linkError) {
      console.error("Error linking user to artist", linkError);
      setSaving(false);
      return;
    }

    setArtist(insertedArtist as Artist);
    setSaving(false);
  };

  if (loading) {
    return <main className="p-6">Loading…</main>;
  }

  // If no artist yet → show form to create one
  if (!artist) {
    return (
      <main className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p>User: {userEmail}</p>
        <p className="mt-4">Create your first artist/profile:</p>
        <input
          className="border px-3 py-2 rounded text-black"
          placeholder="Artist name (e.g., Legendcast)"
          value={artistNameInput}
          onChange={(e) => setArtistNameInput(e.target.value)}
        />
        <div>
          <button
            onClick={handleCreateArtist}
            className="mt-2 px-4 py-2 border rounded"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save artist"}
          </button>
        </div>
      </main>
    );
  }

  // Artist exists → show user + artist + ID
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p>User: {userEmail}</p>
      <p>Artist name: {artist.name}</p>
      <p>Artist ID: {artist.id}</p>
    </main>
  );
}