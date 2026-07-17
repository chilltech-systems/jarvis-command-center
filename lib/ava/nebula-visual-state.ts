import type { AvaNebulaRegionId, AvaNebulaSnapshotV2 } from "@/lib/ava/nebula-feed";

export type AvaVoiceVisualMode = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "approval_required" | "error";
export type AvaAwakeningPhase = "dormant" | "initializing" | "igniting" | "online";
export type NebulaViewMode = "home" | "entering" | "cognition" | "exiting";

export type NebulaVisualState = {
  healthTone: "calm" | "focus" | "warning" | "critical";
  globalIntensity: number;
  bloomIntensity: number;
  coreIntensity: number;
  breathing: number;
  signalFrequency: number;
  turbulence: number;
  fogDensity: number;
  focusedRegionId: AvaNebulaRegionId | null;
  regionActivity: Partial<Record<AvaNebulaRegionId, number>>;
  voiceMode: AvaVoiceVisualMode;
  voiceEnergy: number;
  awakeningPhase: AvaAwakeningPhase;
  awakeningProgress: number;
  memoryMode: boolean;
  showcaseMode: boolean;
  viewMode: NebulaViewMode;
  viewTransitionProgress: number;
};

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function buildNebulaVisualState({
  snapshot,
  voiceMode = "idle",
  voiceEnergy = 0,
  awakeningPhase = "online",
  awakeningProgress = 1,
  memoryMode = false,
  showcaseMode = false,
  viewMode = "home",
  viewTransitionProgress = 0,
}: {
  snapshot: AvaNebulaSnapshotV2 | null;
  voiceMode?: AvaVoiceVisualMode;
  voiceEnergy?: number;
  awakeningPhase?: AvaAwakeningPhase;
  awakeningProgress?: number;
  memoryMode?: boolean;
  showcaseMode?: boolean;
  viewMode?: NebulaViewMode;
  viewTransitionProgress?: number;
}): NebulaVisualState {
  const missionStatus = snapshot?.missionStatus || "Calm";
  const healthTone = missionStatus === "Critical" ? "critical"
    : missionStatus === "Attention Needed" || missionStatus === "Busy" ? "warning"
      : missionStatus === "Focused" ? "focus"
        : "calm";
  const alertBoost = healthTone === "critical" ? 0.34 : healthTone === "warning" ? 0.18 : 0;
  const voiceBoost = voiceMode === "speaking" ? 0.24 : voiceMode === "thinking" ? 0.18 : voiceMode === "listening" ? 0.12 + voiceEnergy * 0.2 : 0;
  const awake = clamp(awakeningProgress);
  const cognitionMix = clamp(viewTransitionProgress);
  const cinematicIntensity = clamp(0.58 + alertBoost + voiceBoost, 0.2, 1.25);
  const homeIntensity = clamp(0.34 + alertBoost * 0.18, 0.26, 0.46);
  const intensity = (homeIntensity + (cinematicIntensity - homeIntensity) * cognitionMix) * (0.12 + awake * 0.88);

  return {
    healthTone,
    globalIntensity: intensity,
    bloomIntensity: 0.42 + intensity * (0.58 + cognitionMix * 0.32),
    coreIntensity: 0.24 + intensity * 0.24,
    breathing: (0.42 + cognitionMix * (voiceMode === "speaking" ? 1.23 : voiceMode === "listening" ? 0.78 + voiceEnergy : healthTone === "critical" ? 1.03 : 0.58)) * (0.2 + awake * 0.8),
    signalFrequency: (0.28 + cognitionMix * (voiceMode === "thinking" ? 1.82 : healthTone === "critical" ? 1.42 : healthTone === "warning" ? 1.07 : 0.72)) * (0.25 + awake * 0.75),
    turbulence: 0.3 + intensity * (0.38 + cognitionMix * 0.32),
    fogDensity: memoryMode ? 0.26 : 0.08 + intensity * (0.035 + cognitionMix * 0.035),
    focusedRegionId: cognitionMix > 0.5 ? snapshot?.currentFocus?.regionId || null : null,
    regionActivity: Object.fromEntries((snapshot?.regions || []).map((region) => [region.id, region.activity])),
    voiceMode,
    voiceEnergy: clamp(voiceEnergy),
    awakeningPhase,
    awakeningProgress: awake,
    memoryMode,
    showcaseMode,
    viewMode,
    viewTransitionProgress: cognitionMix,
  };
}
