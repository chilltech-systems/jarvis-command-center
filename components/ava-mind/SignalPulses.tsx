"use client";

/* eslint-disable react-hooks/immutability */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Color, InstancedMesh, Matrix4, Object3D, Vector3 } from "three";
import type { InteractionStore } from "@/components/ava-mind/interaction-store";
import type { AvaMindControls, NeuralNode, SignalPath } from "@/types/ava-mind";

export function SignalPulses({
  nodes,
  signals,
  interaction,
  controls,
  reducedMotion,
}: {
  nodes: NeuralNode[];
  signals: SignalPath[];
  interaction: React.MutableRefObject<InteractionStore>;
  controls: AvaMindControls;
  reducedMotion: boolean;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const matrix = useMemo(() => new Matrix4(), []);

  useFrame(({ clock }, delta) => {
    const instanced = mesh.current;
    if (!instanced) return;
    const boost = 1 + interaction.current.signalBoost * 1.6;
    interaction.current.signalBoost += (0 - interaction.current.signalBoost) * Math.min(1, delta * 1.7);
    const speedMod = (reducedMotion ? 0.38 : 1) * controls.signalFrequency * boost;

    signals.forEach((signal, index) => {
      signal.delay -= delta * speedMod;
      if (signal.delay <= 0) {
        signal.progress += delta * signal.speed * speedMod * (1 + signal.progress * 0.55);
      }
      if (signal.progress >= 1) {
        signal.progress = 0;
        signal.delay = 0.4 + ((Math.sin(clock.elapsedTime * 0.73 + signal.id) + 1) * 2.1);
        interaction.current.signalBoost = Math.max(interaction.current.signalBoost, signal.branch ? 0.28 : 0.12);
      }

      const from = new Vector3(...nodes[signal.from].position);
      const to = new Vector3(...nodes[signal.to].position);
      const progress = Math.min(1, Math.max(0, signal.progress));
      const arc = Math.sin(progress * Math.PI) * (signal.branch ? 0.22 : 0.12);
      const position = from.lerp(to, progress).add(new Vector3(0, arc, 0));
      const visible = signal.delay <= 0 ? 1 : 0.001;
      const scale = visible * (0.012 + Math.sin(progress * Math.PI) * 0.01);
      dummy.position.copy(position);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      matrix.copy(dummy.matrix);
      instanced.setMatrixAt(index, matrix);
      instanced.setColorAt(index, new Color(signal.branch ? "#dffbff" : "#62ddff").multiplyScalar(1.1 + Math.sin(progress * Math.PI) * 1.4));
    });

    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, signals.length]} frustumCulled={false}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial color="#dffbff" transparent opacity={0.84} depthWrite={false} blending={AdditiveBlending} toneMapped />
    </instancedMesh>
  );
}
