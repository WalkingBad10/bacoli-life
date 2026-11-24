import { GAME_KEY } from '../core/config';
import type { GameState } from '../core/types';

const STORAGE_KEY = `${GAME_KEY}:save`;
const SAVE_VERSION = 1;

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
  const envelope: Envelope = { version: SAVE_VERSION, checksum: '', payload: state };
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
  // Migrazione: i campi assenti vengono inizializzati con valori sicuri.
  state.inventory ??= {};
  state.relationships ??= {};
  state.time ??= 8 * 60;
  state.day ??= 1;
  state.weather ??= 'sun';
  state.player.energy ??= 100;
  state.player.hunger ??= 100;
  state.player.savings ??= 0;
  state.player.job ??= null;
  state.player.homeId ??= 'home-1';
  return state;
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
