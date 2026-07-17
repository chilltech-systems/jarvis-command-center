"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, CatmullRomCurve3, Color, Group, Mesh, Vector3 } from "three";
import type { AvaNebulaEventV2, AvaNebulaRegionV2 } from "@/lib/ava/nebula-feed";

const TONE_COLORS = {
  calm: "#55dfff",
  focus: "#b886ff",
  warning: "#ffb44f",
  critical: "#ff426d",
};

export function CognitionEventPaths({ event, regions, reducedMotion }: { event: AvaNebulaEventV2 | null; regions: AvaNebulaRegionV2[]; reducedMotion: boolean }) {
  const pulse = useRef<Group>(null);
  const shockwave = useRef<Mesh>(null);
  const elapsed = useRef(0);
  const path = useMemo(() => {
    if (!event) return null;
    const points = event.presentation.path
      .map((regionId) => regions.find((region) => region.id === regionId)?.center)
      .filter(Boolean)
      .map((center) => new Vector3(...center!));
    return points.length > 1 ? new CatmullRomCurve3(points) : null;
  }, [event, regions]);
  const linePoints = useMemo(() => path?.getPoints(48) || [], [path]);
  const color = event ? TONE_COLORS[event.presentation.tone] : TONE_COLORS.calm;

  useFrame((_, delta) => {
    if (!event || !path) return;
    elapsed.current += delta * (reducedMotion ? 0.35 : 1) * (0.7 + event.presentation.intensity);
    if (pulse.current) {
      pulse.current.children.forEach((child, index) => {
        const progress = (elapsed.current * 0.22 + index * 0.24) % 1;
        child.position.copy(path.getPointAt(progress));
        child.scale.setScalar(0.7 + Math.sin(progress * Math.PI) * 0.9);
      });
    }
    if (shockwave.current) {
      const phase = (elapsed.current * 0.34) % 1;
      shockwave.current.scale.setScalar(0.35 + phase * 2.1);
      const material = shockwave.current.material;
      if (!Array.isArray(material)) material.opacity = event.presentation.shockwave ? (1 - phase) * 0.28 : 0;
    }
  });

  if (!event || !path) return null;
  const destination = regions.find((region) => region.id === event.regionId)?.center || [0, 0, 0];
  return (
    <group>
      <Line points={linePoints} color={color} transparent opacity={0.2 + event.presentation.intensity * 0.22} lineWidth={1.1} />
      <group ref={pulse}>
        {[0, 1, 2].map((index) => (
          <mesh key={index}>
            <sphereGeometry args={[0.025 + index * 0.003, 12, 10]} />
            <meshBasicMaterial color={new Color(color)} transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <mesh ref={shockwave} position={destination}>
        <ringGeometry args={[0.12, 0.15, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
