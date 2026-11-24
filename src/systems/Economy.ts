import { ITEM_CATALOG, type ItemId } from '../core/config';

export interface Wallet {
  money: number;
  savings: number;
  inventory: Record<string, number>;
}

export function buy(wallet: Wallet, item: ItemId, quantity = 1): boolean {
  const price = ITEM_CATALOG[item].price * quantity;
  if (!Number.isFinite(price) || price <= 0 || wallet.money < price) return false;
  wallet.money = Math.round((wallet.money - price) * 100) / 100;
  wallet.inventory[item] = (wallet.inventory[item] ?? 0) + quantity;
  return true;
}

export function sell(wallet: Wallet, item: ItemId, quantity = 1): boolean {
  const owned = wallet.inventory[item] ?? 0;
  if (owned < quantity) return false;
  const value = Math.round(ITEM_CATALOG[item].price * 0.5 * quantity * 100) / 100;
  wallet.inventory[item] = owned - quantity;
  if (wallet.inventory[item] === 0) delete wallet.inventory[item];
  wallet.money = Math.round((wallet.money + value) * 100) / 100;
  return true;
}

export function deposit(wallet: Wallet, amount: number): boolean {
  if (amount <= 0 || wallet.money < amount) return false;
  wallet.money = Math.round((wallet.money - amount) * 100) / 100;
  wallet.savings = Math.round((wallet.savings + amount) * 100) / 100;
  return true;
}

export function withdraw(wallet: Wallet, amount: number): boolean {
  if (amount <= 0 || wallet.savings < amount) return false;
  wallet.savings = Math.round((wallet.savings - amount) * 100) / 100;
  wallet.money = Math.round((wallet.money + amount) * 100) / 100;
  return true;
}

export function paySalary(wallet: Wallet, amount: number): void {
  if (amount <= 0) return;
  wallet.money = Math.round((wallet.money + amount) * 100) / 100;
}

/** Spese domestiche giornaliere, volutamente leggere e non frustranti. */
export function dailyExpenses(wallet: Wallet): void {
  const cost = 4.5;
  wallet.money = Math.max(0, Math.round((wallet.money - cost) * 100) / 100);
}
