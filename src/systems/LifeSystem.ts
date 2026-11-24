import type { CareerState, FamilyMember, HomeState, JobState } from '../core/types';
import type { Wallet } from './Economy';
import { careerWageMultiplier, registerShift } from './CareerSystem';

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
  washing_machine: { name: 'Lavatrice', price: 380, comfort: 7 },
  microwave: { name: 'Microonde', price: 180, comfort: 4 },
  desk: { name: 'Scrivania', price: 220, comfort: 5 },
  crib: { name: 'Culla', price: 150, comfort: 6 },
} as const;

export type FurnitureId = keyof typeof FURNITURE_CATALOG;

export const JOB_CATALOG = {
  barista: { title: 'Barista', workplace: 'Bar Pina', hourlyWage: 9.5, energyCostPerHour: 7, minLevel: 1 },
  pizzaiolo: { title: 'Pizzaiolo', workplace: 'Pizzeria da Nino', hourlyWage: 11, energyCostPerHour: 9, minLevel: 1 },
  bagnino: { title: 'Bagnino', workplace: 'Lido Miliscola', hourlyWage: 8, energyCostPerHour: 6, minLevel: 1 },
  pescivendolo: { title: 'Pescivendolo', workplace: 'Pescheria Miseno', hourlyWage: 10.5, energyCostPerHour: 8, minLevel: 2 },
  impiegato: { title: 'Impiegato comunale', workplace: 'Municipio di Bacoli', hourlyWage: 12.5, energyCostPerHour: 5, minLevel: 2 },
  tecnico_eav: { title: 'Tecnico EAV', workplace: 'Stazione Fusaro', hourlyWage: 14, energyCostPerHour: 8, minLevel: 3 },
  cuoco: { title: 'Cuoco', workplace: 'Ristorante Baia', hourlyWage: 13, energyCostPerHour: 9, minLevel: 3 },
  guida: { title: 'Guida turistica', workplace: 'Cuma', hourlyWage: 11.5, energyCostPerHour: 7, minLevel: 2 },
} as const;

export type JobId = keyof typeof JOB_CATALOG;

/** Compra un arredo e lo registra nella casa. Gli arredi sono unici. */
export function buyFurniture(home: HomeState, wallet: Wallet, id: FurnitureId): boolean {
  const spec = FURNITURE_CATALOG[id];
  if (!spec || wallet.money < spec.price || home.furniture.includes(id)) return false;
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
    { name: 'Giuseppina', relation: 'compagna', age: 34, mood: 72, schedule: 'work' },
    { name: 'Ciro', relation: 'figlio', age: 8, mood: 80, schedule: 'school', child: true },
  );
  return true;
}

/** Il umore cala lentamente con il passare delle ore. */
export function advanceFamily(family: FamilyMember[], hours: number): void {
  for (const member of family) {
    member.mood = Math.max(0, Math.min(100, member.mood - hours * 0.55));
  }
}

/**
 * Routine familiare oraria: la scuola, il lavoro e il riposo cambiano il ritmo
 * dell'umore. Mantiene `advanceFamily` invariata per i salvataggi esistenti.
 */
export function advanceFamilyRoutine(
  family: FamilyMember[], hours: number, hour: number,
): void {
  advanceFamily(family, hours);
  for (const member of family) {
    const schedule = member.schedule ?? (member.child ? 'school' : 'home');
    if (schedule === 'school' && hour >= 8 && hour < 16) member.mood += hours * 0.2;
    if (schedule === 'work' && hour >= 8 && hour < 18) member.mood += hours * 0.1;
    if (schedule === 'baby' && hour >= 20) member.mood -= hours * 0.35;
    member.mood = Math.max(0, Math.min(100, member.mood));
  }
}

export function familyRoutineLabel(member: FamilyMember, hour: number): string {
  const schedule = member.schedule ?? (member.child ? 'school' : 'home');
  if (hour >= 22 || hour < 7) return 'dorme';
  if (schedule === 'school' && hour < 16) return 'a scuola';
  if (schedule === 'work' && hour < 18) return 'al lavoro';
  if (schedule === 'baby') return 'in culla';
  if (hour < 9) return 'fa colazione';
  if (hour < 14) return 'in casa';
  if (hour < 19) return 'in giro per Bacoli';
  return 'in famiglia';
}

/** Un'attività condivisa migliora l'umore di tutti i membri. */
export function familyActivity(family: FamilyMember[], kind: 'meal' | 'tv' | 'walk'): number {
  const bonus = { meal: 8, tv: 5, walk: 12 }[kind];
  for (const member of family) {
    member.mood = Math.min(100, member.mood + bonus);
  }
  return bonus;
}

/** Un nuovo figlio nasce solo in una famiglia già sposata e con denaro. */
export function haveChild(
  family: FamilyMember[], wallet: Wallet, spouseId: string | null,
): FamilyMember | null {
  const hasPartner = Boolean(spouseId) || family.some((m) => m.relation === 'compagna');
  if (!hasPartner || family.length >= 6 || wallet.money < 600) return null;
  wallet.money -= 600;
  const child: FamilyMember = {
    name: 'Peppe Jr', relation: 'figlio', age: 0, mood: 85,
    schedule: 'baby', child: true,
  };
  family.push(child);
  return child;
}

export function createJob(id: JobId): JobState {
  const spec = JOB_CATALOG[id];
  return {
    id, title: spec.title, workplace: spec.workplace,
    hourlyWage: spec.hourlyWage, hoursWorked: 0, daysWorked: 0,
    level: 1, xp: 0,
  };
}

export interface ShiftResult {
  wage: number;
  energyCost: number;
  hours: number;
  xp: number;
  levelUp: boolean;
  bonusWage: number;
}

/** Esegue un turno di lavoro e restituisce stipendio e energia consumata. */
export function workShift(job: JobState, hours: number, career?: CareerState): ShiftResult {
  const spec = JOB_CATALOG[job.id as JobId] ?? {
    title: job.title, workplace: job.workplace, hourlyWage: job.hourlyWage,
    energyCostPerHour: 7, minLevel: 1,
  };
  const safeHours = Math.max(0.5, Math.min(12, hours));
  job.hoursWorked += safeHours;
  job.daysWorked += 1;
  const wage = Math.round(
    job.hourlyWage * safeHours * careerWageMultiplier(career) * 100,
  ) / 100;
  const progress = registerShift(job, career, safeHours, wage);
  return {
    wage,
    energyCost: spec.energyCostPerHour * safeHours,
    hours: safeHours,
    xp: progress.gainedXp,
    levelUp: progress.levelUp,
    bonusWage: progress.bonusWage,
  };
}
