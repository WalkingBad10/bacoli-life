import type { GameState, HomeRecord, HomeState } from '../core/types';
import { FURNITURE_CATALOG, type FurnitureId } from './LifeSystem';
import type { Wallet } from './Economy';

/**
 * Case reali nei quattro quartieri già giocabili. La prima mantiene prezzo e
 * indirizzo della Milestone 3 per non invalidare i salvataggi precedenti.
 */
export const HOME_OFFERS: readonly HomeRecord[] = [
  { id: 'home-1', address: 'Via Ortensio 12', street: 'Via Ortensio', price: 25_000, owned: false, furniture: [], upgrades: [], style: 'historic' },
  { id: 'home-2', address: 'Via Spiaggia 8', street: 'Via Spiaggia', price: 42_000, owned: false, furniture: [], upgrades: [], style: 'seafront' },
  { id: 'home-3', address: 'Piazzetta Miseno 4', street: 'Miseno', price: 58_000, owned: false, furniture: [], upgrades: [], style: 'villa' },
  { id: 'home-4', address: 'Via Baia 22', street: 'Baia', price: 68_000, owned: false, furniture: [], upgrades: [], style: 'seafront' },
  { id: 'home-5', address: 'Via Fusaro 15', street: 'Fusaro', price: 74_000, owned: false, furniture: [], upgrades: [], style: 'apartment' },
  { id: 'home-6', address: 'Via Torregaveta 30', street: 'Torregaveta', price: 88_000, owned: false, furniture: [], upgrades: [], style: 'villa' },
] as const;

export function defaultHomes(): HomeRecord[] {
  return HOME_OFFERS.map((home) => ({ ...home, furniture: [...home.furniture], upgrades: [...home.upgrades] }));
}

/** Ricostruisce le case v4 senza perdere arredi e proprietà dei salvataggi v3. */
export function normalizeHomes(
  value: HomeRecord[] | undefined, legacy: HomeState | undefined, homeId: string | null | undefined,
): HomeRecord[] {
  const homes = defaultHomes();
  const byId = new Map(homes.map((home) => [home.id, home]));
  if (Array.isArray(value)) {
    for (const stored of value) {
      if (!stored || typeof stored !== 'object') continue;
      const target = byId.get(stored.id);
      if (!target) continue;
      target.owned = Boolean(stored.owned);
      target.furniture = Array.isArray(stored.furniture)
        ? stored.furniture.filter((id): id is string => typeof id === 'string') : [];
      target.upgrades = Array.isArray(stored.upgrades)
        ? stored.upgrades.filter((id): id is string => typeof id === 'string') : [];
    }
  }
  const legacyOwned = Boolean(legacy?.owned);
  const legacyId = homeId && byId.has(homeId) ? homeId : 'home-1';
  if (legacyOwned) byId.get(legacyId)!.owned = true;
  if (legacy?.furniture?.length) {
    const target = byId.get(legacyId)!;
    for (const id of legacy.furniture) {
      if (!target.furniture.includes(id)) target.furniture.push(id);
    }
  }
  if (legacy?.upgrades?.length) {
    const target = byId.get(legacyId)!;
    for (const id of legacy.upgrades) {
      if (!target.upgrades.includes(id)) target.upgrades.push(id);
    }
  }
  return homes;
}

export function activeHomeId(state: GameState): string {
  const id = state.activeHomeId ?? state.player.homeId ?? 'home-1';
  const homes = state.homes ?? [];
  if (homes.some((home) => home.id === id && home.owned)) return id;
  return homes.find((home) => home.owned)?.id ?? 'home-1';
}

export function activeHome(state: GameState): HomeRecord {
  const homes = state.homes ?? (state.homes = defaultHomes());
  return homes.find((home) => home.id === activeHomeId(state)) ?? homes[0];
}

/** Tiene allineato il vecchio `home` usato da HUD, interni e test E2E. */
export function syncHomeMirror(state: GameState): HomeRecord {
  const home = activeHome(state);
  state.activeHomeId = home.id;
  state.player.homeId = home.id;
  state.home.owned = home.owned;
  state.home.address = home.address;
  state.home.id = home.id;
  state.home.street = home.street;
  state.home.furniture = [...home.furniture];
  state.home.upgrades = [...home.upgrades];
  return home;
}

export function buyHome(state: GameState, id: string, wallet: Wallet): HomeRecord | null {
  const home = (state.homes ??= defaultHomes()).find((item) => item.id === id);
  if (!home || home.owned || wallet.money < home.price) return null;
  wallet.money = Math.round((wallet.money - home.price) * 100) / 100;
  home.owned = true;
  state.activeHomeId = home.id;
  syncHomeMirror(state);
  return home;
}

export function setActiveHome(state: GameState, id: string): boolean {
  const home = (state.homes ??= defaultHomes()).find((item) => item.id === id && item.owned);
  if (!home) return false;
  state.activeHomeId = id;
  syncHomeMirror(state);
  return true;
}

export function decorateHome(home: HomeRecord, wallet: Wallet, id: FurnitureId): boolean {
  const spec = FURNITURE_CATALOG[id];
  if (!spec || home.furniture.includes(id) || wallet.money < spec.price) return false;
  wallet.money = Math.round((wallet.money - spec.price) * 100) / 100;
  home.furniture.push(id);
  return true;
}

export function homeComfortLabel(home: HomeRecord): string {
  const comfort = home.furniture.reduce((sum, id) => {
    const spec = FURNITURE_CATALOG[id as FurnitureId];
    return sum + (spec ? spec.comfort : 0);
  }, 0) + home.upgrades.length * 5;
  return `${home.address} · comfort ${Math.min(100, comfort)}`;
}
