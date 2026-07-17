"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ACESFilmicToneMapping } from "three";
import { AvaMindScene } from "@/components/ava-mind/AvaMindScene";
import { SystemInterface } from "@/components/ava-mind/SystemInterface";
import { PerformanceManager } from "@/components/ava-mind/PerformanceManager";
import { useAvaRealtimeVoice } from "@/components/ava-mind/useAvaRealtimeVoice";
import type { AvaNebulaSnapshotV2 } from "@/lib/ava/nebula-feed";
import { buildNebulaVisualState, type AvaAwakeningPhase, type NebulaViewMode } from "@/lib/ava/nebula-visual-state";
import { chooseQualityProfile, QUALITY_PROFILES } from "@/lib/performance-profile";
import type { AvaMindControls, AvaMindQualityProfile } from "@/types/ava-mind";

function WebGLAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

export function AvaMindCanvas() {
  const [webgl, setWebgl] = useState(true);
  const [quality, setQuality] = useState<AvaMindQualityProfile>(() => QUALITY_PROFILES.medium);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [controls, setControls] = useState<AvaMindControls | null>(null);
  const [snapshot, setSnapshot] = useState<AvaNebulaSnapshotV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [memoryMode, setMemoryMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [showcaseMode, setShowcaseMode] = useState(false);
  const [viewMode, setViewMode] = useState<NebulaViewMode>("home");
  const [viewTransitionProgress, setViewTransitionProgress] = useState(0);
  const [awakeningProgress, setAwakeningProgress] = useState(0);
  const [awakeningPhase, setAwakeningPhase] = useState<AvaAwakeningPhase>("dormant");
  const voice = useAvaRealtimeVoice();
  const stopVoice = voice.stop;
  const lastSoundEventId = useRef<string | null>(null);
  const viewAnimationFrame = useRef(0);

  useEffect(() => {
    setWebgl(WebGLAvailable());
    const profile = chooseQualityProfile();
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setQuality(profile);
    setReducedMotion(motionQuery.matches);
    setControls({
      nodeCount: profile.nodeCount,
      connectionDistance: 0.34,
      connectionOpacity: profile.name === "low" ? 0.64 : 0.82,
      bloomIntensity: profile.bloomIntensity,
      coreIntensity: profile.name === "low" ? 0.3 : 0.36,
      fieldTurbulence: profile.name === "low" ? 0.52 : 1,
      fogDensity: profile.name === "low" ? 0.12 : 0.16,
      wispIntensity: profile.name === "low" ? 0.3 : 0.42,
      raymarchSteps: profile.raymarchSteps,
      nebulaBreathing: motionQuery.matches ? 0.22 : 1,
      cursorForce: motionQuery.matches ? 0.2 : 1,
      returnStiffness: 5.8,
      damping: 0.86,
      idleRotationSpeed: motionQuery.matches ? 0.008 : 0.018,
      signalFrequency: motionQuery.matches ? 0.48 : 1,
      particleCount: profile.particleCount,
      quality: profile.name,
    });

    const handleMotion = () => setReducedMotion(motionQuery.matches);
    motionQuery.addEventListener("change", handleMotion);
    return () => motionQuery.removeEventListener("change", handleMotion);
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = async () => {
      try {
        const response = await fetch("/api/ava/nebula-state", { cache: "no-store" });
        if (!response.ok) throw new Error("Nebula state unavailable");
        const next = await response.json() as AvaNebulaSnapshotV2;
        if (active) setSnapshot(next);
      } catch {
        // Keep the last valid frame; the interface will continue in degraded visual mode.
      } finally {
        if (active) {
          setLoading(false);
          timer = setTimeout(refresh, 8_000);
        }
      }
    };
    void refresh();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setAwakeningProgress(1);
      setAwakeningPhase("online");
      return;
    }
    const seen = window.sessionStorage.getItem("ava-nebula-awakened") === "1";
    const duration = seen ? 1_450 : 4_200;
    const started = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAwakeningProgress(eased);
      setAwakeningPhase(progress < 0.16 ? "dormant" : progress < 0.48 ? "initializing" : progress < 0.82 ? "igniting" : "online");
      if (progress < 1) frame = requestAnimationFrame(animate);
      else window.sessionStorage.setItem("ava-nebula-awakened", "1");
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion]);

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setShowcaseMode(false);
      clearTimeout(idleTimer);
      if (viewMode === "cognition") idleTimer = setTimeout(() => setShowcaseMode(true), 25_000);
    };
    ["pointermove", "pointerdown", "keydown", "touchstart"].forEach((event) => window.addEventListener(event, wake, { passive: true }));
    wake();
    return () => {
      clearTimeout(idleTimer);
      ["pointermove", "pointerdown", "keydown", "touchstart"].forEach((event) => window.removeEventListener(event, wake));
    };
  }, [viewMode]);

  useEffect(() => {
    if (voice.mode !== "idle") setShowcaseMode(false);
  }, [voice.mode]);

  const activeControls = useMemo(() => controls ?? {
    nodeCount: quality.nodeCount,
    connectionDistance: 0.34,
    connectionOpacity: 1,
    bloomIntensity: quality.bloomIntensity,
    coreIntensity: 0.36,
    fieldTurbulence: 1,
    fogDensity: 0.16,
    wispIntensity: 0.42,
    raymarchSteps: quality.raymarchSteps,
    nebulaBreathing: 1,
    cursorForce: 1,
    returnStiffness: 5.8,
    damping: 0.86,
    idleRotationSpeed: 0.018,
    signalFrequency: 1,
    particleCount: quality.particleCount,
    quality: quality.name,
  }, [controls, quality]);

  const visual = useMemo(() => buildNebulaVisualState({
    snapshot,
    voiceMode: voice.mode,
    voiceEnergy: voice.energy,
    awakeningPhase,
    awakeningProgress,
    memoryMode,
    showcaseMode,
    viewMode,
    viewTransitionProgress,
  }), [awakeningPhase, awakeningProgress, memoryMode, showcaseMode, snapshot, viewMode, viewTransitionProgress, voice.energy, voice.mode]);

  const cinematicControls = useMemo<AvaMindControls>(() => ({
    ...activeControls,
    bloomIntensity: Math.max(activeControls.bloomIntensity, visual.bloomIntensity),
    coreIntensity: visual.coreIntensity,
    fieldTurbulence: visual.turbulence,
    fogDensity: visual.fogDensity,
    nebulaBreathing: visual.breathing,
    signalFrequency: visual.signalFrequency,
  }), [activeControls, visual]);

  useEffect(() => {
    if (!soundEnabled || viewMode !== "cognition" || !snapshot?.recentEvents[0]) return;
    const event = snapshot.recentEvents[0];
    if (lastSoundEventId.current === event.id) return;
    lastSoundEventId.current = event.id;
    if (event.severity !== "critical" && event.severity !== "high") return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(event.severity === "critical" ? 174 : 264, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(event.severity === "critical" ? 88 : 174, context.currentTime + 0.55);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.75);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.8);
    return () => { void context.close(); };
  }, [snapshot?.recentEvents, soundEnabled, viewMode]);

  const animateView = useCallback((from: number, to: number, nextMode: NebulaViewMode, finishedMode: NebulaViewMode) => {
    cancelAnimationFrame(viewAnimationFrame.current);
    setViewMode(nextMode);
    const duration = reducedMotion ? 180 : nextMode === "entering" ? 1_150 : 920;
    const started = performance.now();
    const tick = (now: number) => {
      const linear = Math.min(1, (now - started) / duration);
      const eased = reducedMotion ? linear : 1 - Math.pow(1 - linear, 3);
      setViewTransitionProgress(from + (to - from) * eased);
      if (linear < 1) viewAnimationFrame.current = requestAnimationFrame(tick);
      else setViewMode(finishedMode);
    };
    viewAnimationFrame.current = requestAnimationFrame(tick);
  }, [reducedMotion]);

  const enterCognition = useCallback(() => {
    if (viewMode !== "home") return;
    setMemoryMode(false);
    setShowcaseMode(false);
    animateView(0, 1, "entering", "cognition");
  }, [animateView, viewMode]);

  const exitCognition = useCallback(() => {
    if (viewMode !== "cognition") return;
    stopVoice();
    setMemoryMode(false);
    setShowcaseMode(false);
    animateView(1, 0, "exiting", "home");
  }, [animateView, stopVoice, viewMode]);

  useEffect(() => () => cancelAnimationFrame(viewAnimationFrame.current), []);

  const skipAwakening = () => {
    setAwakeningProgress(1);
    setAwakeningPhase("online");
    window.sessionStorage.setItem("ava-nebula-awakened", "1");
  };

  if (!webgl) {
    return (
      <main className="ava-mind-page">
        <div className="ava-webgl-fallback">
          <span>AVA COGNITIVE CORE</span>
          <h1>WebGL is unavailable</h1>
          <p>This experience needs hardware-accelerated WebGL to render AVA&apos;s neural field.</p>
        </div>
      </main>
    );
  }

  return (
    <main className={`ava-mind-page view-${viewMode} tone-${visual.healthTone} ${memoryMode ? "memory-mode" : ""} ${showcaseMode ? "showcase-mode" : ""}`}>
      <Canvas
        className="ava-mind-canvas"
        dpr={[1, quality.pixelRatio]}
        camera={{ fov: 45, position: [0, 0.18, 4.45], near: 0.1, far: 18 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.9;
        }}
      >
        <color attach="background" args={["#01050b"]} />
        <Suspense fallback={null}>
          <AvaMindScene controls={cinematicControls} quality={quality} reducedMotion={reducedMotion} snapshot={snapshot} visual={visual} onEnterCognition={enterCognition} onExitCognition={exitCognition} />
        </Suspense>
      </Canvas>
      <SystemInterface
        snapshot={snapshot}
        visual={visual}
        loading={loading}
        memoryMode={memoryMode}
        soundEnabled={soundEnabled}
        awakeningActive={awakeningProgress < 1}
        voiceActive={voice.active}
        voiceError={voice.error}
        onToggleVoice={() => void voice.start()}
        onToggleMemory={() => setMemoryMode((value) => !value)}
        onToggleSound={() => setSoundEnabled((value) => !value)}
        onSkipAwakening={skipAwakening}
        onWake={() => setShowcaseMode(false)}
      />
      <PerformanceManager controls={activeControls} setControls={setControls} />
    </main>
  );
}
