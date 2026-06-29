"use client";

import { useState } from "react";
import { AvaPageShell, SectionHeader } from "@/app/components/ava-shell";
import { dailyBrief } from "@/lib/mock-data/ava";

export default function DailyBriefPage() {
  const [brief, setBrief] = useState(dailyBrief);
  const [loading, setLoading] = useState(false);

  async function generateBrief() {
    setLoading(true);
    const response = await fetch("/api/ava/daily-brief");
    if (response.ok) setBrief(await response.json());
    setLoading(false);
  }

  return (
    <AvaPageShell eyebrow="Ava Intelligence" title="Daily Brief" subtitle="A structured operating brief for the day ahead.">
      <section className="panel">
        <SectionHeader title="Today's Summary" action={<button className="inline-button" type="button" onClick={generateBrief} disabled={loading}>{loading ? "Generating..." : "Generate Brief"}</button>} />
        <p className="snapshot-copy">{brief.summary}</p>
      </section>
      <section className="grid brief-grid home-section">
        {[
          ["Schedule Overview", brief.scheduleOverview],
          ["Task Priorities", brief.taskPriorities],
          ["Weather Impact", brief.weatherImpact],
          ["Business Pulse", brief.businessPulse],
          ["Automation Issues", brief.automationIssues],
          ["Suggested Focus", brief.suggestedFocus],
          ["Personal Notes", brief.personalNotes],
        ].map(([title, copy]) => <article className="panel" key={title}><SectionHeader title={title} /><p className="subtle">{copy}</p></article>)}
      </section>
    </AvaPageShell>
  );
}
