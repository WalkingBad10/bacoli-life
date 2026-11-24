import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import worldData from '../../src/data/bacoli_world.json';
import { REGIONS, STATIONS } from '../../src/systems/TransportSystem';

interface Region {
  id: string;
  bounds: { south: number; north: number; west: number; east: number };
  scale: {
    metersPerPixel: number;
    metersPerTile: number;
    adultHeightPx: number;
    floorHeightPx: number;
  };
  size: { width: number; height: number };
  spawn: { x: number; y: number };
  stations: Record<string, { x: number; y: number }>;
  places: Array<{ id: string; bounds?: [number, number, number, number]; floors?: number }>;
}

const regions = worldData.regions as unknown as Region[];
const mapFile = (region: string, name: string) =>
  resolve(process.cwd(), 'public', 'assets', 'maps', region, name);

function solidTiles(bits: Uint8Array): number {
  let total = 0;
  for (const byte of bits) for (let bit = 0; bit < 8; bit++) total += (byte >> bit) & 1;
  return total;
}

describe('mondo M5: regioni flegree metriche', () => {
  it('parte dal centro storico M4 e include tutte le frazioni richieste', () => {
    expect(regions[0].id).toBe('centro');
    expect(regions.map((region) => region.id)).toEqual(expect.arrayContaining([
      'marina_grande', 'lago_miseno', 'villa_comunale', 'miseno', 'miliscola',
      'baia', 'fusaro', 'torregaveta',
    ]));
    expect(regions[0].size).toEqual({ width: 463, height: 722 });
    expect(regions[0].spawn).toEqual({ x: 324, y: 478 });
  });

  it('conserva la scala universale in ogni regione', () => {
    for (const region of regions) {
      expect(region.scale).toEqual({
        metersPerPixel: 1 / 16, metersPerTile: 1, adultHeightPx: 28, floorHeightPx: 52,
      });
      expect(region.bounds.south).toBeLessThan(region.bounds.north);
      expect(region.bounds.west).toBeLessThan(region.bounds.east);
    }
  });

  it('ha buffer e metadati coerenti per ogni regione', () => {
    for (const region of regions) {
      const meta = JSON.parse(readFileSync(mapFile(region.id, 'meta.json'), 'utf-8'));
      const ground = readFileSync(mapFile(region.id, 'ground.bin'));
      const collision = readFileSync(mapFile(region.id, 'collision.bin'));
      const cells = region.size.width * region.size.height;
      expect([meta.width, meta.height]).toEqual([region.size.width, region.size.height]);
      expect([meta.tileWidth, meta.tileHeight, meta.firstGid]).toEqual([16, 16, 1]);
      expect(meta.metersPerPixel).toBe(1 / 16);
      expect(ground).toHaveLength(cells);
      expect(collision).toHaveLength(Math.ceil(cells / 8));
      expect(meta.solidTiles).toBe(solidTiles(new Uint8Array(collision)));
    }
  });

  it('colloca ogni fermata attiva nella sua regione reale', () => {
    const mapped = STATIONS.filter((station) => station.status === 'active' && station.mapRegion);
    expect(mapped.length).toBeGreaterThan(8);
    for (const station of mapped) {
      const region = regions.find((item) => item.id === station.mapRegion);
      expect(region, `regione mancante per ${station.id}`).toBeDefined();
      expect(region!.stations[station.id]).toBeDefined();
    }
    expect(REGIONS.find((region) => region.id === 'pianura')?.active).toBe(false);
  });

  it('non inventa piani fuori scala né ID di luoghi duplicati', () => {
    const ids = new Set<string>();
    for (const region of regions) {
      for (const place of region.places) {
        expect(ids.has(place.id), `ID duplicato ${place.id}`).toBe(false);
        ids.add(place.id);
        if (place.floors !== undefined) expect(place.floors).toBeGreaterThanOrEqual(1);
        if (place.floors !== undefined) expect(place.floors).toBeLessThanOrEqual(4);
      }
    }
  });
});
