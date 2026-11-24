import type { FamilyMember, HomeState, JobState } from '../core/types';
import type { Wallet } from './Economy';

export const FURNITURE_CATALOG = {
  bed: { name: 'Letto matrimoniale', price: 320, comfort: 18 },
  sofa: { name: 'Divano', price: 240, comfort: 10 },
  table: { name: 'Tavolo da pranzo', price: 180, comfort: 6 },
  chair: { name: 'Sedia', price: 45, comfort: 1 },
  fridge: { name: 'Frigorifero', price: 290, comfort: 5 },
  stove: { name: 'Fornello', price: 210, comfort: 4 },
  shelf: { name: 'Libreria', price: 130, comfort: 3 },
  tv: { name: 'Televisore', price: 260, comfort: 8 },
  plant: { name: 'Pianta', price: 25, comfort: 2 },
} as const;

export type FurnitureId = keyof typeof FURNITURE_CATALOG;

export const JOB_CATALOG = {
  barista: { title: 'Barista', workplace: 'Bar Pina', hourlyWage: 9.5, energyCostPerHour: 7 },
  pizzaiolo: { title: 'Pizzaiolo', workplace: 'Pizzeria da Nino', hourlyWage: 11, energyCostPerHour: 9 },
  bagnino: { title: 'Bagnino', workplace: 'Lido Miliscola', hourlyWage: 8, energyCostPerHour: 6 },
} as const;

export type JobId = keyof typeof JOB_CATALOG;

/** Compra un arredo e lo registra nella casa. Gli arredi sono unici. */
export function buyFurniture(home: HomeState, wallet: Wallet, id: FurnitureId): boolean {
  const spec = FURNITURE_CATALOG[id];
  if (wallet.money < spec.price || home.furniture.includes(id)) return false;
  wallet.money -= spec.price;
  home.furniture.push(id);
  return true;
}

/** Bonus di comfort dato dagli arredi posseduti (0–100). */
export function homeComfort(home: HomeState): number {
  return Math.min(100, home.furniture.reduce((sum, id) => {
    const spec = FURNITURE_CATALOG[id as FurnitureId];
    return sum + (spec ? spec.comfort : 0);
  }, 0) + home.upgrades.length * 5);
}

/** Alla prima casa di proprietà si crea un nucleo familiare semplice. */
export function startFamily(home: HomeState, family: FamilyMember[]): boolean {
  if (!home.owned || family.length) return false;
  family.push(
    { name: 'Giuseppina', relation: 'compagna', age: 34, mood: 72 },
    { name: 'Ciro', relation: 'figlio', age: 8, mood: 80 },
  );
  return true;
}

/** Il umore cala lentamente con il passare delle ore. */
export function advanceFamily(family: FamilyMember[], hours: number): void {
  for (const member of family) {
    member.mood = Math.max(0, Math.min(100, member.mood - hours * 0.55));
  }
}

/** Un'attività condivisa migliora l'umore di tutti i membri. */
export function familyActivity(family: FamilyMember[], kind: 'meal' | 'tv' | 'walk'): number {
  const bonus = { meal: 8, tv: 5, walk: 12 }[kind];
  for (const member of family) {
    member.mood = Math.min(100, member.mood + bonus);
  }
  return bonus;
}

export function createJob(id: JobId): JobState {
  const spec = JOB_CATALOG[id];
  return {
    id, title: spec.title, workplace: spec.workplace,
    hourlyWage: spec.hourlyWage, hoursWorked: 0, daysWorked: 0,
  };
}

export interface ShiftResult {
  wage: number;
  energyCost: number;
  hours: number;
}

/** Esegue un turno di lavoro e restituisce stipendio e energia consumata. */
export function workShift(job: JobState, hours: number): ShiftResult {
  const spec = JOB_CATALOG[job.id as JobId] ?? {
    title: job.title, workplace: job.workplace, hourlyWage: job.hourlyWage,
    energyCostPerHour: 7,
  };
  const safeHours = Math.max(0.5, Math.min(12, hours));
  job.hoursWorked += safeHours;
  job.daysWorked += 1;
  return {
    wage: job.hourlyWage * safeHours,
    energyCost: spec.energyCostPerHour * safeHours,
    hours: safeHours,
  };
}
