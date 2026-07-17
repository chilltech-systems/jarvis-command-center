"use client";

/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Euler, Group, MathUtils, Plane, Quaternion, Raycaster, Vector2, Vector3 } from "three";
import { CognitiveNodeLabel } from "@/components/ava-mind/CognitiveNodeLabel";
import { CognitionEventPaths } from "@/components/ava-mind/CognitionEventPaths";
import { CognitiveRegions } from "@/components/ava-mind/CognitiveRegions";
import { CursorDisturbance } from "@/components/ava-mind/CursorDisturbance";
import { NeuralNodes } from "@/components/ava-mind/NeuralNodes";
import { MemoryConstellation } from "@/components/ava-mind/MemoryConstellation";
import { OuterAtmosphere } from "@/components/ava-mind/OuterAtmosphere";
import { PlasmaCore } from "@/components/ava-mind/PlasmaCore";
import { SignalPulses } from "@/components/ava-mind/SignalPulses";
import { SynapticNetwork } from "@/components/ava-mind/SynapticNetwork";
import { VolumetricFog } from "@/components/ava-mind/VolumetricFog";
import type { InteractionStore } from "@/components/ava-mind/interaction-store";
import type { AvaMindControls, CognitiveRegion, NeuralGenerationResult } from "@/types/ava-mind";
import type { AvaNebulaSnapshotV2 } from "@/lib/ava/nebula-feed";
import type { NebulaVisualState } from "@/lib/ava/nebula-visual-state";

const FIELD_INTERACTION_RADIUS = 1.86;
const CLICK_DISTANCE = 6;
const EMPTY_CANVAS_RADIUS = 2.06;

export function CognitiveNebula({
  mind,
  interaction,
  controls,
  reducedMotion,
  snapshot,
  visual,
  onEnterCognition,
  onExitCognition,
}: {
  mind: NeuralGenerationResult;
  interaction: React.MutableRefObject<InteractionStore>;
  controls: AvaMindControls;
  reducedMotion: boolean;
  snapshot: AvaNebulaSnapshotV2 | null;
  visual: NebulaVisualState;
  onEnterCognition: () => void;
  onExitCognition: () => void;
}) {
  const field = useRef<Group>(null);
  const drag = useRef({
    active: false,
    last: new Vector2(),
    velocity: new Vector2(),
    pointerId: -1,
  });
  const [selectedRegion, setSelectedRegion] = useState<CognitiveRegion | null>(null);
  const targetQuaternion = useMemo(() => new Quaternion(), []);
  const { camera, gl, size } = useThree();
  const mobileViewport = size.width < 760;

  useEffect(() => {
    if (visual.viewMode !== "cognition" || !snapshot?.currentFocus?.regionId) return;
    const region = mind.regions.find((candidate) => candidate.name === snapshot.currentFocus?.regionId) || null;
    setSelectedRegion(region);
    interaction.current.focus = { region, focused: Boolean(region) };
  }, [interaction, mind.regions, snapshot?.currentFocus?.regionId, visual.viewMode]);

  useEffect(() => {
    const canvas = gl.domElement;
    const pointerNdc = new Vector2();
    const raycaster = new Raycaster();
    const interactionPlane = new Plane();
    const planeNormal = new Vector3();
    const fieldWorldPosition = new Vector3();
    const worldPoint = new Vector3();

    function selectMajorNode(local: Vector3) {
      let closest: CognitiveRegion | null = null;
      let closestDistance = 0.34;
      for (const region of mind.regions) {
        const node = mind.nodes[region.majorNodeId];
        const distance = local.distanceTo(new Vector3(...node.position));
        if (distance < closestDistance) {
          closest = region;
          closestDistance = distance;
        }
      }
      setSelectedRegion(closest);
      interaction.current.focus = { region: closest, focused: Boolean(closest) };
    }

    function updatePointer(event: PointerEvent) {
      const volume = field.current;
      if (!volume) return null;
      const rect = canvas.getBoundingClientRect();
      pointerNdc.set(
        ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1),
      );
      volume.getWorldPosition(fieldWorldPosition);
      camera.getWorldDirection(planeNormal);
      interactionPlane.setFromNormalAndCoplanarPoint(planeNormal, fieldWorldPosition);
      raycaster.setFromCamera(pointerNdc, camera);
      if (!raycaster.ray.intersectPlane(interactionPlane, worldPoint)) return null;

      const local = volume.worldToLocal(worldPoint.clone());
      const store = interaction.current;
      const now = event.timeStamp / 1000;
      const elapsed = store.pointerLastTime > 0 ? Math.max(1 / 240, now - store.pointerLastTime) : 0;
      store.previousPointerLocal.copy(store.pointerLocal);
      store.pointerLocal.copy(local);
      store.pointerInside = local.length() <= FIELD_INTERACTION_RADIUS;
      store.centralHover = visual.viewMode === "home" && local.length() <= (mobileViewport ? 1.15 : 0.66);
      canvas.style.cursor = store.centralHover ? "pointer" : visual.viewMode === "cognition" ? "grab" : "default";

      if (elapsed > 0 && store.previousPointerLocal.lengthSq() < 100) {
        const instantaneous = local.clone().sub(store.previousPointerLocal).divideScalar(elapsed);
        const speed = Math.min(4, instantaneous.length());
        const directionAlpha = 1 - Math.exp(-elapsed * 14);
        const speedAlpha = 1 - Math.exp(-elapsed * 11);
        if (speed > 0.001) store.pointerDirection.lerp(instantaneous.normalize(), directionAlpha);
        store.pointerVelocity += (speed - store.pointerVelocity) * speedAlpha;
        store.disturbanceStrength = Math.min(1, Math.max(store.disturbanceStrength, speed / 2.2));
        if (store.pointerInside && speed > 0.2) {
          const lastSample = store.trailSamples.at(-1);
          if (!lastSample || lastSample.position.distanceTo(local) > 0.025) {
            store.trailSamples.push({ position: local.clone(), age: 0, intensity: Math.min(1, speed / 2) });
            if (store.trailSamples.length > 36) store.trailSamples.shift();
          }
        }
      }

      store.pointerLastTime = now;
      store.ripplePoint.copy(local.lengthSq() > 0.0001 ? local.clone().normalize() : local);
      if (store.pointerVelocity > 0.9) {
        store.rippleStrength = Math.min(1, store.pointerVelocity / 2.4);
        store.signalBoost = Math.min(1, store.signalBoost + 0.08);
      }
      return local;
    }

    function finishPointer(event: PointerEvent, cancelled = false) {
      if (drag.current.pointerId !== event.pointerId) return;
      const local = cancelled ? null : updatePointer(event);
      const wasClick = !cancelled && interaction.current.dragDistance < CLICK_DISTANCE;
      drag.current.active = false;
      drag.current.pointerId = -1;
      interaction.current.pointerActive = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (!wasClick || !local) return;
      if (visual.viewMode === "home" && local.length() <= (mobileViewport ? 1.15 : 0.66)) {
        onEnterCognition();
        return;
      }
      if (visual.viewMode !== "cognition") return;
      if (local.length() > EMPTY_CANVAS_RADIUS) {
        setSelectedRegion(null);
        interaction.current.focus = { region: null, focused: false };
        onExitCognition();
        return;
      }
      selectMajorNode(local);
    }

    function handlePointerDown(event: PointerEvent) {
      if (!event.isPrimary || visual.viewMode === "entering" || visual.viewMode === "exiting") return;
      event.preventDefault();
      drag.current.active = true;
      drag.current.pointerId = event.pointerId;
      drag.current.last.set(event.clientX, event.clientY);
      drag.current.velocity.multiplyScalar(0.45);
      interaction.current.pointerActive = true;
      interaction.current.dragDistance = 0;
      canvas.setPointerCapture(event.pointerId);
      updatePointer(event);
    }

    function handlePointerMove(event: PointerEvent) {
      if (!event.isPrimary) return;
      updatePointer(event);
      if (!drag.current.active || drag.current.pointerId !== event.pointerId || !field.current || visual.viewMode !== "cognition") return;
      const current = new Vector2(event.clientX, event.clientY);
      const movement = current.clone().sub(drag.current.last);
      const elapsed = Math.max(1 / 240, event.timeStamp / 1000 - interaction.current.pointerLastTime + 1 / 120);
      drag.current.last.copy(current);
      interaction.current.dragDistance += movement.length();
      if (interaction.current.dragDistance >= CLICK_DISTANCE && interaction.current.focus.focused) {
        setSelectedRegion(null);
        interaction.current.focus = { region: null, focused: false };
      }
      const yaw = movement.x * 0.0048;
      const pitch = movement.y * 0.0036;
      field.current.rotation.y += yaw;
      field.current.rotation.x = MathUtils.clamp(field.current.rotation.x + pitch, -0.82, 0.82);
      drag.current.velocity.x = MathUtils.lerp(drag.current.velocity.x, yaw / elapsed, 0.42);
      drag.current.velocity.y = MathUtils.lerp(drag.current.velocity.y, pitch / elapsed, 0.42);
    }

    function handlePointerLeave() {
      if (!drag.current.active) {
        interaction.current.pointerInside = false;
        interaction.current.centralHover = false;
        canvas.style.cursor = "default";
      }
    }

    function handlePointerCancel(event: PointerEvent) {
      finishPointer(event, true);
    }

    function handleLostCapture(event: PointerEvent) {
      if (drag.current.pointerId !== event.pointerId) return;
      drag.current.active = false;
      drag.current.pointerId = -1;
      interaction.current.pointerActive = false;
    }

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", finishPointer);
    canvas.addEventListener("pointercancel", handlePointerCancel);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    canvas.addEventListener("lostpointercapture", handleLostCapture);
    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", finishPointer);
      canvas.removeEventListener("pointercancel", handlePointerCancel);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      canvas.removeEventListener("lostpointercapture", handleLostCapture);
      canvas.style.cursor = "";
    };
  }, [camera, gl, interaction, mind.nodes, mind.regions, mobileViewport, onEnterCognition, onExitCognition, visual.viewMode]);

  useFrame(({ clock }, delta) => {
    const volume = field.current;
    if (!volume) return;
    const store = interaction.current;
    store.disturbanceStrength += (0 - store.disturbanceStrength) * Math.min(1, delta * 2.8);
    store.rippleStrength += (0 - store.rippleStrength) * Math.min(1, delta * 3.2);
    store.pointerVelocity += (0 - store.pointerVelocity) * Math.min(1, delta * 2.2);
    store.pointerDirection.multiplyScalar(Math.exp(-delta * 1.8));
    store.hoverStrength += ((store.pointerInside ? 1 : 0) - store.hoverStrength) * Math.min(1, delta * 8);

    if (!drag.current.active) {
      volume.rotation.y += drag.current.velocity.x * delta;
      volume.rotation.x += drag.current.velocity.y * delta;
      drag.current.velocity.multiplyScalar(Math.exp(-delta * 5.2));
      const homeDrift = 0.34 + visual.viewTransitionProgress * 0.66;
      const drift = controls.idleRotationSpeed * homeDrift * (store.hoverStrength > 0.2 ? 0.28 : 1);
      volume.rotation.y += delta * (visual.showcaseMode ? drift * 3.2 : drift);
      volume.rotation.x += Math.sin(clock.elapsedTime * 0.17) * delta * 0.012 * controls.nebulaBreathing;
      volume.rotation.z = Math.sin(clock.elapsedTime * 0.09) * 0.035 * controls.nebulaBreathing;
      volume.rotation.x = MathUtils.clamp(volume.rotation.x, -0.82, 0.82);
    }

    const breath = 1 + Math.sin(clock.elapsedTime * 0.61) * 0.022 * controls.nebulaBreathing + store.signalBoost * 0.016 + visual.voiceEnergy * 0.025;
    const awakeningScale = 0.42 + visual.awakeningProgress * 0.58;
    const homeScale = mobileViewport ? 0.24 : 0.48;
    const cognitionScale = mobileViewport ? 0.38 : 1;
    const transitionScale = MathUtils.lerp(homeScale, cognitionScale, visual.viewTransitionProgress);
    volume.scale.setScalar(transitionScale * breath * awakeningScale);

    if (visual.viewMode === "cognition" && selectedRegion && !drag.current.active) {
      const selectedNode = mind.nodes[selectedRegion.majorNodeId];
      const direction = new Vector3(...selectedNode.originalPosition).normalize();
      const targetYaw = -Math.atan2(direction.x, direction.z);
      const targetPitch = MathUtils.clamp(Math.asin(direction.y) * 0.52, -0.52, 0.52);
      targetQuaternion.setFromEuler(new Euler(targetPitch, targetYaw, 0, "XYZ"));
      volume.quaternion.slerp(targetQuaternion, Math.min(1, delta * 1.55));
      const focusDistance = mobileViewport ? 4.2 : 3.78;
      camera.position.z += (focusDistance - camera.position.z) * Math.min(1, delta * 1.6);
    } else {
      const transition = visual.viewTransitionProgress;
      const homeDistance = mobileViewport ? 5.35 : 5.15;
      const cognitionDistance = mobileViewport ? 4.85 : 4.45;
      const travelDip = reducedMotion ? 0 : Math.sin(transition * Math.PI) * 0.5;
      const idleDistance = MathUtils.lerp(homeDistance, cognitionDistance, transition) - travelDip;
      camera.position.z += (idleDistance - camera.position.z) * Math.min(1, delta * 1.2);
    }
  });

  return (
    <>
      <group ref={field}>
        <PlasmaCore interaction={interaction} controls={controls} reducedMotion={reducedMotion} />
        <VolumetricFog controls={controls} interaction={interaction} reducedMotion={reducedMotion} />
        <CognitiveRegions interaction={interaction} reducedMotion={reducedMotion} visual={visual} />
        <NeuralNodes nodes={mind.nodes} regions={mind.regions} interaction={interaction} controls={controls} reducedMotion={reducedMotion} visual={visual} />
        <SynapticNetwork nodes={mind.nodes} connections={mind.connections} interaction={interaction} controls={controls} />
        <SignalPulses nodes={mind.nodes} signals={mind.signals} interaction={interaction} controls={controls} reducedMotion={reducedMotion} />
        <CursorDisturbance interaction={interaction} />
        <OuterAtmosphere controls={controls} interaction={interaction} reducedMotion={reducedMotion} />
        {visual.viewTransitionProgress > 0.62 ? <CognitionEventPaths event={snapshot?.recentEvents[0] || null} regions={snapshot?.regions || []} reducedMotion={reducedMotion} /> : null}
        {visual.viewTransitionProgress > 0.62 ? <MemoryConstellation memories={snapshot?.notableMemories || []} active={visual.memoryMode} reducedMotion={reducedMotion} /> : null}
      </group>
      {visual.viewMode === "cognition" ? <CognitiveNodeLabel
        region={selectedRegion}
        liveRegion={snapshot?.regions.find((region) => region.id === selectedRegion?.name) || null}
        connections={mind.connections}
        onExit={() => {
          setSelectedRegion(null);
          interaction.current.focus = { region: null, focused: false };
        }}
      /> : null}
    </>
  );
}
