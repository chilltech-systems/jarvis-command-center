"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Color, Group, Vector3 } from "three";
import type { AvaNebulaMemory } from "@/lib/ava/nebula-feed";

const COLORS = { critical: "#ff426d", high: "#ffb44f", normal: "#8e74ff", low: "#55dfff" };

export function MemoryConstellation({ memories, active, reducedMotion }: { memories: AvaNebulaMemory[]; active: boolean; reducedMotion: boolean }) {
  const group = useRef<Group>(null);
  const points = useMemo(() => memories.slice(0, 12).map((memory, index) => {
    const angle = index * 2.39996;
    const radius = 1.05 + (index % 4) * 0.18;
    return {
      memory,
      position: new Vector3(Math.cos(angle) * radius, Math.sin(angle * 1.7) * 0.68, Math.sin(angle) * radius * 0.65),
    };
  }), [memories]);

  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * (reducedMotion ? 0.015 : 0.055);
    group.current.rotation.z = Math.sin(clock.elapsedTime * 0.12) * 0.05;
  });

  if (!active || points.length === 0) return null;
  return (
    <group ref={group}>
      {points.map(({ memory, position }, index) => (
        <group key={memory.id}>
          <Line points={[[0, 0, 0], position]} color={COLORS[memory.severity]} transparent opacity={0.13} lineWidth={0.7} />
          <mesh position={position}>
            <sphereGeometry args={[0.035 + (index % 3) * 0.012, 12, 10]} />
            <meshBasicMaterial color={new Color(COLORS[memory.severity])} transparent opacity={0.88} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
