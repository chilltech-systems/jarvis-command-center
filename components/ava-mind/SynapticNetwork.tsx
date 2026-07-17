"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, ShaderMaterial, Vector3 } from "three";
import { connectionFragmentShader } from "@/shaders/connectionFragment";
import { connectionVertexShader } from "@/shaders/connectionVertex";
import type { InteractionStore } from "@/components/ava-mind/interaction-store";
import type { AvaMindControls, NeuralNode, SynapticConnection } from "@/types/ava-mind";

const FIBER_SEGMENTS = 6;

function fiberPoint(from: Vector3, to: Vector3, progress: number, seed: number, time: number) {
  const base = from.clone().lerp(to, progress);
  const chord = to.clone().sub(from);
  const normal = from.clone().add(to).normalize();
  const side = new Vector3(-chord.z, Math.sin(seed * 1.7) * 0.5, chord.x).normalize();
  const bow = Math.sin(progress * Math.PI);
  const crawl = Math.sin(time * (0.7 + seed * 0.03) + progress * 8.0 + seed) * 0.018;
  return base
    .add(normal.multiplyScalar(bow * (0.035 + (seed % 7) * 0.006)))
    .add(side.multiplyScalar((bow * bow) * (0.025 + (seed % 5) * 0.004) + crawl));
}

export function SynapticNetwork({
  nodes,
  connections,
  interaction,
  controls,
}: {
  nodes: NeuralNode[];
  connections: SynapticConnection[];
  interaction: React.MutableRefObject<InteractionStore>;
  controls: AvaMindControls;
}) {
  const material = useRef<ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const vertexCount = connections.length * FIBER_SEGMENTS * 2;
    const positions = new Float32Array(vertexCount * 3);
    const strengths = new Float32Array(vertexCount);
    connections.forEach((connection, index) => {
      const from = new Vector3(...nodes[connection.from].position);
      const to = new Vector3(...nodes[connection.to].position);
      for (let segment = 0; segment < FIBER_SEGMENTS; segment += 1) {
        const vertexOffset = (index * FIBER_SEGMENTS + segment) * 2;
        const a = fiberPoint(from, to, segment / FIBER_SEGMENTS, connection.id + 1, 0);
        const b = fiberPoint(from, to, (segment + 1) / FIBER_SEGMENTS, connection.id + 1, 0);
        positions.set(a.toArray(), vertexOffset * 3);
        positions.set(b.toArray(), (vertexOffset + 1) * 3);
        strengths[vertexOffset] = connection.strength;
        strengths[vertexOffset + 1] = connection.strength;
      }
    });
    const result = new BufferGeometry();
    const positionAttr = new BufferAttribute(positions, 3);
    positionAttr.setUsage(DynamicDrawUsage);
    result.setAttribute("position", positionAttr);
    result.setAttribute("lineStrength", new BufferAttribute(strengths, 1));
    return result;
  }, [connections, nodes]);

  useFrame(({ clock }) => {
    const position = geometry.getAttribute("position") as BufferAttribute;
    const values = position.array as Float32Array;
    const strength = geometry.getAttribute("lineStrength") as BufferAttribute;
    const selectedRegionId = interaction.current.focus.region?.id ?? null;

    connections.forEach((connection, index) => {
      const from = nodes[connection.from];
      const to = nodes[connection.to];
      const focus = selectedRegionId ? (from.regionId === selectedRegionId || to.regionId === selectedRegionId ? 1 : 0.22) : 1;
      const fromPosition = new Vector3(...from.position);
      const toPosition = new Vector3(...to.position);
      for (let segment = 0; segment < FIBER_SEGMENTS; segment += 1) {
        const vertexOffset = (index * FIBER_SEGMENTS + segment) * 2;
        const a = fiberPoint(fromPosition, toPosition, segment / FIBER_SEGMENTS, connection.id + 1, clock.elapsedTime);
        const b = fiberPoint(fromPosition, toPosition, (segment + 1) / FIBER_SEGMENTS, connection.id + 1, clock.elapsedTime);
        values.set(a.toArray(), vertexOffset * 3);
        values.set(b.toArray(), (vertexOffset + 1) * 3);
        strength.setX(vertexOffset, connection.strength * focus);
        strength.setX(vertexOffset + 1, connection.strength * focus);
      }
    });
    position.needsUpdate = true;
    strength.needsUpdate = true;

    if (material.current) {
      material.current.uniforms.uTime.value = clock.elapsedTime;
      material.current.uniforms.uOpacity.value = controls.connectionOpacity;
    }
  });

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        vertexShader={connectionVertexShader}
        fragmentShader={connectionFragmentShader}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
          uOpacity: { value: controls.connectionOpacity },
          uColor: { value: new Color("#59d7ff") },
        }}
      />
    </lineSegments>
  );
}
