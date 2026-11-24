import { ITEM_CATALOG, type ItemId } from '../core/config';
import type { DeliveryOrder, GameState } from '../core/types';
import type { Wallet } from './Economy';
import { activeHome } from './HomeSystem';

export const DELIVERY_FEE = 2.5;

function nextId(state: GameState): string {
  const orders = state.deliveries ?? [];
  return `delivery-${state.day ?? 1}-${orders.length + 1}`;
}

/**
 * Ordina dal telefono: il cibo arriva a casa dopo un tempo realistico, non
 * viene aggiunto subito all'inventario come nella Milestone 3.
 */
export function orderDelivery(
  state: GameState, wallet: Wallet, item: ItemId, from: string,
  x: number, y: number, quantity = 1,
): DeliveryOrder | null {
  const spec = ITEM_CATALOG[item];
  if (!spec || quantity < 1) return null;
  const total = Math.round((spec.price * quantity + DELIVERY_FEE) * 100) / 100;
  if (wallet.money < total) return null;
  wallet.money = Math.round((wallet.money - total) * 100) / 100;
  const order: DeliveryOrder = {
    id: nextId(state),
    item,
    quantity,
    from,
    eta: 18 + Math.min(12, quantity * 3),
    status: 'preparing',
    x,
    y,
    destinationId: activeHome(state).id,
  };
  (state.deliveries ??= []).push(order);
  return order;
}

/** Avanza tutte le consegne; quelle arrivate riforniscono la dispensa. */
export function advanceDeliveries(state: GameState, minutes: number): DeliveryOrder[] {
  const delivered: DeliveryOrder[] = [];
  for (const order of state.deliveries ?? []) {
    if (order.status === 'delivered') continue;
    order.eta -= minutes;
    if (order.eta <= 6) order.status = 'onway';
    if (order.eta <= 0) {
      order.eta = 0;
      order.status = 'delivered';
      state.inventory[order.item] = (state.inventory[order.item] ?? 0) + order.quantity;
      delivered.push(order);
    }
  }
  return delivered;
}

/** Il corriere si avvicina alla casa del giocatore con movimento lineare. */
export function moveCourier(order: DeliveryOrder, targetX: number, targetY: number, delta: number): void {
  if (order.status === 'delivered') return;
  const speed = order.status === 'onway' ? 0.075 : 0.018;
  const dx = targetX - order.x;
  const dy = targetY - order.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 2) return;
  const step = Math.min(distance, speed * delta);
  order.x += (dx / distance) * step;
  order.y += (dy / distance) * step;
}

export function deliveryLabel(order: DeliveryOrder): string {
  const name = ITEM_CATALOG[order.item as ItemId]?.name ?? order.item;
  const status = order.status === 'delivered'
    ? 'consegnato'
    : order.status === 'onway' ? 'in consegna' : 'in preparazione';
  return `${name} ×${order.quantity} · ${status} · ${Math.max(0, Math.ceil(order.eta))} min`;
}

export function normalizeDeliveries(value: DeliveryOrder[] | undefined): DeliveryOrder[] {
  if (!Array.isArray(value)) return [];
  return value.filter((order): order is DeliveryOrder =>
    Boolean(order) && typeof order === 'object' && typeof order.id === 'string')
    .map((order) => ({
      ...order,
      item: typeof order.item === 'string' ? order.item : 'pizza',
      quantity: Number.isFinite(order.quantity) ? Math.max(1, Math.floor(order.quantity!)) : 1,
      eta: Number.isFinite(order.eta) ? order.eta! : 20,
      status: order.status === 'preparing' || order.status === 'onway' || order.status === 'delivered'
        ? order.status : 'preparing',
      x: Number.isFinite(order.x) ? order.x! : 0,
      y: Number.isFinite(order.y) ? order.y! : 0,
      destinationId: typeof order.destinationId === 'string' ? order.destinationId : 'home-1',
      from: typeof order.from === 'string' ? order.from : 'Bar Pina',
    }));
}
