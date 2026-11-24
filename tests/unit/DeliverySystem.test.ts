import { describe, expect, it } from 'vitest';
import {
  DELIVERY_FEE, advanceDeliveries, deliveryLabel, moveCourier, normalizeDeliveries, orderDelivery,
} from '../../src/systems/DeliverySystem';
import { ITEM_CATALOG, type ItemId } from '../../src/core/config';
import type { DeliveryOrder, GameState } from '../../src/core/types';
import type { Wallet } from '../../src/systems/Economy';

function gameState(): GameState {
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
  };
}

function wallet(money: number): Wallet {
  return { money, savings: 0, inventory: {} };
}

describe('Consegne a domicilio', () => {
  it('addebita prezzo e commissione e assegna ETA e destinazione', () => {
    const state = gameState();
    state.day = 3;
    const w = wallet(100);

    const pizza = orderDelivery(state, w, 'pizza', 'Pizzeria da Nino', 10, 20, 2);
    expect(pizza).toMatchObject({
      id: 'delivery-3-1', item: 'pizza', quantity: 2, from: 'Pizzeria da Nino',
      eta: 24, status: 'preparing', x: 10, y: 20, destinationId: 'home-1',
    });
    expect(w.money).toBe(100 - ITEM_CATALOG.pizza.price * 2 - DELIVERY_FEE);

    const coffee = orderDelivery(state, w, 'caffe', 'Bar Pina', 5, 6);
    expect(coffee?.id).toBe('delivery-3-2');
    expect(coffee?.eta).toBe(21);
    expect(w.money).toBe(77.8);
    expect(state.deliveries).toHaveLength(2);

    expect(orderDelivery(state, w, 'pizza', 'Pizzeria da Nino', 0, 0, 0)).toBeNull();
    expect(orderDelivery(state, w, 'sconosciuto' as ItemId, 'Bar Pina', 0, 0)).toBeNull();
    expect(orderDelivery(state, w, 'spesa', 'Mercato', 0, 0, 10)).toBeNull();
    expect(w.money).toBe(77.8);
    expect(state.deliveries).toHaveLength(2);

    w.money = 100;
    const bulk = orderDelivery(state, w, 'pizza', 'Pizzeria da Nino', 0, 0, 10);
    expect(bulk?.eta).toBe(30);
    expect(w.money).toBe(17.5);
  });

  it('avanza le consegne dalla preparazione alla dispensa senza tempo reale', () => {
    const state = gameState();
    state.inventory = { pizza: 1 };
    const w = wallet(100);
    const order = orderDelivery(state, w, 'pizza', 'Pizzeria da Nino', 0, 0, 2)!;

    expect(advanceDeliveries(state, 5)).toEqual([]);
    expect(order).toMatchObject({ eta: 19, status: 'preparing' });
    expect(state.inventory.pizza).toBe(1);

    expect(advanceDeliveries(state, 13)).toEqual([]);
    expect(order).toMatchObject({ eta: 6, status: 'onway' });
    expect(state.inventory.pizza).toBe(1);

    expect(advanceDeliveries(state, 6)).toEqual([order]);
    expect(order).toMatchObject({ eta: 0, status: 'delivered' });
    expect(state.inventory.pizza).toBe(3);
    expect(advanceDeliveries(state, 100)).toEqual([]);
    expect(state.inventory.pizza).toBe(3);
  });

  it('consegna più ordini con tempi diversi nello stesso avanzamento', () => {
    const state = gameState();
    const w = wallet(100);
    const pizza = orderDelivery(state, w, 'pizza', 'Pizzeria da Nino', 0, 0, 2)!;
    const coffee = orderDelivery(state, w, 'caffe', 'Bar Pina', 0, 0, 1)!;
    expect(pizza.eta).toBe(24);
    expect(coffee.eta).toBe(21);

    expect(advanceDeliveries(state, 21).map((order) => order.id)).toEqual([coffee.id]);
    expect(pizza).toMatchObject({ eta: 3, status: 'onway' });
    expect(coffee.status).toBe('delivered');
    expect(state.inventory.caffe).toBe(1);
    expect(state.inventory.pizza).toBeUndefined();

    expect(advanceDeliveries(state, 3).map((order) => order.id)).toEqual([pizza.id]);
    expect(state.inventory.pizza).toBe(2);
    expect(state.inventory.caffe).toBe(1);
  });

  it('muove il corriere in linea retta, più veloce quando è in consegna', () => {
    const state = gameState();
    const order = orderDelivery(state, wallet(100), 'pizza', 'Pizzeria da Nino', 0, 0, 1)!;

    moveCourier(order, 100, 0, 1_000);
    expect(order.x).toBeCloseTo(18);
    expect(order.y).toBeCloseTo(0);

    order.status = 'onway';
    moveCourier(order, 100, 0, 1_000);
    expect(order.x).toBeCloseTo(93);
    moveCourier(order, 100, 0, 1_000);
    expect(order.x).toBeCloseTo(100);

    const settled = order.x;
    moveCourier(order, 100, 0, 1_000);
    expect(order.x).toBe(settled);

    const diagonal = { ...order, x: 0, y: 0, status: 'onway' as const };
    moveCourier(diagonal, 30, 40, 400);
    expect(diagonal.x).toBeCloseTo(18);
    expect(diagonal.y).toBeCloseTo(24);

    const delivered = { ...order, x: 0, y: 0, status: 'delivered' as const };
    moveCourier(delivered, 100, 100, 10_000);
    expect(delivered.x).toBe(0);
    expect(delivered.y).toBe(0);
  });

  it('formatta gli stati del corriere e normalizza gli ordini salvati', () => {
    expect(normalizeDeliveries(undefined)).toEqual([]);
    const orders = normalizeDeliveries([
      null,
      { item: 'pizza' },
      {
        id: 'd1', item: 'caffe', quantity: 2.9, eta: 5, status: 'onway',
        x: 1.5, y: 2.5, destinationId: 'home-2', from: 'Bar Pina',
      },
      {
        id: 'd2', quantity: -2, eta: Number.NaN, status: 'boh',
        x: 'x', y: null, destinationId: 3, from: null,
      },
    ] as unknown as DeliveryOrder[]);

    expect(orders).toEqual([
      {
        id: 'd1', item: 'caffe', quantity: 2, eta: 5, status: 'onway',
        x: 1.5, y: 2.5, destinationId: 'home-2', from: 'Bar Pina',
      },
      {
        id: 'd2', item: 'pizza', quantity: 1, eta: 20, status: 'preparing',
        x: 0, y: 0, destinationId: 'home-1', from: 'Bar Pina',
      },
    ]);

    expect(deliveryLabel(orders[0])).toBe('Caffè ×2 · in consegna · 5 min');
    expect(deliveryLabel(orders[1])).toBe('Pizza margherita ×1 · in preparazione · 20 min');
    expect(deliveryLabel({ ...orders[0], status: 'delivered', eta: 0 }))
      .toBe('Caffè ×2 · consegnato · 0 min');
    expect(deliveryLabel({ ...orders[0], item: 'sconosciuto', quantity: 1, eta: 6.2 }))
      .toBe('sconosciuto ×1 · in consegna · 7 min');
  });
});
