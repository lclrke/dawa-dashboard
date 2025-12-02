"use client";

import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // After Google login, send back to /dashboard
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      console.error("Error signing in", error.message);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center">
      <button
        onClick={handleSignIn}
        className="px-4 py-2 border rounded"
      >
        Sign in with Google
      </button>
    </main>
  );
}