import { describe, expect, it } from 'vitest';
import { buyVehicle, canDrive, consumeFuel, refuel } from '../../src/systems/VehicleSystem';
import type { VehicleState } from '../../src/core/types';
import type { Wallet } from '../../src/systems/Economy';

function wallet(money: number): Wallet {
  return { money, savings: 0, inventory: {} };
}

function vehicle(): VehicleState {
  return {
    id: 'v', kind: 'car', name: 'Utilitaria', x: 0, y: 0, angle: 0,
    fuel: 20, maxFuel: 40, color: '#fff', owned: true,
  };
}

describe('Veicoli', () => {
  it('consuma carburante proporzionalmente alla distanza', () => {
    const v = vehicle();
    consumeFuel(v, 100);
    expect(v.fuel).toBeCloseTo(19.88);
  });

  it('non consuma più carburante di quanto disponibile', () => {
    const v = vehicle();
    v.fuel = 0.01;
    consumeFuel(v, 100000);
    expect(v.fuel).toBe(0);
    expect(canDrive(v)).toBe(false);
  });

  it('rifornisce solo se il denaro basta', () => {
    const v = vehicle();
    const w = wallet(100);
    expect(refuel(v, w, 10)).toBe(true);
    expect(v.fuel).toBe(30);
    expect(w.money).toBeCloseTo(81.5);
    expect(refuel(v, wallet(1), 10)).toBe(false);
  });

  it('compra un veicolo e scala il prezzo', () => {
    const w = wallet(5000);
    const v = buyVehicle(w, 'moto', 'm1');
    expect(v).not.toBeNull();
    expect(w.money).toBe(2900);
    expect(v?.fuel).toBe(6);
    expect(buyVehicle(wallet(100), 'car', 'c1')).toBeNull();
  });
});
