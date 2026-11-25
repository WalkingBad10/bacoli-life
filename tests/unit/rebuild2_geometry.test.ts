import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../../src/rebuild2/CollisionWorld';
import { findPath } from '../../src/rebuild2/Pathfinding';
import { circleHitsPolygon, obbCorners, obbHitsPolygon } from '../../src/rebuild2/geometry';
import type { Footprint } from '../../src/rebuild2/types';

const square: Footprint = {
  id: 1,
  name: 'isolato',
  type: 'building',
  polygon: [
    { x: 80, y: 80 }, { x: 112, y: 80 }, { x: 112, y: 112 }, { x: 80, y: 112 },
  ],
  properties: { osm_id: '1', levels: 2 },
};

function world(): CollisionWorld {
  return new CollisionWorld([square], new Uint8Array(20 * 20), 20, 20, 16);
}

describe('REBUILD 2.0 — collisione swept da quattro direzioni', () => {
  const cases = [
    { name: 'nord', start: [96, 50], delta: [0, 60], axis: 'y', sign: 1, limit: 74 },
    { name: 'sud', start: [96, 142], delta: [0, -60], axis: 'y', sign: -1, limit: 118 },
    { name: 'est', start: [50, 96], delta: [60, 0], axis: 'x', sign: 1, limit: 74 },
    { name: 'ovest', start: [142, 96], delta: [-60, 0], axis: 'x', sign: -1, limit: 118 },
  ] as const;

  for (const item of cases) {
    it(`blocca senza teletrasporto venendo da ${item.name}`, () => {
      const result = world().move(item.start[0], item.start[1], item.delta[0], item.delta[1], 6);
      const value = result[item.axis];
      if (item.sign > 0) expect(value).toBeLessThanOrEqual(item.limit + 0.001);
      else expect(value).toBeGreaterThanOrEqual(item.limit - 0.001);
      expect(circleHitsPolygon(result, 6, square.polygon)).toBe(false);
      expect(Math.abs(value - item.start[item.axis === 'x' ? 0 : 1])).toBeLessThanOrEqual(60);
    });
  }

  it('scivola lungo il muro invece di incastrarsi', () => {
    const result = world().move(96, 50, 10, 60, 6);
    expect(result.x).toBeGreaterThan(100);
    expect(result.y).toBeLessThanOrEqual(74.001);
    expect(circleHitsPolygon(result, 6, square.polygon)).toBe(false);
  });

  it('l’OBB del bus usa l’angolo reale e non quello azzerato', () => {
    const corners = obbCorners({ x: 100, y: 100 }, 176, 54, Math.PI / 2);
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(54, 0);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(176, 0);
    expect(obbHitsPolygon(corners, square.polygon)).toBe(true);
  });
});

describe('REBUILD 2.0 — A* su griglia metrica', () => {
  it('aggira un isolato senza tagliare l’angolo', () => {
    const blocked = new Set(['5,5', '5,6', '6,5', '6,6']);
    const path = findPath(
      { x: 4.5 * 16, y: 5.5 * 16 },
      { x: 7.5 * 16, y: 5.5 * 16 },
      (col, row) => !blocked.has(`${col},${row}`),
      12, 12, 16,
    );
    expect(path.length).toBeGreaterThan(3);
    for (const point of path) {
      const col = Math.floor(point.x / 16);
      const row = Math.floor(point.y / 16);
      expect(blocked.has(`${col},${row}`)).toBe(false);
    }
  });

  it('non restituisce un percorso quando non esiste alcuna cella percorribile', () => {
    const path = findPath(
      { x: 1.5 * 16, y: 1.5 * 16 },
      { x: 5.5 * 16, y: 5.5 * 16 },
      () => false,
      10, 10, 16,
    );
    expect(path).toEqual([]);
  });
});
