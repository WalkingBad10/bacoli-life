/** Routine quotidiane deterministiche per gli NPC di Bacoli. */

export type RoutineSlot = 'home' | 'commute' | 'work' | 'lunch' | 'beach' | 'errands' | 'evening';

export interface NpcProfile {
  name: string;
  role: string;
  /** Sfasamento personale: evita che tutti cambino attività nello stesso istante. */
  offset: number;
}

export const NPC_PROFILES: NpcProfile[] = [
  { name: 'Maria', role: 'commessa', offset: 0 },
  { name: 'Pasquale', role: 'pescatore', offset: 1 },
  { name: 'Giuseppina', role: 'casalinga', offset: 2 },
  { name: 'Ciro', role: 'barista', offset: 3 },
  { name: 'Alessia', role: 'studentessa', offset: 4 },
  { name: 'Rocco', role: 'tassista', offset: 5 },
  { name: 'Concetta', role: 'fornaia', offset: 6 },
  { name: 'Enzo', role: 'muratore', offset: 7 },
  { name: 'Assunta', role: 'farmacista', offset: 8 },
  { name: 'Gennaro', role: 'pizzaiolo', offset: 9 },
  { name: 'Nunzia', role: 'maestra', offset: 10 },
  { name: 'Peppe', role: 'contadino', offset: 11 },
  { name: 'Rosaria', role: 'cameriera', offset: 12 },
  { name: 'Vincenzo', role: 'autista EAV', offset: 13 },
  { name: 'Teresa', role: 'sarta', offset: 14 },
  { name: 'Saverio', role: 'fabbro', offset: 15 },
  { name: 'Filomena', role: 'commessa', offset: 16 },
  { name: 'Aniello', role: 'giardiniere', offset: 17 },
  { name: 'Gelsomina', role: 'studente', offset: 18 },
  { name: 'Carmine', role: 'cuoco', offset: 19 },
  { name: 'Luisa', role: 'bibliotecaria', offset: 20 },
  { name: 'Michele', role: 'pescatore', offset: 21 },
  { name: 'Anna', role: 'infermiera', offset: 22 },
  { name: 'Salvatore', role: 'capomastro', offset: 23 },
];

/** Attività dominante in base all'ora e alla personalità dell'NPC. */
export function routineSlot(name: string, hour: number): RoutineSlot {
  const profile = NPC_PROFILES.find((item) => item.name === name);
  const shift = profile?.offset ?? 0;
  const h = (hour + Math.floor(shift / 6)) % 24;
  if (h < 6) return 'home';
  if (h < 9) return 'commute';
  if (h < 13) return 'work';
  if (h < 15) return 'lunch';
  if (h < 18) return profile && profile.offset % 3 === 0 ? 'beach' : 'work';
  if (h < 20) return 'errands';
  if (h < 22) return 'evening';
  return 'home';
}

export function routineLabel(slot: RoutineSlot): string {
  const labels: Record<RoutineSlot, string> = {
    home: 'a casa',
    commute: 'verso la fermata',
    work: 'al lavoro',
    lunch: 'a pranzo',
    beach: 'in spiaggia',
    errands: 'fa commissioni',
    evening: 'in piazza',
  };
  return labels[slot];
}
