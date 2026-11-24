import type { GameState, PetState } from '../core/types';
import type { Wallet } from './Economy';

export const PET_CATALOG = {
  dog: { name: 'Cane', price: 180, label: 'Nino' },
  cat: { name: 'Gatto', price: 120, label: 'Pina' },
} as const;

export type PetSpecies = keyof typeof PET_CATALOG;
export const MAX_PETS = 3;
export const PET_FOOD_ITEM = 'spesa';

/** Adotta un animale se c'è spazio e denaro sufficiente. */
export function adoptPet(state: GameState, species: PetSpecies, wallet: Wallet): PetState | null {
  if (state.pets.length >= MAX_PETS) return null;
  const spec = PET_CATALOG[species];
  if (wallet.money < spec.price) return null;
  wallet.money = Math.round((wallet.money - spec.price) * 100) / 100;
  const index = state.pets.filter((pet) => pet.species === species).length + 1;
  const pet: PetState = {
    id: `${species}-${Date.now()}-${index}`,
    name: `${spec.label}${index > 1 ? index : ''}`,
    species,
    age: 1 + (index % 3),
    hunger: 55,
    mood: 80,
    x: state.player.x,
    y: state.player.y,
    homeId: state.home.owned ? state.player.homeId : null,
  };
  state.pets.push(pet);
  return pet;
}

/** La fame e l'umore calano lentamente con le ore. */
export function advancePets(pets: PetState[], hours: number): void {
  for (const pet of pets) {
    pet.hunger = Math.max(0, pet.hunger - hours * 2.4);
    pet.mood = Math.max(0, Math.min(100,
      pet.mood - hours * 1.1 + (pet.hunger > 60 ? hours * 0.4 : 0)));
  }
}

/** Nutre l'animale con la spesa già posseduta nell'inventario. */
export function feedPet(state: GameState, pet: PetState): boolean {
  if ((state.inventory[PET_FOOD_ITEM] ?? 0) <= 0) return false;
  state.inventory[PET_FOOD_ITEM]--;
  if (state.inventory[PET_FOOD_ITEM] === 0) delete state.inventory[PET_FOOD_ITEM];
  pet.hunger = Math.min(100, pet.hunger + 35);
  pet.mood = Math.min(100, pet.mood + 8);
  return true;
}

/** Segue il giocatore con velocità costante, senza teletrasporto. */
export function followPet(pet: PetState, x: number, y: number, deltaMs: number): boolean {
  const dx = x - pet.x;
  const dy = y - pet.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 22) return false;
  const step = Math.min(distance - 18, 46 * (deltaMs / 1000));
  pet.x += (dx / distance) * step;
  pet.y += (dy / distance) * step;
  return true;
}

export function petLabel(pet: PetState): string {
  return `${pet.name} · ${PET_CATALOG[pet.species].name} · fame ${Math.round(pet.hunger)}`;
}
