import type { CareerState, JobState } from '../core/types';
import type { Wallet } from './Economy';

/** Esperienza necessaria per passare al livello successivo. */
export function xpForLevel(level: number): number {
  return 24 + Math.max(0, level - 1) * 16;
}

/** Carriera iniziale: i salvataggi v1-v3 vengono aggiornati a questi valori. */
export function defaultCareer(): CareerState {
  return {
    level: 1, xp: 0, shifts: 0, promotions: 0,
    lastPayDay: 1, unpaidWage: 0, totalEarned: 0,
  };
}

export function normalizeCareer(value?: CareerState | null): CareerState {
  const base = defaultCareer();
  if (!value || typeof value !== 'object') return base;
  return {
    level: Number.isFinite(value.level) ? Math.max(1, Math.min(10, Math.floor(value.level!))) : base.level,
    xp: Number.isFinite(value.xp) ? Math.max(0, value.xp!) : 0,
    shifts: Number.isFinite(value.shifts) ? Math.max(0, Math.floor(value.shifts!)) : 0,
    promotions: Number.isFinite(value.promotions) ? Math.max(0, Math.floor(value.promotions!)) : 0,
    lastPayDay: Number.isFinite(value.lastPayDay) ? Math.max(1, Math.floor(value.lastPayDay!)) : 1,
    unpaidWage: Number.isFinite(value.unpaidWage) ? Math.max(0, value.unpaidWage!) : 0,
    totalEarned: Number.isFinite(value.totalEarned) ? Math.max(0, value.totalEarned!) : 0,
  };
}

/** Aumento di stipendio legato all'anzianità, non ai cheat dei test. */
export function careerWageMultiplier(career?: CareerState | null): number {
  const level = normalizeCareer(career).level;
  return 1 + (level - 1) * 0.08;
}

export interface CareerProgress {
  gainedXp: number;
  levelUp: boolean;
  bonusWage: number;
}

/**
 * Registra un turno: aggiorna esperienza, promozioni e quota di stipendio
 * differita. La paga immediata resta gestita da `workShift` per compatibilità.
 */
export function registerShift(
  job: JobState, career: CareerState | undefined, hours: number, wage: number,
): CareerProgress {
  const state = normalizeCareer(career);
  if (career) Object.assign(career, state);
  const gainedXp = Math.round(hours * (10 + state.level * 2));
  const bonusWage = Math.round(wage * 0.1 * 100) / 100;
  state.xp += gainedXp;
  state.shifts += 1;
  state.unpaidWage = Math.round((state.unpaidWage + bonusWage) * 100) / 100;
  state.totalEarned = Math.round((state.totalEarned + wage) * 100) / 100;
  let levelUp = false;
  while (state.xp >= xpForLevel(state.level) && state.level < 10) {
    state.xp -= xpForLevel(state.level);
    state.level += 1;
    state.promotions += 1;
    levelUp = true;
  }
  if (career) Object.assign(career, state);
  job.level = state.level;
  job.xp = state.xp;
  return { gainedXp, levelUp, bonusWage };
}

/** Busta paga settimanale: premio di livello più turni effettuati. */
export function settlePayday(career: CareerState, day: number, wallet: Wallet): number {
  if (day - career.lastPayDay < 7) return 0;
  const reward = Math.round((18 * career.level + 6 * career.shifts + career.unpaidWage) * 100) / 100;
  wallet.money = Math.round((wallet.money + reward) * 100) / 100;
  career.lastPayDay = day;
  career.unpaidWage = 0;
  career.totalEarned = Math.round((career.totalEarned + reward) * 100) / 100;
  return reward;
}

export function careerLabel(career?: CareerState | null): string {
  const state = normalizeCareer(career);
  return `Livello ${state.level} · ${state.shifts} turni · ${state.promotions} promozioni`;
}
