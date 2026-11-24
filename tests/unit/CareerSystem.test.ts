import { describe, expect, it } from 'vitest';
import {
  careerLabel, careerWageMultiplier, defaultCareer, normalizeCareer,
  registerShift, settlePayday, xpForLevel,
} from '../../src/systems/CareerSystem';
import type { CareerState, JobState } from '../../src/core/types';
import type { Wallet } from '../../src/systems/Economy';

function job(): JobState {
  return {
    id: 'barista', title: 'Barista', workplace: 'Bar Pina', hourlyWage: 9.5,
    hoursWorked: 0, daysWorked: 0, level: 1, xp: 0,
  };
}

function wallet(): Wallet {
  return { money: 100, savings: 0, inventory: {} };
}

describe('Carriera', () => {
  it('migra i salvataggi senza carriera e ripara i campi corrotti', () => {
    expect(normalizeCareer(undefined)).toEqual(defaultCareer());
    expect(normalizeCareer(null)).toEqual(defaultCareer());
    expect(normalizeCareer('non un oggetto' as unknown as CareerState)).toEqual(defaultCareer());

    const migrated = normalizeCareer({
      level: 99, xp: -5, shifts: 2.9, promotions: -2,
      lastPayDay: 0, unpaidWage: -3, totalEarned: Number.NaN,
    } as CareerState);
    expect(migrated).toEqual({
      level: 10, xp: 0, shifts: 2, promotions: 0,
      lastPayDay: 1, unpaidWage: 0, totalEarned: 0,
    });

    expect(normalizeCareer({
      level: 3, xp: 7.5, shifts: 4, promotions: 1,
      lastPayDay: 8, unpaidWage: 1.2, totalEarned: 50,
    })).toEqual({
      level: 3, xp: 7.5, shifts: 4, promotions: 1,
      lastPayDay: 8, unpaidWage: 1.2, totalEarned: 50,
    });
  });

  it('aumenta il moltiplicatore di stipendio con l’anzianità fino al livello 10', () => {
    expect([1, 2, 3].map(xpForLevel)).toEqual([24, 40, 56]);
    expect(careerWageMultiplier()).toBe(1);
    expect(careerWageMultiplier({ level: 6 } as CareerState)).toBeCloseTo(1.4);
    expect(careerWageMultiplier({ level: 99 } as CareerState)).toBeCloseTo(1.72);
    expect(careerLabel()).toBe('Livello 1 · 0 turni · 0 promozioni');
    expect(careerLabel({ level: 3, shifts: 5, promotions: 2 } as CareerState))
      .toBe('Livello 3 · 5 turni · 2 promozioni');
  });

  it('promuove solo al superamento della soglia XP e aggiorna il contratto', () => {
    const contract = job();
    const career = defaultCareer();

    expect(registerShift(contract, career, 2, 19))
      .toEqual({ gainedXp: 24, levelUp: true, bonusWage: 1.9 });
    expect(career).toMatchObject({
      level: 2, xp: 0, shifts: 1, promotions: 1, unpaidWage: 1.9, totalEarned: 19,
    });
    expect(contract).toMatchObject({ level: 2, xp: 0 });

    expect(registerShift(contract, career, 2, 19))
      .toEqual({ gainedXp: 28, levelUp: false, bonusWage: 1.9 });
    expect(career).toMatchObject({
      level: 2, xp: 28, shifts: 2, promotions: 1, unpaidWage: 3.8, totalEarned: 38,
    });
    expect(contract.xp).toBe(28);
  });

  it('concede più promozioni in un turno senza superare il livello 10', () => {
    const contract = job();
    const career = defaultCareer();
    career.xp = 23;

    const progress = registerShift(contract, career, 12, 100);
    expect(progress.levelUp).toBe(true);
    expect(progress.gainedXp).toBe(144);
    expect(career.level).toBe(4);
    expect(career.xp).toBeCloseTo(47);
    expect(career.promotions).toBe(3);
    expect(career.unpaidWage).toBe(10);

    const maxed = defaultCareer();
    maxed.level = 10;
    expect(registerShift(contract, maxed, 12, 20).levelUp).toBe(false);
    expect(maxed.level).toBe(10);
    expect(maxed.promotions).toBe(0);
    expect(maxed.xp).toBe(360);
  });

  it('paga lo stipendio dopo sette giorni azzerando il bonus differito', () => {
    const career = defaultCareer();
    career.level = 2;
    career.shifts = 2;
    career.unpaidWage = 3.8;
    const w = wallet();

    expect(settlePayday(career, 7, w)).toBe(0);
    expect(w.money).toBe(100);

    expect(settlePayday(career, 8, w)).toBe(51.8);
    expect(w.money).toBe(151.8);
    expect(career).toMatchObject({ lastPayDay: 8, unpaidWage: 0, totalEarned: 51.8 });

    expect(settlePayday(career, 10, w)).toBe(0);
    expect(w.money).toBe(151.8);

    expect(settlePayday(career, 15, w)).toBe(48);
    expect(w.money).toBe(199.8);
    expect(career.totalEarned).toBeCloseTo(99.8);
  });
});
