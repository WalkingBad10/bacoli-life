import type { Point } from '../core/types';

export type Walkable = (x: number, y: number) => boolean;

interface Node {
  x: number;
  y: number;
  g: number;
  f: number;
  parent: Node | null;
}

function heuristic(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** A* su griglia a 4 direzioni. Restituisce [] se non esiste un percorso. */
export function findPath(start: Point, goal: Point, walkable: Walkable, maxNodes = 6000): Point[] {
  if (!walkable(goal.x, goal.y)) return [];
  const key = (x: number, y: number) => `${x},${y}`;
  const open: Node[] = [{
    x: start.x, y: start.y, g: 0,
    f: heuristic(start, goal), parent: null,
  }];
  const best = new Map<string, number>([[key(start.x, start.y), 0]]);
  let visited = 0;

  while (open.length && visited++ < maxNodes) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    if (current.x === goal.x && current.y === goal.y) {
      const path: Point[] = [];
      let node: Node | null = current;
      while (node && node.parent) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }
    const neighbours = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];
    for (const n of neighbours) {
      if (!walkable(n.x, n.y)) continue;
      const g = current.g + 1;
      const k = key(n.x, n.y);
      if (g >= (best.get(k) ?? Infinity)) continue;
      best.set(k, g);
      open.push({ ...n, g, f: g + heuristic(n, goal), parent: current });
    }
  }
  return [];
}
