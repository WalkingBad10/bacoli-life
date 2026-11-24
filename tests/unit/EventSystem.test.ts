import { describe, expect, it } from 'vitest';
import {
  LOCAL_EVENTS, attendLocalEvent, eventForDay, eventLabel, nextEvent,
} from '../../src/systems/EventSystem';
import type { FamilyMember, GameState } from '../../src/core/types';
import type { Wallet } from '../../src/systems/Economy';

function gameState(day: number, family: FamilyMember[] = []): GameState {
  return {
    player: {
      x: 0, y: 0, money: 1_000, savings: 0, energy: 100, hunger: 100,
      job: null, homeId: null,
    },
    inventory: {}, relationships: {}, time: 0, day, weather: 'sun',
    home: { owned: false, address: 'Via Ortensio 12', furniture: [], upgrades: [] },
    family, vehicles: [], jobState: null,
    transport: { ticketBus: 0, ticketTrain: 0, monthlyPass: false, lastTrip: null },
    social: { bonds: {}, spouseId: null, marriedOnDay: null },
    pets: [], stats: { distanceWalked: 0, distanceDriven: 0, npcsMet: 0 },
  };
}

function wallet(money: number): Wallet {
  return { money, savings: 0, inventory: {} };
}

describe('Eventi del territorio', () => {
  it('seleziona l’evento ricorrente del giorno con priorità di calendario', () => {
    expect(eventForDay(7)?.id).toBe('mercato');
    expect(eventForDay(14)?.id).toBe('mercato');
    expect(eventForDay(22)?.id).toBe('estate');
    expect(eventForDay(30)?.id).toBe('carnevale');
    expect(eventForDay(1)).toBeNull();
    expect(eventForDay(0)).toBeNull();
    expect(eventForDay(Number.NaN)).toBeNull();
    expect(LOCAL_EVENTS.map((event) => event.period)).toEqual([7, 14, 21, 30, 11]);
  });

  it('descrive l’evento del giorno o il primo evento del calendario', () => {
    expect(nextEvent(6)).toEqual({ event: LOCAL_EVENTS[0], inDays: 1 });
    expect(nextEvent(7)).toEqual({ event: LOCAL_EVENTS[0], inDays: 1 });
    expect(eventLabel(7)).toBe('Mercato di Baia · Banchi di pesce e prodotti locali in piazza.');
    expect(eventLabel(30))
      .toBe('Carnevale flegreo · Maschere e sfilata tra Via Ortensio e Via Spiaggia.');
    expect(eventLabel(1)).toBe('Prossimo evento: Mercato di Baia tra 1 giorni');
  });

  it('concede la ricompensa una sola volta al giorno e migliora l’umore della famiglia', () => {
    const family: FamilyMember[] = [
      { name: 'Giuseppina', relation: 'compagna', age: 34, mood: 70 },
    ];
    const state = gameState(7, family);
    const w = wallet(100);

    expect(attendLocalEvent(state, w, 'mercato'))
      .toEqual({ okay: true, reward: 12, mood: 12 });
    expect(w.money).toBe(112);
    expect(state.events).toEqual([{ id: 'mercato', day: 7 }]);
    expect(family[0].mood).toBe(82);

    expect(attendLocalEvent(state, w, 'mercato'))
      .toEqual({ okay: false, reward: 0, mood: 0 });
    expect(w.money).toBe(112);
    expect(family[0].mood).toBe(82);
    expect(state.events).toHaveLength(1);

    expect(attendLocalEvent(state, w, 'sagra'))
      .toEqual({ okay: false, reward: 0, mood: 0 });
    expect(attendLocalEvent(state, w, 'sconosciuto'))
      .toEqual({ okay: false, reward: 0, mood: 0 });
    expect(w.money).toBe(112);
    expect(state.events).toHaveLength(1);
  });

  it('premia gli eventi dei giorni successivi senza familiari e limita l’umore', () => {
    const state = gameState(30);
    const w = wallet(50);

    expect(attendLocalEvent(state, w, 'carnevale'))
      .toEqual({ okay: true, reward: 36, mood: 0 });
    expect(w.money).toBe(86);

    state.day = 31;
    expect(attendLocalEvent(state, w, 'carnevale'))
      .toEqual({ okay: false, reward: 0, mood: 0 });
    expect(w.money).toBe(86);

    state.day = 22;
    state.family = [{ name: 'Ciro', relation: 'figlio', age: 8, mood: 95 }];
    expect(attendLocalEvent(state, w, 'estate').reward).toBe(18);
    expect(state.family[0].mood).toBe(100);
    expect(w.money).toBe(104);
    expect(state.events).toEqual([
      { id: 'carnevale', day: 30 }, { id: 'estate', day: 22 },
    ]);
  });
});
