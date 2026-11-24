import { describe, expect, it } from 'vitest';
import {
  activeHome, activeHomeId, buyHome, decorateHome, defaultHomes, homeComfortLabel,
  normalizeHomes, setActiveHome, syncHomeMirror,
} from '../../src/systems/HomeSystem';
import { FURNITURE_CATALOG, type FurnitureId } from '../../src/systems/LifeSystem';
import type { GameState, HomeRecord, HomeState } from '../../src/core/types';
import type { Wallet } from '../../src/systems/Economy';

function gameState(): GameState {
  return {
    player: {
      x: 0, y: 0, money: 1_000, savings: 0, energy: 100, hunger: 100,
      job: null, homeId: null,
    },
    inventory: {}, relationships: {}, time: 0, day: 1, weather: 'sun',
    home: { owned: false, address: 'Via Ortensio 12', furniture: [], upgrades: [] },
    family: [], vehicles: [], jobState: null,
    transport: { ticketBus: 0, ticketTrain: 0, monthlyPass: false, lastTrip: null },
    social: { bonds: {}, spouseId: null, marriedOnDay: null },
    pets: [], stats: { distanceWalked: 0, distanceDriven: 0, npcsMet: 0 },
  };
}

function wallet(money: number): Wallet {
  return { money, savings: 0, inventory: {} };
}

describe('Case', () => {
  it('restituisce copie indipendenti del catalogo immobiliare', () => {
    const first = defaultHomes();
    const second = defaultHomes();
    expect(first).toHaveLength(6);
    expect(first[0]).toMatchObject({
      id: 'home-1', address: 'Via Ortensio 12', price: 25_000, owned: false,
    });
    first[0].furniture.push('bed');
    first[0].upgrades.push('camino');
    expect(second[0].furniture).toEqual([]);
    expect(second[0].upgrades).toEqual([]);
  });

  it('migra le case v4 preservando arredi e proprietà dei salvataggi v3', () => {
    const stored = [
      {
        id: 'home-2', address: 'da ignorare', street: 'da ignorare', price: 1,
        owned: true, furniture: ['sofa', 7, 'tv'], upgrades: ['terrazzo'], style: 'villa',
      },
      { id: 'home-404', owned: true, furniture: [], upgrades: [] },
    ] as unknown as HomeRecord[];
    const legacy: HomeState = {
      owned: true, address: 'Via Ortensio', furniture: ['bed', 'sofa'], upgrades: ['camino'],
    };

    const homes = normalizeHomes(stored, legacy, 'home-3');
    expect(homes).toHaveLength(6);

    const second = homes.find((home) => home.id === 'home-2')!;
    expect(second).toMatchObject({
      owned: true, address: 'Via Spiaggia 8', price: 42_000,
      furniture: ['sofa', 'tv'], upgrades: ['terrazzo'],
    });
    const third = homes.find((home) => home.id === 'home-3')!;
    expect(third).toMatchObject({
      owned: true, furniture: ['bed', 'sofa'], upgrades: ['camino'],
    });
    expect(homes[0].owned).toBe(false);
    expect(homes.some((home) => home.id === 'home-404')).toBe(false);

    const fallback = normalizeHomes(
      undefined,
      { owned: true, address: 'Via Ortensio 12', furniture: ['bed'], upgrades: [] },
      'home-99',
    );
    expect(fallback[0]).toMatchObject({ owned: true, furniture: ['bed'] });
  });

  it('sceglie la casa attiva tra quelle possedute e ricade sulla prima', () => {
    const state = gameState();
    state.homes = defaultHomes();
    state.activeHomeId = 'home-3';
    expect(activeHomeId(state)).toBe('home-1');

    state.homes[1].owned = true;
    expect(activeHomeId(state)).toBe('home-2');
    expect(activeHome(state).address).toBe('Via Spiaggia 8');

    state.activeHomeId = 'home-4';
    expect(activeHomeId(state)).toBe('home-2');

    const fresh = gameState();
    expect(activeHome(fresh).id).toBe('home-1');
    expect(fresh.homes).toHaveLength(6);
  });

  it('compra solo case disponibili e sincronizza lo specchio usato dalla HUD', () => {
    const state = gameState();
    const w = wallet(30_000);

    expect(buyHome(state, 'home-2', w)).toBeNull();
    expect(w.money).toBe(30_000);
    expect(state.homes).toHaveLength(6);

    w.money = 50_000;
    const bought = buyHome(state, 'home-2', w);
    expect(bought?.owned).toBe(true);
    expect(w.money).toBe(8_000);
    expect(state.activeHomeId).toBe('home-2');
    expect(state.player.homeId).toBe('home-2');
    expect(state.home).toMatchObject({
      owned: true, id: 'home-2', address: 'Via Spiaggia 8', street: 'Via Spiaggia',
    });

    expect(buyHome(state, 'home-2', w)).toBeNull();
    expect(buyHome(state, 'home-404', w)).toBeNull();
    expect(w.money).toBe(8_000);

    expect(setActiveHome(state, 'home-1')).toBe(false);
    expect(setActiveHome(state, 'home-3')).toBe(false);
    expect(setActiveHome(state, 'home-2')).toBe(true);

    w.money = 30_000;
    expect(buyHome(state, 'home-1', w)?.id).toBe('home-1');
    expect(w.money).toBe(5_000);
    expect(state.home.address).toBe('Via Ortensio 12');
    expect(setActiveHome(state, 'home-2')).toBe(true);
    expect(state.home.address).toBe('Via Spiaggia 8');
  });

  it('copia gli arredi nello specchio senza condividere l’array originale', () => {
    const state = gameState();
    state.homes = defaultHomes();
    state.homes[0].owned = true;
    state.homes[0].furniture.push('bed');

    const home = syncHomeMirror(state);
    expect(state.activeHomeId).toBe('home-1');
    expect(state.home.furniture).toEqual(['bed']);
    state.home.furniture.push('tv');
    expect(home.furniture).toEqual(['bed']);
    expect(state.homes[0].furniture).toEqual(['bed']);
  });

  it('compra arredi una sola volta e calcola il comfort con upgrade e tetto', () => {
    const home = defaultHomes()[0];
    const w = wallet(1_000);

    expect(decorateHome(home, w, 'bed')).toBe(true);
    expect(w.money).toBe(1_000 - FURNITURE_CATALOG.bed.price);
    expect(decorateHome(home, w, 'bed')).toBe(false);
    expect(decorateHome(home, w, 'ghost' as FurnitureId)).toBe(false);
    expect(home.furniture).toEqual(['bed']);
    expect(homeComfortLabel(home)).toBe('Via Ortensio 12 · comfort 18');

    expect(decorateHome(home, w, 'sofa')).toBe(true);
    expect(decorateHome(home, w, 'tv')).toBe(true);
    expect(homeComfortLabel(home)).toBe('Via Ortensio 12 · comfort 36');

    expect(decorateHome(home, w, 'fridge')).toBe(false);
    expect(w.money).toBe(180);

    const luxury = defaultHomes()[0];
    luxury.furniture = ['bed'];
    luxury.upgrades = Array.from({ length: 20 }, (_, index) => `upgrade-${index}`);
    expect(homeComfortLabel(luxury)).toBe('Via Ortensio 12 · comfort 100');
  });
});
