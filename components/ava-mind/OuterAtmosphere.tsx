"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, LineSegments, Points, ShaderMaterial, Vector3 } from "three";
import { createSeededRandom, randomRange } from "@/lib/seeded-random";
import type { InteractionStore } from "@/components/ava-mind/interaction-store";
import type { AvaMindControls } from "@/types/ava-mind";

const wispVertexShader = `
attribute float wispSize;
attribute float wispSeed;
varying float vLife;
uniform float uTime;
uniform float uWispIntensity;
uniform float uDisturbance;
uniform vec3 uPointer;
uniform vec3 uPointerDirection;

void main() {
  vec3 transformed = position;
  float drift = sin(uTime * (0.18 + wispSeed * 0.21) + wispSeed * 30.0);
  float edge = length(transformed);
  transformed += normalize(transformed) * drift * 0.12 * uWispIntensity;
  transformed += vec3(
    sin(transformed.y * 4.0 + uTime * 0.52 + wispSeed),
    cos(transformed.z * 3.4 - uTime * 0.47 + wispSeed * 2.0),
    sin(transformed.x * 3.8 + uTime * 0.39 + wispSeed * 3.0)
  ) * 0.06 * uWispIntensity;
  float wake = exp(-distance(transformed, uPointer) * 2.4) * uDisturbance;
  transformed += (normalize(transformed - uPointer) * 0.08 + uPointerDirection * 0.2) * wake;
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = wispSize * (58.0 / -mvPosition.z);
  vLife = smoothstep(2.55, 1.12, edge) * (0.66 + drift * 0.32);
}
`;

const wispFragmentShader = `
varying float vLife;
uniform float uOpacity;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float radius = length(uv);
  float soft = smoothstep(0.48, 0.0, radius);
  float streak = soft * (0.3 + smoothstep(0.28, 0.0, abs(uv.y)) * 0.7);
  vec3 color = mix(vec3(0.04, 0.22, 0.72), vec3(0.2, 0.68, 1.0), streak);
  gl_FragColor = vec4(color * (0.25 + streak * 0.55), streak * vLife * uOpacity * 0.38);
}
`;

function createArcGeometry(count: number) {
  const random = createSeededRandom(6149);
  const positions: number[] = [];
  const seeds: number[] = [];
  for (let arc = 0; arc < count; arc += 1) {
    const theta = randomRange(random, 0, Math.PI * 2);
    const phi = Math.acos(randomRange(random, -0.88, 0.88));
    const radius = randomRange(random, 1.35, 1.98);
    const origin = [
      Math.sin(phi) * Math.cos(theta) * radius,
      Math.sin(phi) * Math.sin(theta) * radius,
      Math.cos(phi) * radius,
    ];
    const tangent = [-Math.sin(theta), Math.cos(theta), randomRange(random, -0.35, 0.35)];
    const segments = 5;
    for (let step = 0; step < segments; step += 1) {
      const a = step / segments;
      const b = (step + 1) / segments;
      for (const t of [a, b]) {
        const curl = Math.sin(t * Math.PI) * randomRange(random, 0.08, 0.24);
        positions.push(
          origin[0] + tangent[0] * (t - 0.5) * randomRange(random, 0.2, 0.52) + origin[0] * curl,
          origin[1] + tangent[1] * (t - 0.5) * randomRange(random, 0.2, 0.52) + origin[1] * curl,
          origin[2] + tangent[2] * (t - 0.5) * randomRange(random, 0.2, 0.52) + origin[2] * curl,
        );
        seeds.push(random());
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("arcSeed", new BufferAttribute(new Float32Array(seeds), 1));
  return geometry;
}

export function OuterAtmosphere({
  controls,
  interaction,
  reducedMotion,
}: {
  controls: AvaMindControls;
  interaction: React.MutableRefObject<InteractionStore>;
  reducedMotion: boolean;
}) {
  const wisps = useRef<Points>(null);
  const arcs = useRef<LineSegments>(null);
  const wispMaterial = useRef<ShaderMaterial>(null);
  const arcMaterial = useRef<ShaderMaterial>(null);

  const wispGeometry = useMemo(() => {
    const random = createSeededRandom(72931);
    const count = controls.quality === "high" ? 620 : controls.quality === "medium" ? 410 : 230;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const seeds = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const radius = randomRange(random, 1.38, 2.45);
      const theta = randomRange(random, 0, Math.PI * 2);
      const phi = Math.acos(randomRange(random, -0.92, 0.92));
      const asymmetry = 1 + Math.sin(theta * 2.0 + phi * 3.0) * 0.18 + randomRange(random, -0.12, 0.2);
      positions[index * 3] = Math.sin(phi) * Math.cos(theta) * radius * asymmetry;
      positions[index * 3 + 1] = Math.sin(phi) * Math.sin(theta) * radius * randomRange(random, 0.76, 1.18);
      positions[index * 3 + 2] = Math.cos(phi) * radius * randomRange(random, 0.8, 1.2);
      sizes[index] = randomRange(random, 1, 4);
      seeds[index] = random();
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("wispSize", new BufferAttribute(sizes, 1));
    geometry.setAttribute("wispSeed", new BufferAttribute(seeds, 1));
    return geometry;
  }, [controls.quality]);

  const arcGeometry = useMemo(() => createArcGeometry(controls.quality === "high" ? 34 : controls.quality === "medium" ? 22 : 12), [controls.quality]);

  useFrame(({ clock }, delta) => {
    const speed = reducedMotion ? 0.24 : 1;
    const store = interaction.current;
    if (wispMaterial.current) {
      wispMaterial.current.uniforms.uTime.value = clock.elapsedTime * speed;
      wispMaterial.current.uniforms.uOpacity.value = controls.wispIntensity;
      wispMaterial.current.uniforms.uWispIntensity.value = controls.wispIntensity;
      wispMaterial.current.uniforms.uDisturbance.value = store.disturbanceStrength;
      wispMaterial.current.uniforms.uPointer.value.lerp(store.pointerLocal, Math.min(1, delta * 5));
      wispMaterial.current.uniforms.uPointerDirection.value.lerp(store.pointerDirection, Math.min(1, delta * 8));
    }
    if (arcMaterial.current) {
      arcMaterial.current.uniforms.uTime.value = clock.elapsedTime * speed;
      arcMaterial.current.uniforms.uOpacity.value = controls.wispIntensity * (0.54 + store.signalBoost * 0.9);
    }
    if (wisps.current) {
      wisps.current.rotation.y += delta * controls.idleRotationSpeed * 0.7 * speed;
      wisps.current.rotation.z = Math.sin(clock.elapsedTime * 0.07) * 0.018 * controls.nebulaBreathing;
    }
    if (arcs.current) {
      arcs.current.rotation.y -= delta * controls.idleRotationSpeed * 0.38 * speed;
      arcs.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 0.53) * 0.018 * controls.nebulaBreathing + store.disturbanceStrength * 0.025);
    }
  });

  return (
    <>
      <points ref={wisps} geometry={wispGeometry} frustumCulled={false}>
        <shaderMaterial
          ref={wispMaterial}
          vertexShader={wispVertexShader}
          fragmentShader={wispFragmentShader}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          uniforms={{
            uTime: { value: 0 },
            uOpacity: { value: controls.wispIntensity },
            uWispIntensity: { value: controls.wispIntensity },
            uDisturbance: { value: 0 },
            uPointer: { value: interaction.current.pointerLocal.clone() },
            uPointerDirection: { value: new Vector3() },
          }}
        />
      </points>
      <lineSegments ref={arcs} geometry={arcGeometry} frustumCulled={false}>
        <shaderMaterial
          ref={arcMaterial}
          vertexShader={`
            attribute float arcSeed;
            varying float vSeed;
            uniform float uTime;
            void main() {
              vSeed = arcSeed;
              vec3 transformed = position + normal * 0.0;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
            }
          `}
          fragmentShader={`
            varying float vSeed;
            uniform float uTime;
            uniform float uOpacity;
            void main() {
              float pulse = smoothstep(0.72, 1.0, sin(uTime * 2.3 + vSeed * 37.0) * 0.5 + 0.5);
              gl_FragColor = vec4(vec3(0.44, 0.92, 1.0) * (0.42 + pulse * 1.5), (0.025 + pulse * 0.09) * uOpacity);
            }
          `}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          uniforms={{
            uTime: { value: 0 },
            uOpacity: { value: controls.wispIntensity },
          }}
        />
      </lineSegments>
    </>
  );
}
