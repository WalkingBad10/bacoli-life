import type { Point2 } from './types';

export function pointInPolygon(point: Point2, polygon: Point2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i++) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) &&
        point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export function distancePointSegment(p: Point2, a: Point2, b: Point2): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lengthSq = vx * vx + vy * vy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

export function distancePointPolygon(p: Point2, polygon: Point2[]): number {
  if (pointInPolygon(p, polygon)) return 0;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i++) {
    best = Math.min(best, distancePointSegment(p, polygon[j], polygon[i]));
  }
  return best;
}

export function circleHitsPolygon(p: Point2, radius: number, polygon: Point2[]): boolean {
  return distancePointPolygon(p, polygon) <= radius;
}

export function polygonBounds(polygon: Point2[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of polygon) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

export function polygonCentroid(polygon: Point2[]): Point2 {
  let x = 0;
  let y = 0;
  for (const point of polygon) {
    x += point.x;
    y += point.y;
  }
  return { x: x / polygon.length, y: y / polygon.length };
}

export function obbCorners(center: Point2, length: number, width: number, angle: number): Point2[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const halfL = length / 2;
  const halfW = width / 2;
  return [
    [-halfL, -halfW], [halfL, -halfW], [halfL, halfW], [-halfL, halfW],
  ].map(([lx, ly]) => ({
    x: center.x + lx * c - ly * s,
    y: center.y + lx * s + ly * c,
  }));
}

export function obbHitsPolygon(corners: Point2[], polygon: Point2[]): boolean {
  if (corners.some((corner) => pointInPolygon(corner, polygon))) return true;
  if (polygon.some((corner) => pointInPolygon(corner, corners))) return true;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    for (let j = 0; j < polygon.length; j++) {
      const c = polygon[j];
      const d = polygon[(j + 1) % polygon.length];
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

function cross(a: Point2, b: Point2, c: Point2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsIntersect(a: Point2, b: Point2, c: Point2, d: Point2): boolean {
  const c1 = cross(a, b, c);
  const c2 = cross(a, b, d);
  const c3 = cross(c, d, a);
  const c4 = cross(c, d, b);
  return ((c1 > 0 && c2 < 0) || (c1 < 0 && c2 > 0)) &&
         ((c3 > 0 && c4 < 0) || (c3 < 0 && c4 > 0));
}
