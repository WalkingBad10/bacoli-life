import type { Place } from '../core/types';

export interface SolidCircle {
  id?: string;
  x: number;
  y: number;
  radius: number;
}

/**
 * Collisioni accurate: tile solidi della mappa, footprint degli edifici e
 * oggetti circolari (pali, panchine, veicoli). Il movimento è separato sugli
 * assi per consentire lo scorrimento lungo i muri senza Through-wall bug.
 */
export class CollisionSystem {
  private readonly blocked: Uint8Array;
  private readonly solids: SolidCircle[] = [];
  private readonly solidsById = new Map<string, SolidCircle>();

  constructor(
    private readonly width: number,
    private readonly height: number,
    collisionData: Uint8Array,
    places: Place[] = [],
  ) {
    this.blocked = new Uint8Array(collisionData.length);
    this.blocked.set(collisionData);
    for (const place of places) {
      if (place.bounds) {
        const [minX, minY, maxX, maxY] = place.bounds;
        for (let ty = Math.max(0, minY); ty <= Math.min(height - 1, maxY); ty++) {
          for (let tx = Math.max(0, minX); tx <= Math.min(width - 1, maxX); tx++) {
            this.blocked[ty * width + tx] = 1;
          }
        }
        continue;
      }
      for (const [tx, ty] of place.footprint ?? []) {
        if (tx >= 0 && ty >= 0 && tx < width && ty < height) {
          this.blocked[ty * width + tx] = 1;
        }
      }
    }
  }

  addSolid(solid: SolidCircle): void {
    this.solids.push(solid);
    if (solid.id) this.solidsById.set(solid.id, solid);
  }

  hasSolid(id: string): boolean {
    return this.solidsById.has(id);
  }

  /** Aggiorna la posizione di un ostacolo mobile (veicoli). */
  updateSolid(id: string, x: number, y: number): void {
    const solid = this.solidsById.get(id);
    if (solid) { solid.x = x; solid.y = y; }
  }

  /** Rimuove un ostacolo quando un veicolo entra in garage. */
  removeSolid(id: string): void {
    const solid = this.solidsById.get(id);
    if (!solid) return;
    this.solidsById.delete(id);
    const index = this.solids.indexOf(solid);
    if (index >= 0) this.solids.splice(index, 1);
  }

  clearSolids(): void {
    this.solids.length = 0;
    this.solidsById.clear();
  }

  isSolidTile(tx: number, ty: number): boolean {
    if (tx < 1 || ty < 1 || tx >= this.width - 1 || ty >= this.height - 1) return true;
    return this.blocked[ty * this.width + tx] === 1;
  }

  canStand(
    px: number, py: number, radius = 5, ignoreId?: string | string[],
  ): boolean {
    // Campiona il bordo della sagoma: due tile sopra e sotto, ai lati e al centro.
    const points: [number, number][] = [
      [px, py - radius], [px, py + radius],
      [px - radius, py], [px + radius, py],
      [px - radius, py - radius], [px + radius, py - radius],
      [px - radius, py + radius], [px + radius, py + radius],
    ];
    if (points.some(([x, y]) => this.isSolidTile(Math.floor(x / 16), Math.floor(y / 16)))) {
      return false;
    }
    const ignored = new Set(typeof ignoreId === 'string' ? [ignoreId] : ignoreId ?? []);
    return !this.solids.some((s) =>
      !ignored.has(s.id ?? '') && Math.hypot(px - s.x, py - s.y) < radius + s.radius);
  }

  move(
    px: number, py: number, dx: number, dy: number, radius = 5,
    ignoreId?: string | string[],
  ): { x: number; y: number } {
    let x = px;
    let y = py;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 3));
    for (let i = 0; i < steps; i++) {
      const sx = dx / steps;
      const sy = dy / steps;
      if (this.canStand(x + sx, y, radius, ignoreId)) x += sx;
      if (this.canStand(x, y + sy, radius, ignoreId)) y += sy;
    }
    return { x, y };
  }
}
