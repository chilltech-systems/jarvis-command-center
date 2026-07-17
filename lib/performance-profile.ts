import type { AvaMindQualityProfile } from "@/types/ava-mind";

export const QUALITY_PROFILES: Record<AvaMindQualityProfile["name"], AvaMindQualityProfile> = {
  high: {
    name: "high",
    nodeCount: 1040,
    maxConnections: 3400,
    particleCount: 520,
    pixelRatio: 1.9,
    bloomIntensity: 0.75,
    raymarchSteps: 58,
    postprocessing: true,
  },
  medium: {
    name: "medium",
    nodeCount: 820,
    maxConnections: 2200,
    particleCount: 340,
    pixelRatio: 1.45,
    bloomIntensity: 0.65,
    raymarchSteps: 42,
    postprocessing: true,
  },
  low: {
    name: "low",
    nodeCount: 620,
    maxConnections: 1400,
    particleCount: 180,
    pixelRatio: 1.15,
    bloomIntensity: 0.55,
    raymarchSteps: 24,
    postprocessing: false,
  },
};

export function chooseQualityProfile() {
  if (typeof window === "undefined") return QUALITY_PROFILES.medium;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 760px)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const memory = "deviceMemory" in navigator ? Number(navigator.deviceMemory) : 8;

  if (reducedMotion || coarse || narrow || memory <= 4) return QUALITY_PROFILES.low;
  if (memory <= 8 || window.devicePixelRatio < 1.5) return QUALITY_PROFILES.medium;
  return QUALITY_PROFILES.high;
}
