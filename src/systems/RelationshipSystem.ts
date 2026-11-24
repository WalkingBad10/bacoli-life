import type { BondState, BondStage, GameState } from '../core/types';
import type { Wallet } from './Economy';

export const GIFT_PRICE = 15;
export const MARRIAGE_AGE = 18;

/** Legame con un abitante: riutilizza `relationships` per compatibilità v1/v2. */
export function bondOf(state: GameState, name: string): BondState {
  const existing = state.social.bonds[name];
  if (existing) return existing;
  const affinity = state.relationships[name] ?? 0;
  const created: BondState = {
    name,
    affinity,
    gifts: 0,
    stage: name === state.social.spouseId ? 'spouse' : 'acquaintance',
  };
  state.social.bonds[name] = created;
  return created;
}

export function stageFor(affinity: number): BondStage {
  if (affinity >= 45) return 'engaged';
  if (affinity >= 24) return 'dating';
  if (affinity >= 8) return 'friend';
  return 'acquaintance';
}

/** Parlare aumenta l'affinità; lo stato del legame segue la soglia raggiunta. */
export function talkTo(state: GameState, name: string): number {
  const bond = bondOf(state, name);
  bond.affinity = Math.min(100, bond.affinity + 1);
  state.relationships[name] = bond.affinity;
  if (bond.stage !== 'spouse') bond.stage = stageFor(bond.affinity);
  return bond.affinity;
}

/** Un regalo costa denaro ma accelera il corteggiamento. */
export function giveGift(state: GameState, name: string, wallet: Wallet): boolean {
  if (wallet.money < GIFT_PRICE) return false;
  wallet.money = Math.round((wallet.money - GIFT_PRICE) * 100) / 100;
  const bond = bondOf(state, name);
  bond.gifts++;
  bond.affinity = Math.min(100, bond.affinity + 6);
  state.relationships[name] = bond.affinity;
  if (bond.stage !== 'spouse') bond.stage = stageFor(bond.affinity);
  return true;
}

export interface MarriageCheck {
  ok: boolean;
  reason?: string;
}

export function canMarry(state: GameState, name: string): MarriageCheck {
  if (state.social.spouseId) return { ok: false, reason: 'Sei già sposato' };
  if (!state.home.owned) return { ok: false, reason: 'Serve una casa di proprietà' };
  const bond = bondOf(state, name);
  if (bond.affinity < 24) return { ok: false, reason: 'Servono almeno 24 punti di affinità' };
  return { ok: true };
}

/** Matrimonio: crea il coniuge nella famiglia senza richiamare `startFamily`. */
export function marry(state: GameState, name: string): boolean {
  if (!canMarry(state, name).ok) return false;
  const bond = bondOf(state, name);
  bond.stage = 'spouse';
  state.social.spouseId = name;
  state.social.marriedOnDay = state.day;
  if (!state.family.some((member) => member.name === name)) {
    state.family.push({ name, relation: 'coniuge', age: MARRIAGE_AGE + 4, mood: 90 });
  }
  return true;
}

export function spouseName(state: GameState): string | null {
  return state.social.spouseId;
}
