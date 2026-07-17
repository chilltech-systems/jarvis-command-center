"use client";

import { Html } from "@react-three/drei";
import type { AvaNebulaRegionV2 } from "@/lib/ava/nebula-feed";
import type { CognitiveRegion, SynapticConnection } from "@/types/ava-mind";

export function CognitiveNodeLabel({
  region,
  liveRegion,
  connections,
  onExit,
}: {
  region: CognitiveRegion | null;
  liveRegion?: AvaNebulaRegionV2 | null;
  connections: SynapticConnection[];
  onExit: () => void;
}) {
  if (!region) return null;
  const activeConnections = connections.filter((connection) => region.nodeIds.includes(connection.from) || region.nodeIds.includes(connection.to)).length;
  const activity = liveRegion?.activity ?? region.activity;

  return (
    <Html position={[1.78, 0.42, 0.25]} transform={false} occlude={false}>
      <article className="ava-region-card">
        <div className="ava-region-card-kicker"><span className={`region-live-dot ${liveRegion?.status || "idle"}`} /> LIVE COGNITIVE REGION</div>
        <h2>{region.displayName}</h2>
        <p>{liveRegion?.interpretation || region.description}</p>
        {liveRegion?.latestEvent ? <blockquote>{liveRegion.latestEvent.summary}</blockquote> : null}
        <dl>
          <div><dt>State</dt><dd>{liveRegion?.status === "watch" ? "Watching" : activity > 0.65 ? "Active" : "Quiet"}</dd></div>
          <div><dt>Activity</dt><dd>{Math.round(activity * 100)}%</dd></div>
          <div><dt>Signals</dt><dd>{liveRegion?.eventCount ?? activeConnections}</dd></div>
        </dl>
        {liveRegion?.relatedRegionIds.length ? <small>Linked with {liveRegion.relatedRegionIds.map((id) => id.replaceAll("-", " ")).join(", ")}</small> : null}
        <button type="button" onClick={onExit}>Exit Focus</button>
      </article>
    </Html>
  );
}
