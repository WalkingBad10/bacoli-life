import { describe, expect, it } from 'vitest';
import { buy, dailyExpenses, deposit, paySalary, sell, withdraw, type Wallet } from '../../src/systems/Economy';

function wallet(): Wallet {
  return { money: 100, savings: 0, inventory: {} };
}

describe('Economia', () => {
  it('compra un oggetto e scala il denaro', () => {
    const w = wallet();
    expect(buy(w, 'pizza')).toBe(true);
    expect(w.money).toBe(92);
    expect(w.inventory.pizza).toBe(1);
  });

  it('rifiuta acquisti senza denaro sufficiente', () => {
    const w = wallet();
    w.money = 1;
    expect(buy(w, 'pizza')).toBe(false);
    expect(w.inventory.pizza).toBeUndefined();
  });

  it('vende a metà prezzo e rimuove l\'oggetto esaurito', () => {
    const w = wallet();
    buy(w, 'caffe');
    expect(sell(w, 'caffe')).toBe(true);
    expect(w.inventory.caffe).toBeUndefined();
    expect(w.money).toBeCloseTo(99.4);
  });

  it('gestisce depositi e prelievi', () => {
    const w = wallet();
    expect(deposit(w, 30)).toBe(true);
    expect(w.savings).toBe(30);
    expect(withdraw(w, 10)).toBe(true);
    expect(w.savings).toBe(20);
    expect(withdraw(w, 100)).toBe(false);
  });

  it('lo stipendio e le spese giornaliere non producono valori negativi', () => {
    const w = wallet();
    paySalary(w, 50);
    expect(w.money).toBe(150);
    w.money = 2;
    dailyExpenses(w);
    expect(w.money).toBe(0);
  });
});
