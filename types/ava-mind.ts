import type { Vector3Tuple } from "three";

export type CognitiveRegionName =
  | "awareness"
  | "memory"
  | "reasoning"
  | "attention"
  | "timeline"
  | "world-model"
  | "personal-context"
  | "business-systems"
  | "home-systems";

export interface CognitiveRegion {
  id: string;
  name: CognitiveRegionName;
  displayName: string;
  description: string;
  center: Vector3Tuple;
  radius: number;
  activity: number;
  nodeIds: number[];
  majorNodeId: number;
}

export interface NeuralNode {
  id: number;
  originalPosition: Vector3Tuple;
  position: Vector3Tuple;
  velocity: Vector3Tuple;
  regionId: string;
  importance: number;
  pulseSpeed: number;
  pulseOffset: number;
  driftSpeed: number;
  size: number;
  brightness: number;
  major: boolean;
}

export interface SynapticConnection {
  id: number;
  from: number;
  to: number;
  strength: number;
  distance: number;
  regionId: string;
}

export interface SignalPath {
  id: number;
  from: number;
  to: number;
  progress: number;
  speed: number;
  delay: number;
  branch: boolean;
  regionId: string;
}

export interface NeuralGenerationResult {
  nodes: NeuralNode[];
  connections: SynapticConnection[];
  regions: CognitiveRegion[];
  signals: SignalPath[];
}

export type QualityProfileName = "high" | "medium" | "low";

export interface AvaMindQualityProfile {
  name: QualityProfileName;
  nodeCount: number;
  maxConnections: number;
  particleCount: number;
  pixelRatio: number;
  bloomIntensity: number;
  raymarchSteps: number;
  postprocessing: boolean;
}

export interface AvaMindControls {
  nodeCount: number;
  connectionDistance: number;
  connectionOpacity: number;
  bloomIntensity: number;
  coreIntensity: number;
  fieldTurbulence: number;
  fogDensity: number;
  wispIntensity: number;
  raymarchSteps: number;
  nebulaBreathing: number;
  cursorForce: number;
  returnStiffness: number;
  damping: number;
  idleRotationSpeed: number;
  signalFrequency: number;
  particleCount: number;
  quality: QualityProfileName;
}
