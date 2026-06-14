"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function login(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setMessage(error ? error.message : "Magic link sent. Check your inbox.");
  }

  return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={login}>
        <div className="eyebrow">Restricted operations interface</div>
        <h1>Identity Check</h1>
        <p className="subtle">Enter an approved administrator email to access Jarvis telemetry.</p>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@email.com" required />
        <button type="submit" style={{ marginTop: 12 }}>SEND MAGIC LINK</button>
        {message && <p className="subtle">{message}</p>}
      </form>
    </main>
  );
}
