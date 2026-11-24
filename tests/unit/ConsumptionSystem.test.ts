import { describe, expect, it } from 'vitest';
import {
  consumeItem, freeSeats, occupySeat, releaseSeat,
} from '../../src/systems/ConsumptionSystem';
import type { GameState } from '../../src/core/types';

function state(): GameState {
  return {
    player: {
      x: 0, y: 0, money: 100, savings: 0, energy: 40, hunger: 40,
      job: null, homeId: 'home-1',
    },
    inventory: { pizza: 1, caffe: 2 }, relationships: {}, time: 600, day: 1, weather: 'sun',
    home: { owned: false, address: 'Via Ortensio', furniture: [], upgrades: [] },
    family: [], vehicles: [], jobState: null,
    transport: { ticketBus: 0, ticketTrain: 0, monthlyPass: false, lastTrip: null },
    social: { bonds: {}, spouseId: null, marriedOnDay: null },
    pets: [], stats: { distanceWalked: 0, distanceDriven: 0, npcsMet: 0 },
  };
}

describe('Consumo e posti a sedere', () => {
  it('consuma un oggetto posseduto applicando fame ed energia', () => {
    const s = state();
    expect(consumeItem(s, 'pizza')).toBe(true);
    expect(s.inventory.pizza).toBeUndefined();
    expect(s.player.hunger).toBe(70);
    expect(s.player.energy).toBe(44);
  });

  it('non consuma oggetti assenti o non commestibili', () => {
    const s = state();
    expect(consumeItem(s, 'benzina')).toBe(false);
    s.inventory = {};
    expect(consumeItem(s, 'caffe')).toBe(false);
  });

  it('occupa e libera un posto senza sovrapposizioni', () => {
    const seats: Record<string, { id: string; placeId: string; occupiedBy: string | null }> = {};
    expect(occupySeat(seats, 'chair-1', 'bar-pina')).toBe(true);
    expect(occupySeat(seats, 'chair-1', 'bar-pina')).toBe(false);
    expect(freeSeats(seats, 'bar-pina')).toBe(0);
    expect(releaseSeat(seats, 'chair-1')).toBe(true);
    expect(freeSeats(seats, 'bar-pina')).toBe(1);
  });
});
