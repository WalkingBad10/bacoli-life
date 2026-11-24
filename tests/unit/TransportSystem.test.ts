import { describe, expect, it } from 'vitest';
import { LINES, STATIONS, planTrip, reachableFrom, stationsFor } from '../../src/systems/TransportSystem';

describe('Trasporti EAV', () => {
  it('usa i nomi e lordine reali della Cumana', () => {
    const cumana = LINES.find((line) => line.id === 'cumana');
    expect(cumana?.stations).toEqual([
      'napoli_centro', 'bagnoli', 'lucrino', 'baia_station', 'fusaro_station', 'torregaveta',
    ]);
    expect(cumana?.note).toContain('6 novembre 2025');
  });

  it('non collega Bacoli centro alla ferrovia senza autobus', () => {
    const bacoli = STATIONS.find((station) => station.id === 'bacoli_centro');
    expect(bacoli?.lines).not.toContain('cumana');
    expect(bacoli?.lines).not.toContain('circumflegrea');
    expect(planTrip('bacoli_centro', 'baia_station')?.line).toBe('bus_101');
  });

  it('collega Torregaveta a Baia e Fusaro con la Cumana', () => {
    const trip = planTrip('torregaveta', 'fusaro_station');
    expect(trip?.line).toBe('cumana');
    expect(trip?.lineName).toContain('Cumana');
    expect(trip?.minutes).toBeGreaterThan(5);
  });

  it('esclude le fermate Circumnflegrea sospese dal 2014', () => {
    const reachable = reachableFrom('torregaveta').map((station) => station.id);
    expect(reachable).toContain('fusaro_station');
    expect(reachable).not.toContain('cuma_station');
    expect(reachable).not.toContain('lido_fusaro');
    expect(planTrip('torregaveta', 'cuma_station')).toBeNull();
  });

  it('include le linee bus EAV reali che servono Bacoli', () => {
    const busLines = LINES.filter((line) => line.id.startsWith('bus_')).map((line) => line.id);
    expect(busLines).toEqual(expect.arrayContaining([
      'bus_101', 'bus_102', 'bus_144', 'bus_145', 'bus_146', 'bus_150', 'bus_153',
    ]));
    expect(stationsFor('bus_102').map((station) => station.name))
      .toContain('Rotonda Miliscola');
  });
});
