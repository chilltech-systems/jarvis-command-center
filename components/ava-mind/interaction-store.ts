import { Vector3 } from "three";
import type { CognitiveRegion } from "@/types/ava-mind";
import type { NebulaViewMode } from "@/lib/ava/nebula-visual-state";

export type FocusState = {
  region: CognitiveRegion | null;
  focused: boolean;
};

export type TrailSample = {
  position: Vector3;
  age: number;
  intensity: number;
};

export type InteractionStore = {
  pointerLocal: Vector3;
  previousPointerLocal: Vector3;
  pointerDirection: Vector3;
  pointerVelocity: number;
  pointerLastTime: number;
  pointerActive: boolean;
  pointerInside: boolean;
  dragDistance: number;
  hoverStrength: number;
  disturbanceStrength: number;
  ripplePoint: Vector3;
  rippleStrength: number;
  focus: FocusState;
  signalBoost: number;
  trailSamples: TrailSample[];
  viewMode: NebulaViewMode;
  viewTransitionProgress: number;
  centralHover: boolean;
};

export function createInteractionStore(): InteractionStore {
  return {
    pointerLocal: new Vector3(99, 99, 99),
    previousPointerLocal: new Vector3(99, 99, 99),
    pointerDirection: new Vector3(),
    pointerVelocity: 0,
    pointerLastTime: 0,
    pointerActive: false,
    pointerInside: false,
    dragDistance: 0,
    hoverStrength: 0,
    disturbanceStrength: 0,
    ripplePoint: new Vector3(0, 1, 0),
    rippleStrength: 0,
    focus: { region: null, focused: false },
    signalBoost: 0,
    trailSamples: [],
    viewMode: "home",
    viewTransitionProgress: 0,
    centralHover: false,
  };
}
