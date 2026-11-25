import type { GameObjects } from 'phaser';
import { circleHitsPolygon, obbHitsPolygon, polygonBounds } from './geometry';
import type { Footprint, Point2 } from './types';

interface BoundedFootprint {
  source: Footprint;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface MoveResult {
  x: number;
  y: number;
  blockedX: boolean;
  blockedY: boolean;
}

/** Collisione geometrica: impronte OSM + buffer dei solidi, con swept step e sliding. */
export class CollisionWorld {
  private readonly footprints: BoundedFootprint[] = [];
  private readonly solid: Uint8Array;
  private readonly tilePx: number;
  private readonly width: number;
  private readonly height: number;

  constructor(footprints: Footprint[], solid: Uint8Array, width: number, height: number, tilePx = 16) {
    this.footprints = footprints.map((footprint) => {
      const bounds = polygonBounds(footprint.polygon);
      return { source: footprint, ...bounds };
    });
    this.solid = solid;
    this.width = width;
    this.height = height;
    this.tilePx = tilePx;
  }

  blockedAt(x: number, y: number, radius: number, ignoreId?: number): boolean {
    if (x < radius || y < radius || x > this.width * this.tilePx - radius || y > this.height * this.tilePx - radius) {
      return true;
    }
    for (const [dx, dy] of [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]]) {
      const tileX = Math.floor((x + dx) / this.tilePx);
      const tileY = Math.floor((y + dy) / this.tilePx);
      if (this.solid[tileY * this.width + tileX] === 1) return true;
    }
    const point: Point2 = { x, y };
    for (const item of this.footprints) {
      if (ignoreId !== undefined && item.source.id === ignoreId) continue;
      if (x + radius < item.minX || x - radius > item.maxX || y + radius < item.minY || y - radius > item.maxY) {
        continue;
      }
      if (circleHitsPolygon(point, radius, item.source.polygon)) return true;
    }
    return false;
  }

  move(x: number, y: number, dx: number, dy: number, radius: number, ignoreId?: number): MoveResult {
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(distance / 3));
    let cx = x;
    let cy = y;
    let blockedX = false;
    let blockedY = false;
    for (let step = 0; step < steps; step++) {
      const sx = dx / steps;
      const sy = dy / steps;
      if (!this.blockedAt(cx + sx, cy + sy, radius, ignoreId)) {
        cx += sx;
        cy += sy;
        continue;
      }
      if (sx !== 0 && !this.blockedAt(cx + sx, cy, radius, ignoreId)) cx += sx;
      else if (sx !== 0) blockedX = true;
      if (sy !== 0 && !this.blockedAt(cx, cy + sy, radius, ignoreId)) cy += sy;
      else if (sy !== 0) blockedY = true;
    }
    return { x: cx, y: cy, blockedX, blockedY };
  }

  obbHitsAny(corners: Point2[], margin = 0): boolean {
    const minX = Math.min(...corners.map((point) => point.x));
    const maxX = Math.max(...corners.map((point) => point.x));
    const minY = Math.min(...corners.map((point) => point.y));
    const maxY = Math.max(...corners.map((point) => point.y));
    for (let ty = Math.floor(minY / this.tilePx); ty <= Math.floor(maxY / this.tilePx); ty++) {
      for (let tx = Math.floor(minX / this.tilePx); tx <= Math.floor(maxX / this.tilePx); tx++) {
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return true;
        if (this.solid[ty * this.width + tx] === 1) return true;
      }
    }
    for (const item of this.footprints) {
      if (minX + margin < item.minX || maxX - margin > item.maxX ||
          minY + margin < item.minY || maxY - margin > item.maxY) continue;
      if (obbHitsPolygon(corners, item.source.polygon)) return true;
    }
    return false;
  }

  roadClassAt(x: number, y: number, roads: Uint8Array, width: number, tilePx = 16): number {
    const tx = Math.floor(x / tilePx);
    const ty = Math.floor(y / tilePx);
    if (tx < 0 || ty < 0 || tx >= width || ty >= roads.length / width) return 0;
    return roads[ty * width + tx];
  }

  /** Usato solo dal debug F1: non compare nella versione giocabile. */
  drawDebug(graphics: GameObjects.Graphics, view: { x: number; y: number; width: number; height: number }): void {
    graphics.clear();
    graphics.lineStyle(1, 0x36d6a8, 0.85);
    for (const item of this.footprints) {
      if (item.maxX < view.x || item.minX > view.x + view.width ||
          item.maxY < view.y || item.minY > view.y + view.height) continue;
      graphics.strokePoints(item.source.polygon, true);
    }
    graphics.lineStyle(1, 0xf2a13c, 0.7);
    const fromX = Math.max(0, Math.floor(view.x / this.tilePx));
    const toX = Math.min(this.width - 1, Math.ceil((view.x + view.width) / this.tilePx));
    const fromY = Math.max(0, Math.floor(view.y / this.tilePx));
    const toY = Math.min(this.height - 1, Math.ceil((view.y + view.height) / this.tilePx));
    for (let ty = fromY; ty <= toY; ty++) {
      for (let tx = fromX; tx <= toX; tx++) {
        if (this.solid[ty * this.width + tx] !== 1) continue;
        graphics.strokeRect(tx * this.tilePx, ty * this.tilePx, this.tilePx, this.tilePx);
      }
    }
  }
}
