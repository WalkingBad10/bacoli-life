import type { Point } from '../core/types';

/** Rete EAV/ANM della zona flegrea. Dati verificati da OSM, Wikipedia e orari EAV 2026. */
export type RegionId = 'bacoli' | 'pianura' | 'napoli';
export type LineId =
  | 'cumana' | 'circumflegrea' | 'metro'
  | 'bus_101' | 'bus_102' | 'bus_144' | 'bus_145' | 'bus_146' | 'bus_150' | 'bus_153';

export type ServiceStatus = 'active' | 'suspended' | 'closed';

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
  /** Regione metrica M5 in cui la fermata è effettivamente collocata. */
  mapRegion?: string;
  lines: LineId[];
  position: Point;
  coordinates: { lat: number; lon: number };
  status: ServiceStatus;
  note?: string;
}

export interface TransitLine {
  id: LineId;
  name: string;
  operator: 'EAV' | 'ANM' | 'CTP';
  stations: string[];
  status: ServiceStatus;
  fare: number;
  note?: string;
}

export const REGIONS: Region[] = [
  { id: 'bacoli', name: 'Bacoli · Miseno · Miliscola · Baia · Fusaro · Cuma · Torregaveta', active: true, mapKey: 'bacoli' },
  { id: 'pianura', name: 'Pianura (Napoli 80126)', active: false, mapKey: null },
  { id: 'napoli', name: 'Napoli centro', active: false, mapKey: null },
];

export const LINES: TransitLine[] = [
  {
    id: 'cumana', name: 'Cumana (EAV)', operator: 'EAV', status: 'active', fare: 2.2,
    stations: ['napoli_centro', 'bagnoli', 'lucrino', 'baia_station', 'fusaro_station', 'torregaveta'],
    note: 'Baia riaperta il 6 novembre 2025. Torregaveta è il capolinea.',
  },
  {
    id: 'circumflegrea', name: 'Circumflegrea (EAV)', operator: 'EAV', status: 'active', fare: 2.2,
    stations: ['napoli_centro', 'licola', 'marina_licola', 'cuma_station', 'lido_fusaro', 'torregaveta'],
    note: 'Servizio regolare sospeso oltre Licola dal 2014; le stazioni flegree restano visitabili.',
  },
  {
    id: 'bus_101', name: '101 · Napoli – Monte di Procida (EAV)', operator: 'EAV',
    status: 'active', fare: 1.5,
    stations: ['bacoli_centro', 'baia_station', 'fusaro_station', 'torregaveta'],
  },
  {
    id: 'bus_102', name: '102 · Baia – Torregaveta (EAV)', operator: 'EAV',
    status: 'active', fare: 1.5,
    stations: ['torregaveta', 'miliscola', 'bacoli_centro', 'piazza_de_gasperi', 'baia_station'],
    note: 'Circa ogni 20 minuti, 06:00–22:30.',
  },
  {
    id: 'bus_144', name: '144 · Circolare Miseno – Cuma – Baia (EAV)', operator: 'EAV',
    status: 'active', fare: 1.5,
    stations: ['miseno', 'miliscola', 'mercato_sabato', 'fusaro_station', 'cuma_station',
      'piazza_de_gasperi', 'bacoli_centro'],
  },
  {
    id: 'bus_145', name: '145 · Circolare inversa Miseno – Baia – Cuma (EAV)', operator: 'EAV',
    status: 'active', fare: 1.5,
    stations: ['miseno', 'piazza_de_gasperi', 'sella_baia', 'fusaro_station', 'cuma_station',
      'miliscola', 'bacoli_centro'],
  },
  {
    id: 'bus_146', name: '146 · Torregaveta – La Schiana (EAV)', operator: 'EAV',
    status: 'active', fare: 1.5,
    stations: ['torregaveta', 'mercato_sabato', 'miliscola', 'bacoli_centro',
      'piazza_de_gasperi', 'fusaro_station'],
  },
  {
    id: 'bus_150', name: '150 · Vomero – Miseno (EAV, estiva)', operator: 'EAV',
    status: 'active', fare: 1.5, stations: ['miseno'],
  },
  {
    id: 'bus_153', name: '153 · Acquamorta – Torregaveta (EAV)', operator: 'EAV',
    status: 'active', fare: 1.5, stations: ['torregaveta', 'miliscola'],
  },
  {
    id: 'metro', name: 'Metropolitana (ANM)', operator: 'ANM', status: 'active', fare: 1.1,
    stations: ['napoli_centro', 'bagnoli'], note: 'Non ancora collegata alla mappa giocabile.',
  },
];

/**
 * Le posizioni `position` sono gate di gioco nella mappa; `coordinates` sono
 * le coordinate geografiche reali verificate.
 */
export const STATIONS: Station[] = [
  { id: 'bacoli_centro', name: 'Bacoli centro · Via Roma', region: 'bacoli', mapRegion: 'centro',
    lines: ['bus_101', 'bus_102', 'bus_144', 'bus_145', 'bus_146'],
    position: { x: 347, y: 478 }, coordinates: { lat: 40.80550, lon: 14.07920 }, status: 'active' },
  { id: 'miseno', name: 'Miseno / Capo Miseno', region: 'bacoli', mapRegion: 'miseno',
    lines: ['bus_144', 'bus_145', 'bus_150'],
    position: { x: 378, y: 582 }, coordinates: { lat: 40.78669, lon: 14.08409 }, status: 'active' },
  { id: 'miliscola', name: 'Rotonda Miliscola', region: 'bacoli', mapRegion: 'miliscola',
    lines: ['bus_102', 'bus_144', 'bus_145', 'bus_146', 'bus_153'],
    position: { x: 224, y: 552 }, coordinates: { lat: 40.78971, lon: 14.06611 }, status: 'active' },
  { id: 'mercato_sabato', name: 'Via Mercato di Sabato', region: 'bacoli', mapRegion: 'miliscola',
    lines: ['bus_144', 'bus_146'],
    position: { x: 154, y: 434 }, coordinates: { lat: 40.80100, lon: 14.05800 }, status: 'active' },
  { id: 'piazza_de_gasperi', name: 'Baia · Piazza De Gasperi', region: 'bacoli', mapRegion: 'baia',
    lines: ['bus_102', 'bus_144', 'bus_145', 'bus_146'],
    position: { x: 268, y: 260 }, coordinates: { lat: 40.81853, lon: 14.07133 }, status: 'active' },
  { id: 'sella_baia', name: 'Sella di Baia', region: 'bacoli', mapRegion: 'baia',
    lines: ['bus_145'],
    position: { x: 303, y: 303 }, coordinates: { lat: 40.81480, lon: 14.07450 }, status: 'active' },
  { id: 'baia_station', name: 'Baia (Cumana)', region: 'bacoli', mapRegion: 'baia',
    lines: ['cumana', 'bus_101', 'bus_102', 'bus_144', 'bus_145', 'bus_146'],
    position: { x: 268, y: 255 }, coordinates: { lat: 40.82115, lon: 14.07130 }, status: 'active',
    note: 'Riaperto il 6 novembre 2025.' },
  { id: 'fusaro_station', name: 'Fusaro (Cumana)', region: 'bacoli', mapRegion: 'fusaro',
    lines: ['cumana', 'bus_101', 'bus_144', 'bus_145', 'bus_146'],
    position: { x: 194, y: 257 }, coordinates: { lat: 40.81857, lon: 14.06173 }, status: 'active' },
  { id: 'torregaveta', name: 'Torregaveta (Cumana / Circumflegrea)', region: 'bacoli', mapRegion: 'torregaveta',
    lines: ['cumana', 'circumflegrea', 'bus_101', 'bus_102', 'bus_146', 'bus_153'],
    position: { x: 42, y: 335 }, coordinates: { lat: 40.81150, lon: 14.04487 }, status: 'active' },
  { id: 'lucrino', name: 'Lucrino (Cumana)', region: 'bacoli', mapRegion: 'fusaro',
    lines: ['cumana'], position: { x: 373, y: 150 },
    coordinates: { lat: 40.82940, lon: 14.08370 }, status: 'active' },
  { id: 'cuma_station', name: 'Cuma (Circumflegrea)', region: 'bacoli', mapRegion: 'torregaveta',
    lines: ['circumflegrea', 'bus_144', 'bus_145'],
    position: { x: 136, y: 60 }, coordinates: { lat: 40.84915, lon: 14.04929 },
    status: 'suspended', note: 'Servizio sospeso dal 2014; raggiungibile con bus 144/145.' },
  { id: 'lido_fusaro', name: 'Lido Fusaro (Circumflegrea)', region: 'bacoli', mapRegion: 'fusaro',
    lines: ['circumflegrea'], position: { x: 84, y: 160 },
    coordinates: { lat: 40.82888, lon: 14.04984 }, status: 'suspended',
    note: 'Stazione chiusa al servizio regolare.' },
  { id: 'licola', name: 'Licola', region: 'napoli', lines: ['circumflegrea'],
    position: { x: 0, y: 0 }, coordinates: { lat: 40.85000, lon: 14.04000 }, status: 'active' },
  { id: 'marina_licola', name: 'Marina di Licola', region: 'napoli', lines: ['circumflegrea'],
    position: { x: 0, y: 0 }, coordinates: { lat: 40.84700, lon: 14.03800 }, status: 'closed' },
  { id: 'bagnoli', name: 'Bagnoli', region: 'napoli', lines: ['cumana', 'metro'],
    position: { x: 0, y: 0 }, coordinates: { lat: 40.82900, lon: 14.15400 }, status: 'active' },
  { id: 'napoli_centro', name: 'Napoli Montesanto', region: 'napoli',
    lines: ['cumana', 'circumflegrea', 'metro'], position: { x: 0, y: 0 },
    coordinates: { lat: 40.84800, lon: 14.15000 }, status: 'active' },
  { id: 'pianura', name: 'Pianura', region: 'pianura', lines: ['circumflegrea'],
    position: { x: 0, y: 0 }, coordinates: { lat: 40.83500, lon: 14.19000 }, status: 'active' },
];

export function activeRegions(): Region[] {
  return REGIONS.filter((region) => region.active);
}

export function stationsFor(line: LineId): Station[] {
  const ids = LINES.find((lineData) => lineData.id === line)?.stations ?? [];
  return ids.map((id) => STATIONS.find((station) => station.id === id))
    .filter((station): station is Station => Boolean(station));
}

/** Stazioni raggiungibili da una fermata, escludendo quelle a servizio sospeso. */
export function reachableFrom(stationId: string): Station[] {
  const station = STATIONS.find((item) => item.id === stationId);
  if (!station || station.status !== 'active') return [];
  const ids = new Set<string>();
  for (const line of station.lines) {
    const definition = LINES.find((item) => item.id === line);
    if (!definition || definition.status !== 'active') continue;
    for (const id of definition.stations) ids.add(id);
  }
  return STATIONS.filter((item) => ids.has(item.id) && item.status === 'active' && item.id !== stationId);
}

export interface Trip {
  from: Station;
  to: Station;
  line: LineId;
  lineName: string;
  fare: number;
  minutes: number;
}

export function planTrip(fromId: string, toId: string): Trip | null {
  const from = STATIONS.find((station) => station.id === fromId);
  const to = STATIONS.find((station) => station.id === toId);
  if (!from || !to || from.status !== 'active' || to.status !== 'active') return null;
  const lineId = from.lines.find((id) => to.lines.includes(id));
  if (!lineId) return null;
  const definition = LINES.find((line) => line.id === lineId);
  if (!definition || definition.status !== 'active') return null;
  const distance = Math.hypot(
    from.coordinates.lat - to.coordinates.lat,
    from.coordinates.lon - to.coordinates.lon,
  );
  const multiplier = lineId.startsWith('bus') ? 780 : 460;
  return {
    from, to, line: lineId, lineName: definition.name, fare: definition.fare,
    minutes: Math.max(5, Math.round(distance * multiplier)),
  };
}
