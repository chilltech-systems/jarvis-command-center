"use client";

import { useRef, useState } from "react";
import { AvaPageShell, SectionHeader } from "@/app/components/ava-shell";
import { dailyBrief } from "@/lib/mock-data/ava";

const heygenDailyBriefVideo = "https://resource2.heygen.ai/video/transcode/ee2c9100fb1c4c13a6b63a59cd79a1df/v52edb928-1376-4169-94f5-eac1290ed87d/720x1280_nocap.mp4?response-content-disposition=attachment%3B+filename%2A%3DUTF-8%27%27Avatar%2520Video.mp4%3B";
const heygenDailyBriefPoster = "https://dynamic.heygen.ai/aws_pacific/avatar_tmp/9398c616c84c417e8817d2cfc3646905/ee2c9100fb1c4c13a6b63a59cd79a1df.jpeg";

export default function DailyBriefPage() {
  const [brief, setBrief] = useState(dailyBrief);
  const [loading, setLoading] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function generateBrief() {
    setLoading(true);
    const response = await fetch("/api/ava/daily-brief");
    if (response.ok) setBrief(await response.json());
    setLoading(false);
  }

  async function playBriefVideo() {
    const video = videoRef.current;
    if (!video) return;
    const wasMuted = video.muted;
    if (wasMuted) {
      video.muted = false;
      video.volume = 1;
      video.currentTime = 0;
      await video.play();
      setVideoMuted(false);
      return;
    }
    if (video.paused) {
      await video.play();
    } else {
      video.pause();
    }
    setVideoPlaying(true);
  }

  return (
    <AvaPageShell eyebrow="Ava Intelligence" title="Daily Brief" subtitle="I pulled the day into a calm operating brief.">
      <section className="panel">
        <SectionHeader title="Today's Summary" action={<button className="inline-button" type="button" onClick={generateBrief} disabled={loading}>{loading ? "Checking..." : "Refresh Brief"}</button>} />
        <p className="snapshot-copy">{brief.summary}</p>
      </section>
      <section className="brief-video-stage" aria-label="Ava video brief">
        <div className="brief-video-surface portrait" role="button" tabIndex={0} aria-label="Play or pause Ava video brief" onClick={playBriefVideo} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") void playBriefVideo(); }}>
          <video
            ref={videoRef}
            className="brief-video"
            src={heygenDailyBriefVideo}
            poster={heygenDailyBriefPoster}
            autoPlay
            loop
            muted={videoMuted}
            playsInline
            preload="metadata"
            aria-label="Ava video brief player"
            onPlay={() => setVideoPlaying(true)}
            onPause={() => setVideoPlaying(false)}
            onEnded={() => setVideoPlaying(false)}
          />
        </div>
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
