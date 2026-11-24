import type { GameState } from '../core/types';
import type { Wallet } from './Economy';
import { familyActivity } from './LifeSystem';

export interface LocalEvent {
  id: string;
  name: string;
  period: number;
  description: string;
  reward: number;
  decoration: 'flags' | 'lights' | 'umbrellas' | 'none';
}

/** Calendario flegreo ricorrente: mercati, sagre e feste di quartiere. */
export const LOCAL_EVENTS: readonly LocalEvent[] = [
  { id: 'mercato', name: 'Mercato di Baia', period: 7, description: 'Banchi di pesce e prodotti locali in piazza.', reward: 12, decoration: 'umbrellas' },
  { id: 'sagra', name: 'Sagra del pesce di Miseno', period: 14, description: 'Tavolini sul lungomare e specialità di mare.', reward: 24, decoration: 'flags' },
  { id: 'festa', name: 'Festa patronale', period: 21, description: 'Bandiere, luminarie e passeggiata serale.', reward: 30, decoration: 'lights' },
  { id: 'carnevale', name: 'Carnevale flegreo', period: 30, description: 'Maschere e sfilata tra Via Ortensio e Via Spiaggia.', reward: 36, decoration: 'flags' },
  { id: 'estate', name: 'Estate a Miliscola', period: 11, description: 'Bagnanti, gelaterie aperte e musica sulla spiaggia.', reward: 18, decoration: 'umbrellas' },
] as const;

export function eventForDay(day: number): LocalEvent | null {
  if (!Number.isFinite(day) || day < 1) return null;
  return LOCAL_EVENTS.find((event) => day % event.period === 0) ?? null;
}

export function nextEvent(day: number): { event: LocalEvent; inDays: number } {
  let best = LOCAL_EVENTS[0];
  let bestIn = 1;
  for (const event of LOCAL_EVENTS) {
    const inDays = ((event.period - (day % event.period)) || event.period);
    if (inDays < bestIn) { best = event; bestIn = inDays; }
  }
  return { event: best, inDays: bestIn };
}

export interface EventResult {
  okay: boolean;
  reward: number;
  mood: number;
}

export function attendLocalEvent(state: GameState, wallet: Wallet, id: string): EventResult {
  const event = LOCAL_EVENTS.find((item) => item.id === id);
  if (!event || eventForDay(state.day)?.id !== id) return { okay: false, reward: 0, mood: 0 };
  const attended = state.events ??= [];
  if (attended.some((item) => item.id === id && item.day === state.day)) {
    return { okay: false, reward: 0, mood: 0 };
  }
  attended.push({ id, day: state.day });
  wallet.money = Math.round((wallet.money + event.reward) * 100) / 100;
  const mood = state.family.length ? familyActivity(state.family, 'walk') : 0;
  return { okay: true, reward: event.reward, mood };
}

export function eventLabel(day: number): string {
  const current = eventForDay(day);
  if (current) return `${current.name} · ${current.description}`;
  const next = nextEvent(day);
  return `Prossimo evento: ${next.event.name} tra ${next.inDays} giorni`;
}
