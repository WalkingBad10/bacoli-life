import { describe, expect, it } from 'vitest';
import {
  FURNITURE_CATALOG, advanceFamily, buyFurniture, createJob, familyActivity,
  homeComfort, startFamily, workShift,
} from '../../src/systems/LifeSystem';
import type { HomeState } from '../../src/core/types';

function home(): HomeState {
  return { owned: true, address: 'Via Ortensio 12', furniture: [], upgrades: [] };
}

describe('Vita domestica', () => {
  it('compra arredi una sola volta e scala il denaro', () => {
    const place = home();
    const wallet = { money: 1000, savings: 0, inventory: {} };
    expect(buyFurniture(place, wallet, 'bed')).toBe(true);
    expect(wallet.money).toBe(1000 - FURNITURE_CATALOG.bed.price);
    expect(buyFurniture(place, wallet, 'bed')).toBe(false);
    expect(place.furniture).toEqual(['bed']);
  });

  it('non vende arredi senza denaro sufficiente', () => {
    const place = home();
    const wallet = { money: 10, savings: 0, inventory: {} };
    expect(buyFurniture(place, wallet, 'tv')).toBe(false);
    expect(place.furniture).toEqual([]);
  });

  it('calcola il comfort della casa', () => {
    const place = home();
    expect(homeComfort(place)).toBe(0);
    place.furniture = ['bed', 'sofa', 'tv'];
    expect(homeComfort(place)).toBe(36);
  });

  it('crea la famiglia solo con una casa di proprietà', () => {
    const rented = home();
    rented.owned = false;
    const family: { name: string; relation: string; age: number; mood: number }[] = [];
    expect(startFamily(rented, family)).toBe(false);
    expect(family).toEqual([]);
    rented.owned = true;
    expect(startFamily(rented, family)).toBe(true);
    expect(family.map((member) => member.name)).toEqual(['Giuseppina', 'Ciro']);
    expect(startFamily(rented, family)).toBe(false);
  });

  it('fa calare e poi salire l\'umore con le attività', () => {
    const family = [
      { name: 'Giuseppina', relation: 'compagna', age: 34, mood: 70 },
      { name: 'Ciro', relation: 'figlio', age: 8, mood: 80 },
    ];
    advanceFamily(family, 4);
    expect(family[0].mood).toBeCloseTo(67.8);
    expect(familyActivity(family, 'meal')).toBe(8);
    expect(family[0].mood).toBeCloseTo(75.8);
  });
});

describe('Lavoro', () => {
  it('crea un contratto e paga il turno', () => {
    const job = createJob('barista');
    expect(job.title).toBe('Barista');
    const result = workShift(job, 2);
    expect(result.wage).toBe(19);
    expect(result.energyCost).toBe(14);
    expect(job.hoursWorked).toBe(2);
    expect(job.daysWorked).toBe(1);
  });

  it('limita i turnietween 0.5 e 12 ore', () => {
    const job = createJob('pizzaiolo');
    expect(workShift(job, 0.1).hours).toBe(0.5);
    expect(workShift(job, 30).hours).toBe(12);
  });
});
