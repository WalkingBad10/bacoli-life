import type { BusinessState, GameState, Place, PlaceKind } from '../core/types';
import type { Wallet } from './Economy';

/** Orari realistici di apertura, usati anche quando l'attività non è acquistata. */
export const OPEN_HOURS: Partial<Record<PlaceKind, readonly [number, number]>> = {
  cafe: [6, 20],
  bar: [6, 23],
  restaurant: [11, 23],
  shop: [8, 20],
  pharmacy: [8, 20],
  pescheria: [7, 14],
  gelateria: [11, 23],
  bank: [8, 13],
  post_office: [8, 13],
  office: [8, 16],
  dealership: [9, 19],
  garage: [8, 19],
  workplace: [7, 18],
  fuel: [0, 24],
};

const PRICES: Partial<Record<PlaceKind, number>> = {
  cafe: 32_000, bar: 28_000, restaurant: 55_000, shop: 40_000,
  pharmacy: 60_000, pescheria: 35_000, gelateria: 34_000,
  garage: 70_000, fuel: 90_000, workplace: 45_000,
};

const BASE_REVENUE: Partial<Record<PlaceKind, number>> = {
  cafe: 14, bar: 18, restaurant: 26, shop: 20, pharmacy: 24,
  pescheria: 18, gelateria: 16, garage: 30, fuel: 42, workplace: 12,
};

export const BUSINESS_KINDS: PlaceKind[] = [
  'cafe', 'bar', 'restaurant', 'shop', 'pharmacy',
  'pescheria', 'gelateria', 'garage', 'fuel', 'workplace',
];

export function isOpenAt(kind: PlaceKind, hour: number): boolean {
  const range = OPEN_HOURS[kind];
  if (!range) return true;
  const h = ((hour % 24) + 24) % 24;
  return h >= range[0] && h < range[1];
}

export function businessIsOpen(business: BusinessState, hour: number): boolean {
  return business.open && isOpenAt(business.kind, hour);
}

export function businessPrice(kind: PlaceKind): number {
  return PRICES[kind] ?? 30_000;
}

/** Crea una voce per ogni attività commerciale presente sulla mappa. */
export function createBusinesses(places: Place[]): BusinessState[] {
  return places
    .filter((place) => BUSINESS_KINDS.includes(place.kind))
    .map((place) => ({
      id: `biz-${place.id}`,
      placeId: place.id,
      name: place.name,
      kind: place.kind,
      owned: false,
      open: true,
      stock: 20,
      earnings: 0,
      employees: 0,
      level: 1,
      price: businessPrice(place.kind),
      lastCollectedDay: 1,
    }));
}

function sanitizeBusiness(stored: BusinessState, fallback: BusinessState): BusinessState {
  return {
    ...fallback,
    ...stored,
    owned: Boolean(stored.owned),
    open: stored.open !== false,
    stock: Number.isFinite(stored.stock) ? Math.max(0, Math.min(99, Math.floor(stored.stock!))) : 20,
    earnings: Number.isFinite(stored.earnings) ? Math.max(0, stored.earnings!) : 0,
    employees: Number.isFinite(stored.employees) ? Math.max(0, Math.min(4, Math.floor(stored.employees!))) : 0,
    level: Number.isFinite(stored.level) ? Math.max(1, Math.min(5, Math.floor(stored.level!))) : 1,
    lastCollectedDay: Number.isFinite(stored.lastCollectedDay) ? stored.lastCollectedDay! : 1,
  };
}

/** Valida le attività lette da un salvataggio, senza conoscere la mappa. */
export function normalizeStoredBusinesses(value: BusinessState[] | undefined): BusinessState[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: BusinessState[] = [];
  for (const stored of value) {
    if (!stored || typeof stored !== 'object' || typeof stored.id !== 'string') continue;
    if (seen.has(stored.id)) continue;
    seen.add(stored.id);
    result.push(sanitizeBusiness(stored, createBusinesses([])[0] ?? {
      id: stored.id, placeId: '', name: stored.name ?? 'Attività', kind: 'shop',
      owned: false, open: true, stock: 20, earnings: 0, employees: 0,
      level: 1, price: 30_000, lastCollectedDay: 1,
    }));
  }
  return result;
}

export function normalizeBusinesses(value: BusinessState[] | undefined, places: Place[]): BusinessState[] {
  const defaults = createBusinesses(places);
  const byId = new Map(defaults.map((item) => [item.id, item]));
  for (const stored of normalizeStoredBusinesses(value)) {
    const fallback = byId.get(stored.id);
    if (fallback) byId.set(stored.id, sanitizeBusiness(stored, fallback));
    else defaults.push(stored);
  }
  return defaults;
}

export function buyBusiness(state: GameState, place: Place, wallet: Wallet): BusinessState | null {
  const businesses = state.businesses ?? (state.businesses = createBusinesses([]));
  let business = businesses.find((item) => item.placeId === place.id);
  if (!business) {
    business = createBusinesses([place])[0];
    if (!business) return null;
    businesses.push(business);
  }
  if (business.owned || wallet.money < business.price) return null;
  wallet.money = Math.round((wallet.money - business.price) * 100) / 100;
  business.owned = true;
  business.open = true;
  business.stock = 20;
  return business;
}

/** Incasso passivo delle attività aperte: lo si ritira alla cassa. */
export function advanceBusinesses(
  businesses: BusinessState[], minutes: number, hour: number,
): number {
  let total = 0;
  for (const business of businesses) {
    if (!business.owned || !businessIsOpen(business, hour) || business.stock <= 0) continue;
    const hourly = (BASE_REVENUE[business.kind] ?? 12) * business.level
      * (1 + business.employees * 0.35);
    const gain = Math.round(hourly * (minutes / 60) * 100) / 100;
    business.earnings = Math.round((business.earnings + gain) * 100) / 100;
    business.stock = Math.max(0, business.stock - minutes / 240);
    total += gain;
  }
  return total;
}

export function collectEarnings(business: BusinessState, wallet: Wallet): number {
  const amount = Math.round(business.earnings * 100) / 100;
  if (amount <= 0) return 0;
  wallet.money = Math.round((wallet.money + amount) * 100) / 100;
  business.earnings = 0;
  return amount;
}

export function restockBusiness(business: BusinessState, wallet: Wallet): boolean {
  const cost = 120 + business.level * 40;
  if (wallet.money < cost || business.stock >= 90) return false;
  wallet.money = Math.round((wallet.money - cost) * 100) / 100;
  business.stock = Math.min(99, business.stock + 30);
  return true;
}

export function hireEmployee(business: BusinessState, wallet: Wallet): boolean {
  const cost = 450 + business.employees * 250;
  if (wallet.money < cost || business.employees >= 4) return false;
  wallet.money = Math.round((wallet.money - cost) * 100) / 100;
  business.employees += 1;
  return true;
}

export function upgradeBusiness(business: BusinessState, wallet: Wallet): boolean {
  const cost = 900 * business.level;
  if (wallet.money < cost || business.level >= 5) return false;
  wallet.money = Math.round((wallet.money - cost) * 100) / 100;
  business.level += 1;
  return true;
}

export function businessLabel(business: BusinessState, hour: number): string {
  const status = businessIsOpen(business, hour)
    ? 'aperto'
    : business.open ? 'chiuso per orario' : 'chiuso dal proprietario';
  return `${business.name} · ${status} · cassa € ${business.earnings.toFixed(2)}`;
}
