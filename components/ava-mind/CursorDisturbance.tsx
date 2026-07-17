"use client";

/* eslint-disable react-hooks/immutability */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial } from "three";
import type { InteractionStore } from "@/components/ava-mind/interaction-store";

const TRAIL_POINTS = 36;

const trailVertexShader = `
attribute float trailAge;
attribute float trailIntensity;
varying float vAlpha;

void main() {
  float life = 1.0 - clamp(trailAge / 1.05, 0.0, 1.0);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = (3.0 + trailIntensity * 7.0) * life * (5.5 / max(1.0, -mvPosition.z));
  vAlpha = life * life * (0.2 + trailIntensity * 0.5);
}
`;

const trailFragmentShader = `
varying float vAlpha;
uniform float uOpacity;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float glow = smoothstep(0.5, 0.08, length(uv));
  vec3 color = mix(vec3(0.08, 0.48, 1.0), vec3(0.42, 0.94, 1.0), glow);
  gl_FragColor = vec4(color, glow * vAlpha * uOpacity);
}
`;

export function CursorDisturbance({ interaction }: { interaction: React.MutableRefObject<InteractionStore> }) {
  const points = useRef<Points>(null);
  const material = useRef<ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const positions = new Float32Array(TRAIL_POINTS * 3).fill(99);
    const ages = new Float32Array(TRAIL_POINTS).fill(99);
    const intensities = new Float32Array(TRAIL_POINTS);
    const result = new BufferGeometry();
    result.setAttribute("position", new BufferAttribute(positions, 3));
    result.setAttribute("trailAge", new BufferAttribute(ages, 1));
    result.setAttribute("trailIntensity", new BufferAttribute(intensities, 1));
    return result;
  }, []);

  useFrame((_, delta) => {
    const store = interaction.current;
    for (const sample of store.trailSamples) sample.age += delta;
    store.trailSamples = store.trailSamples.filter((sample) => sample.age <= 1.05).slice(-TRAIL_POINTS);

    const position = geometry.getAttribute("position") as BufferAttribute;
    const age = geometry.getAttribute("trailAge") as BufferAttribute;
    const intensity = geometry.getAttribute("trailIntensity") as BufferAttribute;
    const positions = position.array as Float32Array;
    const ages = age.array as Float32Array;
    const intensities = intensity.array as Float32Array;

    for (let index = 0; index < TRAIL_POINTS; index += 1) {
      const sample = store.trailSamples[index];
      if (sample) {
        positions.set(sample.position.toArray(), index * 3);
        ages[index] = sample.age;
        intensities[index] = sample.intensity;
      } else {
        positions[index * 3] = 99;
        positions[index * 3 + 1] = 99;
        positions[index * 3 + 2] = 99;
        ages[index] = 99;
        intensities[index] = 0;
      }
    }

    position.needsUpdate = true;
    age.needsUpdate = true;
    intensity.needsUpdate = true;
    if (material.current) material.current.uniforms.uOpacity.value = Math.min(0.82, 0.42 + store.disturbanceStrength * 0.4);
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={trailVertexShader}
        fragmentShader={trailFragmentShader}
        transparent
        opacity={0.5}
        depthWrite={false}
        depthTest={false}
        blending={AdditiveBlending}
        toneMapped
        uniforms={{ uOpacity: { value: 0.5 } }}
      />
    </points>
  );
}
