"use client";

import { useState } from "react";

export function AvaContextRefreshControl({ canRequest }: { canRequest: boolean }) {
  const [message, setMessage] = useState("");
  const [requesting, setRequesting] = useState(false);

  async function requestRefresh() {
    setRequesting(true);
    setMessage("");
    const response = await fetch("/api/ava/context/approval", { method: "POST" });
    const result = await response.json().catch(() => ({}));
    setRequesting(false);
    setMessage(response.ok
      ? "Manual refresh requested. Approve the pending Ava action to run it within today's usage limit."
      : result.error || "I could not create the refresh approval.");
  }

  return (
    <div className="runtime-refresh-control">
      <button className="inline-button" type="button" disabled={!canRequest || requesting} onClick={() => void requestRefresh()}>
        {requesting ? "Requesting..." : "Request manual refresh"}
      </button>
      {message ? <p className="subtle">{message}</p> : null}
    </div>
  );
}
