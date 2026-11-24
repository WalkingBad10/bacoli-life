import { ITEM_CATALOG, type ItemId } from '../core/config';
import type { GameState } from '../core/types';

const FOOD_VALUES: Partial<Record<ItemId, { hunger: number; energy: number }>> = {
  caffe: { hunger: 2, energy: 8 },
  pizza: { hunger: 30, energy: 4 },
  cornetto: { hunger: 16, energy: 3 },
  gelato: { hunger: 12, energy: 2 },
  spesa: { hunger: 24, energy: 2 },
  pesce: { hunger: 26, energy: 4 },
  dolce: { hunger: 14, energy: 3 },
};

/** Usa un oggetto non commestibile (detersivo, giornale, benzina...). */
export function useItem(state: GameState, item: ItemId): boolean {
  if (FOOD_VALUES[item] || (state.inventory[item] ?? 0) <= 0) return false;
  state.inventory[item]--;
  if (state.inventory[item] === 0) delete state.inventory[item];
  return true;
}

/** Consuma un oggetto posseduto: separazione tra acquisto e uso reale. */
export function consumeItem(state: GameState, item: ItemId): boolean {
  const value = FOOD_VALUES[item];
  if (!value || (state.inventory[item] ?? 0) <= 0) return false;
  state.inventory[item]--;
  if (state.inventory[item] === 0) delete state.inventory[item];
  state.player.hunger = Math.max(0, Math.min(100, state.player.hunger + value.hunger));
  state.player.energy = Math.max(0, Math.min(100, state.player.energy + value.energy));
  return true;
}

export function consumableName(item: ItemId): string {
  return ITEM_CATALOG[item].name;
}

export interface SeatState {
  id: string;
  placeId: string;
  occupiedBy: string | null;
}

export function occupySeat(
  seats: Record<string, SeatState>, id: string, placeId: string, occupant = 'player',
): boolean {
  const existing = seats[id];
  if (existing?.occupiedBy) return false;
  seats[id] = { id, placeId, occupiedBy: occupant };
  return true;
}

export function releaseSeat(seats: Record<string, SeatState>, id: string, occupant = 'player'): boolean {
  const seat = seats[id];
  if (!seat || seat.occupiedBy !== occupant) return false;
  seat.occupiedBy = null;
  return true;
}

export function freeSeats(seats: Record<string, SeatState>, placeId: string): number {
  return Object.values(seats).filter((seat) => seat.placeId === placeId && !seat.occupiedBy).length;
}
