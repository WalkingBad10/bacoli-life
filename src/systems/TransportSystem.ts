import type { Point } from '../core/types';

/**
 * Architettura di rete per le future espansioni.
 * Per ora solo Bacoli è attiva: Pianura/Napoli sono dichiarate come regioni
 * pianificate, senza mappe né contenuti, per non costruirle prematuramente.
 */

export type RegionId = 'bacoli' | 'pianura' | 'napoli';
export type LineId = 'cumana' | 'circumflegrea' | 'bus';

export interface Region {
  id: RegionId;
  name: string;
  active: boolean;
  mapKey: string | null;
}

export interface Station {
  id: string;
  name: string;
  region: RegionId;
  lines: LineId[];
  position: Point;
  active: boolean;
}

export interface RailLine {
  id: LineId;
  name: string;
  operator: 'EAV' | 'Comune';
  stations: string[];
  active: boolean;
}

export const REGIONS: Region[] = [
  { id: 'bacoli', name: 'Bacoli', active: true, mapKey: 'bacoli' },
  { id: 'pianura', name: 'Pianura (Napoli 80126)', active: false, mapKey: null },
  { id: 'napoli', name: 'Napoli', active: false, mapKey: null },
];

export const LINES: RailLine[] = [
  {
    id: 'cumana',
    name: 'Cumana',
    operator: 'EAV',
    stations: ['torregaveta', 'fusaro', 'baia', 'miseno', 'bacoli', 'bagnoli', 'napoli'],
    active: false,
  },
  {
    id: 'circumflegrea',
    name: 'Circumflegrea',
    operator: 'EAV',
    stations: ['torregaveta', 'bacoli', 'quarto', 'pianura', 'napoli'],
    active: false,
  },
];

export const STATIONS: Station[] = [
  { id: 'bacoli', name: 'Bacoli', region: 'bacoli', lines: ['cumana', 'circumflegrea'], position: { x: 0, y: 0 }, active: false },
];

export function activeRegions(): Region[] {
  return REGIONS.filter((r) => r.active);
}

export function stationsFor(line: LineId): Station[] {
  const ids = LINES.find((l) => l.id === line)?.stations ?? [];
  return ids.map((id) => STATIONS.find((s) => s.id === id)).filter((s): s is Station => Boolean(s));
}
