import { GAME_KEY } from '../core/config';
import type { GameState, VehicleState } from '../core/types';

const STORAGE_KEY = `${GAME_KEY}:save`;
const SAVE_VERSION = 2;

interface Envelope {
  version: number;
  checksum: string;
  payload: GameState;
}

/** FNV-1a: rileva salvataggi corrotti o manomessi. */
export function checksum(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function encodeExport(state: GameState): string {
  const envelope: Envelope = {
    version: SAVE_VERSION, checksum: '', payload: normalize(state),
  };
  const body = JSON.stringify(envelope.payload);
  envelope.checksum = checksum(body);
  const bytes = new TextEncoder().encode(JSON.stringify(envelope));
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

export function decodeExport(raw: string): GameState {
  const binary = atob(raw.trim());
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const envelope = JSON.parse(new TextDecoder().decode(bytes)) as Envelope;
  return verify(envelope);
}

/** I salvataggi della versione 1 vengono aggiornati senza perdere i dati. */
export function normalize(state: GameState): GameState {
  state.inventory ??= {};
  state.relationships ??= {};
  state.time ??= 8 * 60;
  state.day ??= 1;
  state.weather ??= 'sun';
  state.player ??= {
    x: 0, y: 0, money: 500, savings: 0, energy: 100, hunger: 100,
    job: null, homeId: 'home-1',
  };
  state.player.energy ??= 100;
  state.player.hunger ??= 100;
  state.player.savings ??= 0;
  state.player.job ??= null;
  state.player.homeId ??= 'home-1';
  state.home ??= { owned: false, address: 'Via Ortensio', furniture: [], upgrades: [] };
  state.home.furniture ??= [];
  state.home.upgrades ??= [];
  state.family ??= [];
  state.vehicles ??= [];
  state.jobState ??= null;
  state.transport ??= { ticketBus: 0, ticketTrain: 0, monthlyPass: false, lastTrip: null };
  state.stats ??= { distanceWalked: 0, distanceDriven: 0, npcsMet: 0 };
  state.stats.distanceWalked ??= 0;
  state.stats.distanceDriven ??= 0;
  state.stats.npcsMet ??= 0;
  return state;
}

function verify(envelope: Envelope): GameState {
  if (!envelope || typeof envelope !== 'object') throw new Error('Salvataggio non valido');
  if (envelope.version > SAVE_VERSION) throw new Error('Salvataggio da una versione futura');
  if (checksum(JSON.stringify(envelope.payload)) !== envelope.checksum) {
    throw new Error('Checksum non valido: salvataggio corrotto');
  }
  const state = envelope.payload;
  if (!state.player || typeof state.player.money !== 'number') {
    throw new Error('Dati del giocatore mancanti');
  }
  return normalize(state);
}

export function saveGame(state: GameState): void {
  localStorage.setItem(STORAGE_KEY, encodeExport(state));
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return decodeExport(raw);
  } catch (error) {
    console.warn('[BACOLI LIFE] Salvataggio ignorato:', error);
    return null;
  }
}

export function hasSave(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

export function defaultVehicles(): VehicleState[] {
  return [
    {
      id: 'starting-car', kind: 'car', name: 'Fiat 126 bianca',
      x: 0, y: 0, angle: 0, fuel: 18, maxFuel: 40,
      color: '#F2EAD8', owned: true,
    },
  ];
}
