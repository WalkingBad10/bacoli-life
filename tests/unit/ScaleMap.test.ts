import { describe, expect, it } from 'vitest';
import centro from '../../src/data/bacoli_centro.json';
import meta from '../../public/assets/maps/centro/meta.json';

describe('Mappa metrica del centro storico', () => {
  it('usa la scala universale 1 metro = 16 pixel', () => {
    expect(centro.scale).toEqual({
      metersPerPixel: 1 / 16,
      metersPerTile: 1,
      adultHeightPx: 28,
      floorHeightPx: 52,
    });
    expect(meta.tileWidth).toBe(16);
    expect(meta.tileHeight).toBe(16);
    expect(meta.metersPerPixel).toBe(1 / 16);
    expect(meta.metersPerTile).toBe(1);
  });

  it('copre Via Ortensio, Via Spiaggia e il centro storico', () => {
    expect(centro.bounds).toEqual({
      south: 40.7995, north: 40.8060, west: 14.0775, east: 14.0830,
    });
    // Via Ortensio: lat 40.80357–40.80544, lon 14.07945–14.08175.
    expect(40.80357).toBeGreaterThan(centro.bounds.south);
    expect(40.80544).toBeLessThan(centro.bounds.north);
    expect(14.07945).toBeGreaterThan(centro.bounds.west);
    expect(14.08175).toBeLessThan(centro.bounds.east);
    // Via Spiaggia: lat 40.80162–40.80186, lon 14.08133–14.08134.
    expect(40.80162).toBeGreaterThan(centro.bounds.south);
    expect(40.80186).toBeLessThan(centro.bounds.north);
  });

  it('dichiara dimensioni coerenti con i buffer binari', () => {
    const expected = meta.width * meta.height;
    expect(centro.size).toEqual({ width: meta.width, height: meta.height });
    expect(meta.solidTiles).toBeGreaterThan(0);
    expect(meta.solidTiles).toBeLessThan(expected);
  });

  it('usa impronte OSM reali con metadati di facciata', () => {
    const buildings = centro.places.filter((place) => Boolean(place.bounds));
    expect(buildings).toHaveLength(centro.buildingCount);
    expect(buildings.length).toBeGreaterThan(200);
    for (const building of buildings) {
      expect(building.floors).toBeGreaterThanOrEqual(1);
      expect(building.floors).toBeLessThanOrEqual(4);
      expect([...Array.from({ length: 23 }, (_, i) => 96 + i * 16),
        480, 512, 544, 576, 608, 640, 672, 704, 768, 832, 896, 960, 1024, 1088,
      ]).toContain(building.facadeWidth);
      expect(building.variant).toBeGreaterThanOrEqual(0);
      expect(building.variant).toBeLessThanOrEqual(3);
      expect(building.meters?.width).toBeGreaterThan(0);
      expect(building.source).toContain('OSM');
      expect(building.bounds).toHaveLength(4);
      const [minX, minY, maxX, maxY] = building.bounds!;
      expect(minX).toBeGreaterThanOrEqual(0);
      expect(maxX).toBeLessThan(meta.width);
      expect(minY).toBeGreaterThanOrEqual(0);
      expect(maxY).toBeLessThan(meta.height);
      expect(maxX).toBeGreaterThanOrEqual(minX);
      expect(maxY).toBeGreaterThanOrEqual(minY);
    }
  });

  it('non assegna più piani a impronte edilizie estese', () => {
    const huge = centro.places.filter((place) => (place.meters?.area ?? 0) > 700);
    expect(huge.length).toBeGreaterThan(0);
    for (const place of huge) expect(place.floors).toBeLessThanOrEqual(1);
  });

  it('genera uno spawn interno alla mappa', () => {
    expect(centro.spawn.x).toBeGreaterThan(0);
    expect(centro.spawn.y).toBeGreaterThan(0);
    expect(centro.spawn.x).toBeLessThan(meta.width);
    expect(centro.spawn.y).toBeLessThan(meta.height);
  });

  it('dichiara come approssimati i soli servizi non georeferenziati', () => {
    const approximated = centro.places.filter((place) =>
      place.source?.includes('approssim'));
    expect(approximated.length).toBeGreaterThan(0);
    for (const place of approximated) {
      expect(place.source).toMatch(/approssim/);
    }
    const osmPlaces = centro.places.filter((place) => place.source?.startsWith('OSM'));
    expect(osmPlaces.length).toBeGreaterThan(300);
  });
});
