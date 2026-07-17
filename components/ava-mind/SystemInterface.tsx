"use client";

import { Mic, MicOff, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import type { AvaNebulaSnapshotV2 } from "@/lib/ava/nebula-feed";
import type { NebulaVisualState } from "@/lib/ava/nebula-visual-state";

const PHASE_LABELS = {
  dormant: "Core dormant",
  initializing: "Initializing cognition",
  igniting: "Igniting neural regions",
  online: "System online",
};

const VOICE_LABELS = {
  idle: "Talk to Ava",
  connecting: "Connecting",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
  approval_required: "Approval needed",
  error: "Voice unavailable",
};

function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "Now" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function SystemInterface({
  snapshot,
  visual,
  loading,
  memoryMode,
  soundEnabled,
  awakeningActive,
  voiceActive,
  voiceError,
  onToggleVoice,
  onToggleMemory,
  onToggleSound,
  onSkipAwakening,
  onWake,
}: {
  snapshot: AvaNebulaSnapshotV2 | null;
  visual: NebulaVisualState;
  loading: boolean;
  memoryMode: boolean;
  soundEnabled: boolean;
  awakeningActive: boolean;
  voiceActive: boolean;
  voiceError: string | null;
  onToggleVoice: () => void;
  onToggleMemory: () => void;
  onToggleSound: () => void;
  onSkipAwakening: () => void;
  onWake: () => void;
}) {
  const recentEvents = snapshot?.recentEvents.slice(0, 4) || [];
  const status = loading ? "Synchronizing" : snapshot?.missionStatus || "Calm";

  if (visual.viewMode === "home" || visual.viewMode === "exiting" || (visual.viewMode === "entering" && visual.viewTransitionProgress < 0.58)) {
    return (
      <div className={`ava-system-interface ava-home-interface tone-${visual.healthTone} view-${visual.viewMode}`} onPointerDown={onWake}>
        <section className="ava-core-id ava-home-core-id">
          <strong>AVA</strong>
          <span>System core</span>
          <em>{loading ? "Synchronizing" : `${status} · ${snapshot?.runtimeHealth.liveSources || 0} live sources`}</em>
        </section>
        <section className="ava-home-prompt" aria-label="Open active cognition">
          <span>Active cognition</span>
          <strong>Select core to enter</strong>
          <i />
        </section>
        <section className="ava-home-status" aria-live="polite">
          <span className="ava-status-dot" />
          <span>{snapshot?.currentFocus?.summary || snapshot?.runtimeHealth.summary || "I'm quietly monitoring the system."}</span>
        </section>
      </div>
    );
  }

  return (
    <div className={`ava-system-interface tone-${visual.healthTone} ${awakeningActive ? "awakening" : ""}`} onPointerDown={onWake}>
      <section className="ava-core-id">
        <strong>AVA</strong>
        <span>Cognitive Nebula</span>
        <em>{PHASE_LABELS[visual.awakeningPhase]}</em>
      </section>

      <section className="ava-live-mission" aria-live="polite">
        <span>{memoryMode ? "Memory constellation" : visual.showcaseMode ? "Ambient cognition" : status}</span>
        <strong>{memoryMode ? `${snapshot?.notableMemories.length || 0} retained signals` : snapshot?.currentFocus?.summary || snapshot?.runtimeHealth.summary || "I'm monitoring the field."}</strong>
      </section>

      {recentEvents.length ? (
        <section className="ava-event-rail" aria-label="Recent cognition events">
          <div className="ava-event-rail-heading"><span>Live cognition</span><i /></div>
          {recentEvents.map((event) => (
            <article key={event.id} className={`severity-${event.severity}`}>
              <span>{event.regionId.replaceAll("-", " ")}</span>
              <p>{event.summary}</p>
              <time>{formatTime(event.timestamp)}</time>
            </article>
          ))}
        </section>
      ) : null}

      <section className="ava-nebula-controls" aria-label="Nebula controls">
        <button type="button" className={voiceActive ? "active" : ""} onClick={onToggleVoice} title={voiceError || VOICE_LABELS[visual.voiceMode]}>
          {voiceActive ? <MicOff size={16} /> : <Mic size={16} />}
          <span>{VOICE_LABELS[visual.voiceMode]}</span>
        </button>
        <button type="button" className={memoryMode ? "active" : ""} onClick={onToggleMemory}>
          <RotateCcw size={16} /><span>{memoryMode ? "Return to now" : "Recall"}</span>
        </button>
        <button type="button" className={soundEnabled ? "active" : ""} onClick={onToggleSound}>
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}<span>Sound</span>
        </button>
      </section>

      <section className="ava-status-line">
        <span className="ava-status-dot" />
        <span>{visual.voiceMode !== "idle" ? VOICE_LABELS[visual.voiceMode] : `${snapshot?.runtimeHealth.liveSources || 0} live sources · ${status}`}</span>
      </section>
      <section className="ava-interaction-hint">
        <span>Drag to explore</span>
        <span>Select a bright region to enter focus</span>
      </section>

      {awakeningActive ? (
        <section className="ava-awakening-overlay" aria-label="Ava awakening">
          <div className="ava-awakening-mark"><span /><strong>{Math.round(visual.awakeningProgress * 100)}</strong></div>
          <p>{PHASE_LABELS[visual.awakeningPhase]}</p>
          <div className="ava-awakening-progress"><i style={{ width: `${visual.awakeningProgress * 100}%` }} /></div>
          <button type="button" onClick={onSkipAwakening}>{visual.awakeningProgress > 0.7 ? <Play size={13} /> : <Pause size={13} />} Skip sequence</button>
        </section>
      ) : null}
    </div>
  );
}
