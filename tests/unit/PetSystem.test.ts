import { describe, expect, it } from 'vitest';
import {
  MAX_PETS, advancePets, adoptPet, feedPet, followPet,
} from '../../src/systems/PetSystem';
import type { GameState } from '../../src/core/types';

function state(): GameState {
  return {
    player: {
      x: 100, y: 200, money: 500, savings: 0, energy: 100, hunger: 100,
      job: null, homeId: 'home-1',
    },
    inventory: { spesa: 2 }, relationships: {}, time: 600, day: 1, weather: 'sun',
    home: { owned: true, address: 'Via Ortensio', furniture: [], upgrades: [] },
    family: [], vehicles: [], jobState: null,
    transport: { ticketBus: 0, ticketTrain: 0, monthlyPass: false, lastTrip: null },
    social: { bonds: {}, spouseId: null, marriedOnDay: null },
    pets: [], stats: { distanceWalked: 0, distanceDriven: 0, npcsMet: 0 },
  };
}

describe('Animali domestici', () => {
  it('adotta un cane addebitando il prezzo del catalogo', () => {
    const s = state();
    const wallet = { money: 500, savings: 0, inventory: {} };
    const pet = adoptPet(s, 'dog', wallet);
    expect(pet?.species).toBe('dog');
    expect(wallet.money).toBe(320);
    expect(s.pets).toHaveLength(1);
  });

  it('non adotta oltre il limite o senza denaro', () => {
    const s = state();
    const wallet = { money: 1000, savings: 0, inventory: {} };
    for (let i = 0; i < MAX_PETS; i++) expect(adoptPet(s, 'cat', wallet)).not.toBeNull();
    expect(adoptPet(s, 'cat', wallet)).toBeNull();
    expect(adoptPet(state(), 'dog', { money: 10, savings: 0, inventory: {} })).toBeNull();
  });

  it('nutre con la spesa e fa decay con le ore', () => {
    const s = state();
    const pet = adoptPet(s, 'dog', { money: 500, savings: 0, inventory: {} })!;
    pet.hunger = 30;
    expect(feedPet(s, pet)).toBe(true);
    expect(pet.hunger).toBe(65);
    expect(s.inventory.spesa).toBe(1);
    advancePets(s.pets, 5);
    expect(pet.hunger).toBeLessThan(65);
    expect(pet.mood).toBeLessThan(88);
  });

  it('segue il giocatore senza teletrasporto', () => {
    const s = state();
    const pet = adoptPet(s, 'dog', { money: 500, savings: 0, inventory: {} })!;
    const before = { x: pet.x, y: pet.y };
    expect(followPet(pet, 300, 200, 500)).toBe(true);
    expect(pet.x).toBeGreaterThan(before.x);
    expect(pet.x).toBeLessThan(300);
    expect(followPet(pet, pet.x, pet.y, 500)).toBe(false);
  });
});
