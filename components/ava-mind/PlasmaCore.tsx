"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, BackSide, ShaderMaterial, Vector3 } from "three";
import { plasmaCoreFragmentShader, plasmaCoreVertexShader } from "@/shaders/plasmaCore";
import type { InteractionStore } from "@/components/ava-mind/interaction-store";
import type { AvaMindControls } from "@/types/ava-mind";

export function PlasmaCore({
  interaction,
  controls,
  reducedMotion,
}: {
  interaction: React.MutableRefObject<InteractionStore>;
  controls: AvaMindControls;
  reducedMotion: boolean;
}) {
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uCoreIntensity: { value: controls.coreIntensity },
    uTurbulence: { value: controls.fieldTurbulence },
    uFogDensity: { value: controls.fogDensity },
    uRaymarchSteps: { value: controls.raymarchSteps },
    uPointer: { value: new Vector3() },
    uDisturbance: { value: 0 },
    uBreathing: { value: controls.nebulaBreathing },
  }), [controls.coreIntensity, controls.fieldTurbulence, controls.fogDensity, controls.nebulaBreathing, controls.raymarchSteps]);

  useFrame(({ clock }, delta) => {
    if (!material.current) return;
    const speed = reducedMotion ? 0.34 : 1;
    const store = interaction.current;
    material.current.uniforms.uTime.value = clock.elapsedTime * speed;
    material.current.uniforms.uCoreIntensity.value = controls.coreIntensity;
    material.current.uniforms.uTurbulence.value = controls.fieldTurbulence;
    material.current.uniforms.uFogDensity.value = controls.fogDensity;
    material.current.uniforms.uRaymarchSteps.value = controls.raymarchSteps;
    material.current.uniforms.uBreathing.value = controls.nebulaBreathing;
    material.current.uniforms.uPointer.value.lerp(store.pointerLocal, Math.min(1, delta * 7));
    material.current.uniforms.uDisturbance.value = store.disturbanceStrength;
  });

  return (
    <mesh scale={[1.55, 1.42, 1.5]} frustumCulled={false}>
      <sphereGeometry args={[1.42, 42, 24]} />
      <shaderMaterial
        ref={material}
        vertexShader={plasmaCoreVertexShader}
        fragmentShader={plasmaCoreFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={AdditiveBlending}
        side={BackSide}
        toneMapped={false}
      />
    </mesh>
  );
}
