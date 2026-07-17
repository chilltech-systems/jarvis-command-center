"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial, Vector3 } from "three";
import { createSeededRandom, randomRange } from "@/lib/seeded-random";
import type { InteractionStore } from "@/components/ava-mind/interaction-store";
import type { AvaMindControls } from "@/types/ava-mind";

const fogVertexShader = `
attribute float fogSize;
attribute float fogSeed;
varying float vAlpha;
uniform float uTime;
uniform float uTurbulence;
uniform float uDisturbance;
uniform vec3 uPointer;
uniform vec3 uPointerDirection;

void main() {
  vec3 transformed = position;
  float pulse = sin(uTime * (0.22 + fogSeed * 0.42) + fogSeed * 19.0);
  float curlX = sin(position.y * 2.8 + uTime * 0.37 + fogSeed * 5.0);
  float curlY = cos(position.z * 2.2 - uTime * 0.31 + fogSeed * 4.0);
  float curlZ = sin(position.x * 2.5 + uTime * 0.29 + fogSeed * 7.0);
  transformed += vec3(curlX, curlY, curlZ) * 0.045 * uTurbulence;
  transformed *= 1.0 + pulse * 0.035 * uTurbulence;
  float pointerDistance = distance(transformed, uPointer);
  float wake = exp(-pointerDistance * 2.9) * uDisturbance;
  transformed += (normalize(transformed - uPointer) * 0.08 + uPointerDirection * 0.16) * wake;
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = fogSize * (72.0 / -mvPosition.z);
  vAlpha = smoothstep(2.3, 0.3, length(transformed)) * (0.62 + pulse * 0.25);
}
`;

const fogFragmentShader = `
varying float vAlpha;
uniform float uOpacity;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float radius = length(uv);
  float smoke = smoothstep(0.5, 0.0, radius);
  float alpha = smoke * smoke * vAlpha * uOpacity * 0.2;
  vec3 color = mix(vec3(0.04, 0.16, 0.72), vec3(0.22, 0.78, 1.0), smoke);
  gl_FragColor = vec4(color * (0.26 + smoke * 0.45), alpha);
}
`;

export function VolumetricFog({
  controls,
  interaction,
  reducedMotion,
}: {
  controls: AvaMindControls;
  interaction: React.MutableRefObject<InteractionStore>;
  reducedMotion: boolean;
}) {
  const points = useRef<Points>(null);
  const material = useRef<ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const random = createSeededRandom(38421);
    const count = controls.quality === "high" ? 230 : controls.quality === "medium" ? 160 : 90;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const seeds = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const radius = randomRange(random, 0.28, 1.62);
      const theta = randomRange(random, 0, Math.PI * 2);
      const phi = Math.acos(randomRange(random, -0.96, 0.96));
      const lobe = 1 + Math.sin(theta * 3.0 + phi * 2.0) * 0.16 + randomRange(random, -0.18, 0.22);
      positions[index * 3] = Math.sin(phi) * Math.cos(theta) * radius * lobe;
      positions[index * 3 + 1] = Math.sin(phi) * Math.sin(theta) * radius * randomRange(random, 0.82, 1.14);
      positions[index * 3 + 2] = Math.cos(phi) * radius * randomRange(random, 0.86, 1.18);
      sizes[index] = randomRange(random, 6, 18);
      seeds[index] = random();
    }
    const result = new BufferGeometry();
    result.setAttribute("position", new BufferAttribute(positions, 3));
    result.setAttribute("fogSize", new BufferAttribute(sizes, 1));
    result.setAttribute("fogSeed", new BufferAttribute(seeds, 1));
    return result;
  }, [controls.quality]);

  useFrame(({ clock }, delta) => {
    if (!material.current || !points.current) return;
    const speed = reducedMotion ? 0.28 : 1;
    const store = interaction.current;
    material.current.uniforms.uTime.value = clock.elapsedTime * speed;
    material.current.uniforms.uOpacity.value = controls.fogDensity;
    material.current.uniforms.uTurbulence.value = controls.fieldTurbulence;
    material.current.uniforms.uDisturbance.value = store.disturbanceStrength;
    material.current.uniforms.uPointer.value.lerp(store.pointerLocal, Math.min(1, delta * 5));
    material.current.uniforms.uPointerDirection.value.lerp(store.pointerDirection, Math.min(1, delta * 8));
    points.current.rotation.y += delta * controls.idleRotationSpeed * 0.32 * speed;
    points.current.rotation.x = Math.sin(clock.elapsedTime * 0.11) * 0.025 * controls.nebulaBreathing;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={fogVertexShader}
        fragmentShader={fogFragmentShader}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
          uOpacity: { value: controls.fogDensity },
          uTurbulence: { value: controls.fieldTurbulence },
          uDisturbance: { value: 0 },
          uPointer: { value: interaction.current.pointerLocal.clone() },
          uPointerDirection: { value: new Vector3() },
        }}
      />
    </points>
  );
}
