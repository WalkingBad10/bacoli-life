/** Grafo stradale M6 derivato dalle classi OSM di `roads.bin`. */

export interface RoadPoint {
  x: number;
  y: number;
}

interface HeapNode {
  index: number;
  score: number;
}

/** Min-heap piccolo e senza dipendenze, usato solo per instradamenti brevi. */
class MinHeap {
  private items: HeapNode[] = [];

  push(node: HeapNode): void {
    this.items.push(node);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].score <= this.items[i].score) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop(): HeapNode | undefined {
    const first = this.items[0];
    const last = this.items.pop();
    if (!first || !last) return first;
    if (this.items.length) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.items.length && this.items[left].score < this.items[smallest].score) smallest = left;
        if (right < this.items.length && this.items[right].score < this.items[smallest].score) smallest = right;
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
        i = smallest;
      }
    }
    return first;
  }

  get size(): number {
    return this.items.length;
  }
}

/**
 * Classi: 0 fuori strada, 1 asfalto, 2 basolato, 3 marciapiede, 4 sterrato.
 * Solo asfalto e basolato sono percorribili dai veicoli; i marciapiedi restano
 * pedonali e gli sterrati sono esclusi dal traffico ordinario.
 */
export class RoadGraph {
  constructor(
    private readonly classes: Uint8Array,
    private readonly width: number,
    private readonly height: number,
    private readonly solid: Uint8Array,
  ) {}

  /** 0 fuori strada, 1 asfalto, 2 basolato, 3 marciapiede, 4 sterrato. */
  surfaceAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    return this.classes[y * this.width + x];
  }

  drivable(x: number, y: number): boolean {
    if (x < 1 || y < 1 || x >= this.width - 1 || y >= this.height - 1) return false;
    const index = y * this.width + x;
    const road = this.classes[index];
    return (road === 1 || road === 2) && !this.solid[index];
  }

  /** Tile stradale più vicino, con ricerca concentrica limitata. */
  nearest(x: number, y: number, radius = 28): RoadPoint | null {
    if (this.drivable(x, y)) return { x, y };
    for (let r = 1; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          if (this.drivable(x + dx, y + dy)) return { x: x + dx, y: y + dy };
        }
      }
    }
    return null;
  }

  /** A* a 4 vicini. Se il traguardo è irraggiungibile restituisce il percorso
   *  parziale verso il nodo più vicino, mai un salto. */
  route(from: RoadPoint, to: RoadPoint, maxNodes = 8000): RoadPoint[] {
    const start = this.nearest(from.x, from.y);
    const goal = this.nearest(to.x, to.y);
    if (!start || !goal) return [];
    const w = this.width;
    const total = w * this.height;
    const startIndex = start.y * w + start.x;
    const goalIndex = goal.y * w + goal.x;
    if (startIndex === goalIndex) return [];

    const g = new Float32Array(total).fill(Infinity);
    const previous = new Int32Array(total).fill(-1);
    const closed = new Uint8Array(total);
    const heap = new MinHeap();
    const heuristic = (x: number, y: number) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
    g[startIndex] = 0;
    heap.push({ index: startIndex, score: heuristic(start.x, start.y) });

    let best = startIndex;
    let bestDistance = heuristic(start.x, start.y);
    let expanded = 0;
    while (heap.size && expanded < maxNodes) {
      const node = heap.pop();
      if (!node) break;
      if (closed[node.index]) continue;
      closed[node.index] = 1;
      expanded++;
      const x = node.index % w;
      const y = (node.index / w) | 0;
      const distance = heuristic(x, y);
      if (distance < bestDistance) { bestDistance = distance; best = node.index; }
      if (node.index === goalIndex) { best = goalIndex; break; }

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!this.drivable(nx, ny)) continue;
        const next = ny * w + nx;
        if (closed[next]) continue;
        const cost = g[node.index] + 1;
        if (cost >= g[next]) continue;
        g[next] = cost;
        previous[next] = node.index;
        heap.push({ index: next, score: cost + heuristic(nx, ny) });
      }
    }

    const path: RoadPoint[] = [];
    let cursor = best;
    while (cursor !== startIndex && cursor !== -1 && path.length < maxNodes) {
      path.push({ x: cursor % w, y: (cursor / w) | 0 });
      cursor = previous[cursor];
    }
    path.reverse();
    return path;
  }

  /** Destinazione stradale lontana e deterministica: nessun random per frame. */
  pickDestination(from: RoadPoint, salt: number, minDistance = 18): RoadPoint | null {
    const stride = Math.max(6, Math.floor(this.width / 24));
    let best: RoadPoint | null = null;
    let bestScore = -Infinity;
    for (let y = 4; y < this.height - 4; y += stride) {
      for (let x = 4; x < this.width - 4; x += stride) {
        if (!this.drivable(x, y)) continue;
        const distance = Math.abs(x - from.x) + Math.abs(y - from.y);
        if (distance < minDistance) continue;
        const hash = ((x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)) >>> 0;
        const score = hash * 0.01 + Math.min(distance, 60);
        if (score > bestScore) { bestScore = score; best = { x, y }; }
      }
    }
    return best ?? this.nearest(from.x + minDistance, from.y + 3);
  }
}
