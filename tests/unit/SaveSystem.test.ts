import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checksum, decodeExport, encodeExport, hasSave, loadGame, SAVE_VERSION, saveGame,
} from '../../src/systems/SaveSystem';
import type { GameState } from '../../src/core/types';

const state: GameState = {
  player: {
    x: 120, y: 208, money: 321.5, savings: 40, energy: 88, hunger: 70,
    job: 'Barista', homeId: 'home-1',
  },
  inventory: { caffe: 2, pizza: 1 },
  relationships: { Maria: 3 },
  time: 600,
  day: 2,
  weather: 'cloud',
  home: { owned: true, address: 'Via Ortensio 12', furniture: ['bed'], upgrades: [] },
  family: [{ name: 'Giulia', relation: 'sorella', age: 24, mood: 80 }],
  vehicles: [],
  jobState: null,
  transport: { ticketBus: 2, ticketTrain: 1, monthlyPass: false, lastTrip: null },
  social: { bonds: {}, spouseId: null, marriedOnDay: null },
  pets: [],
  stats: { distanceWalked: 100, distanceDriven: 0, npcsMet: 2 },
};

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

describe('Salvataggi', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  it('checksum rileva una modifica', () => {
    expect(checksum('bacoli')).not.toBe(checksum('bacoli!'));
  });

  it('esporta e importa mantenendo tutti i dati', () => {
    const code = encodeExport(state);
    expect(decodeExport(code)).toEqual(state);
  });

  it('rifiuta un salvataggio corrotto', () => {
    const code = encodeExport(state);
    const broken = code.slice(0, -4) + 'AAAA';
    expect(() => decodeExport(broken)).toThrow();
  });

  it('salva e carica dalla chiave dedicata', () => {
    expect(hasSave()).toBe(false);
    saveGame(state);
    expect(hasSave()).toBe(true);
    expect(loadGame()).toEqual(state);
  });

  it('migra i campi mancanti da versioni precedenti', () => {
    const partial = { version: 1, checksum: '', payload: { player: { money: 10 } } };
    partial.checksum = checksum(JSON.stringify(partial.payload));
    const code = btoa(JSON.stringify(partial));
    const loaded = decodeExport(code);
    expect(loaded.day).toBe(1);
    expect(loaded.inventory).toEqual({});
    expect(loaded.player.homeId).toBe('home-1');
    expect(loaded.home.owned).toBe(false);
    expect(loaded.vehicles).toEqual([]);
    expect(loaded.transport.ticketBus).toBe(0);
    expect(loaded.stats.distanceWalked).toBe(0);
  });

  it('mantiene denaro e inventario di un salvataggio della versione 1', () => {
    const old = {
      version: 1, checksum: '', payload: {
        player: { x: 50, y: 60, money: 777, savings: 25, energy: 40, hunger: 30, job: null, homeId: null },
        inventory: { caffe: 3 }, relationships: { Ciro: 4 },
        time: 720, day: 5, weather: 'rain',
      },
    };
    old.checksum = checksum(JSON.stringify(old.payload));
    const loaded = decodeExport(btoa(JSON.stringify(old)));
    expect(loaded.player.money).toBe(777);
    expect(loaded.inventory).toEqual({ caffe: 3 });
    expect(loaded.day).toBe(5);
    expect(loaded.weather).toBe('rain');
    expect(loaded.home.owned).toBe(false);
  });

  it('migra un salvataggio v2 senza rompere il checksum', () => {
    const payload = {
      player: { x: 1, y: 2, money: 900, savings: 0, energy: 90, hunger: 80, job: null, homeId: 'home-1' },
      inventory: {}, relationships: { Maria: 5 }, time: 600, day: 4, weather: 'sun',
      home: { owned: true, address: 'Via Ortensio', furniture: [], upgrades: [] },
      family: [],
      vehicles: [{
        id: 'starting-car', kind: 'car', name: '126', x: 0, y: 0, angle: 0,
        fuel: 20, maxFuel: 40, color: '#fff', owned: true,
      }],
      jobState: null,
      transport: { ticketBus: 0, ticketTrain: 0, monthlyPass: false, lastTrip: null },
      stats: { distanceWalked: 0, distanceDriven: 0, npcsMet: 0 },
    };
    const envelope = { version: 2, checksum: checksum(JSON.stringify(payload)), payload };
    const loaded = decodeExport(btoa(JSON.stringify(envelope)));
    expect(SAVE_VERSION).toBe(4);
    expect(loaded.social.spouseId).toBeNull();
    expect(loaded.social.bonds.Maria.affinity).toBe(5);
    expect(loaded.pets).toEqual([]);
    expect(loaded.vehicles[0].condition).toBe(100);
    expect(loaded.vehicles[0].lastServiceDay).toBe(4);
    expect(loaded.career?.level).toBe(1);
    expect(loaded.homes?.length).toBeGreaterThan(0);
    expect(loaded.homes?.[0].owned).toBe(true);
    expect(loaded.businesses).toEqual([]);
    expect(loaded.deliveries).toEqual([]);
    expect(loaded.events).toEqual([]);
  });

  it('migra un salvataggio v3 preservando casa, animali e dati v4', () => {
    const payload = {
      ...state,
      version: undefined,
      social: { bonds: { Maria: { name: 'Maria', affinity: 42, gifts: 1, stage: 'friend' } }, spouseId: null, marriedOnDay: null },
      pets: [{ id: 'pet-1', name: 'Nino', species: 'dog', age: 2, hunger: 60, mood: 70, x: 1, y: 2, homeId: 'home-1' }],
      vehicles: [{ id: 'car-1', kind: 'car', name: '126', x: 0, y: 0, angle: 0, fuel: 10, maxFuel: 40, color: '#fff', owned: true }],
    };
    const envelope = {
      version: 3, checksum: checksum(JSON.stringify(payload)), payload,
    };
    const loaded = decodeExport(btoa(JSON.stringify(envelope)));
    expect(loaded.player.money).toBe(321.5);
    expect(loaded.home.furniture).toEqual(['bed']);
    expect(loaded.homes?.find((home) => home.id === 'home-1')?.furniture).toContain('bed');
    expect(loaded.pets).toHaveLength(1);
    expect(loaded.career?.shifts).toBe(0);
    expect(loaded.deliveries).toEqual([]);
  });

  it('rifiuta versioni future e ripara campi annidati corrotti', () => {
    const future = { version: SAVE_VERSION + 1, checksum: 'x', payload: { player: { money: 1 } } };
    expect(() => decodeExport(btoa(JSON.stringify(future)))).toThrow(/versione futura/);

    const payload = {
      player: { x: 1, y: 2, money: 100, savings: 0, energy: 90, hunger: 80, job: null, homeId: null },
      inventory: {}, relationships: {}, time: 600, day: 1, weather: 'sun',
      home: { owned: false, address: 'Via Ortensio', furniture: [], upgrades: [] },
      family: [], vehicles: [], jobState: null,
      transport: { ticketBus: 0, ticketTrain: 0, monthlyPass: false, lastTrip: null },
      social: { bonds: { Ciro: null }, spouseId: null, marriedOnDay: null },
      pets: {}, stats: { distanceWalked: 0, distanceDriven: 0, npcsMet: 0 },
    };
    const envelope = { version: SAVE_VERSION, checksum: checksum(JSON.stringify(payload)), payload };
    const loaded = decodeExport(btoa(JSON.stringify(envelope)));
    expect(loaded.social.bonds.Ciro).toBeUndefined();
    expect(loaded.pets).toEqual([]);
  });
});
