import { Vector3 } from "three";
import { COGNITIVE_REGION_DEFS } from "@/lib/cognitive-regions";
import { buildSpatialHash, nearbyNodeIds } from "@/lib/spatial-hash";
import { createSeededRandom, randomRange, weightedChoice } from "@/lib/seeded-random";
import type {
  CognitiveRegion,
  NeuralGenerationResult,
  NeuralNode,
  SignalPath,
  SynapticConnection,
} from "@/types/ava-mind";

const FIELD_RADIUS = 1.58;

function randomPointInSphere(random: () => number, radius: number) {
  const theta = randomRange(random, 0, Math.PI * 2);
  const phi = Math.acos(randomRange(random, -1, 1));
  const r = radius * Math.cbrt(random());
  return new Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi),
  );
}

function densityNoise(point: Vector3) {
  return Math.sin(point.x * 3.1 + point.y * 1.7) * 0.08
    + Math.cos(point.z * 2.4 - point.x * 1.3) * 0.07
    + Math.sin((point.x + point.y + point.z) * 2.2) * 0.05;
}

function softenInsideField(point: Vector3) {
  const noisyRadius = FIELD_RADIUS * (0.92 + densityNoise(point));
  if (point.length() > noisyRadius) point.setLength(randomRange(() => 0.72, noisyRadius * 0.78, noisyRadius * 1.02));
  return point;
}

export function generateNeuralMind(nodeCount: number, maxConnections: number, seed = 44291): NeuralGenerationResult {
  const random = createSeededRandom(seed);
  const regionRecords: CognitiveRegion[] = COGNITIVE_REGION_DEFS.map((region) => ({
    ...region,
    nodeIds: [] as number[],
    majorNodeId: -1,
  }));

  const regionsById = new Map(regionRecords.map((region) => [region.id, region]));
  const regionChoices = regionRecords.map((region) => ({ value: region, weight: region.activity * region.radius }));
  const nodes: NeuralNode[] = [];

  for (const region of regionRecords) {
    const center = new Vector3(...region.center);
    const point = softenInsideField(center.clone().add(randomPointInSphere(random, region.radius * 0.08)));
    const node: NeuralNode = {
      id: nodes.length,
      originalPosition: point.toArray(),
      position: point.toArray(),
      velocity: [0, 0, 0],
      regionId: region.id,
      importance: 1,
      pulseSpeed: randomRange(random, 1.2, 2.4) * (0.8 + region.activity),
      pulseOffset: randomRange(random, 0, Math.PI * 2),
      driftSpeed: randomRange(random, 0.18, 0.52),
      size: randomRange(random, 0.022, 0.03),
      brightness: randomRange(random, 0.78, 1),
      major: true,
    };
    region.majorNodeId = node.id;
    region.nodeIds.push(node.id);
    nodes.push(node);
  }

  while (nodes.length < nodeCount) {
    const region = weightedChoice(random, regionChoices);
    const center = new Vector3(...region.center);
    const clustered = random() > 0.17;
    const point = clustered
      ? center.clone().add(randomPointInSphere(random, region.radius * randomRange(random, 0.34, 0.92)))
      : randomPointInSphere(random, FIELD_RADIUS);
    softenInsideField(point);

    const importanceRoll = random();
    const importance = importanceRoll > 0.955 ? 0.66 : importanceRoll > 0.77 ? 0.38 : randomRange(random, 0.08, 0.22);
    const size = importance > 0.6 ? randomRange(random, 0.011, 0.014) : importance > 0.3 ? randomRange(random, 0.007, 0.011) : randomRange(random, 0.004, 0.007);
    const node: NeuralNode = {
      id: nodes.length,
      originalPosition: point.toArray(),
      position: point.toArray(),
      velocity: [0, 0, 0],
      regionId: region.id,
      importance,
      pulseSpeed: randomRange(random, 0.7, 2.7) * (0.7 + region.activity),
      pulseOffset: randomRange(random, 0, Math.PI * 2),
      driftSpeed: randomRange(random, 0.05, 0.34),
      size,
      brightness: randomRange(random, 0.28, 0.72),
      major: false,
    };
    region.nodeIds.push(node.id);
    nodes.push(node);
  }

  const spatial = buildSpatialHash(nodes, 0.34);
  const connections: SynapticConnection[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    if (connections.length >= maxConnections) break;
    const source = new Vector3(...node.originalPosition);
    const neighbors = nearbyNodeIds(spatial, node.originalPosition, 0.34)
      .filter((id) => id !== node.id)
      .sort((a, b) => {
        const da = source.distanceTo(new Vector3(...nodes[a].originalPosition));
        const db = source.distanceTo(new Vector3(...nodes[b].originalPosition));
        return da - db;
      })
      .slice(0, node.major ? 18 : node.importance > 0.35 ? 8 : 4);

    for (const neighborId of neighbors) {
      if (connections.length >= maxConnections) break;
      const key = node.id < neighborId ? `${node.id}:${neighborId}` : `${neighborId}:${node.id}`;
      if (seen.has(key)) continue;
      const target = nodes[neighborId];
      const distance = source.distanceTo(new Vector3(...target.originalPosition));
      const sameRegion = node.regionId === target.regionId;
      const threshold = sameRegion ? 0.42 : 0.31;
      const keep = distance < threshold || node.major || target.major;
      if (!keep || (!sameRegion && random() < 0.72)) continue;
      seen.add(key);
      connections.push({
        id: connections.length,
        from: node.id,
        to: neighborId,
        distance,
        strength: Math.max(0.12, 1 - distance / (sameRegion ? 0.58 : 0.9)) * (sameRegion ? 1 : 0.46),
        regionId: sameRegion ? node.regionId : "cross-region",
      });
    }
  }

  const majorIds = regionRecords.map((region) => region.majorNodeId);
  const signals: SignalPath[] = Array.from({ length: 46 }, (_, id) => {
    const from = majorIds[Math.floor(random() * majorIds.length)];
    let to = majorIds[Math.floor(random() * majorIds.length)];
    if (from === to) to = majorIds[(majorIds.indexOf(from) + 3) % majorIds.length];
    return {
      id,
      from,
      to,
      progress: random(),
      speed: randomRange(random, 0.06, 0.18),
      delay: randomRange(random, 0, 6),
      branch: random() > 0.78,
      regionId: nodes[from].regionId,
    } satisfies SignalPath;
  });

  for (const region of regionRecords) {
    const source = nodes[region.majorNodeId];
    region.nodeIds = nodes.filter((node) => node.regionId === region.id).map((node) => node.id);
    const closeConnections = connections.filter((connection) => connection.from === source.id || connection.to === source.id).length;
    if (!closeConnections) {
      const targetId = region.nodeIds.find((id) => id !== source.id) ?? source.id;
      if (targetId !== source.id) {
        connections.push({
          id: connections.length,
          from: source.id,
          to: targetId,
          distance: new Vector3(...source.originalPosition).distanceTo(new Vector3(...nodes[targetId].originalPosition)),
          strength: 0.8,
          regionId: region.id,
        });
      }
    }
  }

  return { nodes, connections, regions: regionRecords, signals };
}
