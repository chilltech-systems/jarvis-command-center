"use client";

/* eslint-disable react-hooks/immutability */

import { EffectComposer, Bloom, Noise, Vignette } from "@react-three/postprocessing";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Fog, Vector3 } from "three";
import { CognitiveNebula } from "@/components/ava-mind/CognitiveNebula";
import { createInteractionStore } from "@/components/ava-mind/interaction-store";
import { generateNeuralMind } from "@/lib/neural-generation";
import type { AvaMindControls, AvaMindQualityProfile } from "@/types/ava-mind";
import type { AvaNebulaSnapshotV2 } from "@/lib/ava/nebula-feed";
import type { NebulaVisualState } from "@/lib/ava/nebula-visual-state";

export function AvaMindScene({
  controls,
  quality,
  reducedMotion,
  snapshot,
  visual,
  onEnterCognition,
  onExitCognition,
}: {
  controls: AvaMindControls;
  quality: AvaMindQualityProfile;
  reducedMotion: boolean;
  snapshot: AvaNebulaSnapshotV2 | null;
  visual: NebulaVisualState;
  onEnterCognition: () => void;
  onExitCognition: () => void;
}) {
  const interaction = useRef(createInteractionStore());
  const mind = useMemo(() => generateNeuralMind(controls.nodeCount, quality.maxConnections), [controls.nodeCount, quality.maxConnections]);
  const { scene, camera, pointer, viewport } = useThree();

  useMemo(() => {
    scene.fog = new Fog("#01050b", 4.4, 8.5);
  }, [scene]);

  useFrame(({ clock }, delta) => {
    interaction.current.viewMode = visual.viewMode;
    interaction.current.viewTransitionProgress = visual.viewTransitionProgress;
    const cognitionMix = visual.viewTransitionProgress;
    const parallax = reducedMotion || viewport.width < 5 || interaction.current.pointerActive ? 0 : cognitionMix;
    if (visual.showcaseMode && !reducedMotion) {
      camera.position.x += (Math.sin(clock.elapsedTime * 0.11) * 0.34 - camera.position.x) * Math.min(1, delta * 0.35);
      camera.position.y += (0.18 + Math.cos(clock.elapsedTime * 0.09) * 0.12 - camera.position.y) * Math.min(1, delta * 0.35);
    } else {
    camera.position.x += (pointer.x * 0.13 * parallax - camera.position.x) * Math.min(1, delta * 1.1);
    camera.position.y += (0.18 + pointer.y * 0.08 * parallax - camera.position.y) * Math.min(1, delta * 0.9);
    }
    camera.lookAt(new Vector3(0, Math.sin(clock.elapsedTime * 0.18) * (reducedMotion ? 0.005 : 0.025), 0));
  });

  return (
    <>
      <ambientLight intensity={0.04} />
      <directionalLight position={[-3, 2.4, 3.8]} intensity={0.3} color="#8deeff" />
      <pointLight position={[0, 0.2, 2.2]} intensity={0.24} color="#2aaeff" distance={5.5} />
      <CognitiveNebula
        mind={mind}
        interaction={interaction}
        controls={controls}
        reducedMotion={reducedMotion}
        snapshot={snapshot}
        visual={visual}
        onEnterCognition={onEnterCognition}
        onExitCognition={onExitCognition}
      />
      {quality.postprocessing ? (
        <EffectComposer multisampling={0}>
          <Bloom intensity={Math.max(controls.bloomIntensity, visual.bloomIntensity)} luminanceThreshold={visual.healthTone === "critical" ? 0.48 : 0.65} luminanceSmoothing={0.25} mipmapBlur radius={0.35} />
          <Noise opacity={0.018} />
          <Vignette darkness={0.58} eskil={false} offset={0.22} />
        </EffectComposer>
      ) : null}
    </>
  );
}
