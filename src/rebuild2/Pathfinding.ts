import type { Point2 } from './types';

interface Node {
  col: number;
  row: number;
  g: number;
  f: number;
  parent?: Node;
}

function octile(a: Node, b: Node): number {
  const dx = Math.abs(a.col - b.col);
  const dy = Math.abs(a.row - b.row);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

function key(col: number, row: number): string {
  return `${col},${row}`;
}

/**
 * A* su griglia metrica: i nodi sono tile da 1 m, quindi il percorso non può
 * attraversare un edificio senza passare da una cella libera.
 */
export function findPath(
  start: Point2,
  goal: Point2,
  passable: (col: number, row: number) => boolean,
  width: number,
  height: number,
  tilePx = 16,
  maxExpanded = 4000,
): Point2[] {
  const startCol = Math.max(0, Math.min(width - 1, Math.floor(start.x / tilePx)));
  const startRow = Math.max(0, Math.min(height - 1, Math.floor(start.y / tilePx)));
  let goalCol = Math.max(0, Math.min(width - 1, Math.floor(goal.x / tilePx)));
  let goalRow = Math.max(0, Math.min(height - 1, Math.floor(goal.y / tilePx)));

  if (!passable(goalCol, goalRow)) {
    let found = false;
    for (let radius = 1; radius <= 8 && !found; radius++) {
      for (let dy = -radius; dy <= radius && !found; dy++) {
        for (let dx = -radius; dx <= radius && !found; dx++) {
          const col = goalCol + dx;
          const row = goalRow + dy;
          if (col < 0 || row < 0 || col >= width || row >= height) continue;
          if (!passable(col, row)) continue;
          goalCol = col;
          goalRow = row;
          found = true;
        }
      }
    }
    if (!found) return [];
  }

  const startNode: Node = { col: startCol, row: startRow, g: 0, f: 0 };
  const endNode: Node = { col: goalCol, row: goalRow, g: 0, f: 0 };
  startNode.f = octile(startNode, endNode);
  const open: Node[] = [startNode];
  const best = new Map<string, number>([[key(startCol, startRow), 0]]);
  const closed = new Set<string>();
  let expanded = 0;

  while (open.length > 0 && expanded++ < maxExpanded) {
    let bestIndex = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIndex].f) bestIndex = i;
    }
    const current = open.splice(bestIndex, 1)[0];
    const currentKey = key(current.col, current.row);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);

    if (current.col === goalCol && current.row === goalRow) {
      const path: Point2[] = [];
      let node: Node | undefined = current;
      while (node) {
        path.push({ x: (node.col + 0.5) * tilePx, y: (node.row + 0.5) * tilePx });
        node = node.parent;
      }
      return path.reverse();
    }

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const col = current.col + dx;
        const row = current.row + dy;
        if (col < 0 || row < 0 || col >= width || row >= height) continue;
        if (!passable(col, row)) continue;
        // Non tagliare l'angolo tra due solidi vicini.
        if (dx !== 0 && dy !== 0 && (!passable(current.col + dx, current.row) || !passable(current.col, current.row + dy))) {
          continue;
        }
        const nextKey = key(col, row);
        if (closed.has(nextKey)) continue;
        const step = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1;
        const g = current.g + step;
        const previous = best.get(nextKey);
        if (previous !== undefined && previous <= g) continue;
        best.set(nextKey, g);
        const node: Node = { col, row, g, f: 0, parent: current };
        node.f = g + octile(node, endNode);
        open.push(node);
      }
    }
  }
  return [];
}
