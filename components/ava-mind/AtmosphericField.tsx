"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points } from "three";
import { createSeededRandom, randomRange } from "@/lib/seeded-random";
import type { InteractionStore } from "@/components/ava-mind/interaction-store";

export function AtmosphericField({
  particleCount,
  interaction,
  reducedMotion,
}: {
  particleCount: number;
  interaction: React.MutableRefObject<InteractionStore>;
  reducedMotion: boolean;
}) {
  const points = useRef<Points>(null);
  const geometry = useMemo(() => {
    const random = createSeededRandom(9917);
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i += 1) {
      const radius = randomRange(random, 1.72, 3.2);
      const theta = randomRange(random, 0, Math.PI * 2);
      const phi = Math.acos(randomRange(random, -0.9, 0.9));
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * radius * 0.78;
      positions[i * 3 + 2] = Math.cos(phi) * radius;
      sizes[i] = randomRange(random, 0.4, 1.8);
    }
    const result = new BufferGeometry();
    result.setAttribute("position", new BufferAttribute(positions, 3));
    result.setAttribute("size", new BufferAttribute(sizes, 1));
    return result;
  }, [particleCount]);

  useFrame(({ clock }, delta) => {
    if (!points.current) return;
    const speed = reducedMotion ? 0.18 : 1;
    points.current.rotation.y += delta * 0.012 * speed;
    points.current.rotation.x = Math.sin(clock.elapsedTime * 0.08) * 0.018;
    const influence = interaction.current.pointerInside ? interaction.current.pointerVelocity * 0.008 : 0;
    points.current.position.x += (Math.min(influence, 0.035) - points.current.position.x) * 0.045;
  });

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        color="#7ee7ff"
        size={0.012}
        transparent
        opacity={0.38}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
