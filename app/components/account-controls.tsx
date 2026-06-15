"use client";

import { useEffect, useState } from "react";
import { LogOut, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AccountControlsProps = {
  compact?: boolean;
};

export function AccountControls({ compact = false }: AccountControlsProps) {
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function leave(switchAccount: boolean) {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign(switchAccount ? "/login?switch=1" : "/login");
  }

  if (!email) return null;

  return (
    <div className={compact ? "account-controls compact" : "account-controls"}>
      {!compact && <span className="account-email">{email}</span>}
      <button type="button" className="control-button" onClick={() => leave(true)} disabled={busy}>
        <RefreshCw size={13} /> Switch account
      </button>
      <button type="button" className="control-button" onClick={() => leave(false)} disabled={busy}>
        <LogOut size={13} /> Sign out
      </button>
    </div>
  );
}
