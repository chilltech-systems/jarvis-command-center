"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Color, Group } from "three";
import { COGNITIVE_REGION_DEFS } from "@/lib/cognitive-regions";
import type { InteractionStore } from "@/components/ava-mind/interaction-store";
import type { NebulaVisualState } from "@/lib/ava/nebula-visual-state";

const CLUSTER_COLORS = ["#dffbff", "#78e8ff", "#2f8cff", "#68f5ff"];

export function CognitiveRegions({
  interaction,
  reducedMotion,
  visual,
}: {
  interaction: React.MutableRefObject<InteractionStore>;
  reducedMotion: boolean;
  visual: NebulaVisualState;
}) {
  const group = useRef<Group>(null);
  const clusterShells = useMemo(() => COGNITIVE_REGION_DEFS.flatMap((region, regionIndex) => (
    Array.from({ length: 3 }, (_, shellIndex) => ({
      id: `${region.id}-${shellIndex}`,
      center: region.center,
      radius: region.radius * (0.38 + shellIndex * 0.16),
      color: new Color(CLUSTER_COLORS[(regionIndex + shellIndex) % CLUSTER_COLORS.length]),
      opacity: ((0.035 + region.activity * 0.045) * 0.06) / (shellIndex + 1),
      regionName: region.name,
      scale: [
        1 + Math.sin(regionIndex * 1.7 + shellIndex) * 0.22,
        0.72 + Math.cos(regionIndex * 1.1 + shellIndex) * 0.16,
        1 + Math.sin(regionIndex * 0.9 - shellIndex) * 0.18,
      ] as [number, number, number],
      rotation: [regionIndex * 0.31, shellIndex * 0.72, regionIndex * 0.19] as [number, number, number],
    }))
  )), []);

  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    const speed = reducedMotion ? 0.22 : 1;
    group.current.rotation.y += delta * 0.018 * speed;
    group.current.rotation.x = Math.sin(clock.elapsedTime * 0.24) * 0.035;
    group.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 0.82) * 0.018 + interaction.current.signalBoost * 0.035);
  });

  return (
    <group ref={group}>
      {clusterShells.map((cluster) => (
        <mesh
          key={cluster.id}
          position={cluster.center}
          rotation={cluster.rotation}
          scale={[
            cluster.radius * cluster.scale[0],
            cluster.radius * cluster.scale[1],
            cluster.radius * cluster.scale[2],
          ]}
        >
          <sphereGeometry args={[1, 18, 10]} />
          <meshBasicMaterial
            color={visual.healthTone === "critical" && cluster.regionName === visual.focusedRegionId ? "#ff426d" : visual.healthTone === "warning" && cluster.regionName === visual.focusedRegionId ? "#ffb44f" : cluster.color}
            transparent
            opacity={cluster.opacity * (0.45 + (visual.regionActivity[cluster.regionName] ?? 0.5) * 1.3) * visual.globalIntensity}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      <pointLight color="#65ddff" intensity={0.35} distance={3.1} />
    </group>
  );
}
