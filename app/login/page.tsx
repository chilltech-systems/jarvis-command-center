"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [message, setMessage] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("error") ?? "",
  );
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  }

  return (
    <main className="login-wrap">
      <section className="login-card">
        <div className="eyebrow">Restricted operations interface</div>
        <h1>Identity Check</h1>
        <p className="subtle">Sign in with an approved Google account to access Ava telemetry.</p>
        <button type="button" onClick={login} disabled={loading} style={{ marginTop: 12 }}>
          {loading ? "CONNECTING TO GOOGLE..." : "SIGN IN WITH GOOGLE"}
        </button>
        <p className="login-hint">Ava will ask which Google account to use on every new sign-in.</p>
        {message && <p className="auth-error">{message}</p>}
      </section>
    </main>
  );
}
