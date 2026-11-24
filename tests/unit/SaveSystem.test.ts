import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checksum, decodeExport, encodeExport, hasSave, loadGame, saveGame } from '../../src/systems/SaveSystem';
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
});
