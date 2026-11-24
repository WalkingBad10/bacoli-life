import { describe, expect, it } from 'vitest';
import {
  canMarry, giveGift, marry, talkTo,
} from '../../src/systems/RelationshipSystem';
import type { GameState } from '../../src/core/types';

function state(): GameState {
  return {
    player: {
      x: 0, y: 0, money: 200, savings: 0, energy: 100, hunger: 100,
      job: null, homeId: 'home-1',
    },
    inventory: {}, relationships: {}, time: 600, day: 3, weather: 'sun',
    home: { owned: false, address: 'Via Ortensio', furniture: [], upgrades: [] },
    family: [], vehicles: [], jobState: null,
    transport: { ticketBus: 0, ticketTrain: 0, monthlyPass: false, lastTrip: null },
    social: { bonds: {}, spouseId: null, marriedOnDay: null },
    pets: [], stats: { distanceWalked: 0, distanceDriven: 0, npcsMet: 0 },
  };
}

describe('Relazioni e matrimonio', () => {
  it('parlare e regalare aumentano l’affinità', () => {
    const s = state();
    const wallet = { money: 200, savings: 0, inventory: {} };
    expect(talkTo(s, 'Maria')).toBe(1);
    expect(giveGift(s, 'Maria', wallet)).toBe(true);
    expect(wallet.money).toBe(185);
    expect(s.relationships.Maria).toBe(7);
    expect(s.social.bonds.Maria.gifts).toBe(1);
  });

  it('rifiuta il matrimonio senza casa o affinità', () => {
    const s = state();
    expect(canMarry(s, 'Maria').ok).toBe(false);
    s.home.owned = true;
    expect(canMarry(s, 'Maria').reason).toContain('affinità');
  });

  it('sposa un NPC creando il coniuge una sola volta', () => {
    const s = state();
    s.home.owned = true;
    s.relationships.Maria = 30;
    expect(marry(s, 'Maria')).toBe(true);
    expect(s.social.spouseId).toBe('Maria');
    expect(s.social.marriedOnDay).toBe(3);
    expect(s.family).toHaveLength(1);
    expect(s.family[0]).toMatchObject({ name: 'Maria', relation: 'coniuge' });
    expect(marry(s, 'Ciro')).toBe(false);
    expect(s.family).toHaveLength(1);
  });
});
