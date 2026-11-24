/** Routine quotidiane deterministiche per gli NPC di Bacoli. */

export type RoutineSlot = 'home' | 'commute' | 'work' | 'lunch' | 'beach' | 'errands' | 'evening';

export type NpcKind = 'resident' | 'fisher' | 'tourist' | 'bather' | 'family';

export interface NpcProfile {
  name: string;
  role: string;
  /** Sfasamento personale: evita che tutti cambino attività nello stesso istante. */
  offset: number;
  /** Tipo di pedone: cambia priorità di destinazione e dialogo. */
  kind?: NpcKind;
}

export const NPC_PROFILES: NpcProfile[] = [
  { name: 'Maria', role: 'commessa', offset: 0, kind: 'resident' },
  { name: 'Pasquale', role: 'pescatore', offset: 1, kind: 'fisher' },
  { name: 'Giuseppina', role: 'casalinga', offset: 2, kind: 'family' },
  { name: 'Ciro', role: 'barista', offset: 3, kind: 'resident' },
  { name: 'Alessia', role: 'studentessa', offset: 4, kind: 'family' },
  { name: 'Rocco', role: 'tassista', offset: 5, kind: 'resident' },
  { name: 'Concetta', role: 'fornaia', offset: 6, kind: 'resident' },
  { name: 'Enzo', role: 'muratore', offset: 7, kind: 'resident' },
  { name: 'Assunta', role: 'farmacista', offset: 8, kind: 'resident' },
  { name: 'Gennaro', role: 'pizzaiolo', offset: 9, kind: 'resident' },
  { name: 'Nunzia', role: 'maestra', offset: 10, kind: 'family' },
  { name: 'Peppe', role: 'contadino', offset: 11, kind: 'resident' },
  { name: 'Rosaria', role: 'cameriera', offset: 12, kind: 'resident' },
  { name: 'Vincenzo', role: 'autista EAV', offset: 13, kind: 'resident' },
  { name: 'Teresa', role: 'sarta', offset: 14, kind: 'resident' },
  { name: 'Saverio', role: 'fabbro', offset: 15, kind: 'resident' },
  { name: 'Filomena', role: 'commessa', offset: 16, kind: 'resident' },
  { name: 'Aniello', role: 'giardiniere', offset: 17, kind: 'resident' },
  { name: 'Gelsomina', role: 'studente', offset: 18, kind: 'family' },
  { name: 'Carmine', role: 'cuoco', offset: 19, kind: 'resident' },
  { name: 'Luisa', role: 'bibliotecaria', offset: 20, kind: 'resident' },
  { name: 'Michele', role: 'pescatore', offset: 21, kind: 'fisher' },
  { name: 'Anna', role: 'infermiera', offset: 22, kind: 'resident' },
  { name: 'Salvatore', role: 'capomastro', offset: 23, kind: 'resident' },
  { name: 'Giulia', role: 'turista tedesca', offset: 24, kind: 'tourist' },
  { name: 'Hans', role: 'turista', offset: 25, kind: 'tourist' },
  { name: 'Sofia', role: 'turista milanese', offset: 26, kind: 'tourist' },
  { name: 'Davide', role: 'bagnino', offset: 27, kind: 'bather' },
  { name: 'Ludovica', role: 'bagnante', offset: 28, kind: 'bather' },
  { name: 'Matteo', role: 'bagnante', offset: 29, kind: 'bather' },
  { name: 'Rita', role: 'pescivendola', offset: 30, kind: 'fisher' },
  { name: 'Giacomo', role: 'pesc sportivo', offset: 31, kind: 'fisher' },
  { name: 'Elena', role: 'madre con passeggino', offset: 32, kind: 'family' },
  { name: 'Domenico', role: 'padre in vacanza', offset: 33, kind: 'family' },
  { name: 'Chiara', role: 'studentessa', offset: 34, kind: 'tourist' },
  { name: 'Umberto', role: 'anziano del borgo', offset: 35, kind: 'resident' },
  { name: 'Serena', role: 'gelataia', offset: 36, kind: 'resident' },
  { name: 'Bruno', role: 'tecnico EAV', offset: 37, kind: 'resident' },
  { name: 'Federica', role: 'turista romana', offset: 38, kind: 'tourist' },
  { name: 'Alfonso', role: 'barcaiolo', offset: 39, kind: 'fisher' },
];

/** Attività dominante in base all'ora e alla personalità dell'NPC. */
export function routineSlot(name: string, hour: number): RoutineSlot {
  const profile = NPC_PROFILES.find((item) => item.name === name);
  const shift = profile?.offset ?? 0;
  const h = (hour + Math.floor(shift / 6)) % 24;
  if (profile?.kind === 'tourist' || profile?.kind === 'bather') {
    if (h < 8) return 'home';
    if (h < 11) return 'commute';
    if (h < 18) return 'beach';
    if (h < 21) return 'evening';
    return 'home';
  }
  if (profile?.kind === 'fisher') {
    if (h < 5) return 'home';
    if (h < 10) return 'beach';
    if (h < 14) return 'work';
    if (h < 18) return 'beach';
    if (h < 21) return 'evening';
    return 'home';
  }
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
