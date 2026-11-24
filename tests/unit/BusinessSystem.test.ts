import { describe, expect, it } from 'vitest';
import {
  BUSINESS_KINDS, advanceBusinesses, businessIsOpen, businessLabel, businessPrice,
  buyBusiness, collectEarnings, createBusinesses, hireEmployee, isOpenAt,
  normalizeBusinesses, normalizeStoredBusinesses, restockBusiness, upgradeBusiness,
} from '../../src/systems/BusinessSystem';
import type { BusinessState, GameState, Place, PlaceKind } from '../../src/core/types';
import type { Wallet } from '../../src/systems/Economy';

function place(id: string, kind: PlaceKind, name: string): Place {
  return { id, name, kind, x: 0, y: 0, sprite: 0, footprint: [] };
}

function business(kind: PlaceKind = 'cafe'): BusinessState {
  return {
    id: `biz-${kind}`, placeId: kind, name: 'Bar Pina', kind,
    owned: true, open: true, stock: 20, earnings: 0, employees: 0,
    level: 1, price: businessPrice(kind), lastCollectedDay: 1,
  };
}

function gameState(businesses: BusinessState[] = []): GameState {
  return {
    player: {
      x: 0, y: 0, money: 1_000, savings: 0, energy: 100, hunger: 100,
      job: null, homeId: null,
    },
    inventory: {}, relationships: {}, time: 0, day: 1, weather: 'sun',
    home: { owned: false, address: 'Via Ortensio 12', furniture: [], upgrades: [] },
    family: [], vehicles: [], jobState: null,
    transport: { ticketBus: 0, ticketTrain: 0, monthlyPass: false, lastTrip: null },
    social: { bonds: {}, spouseId: null, marriedOnDay: null },
    pets: [], stats: { distanceWalked: 0, distanceDriven: 0, npcsMet: 0 },
    businesses,
  };
}

function wallet(money: number): Wallet {
  return { money, savings: 0, inventory: {} };
}

describe('Attività commerciali', () => {
  it('crea una voce solo per i luoghi commerciali della mappa', () => {
    const places = [
      place('cafe-1', 'cafe', 'Bar Centrale'),
      place('home-1', 'home', 'Casa'),
      place('bank-1', 'bank', 'Banca'),
      place('bar-1', 'bar', 'Bar Pina'),
    ];
    const list = createBusinesses(places);
    expect(list.map((item) => item.id)).toEqual(['biz-cafe-1', 'biz-bar-1']);
    expect(list[0]).toMatchObject({
      placeId: 'cafe-1', name: 'Bar Centrale', kind: 'cafe', owned: false,
      open: true, stock: 20, earnings: 0, employees: 0, level: 1,
      price: 32_000, lastCollectedDay: 1,
    });
    expect(list[1].price).toBe(28_000);
    expect(BUSINESS_KINDS).toContain('gelateria');
    expect(BUSINESS_KINDS).not.toContain('bank');
    expect(businessPrice('sconosciuto' as PlaceKind)).toBe(30_000);
  });

  it('rispetta gli orari reali e distingue le chiusure', () => {
    expect(isOpenAt('cafe', 6)).toBe(true);
    expect(isOpenAt('cafe', 19.9)).toBe(true);
    expect(isOpenAt('cafe', 20)).toBe(false);
    expect(isOpenAt('cafe', 30)).toBe(true);
    expect(isOpenAt('bar', 22)).toBe(true);
    expect(isOpenAt('bar', 23)).toBe(false);
    expect(isOpenAt('bank', 8)).toBe(true);
    expect(isOpenAt('bank', 13)).toBe(false);
    expect(isOpenAt('fuel', 3)).toBe(true);
    expect(isOpenAt('home', 3)).toBe(true);

    const bar = business('bar');
    expect(businessIsOpen(bar, 22)).toBe(true);
    expect(businessLabel(bar, 22)).toBe('Bar Pina · aperto · cassa € 0.00');
    expect(businessLabel(bar, 23)).toBe('Bar Pina · chiuso per orario · cassa € 0.00');
    bar.open = false;
    expect(businessIsOpen(bar, 22)).toBe(false);
    expect(businessLabel(bar, 22)).toBe('Bar Pina · chiuso dal proprietario · cassa € 0.00');
    bar.open = true;
    bar.earnings = 14.5;
    expect(businessLabel(bar, 22)).toBe('Bar Pina · aperto · cassa € 14.50');
  });

  it('normalizza le attività lette dal salvataggio senza duplicati', () => {
    const stored = [
      {
        id: 'biz-cafe-1', owned: 1, open: false, stock: 150, earnings: -5,
        employees: 9, level: 99, lastCollectedDay: Number.NaN,
      },
      { id: 'biz-cafe-1', owned: false, stock: 1 },
      {
        id: 'biz-old', placeId: 'old', name: 'Chiosco', kind: 'shop',
        owned: true, price: 99, stock: 2.9,
      },
      null,
      { stock: 3 },
    ] as unknown as BusinessState[];

    const sanitized = normalizeStoredBusinesses(stored);
    expect(sanitized).toHaveLength(2);
    expect(sanitized[0]).toMatchObject({
      id: 'biz-cafe-1', owned: true, open: false, stock: 99,
      earnings: 0, employees: 4, level: 5, lastCollectedDay: 1,
    });
    expect(sanitized[1]).toMatchObject({
      id: 'biz-old', name: 'Chiosco', kind: 'shop', price: 99,
      owned: true, open: true, stock: 2, level: 1,
    });

    const list = normalizeBusinesses(stored, [
      place('cafe-1', 'cafe', 'Caffè'), place('bar-1', 'bar', 'Bar Pina'),
    ]);
    expect(list).toHaveLength(3);

    const cafe = list.find((item) => item.id === 'biz-cafe-1')!;
    expect(cafe).toMatchObject({
      placeId: 'cafe-1', name: 'Caffè', kind: 'cafe', price: 32_000,
      owned: false, open: true, stock: 20, earnings: 0, employees: 0, level: 1,
    });
    const bar = list.find((item) => item.id === 'biz-bar-1')!;
    expect(bar).toMatchObject({ owned: false, open: true, stock: 20, level: 1 });
    const old = list.find((item) => item.id === 'biz-old')!;
    expect(old).toMatchObject({ name: 'Chiosco', kind: 'shop', price: 99, owned: true, stock: 2 });

    expect(normalizeStoredBusinesses(undefined)).toEqual([]);
    expect(normalizeStoredBusinesses([null, {}] as unknown as BusinessState[])).toEqual([]);
  });

  it('acquista ogni attività una sola volta senza toccare cassa e scorte', () => {
    const cafe = place('cafe-1', 'cafe', 'Bar Centrale');
    const state = gameState(createBusinesses([cafe]));
    const w = wallet(30_000);

    expect(buyBusiness(state, cafe, w)).toBeNull();
    expect(w.money).toBe(30_000);

    w.money = 40_000;
    const owned = buyBusiness(state, cafe, w);
    expect(owned?.owned).toBe(true);
    expect(w.money).toBe(8_000);
    expect(owned).toMatchObject({ open: true, stock: 20 });

    state.businesses![0].earnings = 12.5;
    state.businesses![0].stock = 3;
    expect(buyBusiness(state, cafe, w)).toBeNull();
    expect(state.businesses![0].earnings).toBe(12.5);
    expect(state.businesses![0].stock).toBe(3);
    expect(w.money).toBe(8_000);

    const bar = place('bar-1', 'bar', 'Bar Pina');
    w.money = 30_000;
    expect(buyBusiness(state, bar, w)?.id).toBe('biz-bar-1');
    expect(w.money).toBe(2_000);

    const fresh = gameState();
    expect(buyBusiness(fresh, cafe, wallet(40_000))?.owned).toBe(true);
    expect(fresh.businesses).toHaveLength(1);
  });

  it('genera incassi passivi solo quando aperto e con scorte', () => {
    const cafe = business('cafe');
    const w = wallet(0);

    expect(advanceBusinesses([cafe], 60, 10)).toBe(14);
    expect(cafe).toMatchObject({ earnings: 14, stock: 19.75 });

    cafe.employees = 2;
    cafe.level = 2;
    expect(advanceBusinesses([cafe], 30, 10)).toBeCloseTo(23.8);
    expect(cafe.earnings).toBeCloseTo(37.8);
    expect(cafe.stock).toBeCloseTo(19.625);

    expect(advanceBusinesses([cafe], 60, 21)).toBe(0);
    cafe.open = false;
    expect(advanceBusinesses([cafe], 60, 10)).toBe(0);
    cafe.open = true;
    cafe.owned = false;
    expect(advanceBusinesses([cafe], 60, 10)).toBe(0);
    cafe.owned = true;
    cafe.stock = 0;
    expect(advanceBusinesses([cafe], 60, 10)).toBe(0);
    expect(w.money).toBe(0);

    const shop = business('shop');
    shop.stock = 0.2;
    expect(advanceBusinesses([shop], 60, 10)).toBe(20);
    expect(shop.stock).toBe(0);
    expect(advanceBusinesses([shop], 60, 10)).toBe(0);
  });

  it('ritira la cassa una sola volta e la azzera', () => {
    const cafe = business('cafe');
    cafe.earnings = 23.8;
    const w = wallet(100);

    expect(collectEarnings(cafe, w)).toBe(23.8);
    expect(w.money).toBe(123.8);
    expect(cafe.earnings).toBe(0);
    expect(collectEarnings(cafe, w)).toBe(0);
    expect(w.money).toBe(123.8);
  });

  it('rifornisce, assume dipendenti e potenzia l’attività rispettando i limiti', () => {
    const cafe = business('cafe');
    const w = wallet(200);

    expect(restockBusiness(cafe, w)).toBe(true);
    expect(w.money).toBe(40);
    expect(cafe.stock).toBe(50);
    expect(restockBusiness(cafe, w)).toBe(false);

    w.money = 1_000;
    cafe.stock = 85;
    expect(restockBusiness(cafe, w)).toBe(true);
    expect(cafe.stock).toBe(99);
    expect(w.money).toBe(840);
    expect(restockBusiness(cafe, w)).toBe(false);

    w.money = 500;
    expect(hireEmployee(cafe, w)).toBe(true);
    expect(w.money).toBe(50);
    expect(cafe.employees).toBe(1);
    expect(hireEmployee(cafe, w)).toBe(false);

    w.money = 10_000;
    expect(hireEmployee(cafe, w)).toBe(true);
    expect(hireEmployee(cafe, w)).toBe(true);
    expect(cafe.employees).toBe(3);
    expect(w.money).toBe(8_350);
    expect(hireEmployee(cafe, w)).toBe(true);
    expect(cafe.employees).toBe(4);
    expect(hireEmployee(cafe, w)).toBe(false);

    cafe.level = 1;
    w.money = 1_000;
    expect(upgradeBusiness(cafe, w)).toBe(true);
    expect(w.money).toBe(100);
    expect(cafe.level).toBe(2);
    expect(upgradeBusiness(cafe, w)).toBe(false);

    w.money = 20_000;
    expect(upgradeBusiness(cafe, w)).toBe(true);
    expect(upgradeBusiness(cafe, w)).toBe(true);
    expect(upgradeBusiness(cafe, w)).toBe(true);
    expect(cafe.level).toBe(5);
    expect(w.money).toBe(11_900);
    expect(upgradeBusiness(cafe, w)).toBe(false);
  });
});
