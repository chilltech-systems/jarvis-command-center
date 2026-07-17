"use client";

/* eslint-disable react-hooks/immutability */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, DynamicDrawUsage, InstancedMesh, Matrix4, NormalBlending, Object3D, Vector3 } from "three";
import { applySpringReturn, forceFromPointer } from "@/lib/interaction-physics";
import type { InteractionStore } from "@/components/ava-mind/interaction-store";
import type { AvaMindControls, CognitiveRegion, NeuralNode } from "@/types/ava-mind";
import type { NebulaVisualState } from "@/lib/ava/nebula-visual-state";

const PALETTE = [
  new Color("#dffbff"),
  new Color("#80eaff"),
  new Color("#2ab8ff"),
  new Color("#1f64ff"),
];

export function NeuralNodes({
  nodes,
  regions,
  interaction,
  controls,
  reducedMotion,
  visual,
}: {
  nodes: NeuralNode[];
  regions: CognitiveRegion[];
  interaction: React.MutableRefObject<InteractionStore>;
  controls: AvaMindControls;
  reducedMotion: boolean;
  visual: NebulaVisualState;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const matrix = useMemo(() => new Matrix4(), []);
  const displacement = useMemo(() => new Float32Array(nodes.length * 3), [nodes.length]);
  const velocity = useMemo(() => new Float32Array(nodes.length * 3), [nodes.length]);
  const regionActivity = useMemo(() => new Map(regions.map((region) => [region.id, visual.regionActivity[region.name] ?? region.activity])), [regions, visual.regionActivity]);

  useFrame(({ clock }, delta) => {
    const instanced = mesh.current;
    if (!instanced) return;
    const store = interaction.current;
    const pointerRadius = store.pointerVelocity > 0.9 ? 0.62 : 0.38;
    const forceScale = reducedMotion ? 0.12 : controls.cursorForce;
    const selectedRegionId = store.focus.region?.id ?? null;

    for (const node of nodes) {
      const i3 = node.id * 3;
      const original = new Vector3(...node.originalPosition);
      const nodeDisplacement = new Vector3(displacement[i3], displacement[i3 + 1], displacement[i3 + 2]);
      const nodeVelocity = new Vector3(velocity[i3], velocity[i3 + 1], velocity[i3 + 2]);

      if (store.pointerInside && forceScale > 0) {
        const force = forceFromPointer(
          original.clone().add(nodeDisplacement),
          store.pointerLocal,
          store.pointerDirection,
          Math.min(0.075, store.pointerVelocity * 0.018) * forceScale,
          pointerRadius,
        );
        if (force) {
          nodeVelocity.add(force);
          if (nodeVelocity.length() > 0.42) nodeVelocity.setLength(0.42);
        }
      }

      applySpringReturn(nodeDisplacement, nodeVelocity, controls.returnStiffness, controls.damping, delta);
      displacement[i3] = nodeDisplacement.x;
      displacement[i3 + 1] = nodeDisplacement.y;
      displacement[i3 + 2] = nodeDisplacement.z;
      velocity[i3] = nodeVelocity.x;
      velocity[i3 + 1] = nodeVelocity.y;
      velocity[i3 + 2] = nodeVelocity.z;

      const drift = reducedMotion ? 0.22 : 1;
      const driftOffset = Math.sin(clock.elapsedTime * node.driftSpeed + node.pulseOffset) * 0.012 * drift;
      const nextPosition = original
        .add(nodeDisplacement)
        .add(new Vector3(Math.sin(node.pulseOffset) * driftOffset, Math.cos(node.pulseOffset * 1.7) * driftOffset, Math.sin(node.pulseOffset * 0.7) * driftOffset));

      node.position = nextPosition.toArray();
      const pulse = Math.sin(clock.elapsedTime * node.pulseSpeed + node.pulseOffset) * 0.5 + 0.5;
      const hoverDistance = store.pointerInside ? nextPosition.distanceTo(store.pointerLocal) : 99;
      const hover = Math.max(0, 1 - hoverDistance / 0.46) * store.hoverStrength;
      const regionPulse = Math.sin(clock.elapsedTime * (0.8 + (regionActivity.get(node.regionId) ?? 0.5)) + node.pulseOffset * 0.3) * 0.5 + 0.5;
      const liveFocus = visual.focusedRegionId && regions.find((region) => region.name === visual.focusedRegionId)?.id;
      const focusId = selectedRegionId || liveFocus;
      const focusBoost = focusId ? (focusId === node.regionId ? 1.55 : visual.memoryMode ? 0.16 : 0.38) : visual.memoryMode ? 0.24 : 1;
      const scale = node.size * (1 + pulse * 0.16 + hover * 0.3 + (node.major ? regionPulse * 0.16 : 0)) * focusBoost;
      const cinematicTone = visual.viewTransitionProgress > 0.5;
      const toneColor = cinematicTone && visual.healthTone === "critical" ? new Color("#ff426d") : cinematicTone && visual.healthTone === "warning" ? new Color("#ffb44f") : cinematicTone && visual.voiceMode === "speaking" ? new Color("#b886ff") : null;
      const color = (toneColor && node.major ? toneColor : PALETTE[node.major ? 0 : node.importance > 0.45 ? 1 : node.importance > 0.2 ? 2 : 3]).clone();
      const intensity = Math.min(1.4, (node.brightness + pulse * 0.18 + hover * 0.34 + (node.major ? 0.18 : 0)) * focusBoost * visual.globalIntensity);

      dummy.position.copy(nextPosition);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      matrix.copy(dummy.matrix);
      instanced.setMatrixAt(node.id, matrix);
      instanced.setColorAt(node.id, color.multiplyScalar(intensity));
    }

    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, nodes.length]} onUpdate={(instance) => instance.instanceMatrix.setUsage(DynamicDrawUsage)}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color="#7beaff" transparent opacity={0.88} depthWrite={false} depthTest blending={NormalBlending} toneMapped />
    </instancedMesh>
  );
}
