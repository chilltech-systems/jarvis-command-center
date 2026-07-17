"use client";

import { useEffect, useState } from "react";
import type { AvaMindControls } from "@/types/ava-mind";

export function PerformanceManager({
  controls,
  setControls,
}: {
  controls: AvaMindControls;
  setControls: React.Dispatch<React.SetStateAction<AvaMindControls | null>>;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "d") setOpen((value) => !value);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (process.env.NODE_ENV === "production" || !open) return null;

  function update<K extends keyof AvaMindControls>(key: K, value: AvaMindControls[K]) {
    setControls((current) => ({ ...(current ?? controls), [key]: value }));
  }

  return (
    <aside className="ava-dev-panel">
      <div>DEVELOPMENT FIELD CONTROLS</div>
      <label>Nodes <input type="number" value={controls.nodeCount} min={300} max={1200} step={20} onChange={(event) => update("nodeCount", Number(event.target.value))} /></label>
      <label>Connection distance <input type="range" value={controls.connectionDistance} min={0.22} max={0.52} step={0.01} onChange={(event) => update("connectionDistance", Number(event.target.value))} /></label>
      <label>Connection opacity <input type="range" value={controls.connectionOpacity} min={0.15} max={1.5} step={0.05} onChange={(event) => update("connectionOpacity", Number(event.target.value))} /></label>
      <label>Bloom <input type="range" value={controls.bloomIntensity} min={0.1} max={1.4} step={0.05} onChange={(event) => update("bloomIntensity", Number(event.target.value))} /></label>
      <label>Core intensity <input type="range" value={controls.coreIntensity} min={0.2} max={1.8} step={0.05} onChange={(event) => update("coreIntensity", Number(event.target.value))} /></label>
      <label>Field turbulence <input type="range" value={controls.fieldTurbulence} min={0} max={1.8} step={0.05} onChange={(event) => update("fieldTurbulence", Number(event.target.value))} /></label>
      <label>Fog density <input type="range" value={controls.fogDensity} min={0.05} max={1.35} step={0.05} onChange={(event) => update("fogDensity", Number(event.target.value))} /></label>
      <label>Wisp intensity <input type="range" value={controls.wispIntensity} min={0.05} max={1.5} step={0.05} onChange={(event) => update("wispIntensity", Number(event.target.value))} /></label>
      <label>Raymarch steps <input type="range" value={controls.raymarchSteps} min={12} max={72} step={2} onChange={(event) => update("raymarchSteps", Number(event.target.value))} /></label>
      <label>Nebula breathing <input type="range" value={controls.nebulaBreathing} min={0} max={1.8} step={0.05} onChange={(event) => update("nebulaBreathing", Number(event.target.value))} /></label>
      <label>Cursor force <input type="range" value={controls.cursorForce} min={0} max={2.2} step={0.05} onChange={(event) => update("cursorForce", Number(event.target.value))} /></label>
      <label>Return stiffness <input type="range" value={controls.returnStiffness} min={1} max={12} step={0.2} onChange={(event) => update("returnStiffness", Number(event.target.value))} /></label>
      <label>Damping <input type="range" value={controls.damping} min={0.7} max={0.98} step={0.01} onChange={(event) => update("damping", Number(event.target.value))} /></label>
      <label>Volume drift <input type="range" value={controls.idleRotationSpeed} min={0} max={0.08} step={0.002} onChange={(event) => update("idleRotationSpeed", Number(event.target.value))} /></label>
      <label>Signals <input type="range" value={controls.signalFrequency} min={0.1} max={2.4} step={0.05} onChange={(event) => update("signalFrequency", Number(event.target.value))} /></label>
      <label>Particles <input type="number" value={controls.particleCount} min={80} max={700} step={20} onChange={(event) => update("particleCount", Number(event.target.value))} /></label>
      <label>Quality
        <select value={controls.quality} onChange={(event) => update("quality", event.target.value as AvaMindControls["quality"])}>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
      </label>
    </aside>
  );
}
