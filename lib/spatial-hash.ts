import type { NeuralNode } from "@/types/ava-mind";

function keyFor(position: readonly number[], cellSize: number) {
  return `${Math.floor(position[0] / cellSize)}:${Math.floor(position[1] / cellSize)}:${Math.floor(position[2] / cellSize)}`;
}

export function buildSpatialHash(nodes: NeuralNode[], cellSize: number) {
  const cells = new Map<string, number[]>();
  for (const node of nodes) {
    const key = keyFor(node.originalPosition, cellSize);
    const list = cells.get(key);
    if (list) list.push(node.id);
    else cells.set(key, [node.id]);
  }
  return cells;
}

export function nearbyNodeIds(cells: Map<string, number[]>, position: readonly number[], cellSize: number) {
  const cx = Math.floor(position[0] / cellSize);
  const cy = Math.floor(position[1] / cellSize);
  const cz = Math.floor(position[2] / cellSize);
  const ids: number[] = [];

  for (let x = cx - 1; x <= cx + 1; x += 1) {
    for (let y = cy - 1; y <= cy + 1; y += 1) {
      for (let z = cz - 1; z <= cz + 1; z += 1) {
        const list = cells.get(`${x}:${y}:${z}`);
        if (list) ids.push(...list);
      }
    }
  }

  return ids;
}
