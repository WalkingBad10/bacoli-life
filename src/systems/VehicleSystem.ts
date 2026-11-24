import type { VehicleKind, VehicleState } from '../core/types';
import type { Wallet } from './Economy';

export const VEHICLE_CATALOG: Record<VehicleKind, {
  name: string; price: number; maxFuel: number; consumption: number; speed: number;
}> = {
  car: { name: 'Utilitaria', price: 4200, maxFuel: 40, consumption: 0.12, speed: 168 },
  moto: { name: 'Vespa 125', price: 2100, maxFuel: 12, consumption: 0.05, speed: 145 },
  bus: { name: 'Autobus EAV', price: 0, maxFuel: 90, consumption: 0.3, speed: 95 },
};

export function consumeFuel(vehicle: VehicleState, distance: number): number {
  const spec = VEHICLE_CATALOG[vehicle.kind];
  const used = Math.min(vehicle.fuel, distance / 100 * spec.consumption);
  vehicle.fuel = Math.max(0, vehicle.fuel - used);
  return used;
}

export function refuel(vehicle: VehicleState, wallet: Wallet, liters: number): boolean {
  const missing = Math.min(liters, vehicle.maxFuel - vehicle.fuel);
  if (missing <= 0) return false;
  // 1 litro di benzina è presente nel catalogo economico.
  const price = 1.85 * missing;
  if (wallet.money < price) return false;
  wallet.money -= price;
  vehicle.fuel += missing;
  return true;
}

export function buyVehicle(wallet: Wallet, kind: 'car' | 'moto', id: string): VehicleState | null {
  const spec = VEHICLE_CATALOG[kind];
  if (wallet.money < spec.price) return null;
  wallet.money -= spec.price;
  return {
    id, kind, name: spec.name, x: 0, y: 0, angle: 0,
    fuel: spec.maxFuel / 2, maxFuel: spec.maxFuel,
    color: kind === 'car' ? '#3A6EA5' : '#B1403B', owned: true,
  };
}

export function canDrive(vehicle: VehicleState): boolean {
  return vehicle.owned && vehicle.fuel > 0;
}
