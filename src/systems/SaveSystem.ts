import { GAME_KEY } from '../core/config';
import worldData from '../data/bacoli_world.json';
import type {
  AttendedEvent, GameState, PetState, SocialState, VehicleState,
} from '../core/types';
import { normalizeStoredBusinesses } from './BusinessSystem';
import { defaultCareer, normalizeCareer } from './CareerSystem';
import { normalizeDeliveries } from './DeliverySystem';
import { normalizeHomes, syncHomeMirror } from './HomeSystem';

const STORAGE_KEY = `${GAME_KEY}:save`;
const REGION_IDS = new Set<string>(
  (worldData.regions as unknown as Array<{ id: string }>).map((region) => region.id),
);
/** v4 aggiunge carriera, case multiple, attività, consegne ed eventi. */
export const SAVE_VERSION = 4;

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

function defaultSocial(): SocialState {
  return { bonds: {}, spouseId: null, marriedOnDay: null };
}

function defaultPet(id = 'pet-1'): PetState {
  return {
    id, name: id === 'pet-1' ? 'Nino' : 'Pina', species: 'dog', age: 2,
    hunger: 70, mood: 75, x: 0, y: 0, homeId: 'home-1',
  };
}

/**
 * Migra il payload solo DOPO la verifica del checksum: mutare prima renderebbe
 * illeggibili tutti i salvataggi già pubblicati con la versione 2.
 */
function migrate(payload: GameState, version: number): GameState {
  if (version < 2) {
    payload.transport ??= { ticketBus: 0, ticketTrain: 0, monthlyPass: false, lastTrip: null };
    payload.stats ??= { distanceWalked: 0, distanceDriven: 0, npcsMet: 0 };
  }
  if (version < 3) {
    payload.social ??= defaultSocial();
    payload.pets ??= [];
    for (const vehicle of payload.vehicles ?? []) {
      vehicle.condition ??= 100;
      vehicle.odometer ??= 0;
      vehicle.lastServiceDay ??= payload.day ?? 1;
      vehicle.garageId ??= null;
    }
  }
  if (version < 4) {
    payload.career ??= defaultCareer();
    payload.homes ??= normalizeHomes(undefined, payload.home, payload.player?.homeId);
    payload.activeHomeId ??= payload.player?.homeId ?? 'home-1';
    payload.businesses ??= [];
    payload.deliveries ??= [];
    payload.events ??= [];
  }
  return normalize(payload);
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

/** Completa i campi mancanti e ripara i tipi annidati danneggiati. */
export function normalize(state: GameState): GameState {
  if (!state || typeof state !== 'object') state = {} as GameState;
  state.inventory ??= {};
  state.relationships ??= {};
  state.time ??= 8 * 60;
  state.day ??= 1;
  state.weather ??= 'sun';
  state.player ??= {
    x: 0, y: 0, money: 500, savings: 0, energy: 100, hunger: 100,
    job: null, homeId: 'home-1',
  };
  if (!Number.isFinite(state.player.money)) state.player.money = 500;
  state.player.energy ??= 100;
  state.player.hunger ??= 100;
  state.player.savings ??= 0;
  state.player.job ??= null;
  state.player.homeId ??= 'home-1';
  state.home ??= { owned: false, address: 'Via Ortensio', furniture: [], upgrades: [] };
  state.home.furniture ??= [];
  state.home.upgrades ??= [];
  state.homes = normalizeHomes(state.homes, state.home, state.player.homeId);
  state.activeHomeId ??= state.player.homeId ?? 'home-1';
  syncHomeMirror(state);
  state.family ??= [];
  state.family = state.family.filter((member): member is NonNullable<typeof member> =>
    Boolean(member) && typeof member === 'object')
    .map((member) => ({
      ...member,
      age: Number.isFinite(member.age) ? Math.max(0, member.age!) : 0,
      mood: Number.isFinite(member.mood) ? Math.max(0, Math.min(100, member.mood!)) : 70,
      child: member.child ?? member.relation === 'figlio',
      schedule: member.schedule ?? (member.relation === 'figlio' ? 'school' : 'home'),
    }));
  state.vehicles ??= [];
  state.jobState ??= null;
  state.transport ??= { ticketBus: 0, ticketTrain: 0, monthlyPass: false, lastTrip: null };
  state.stats ??= { distanceWalked: 0, distanceDriven: 0, npcsMet: 0 };
  state.stats.distanceWalked ??= 0;
  state.stats.distanceDriven ??= 0;
  state.stats.npcsMet ??= 0;
  state.career = normalizeCareer(state.career);
  state.businesses = normalizeStoredBusinesses(state.businesses);
  state.deliveries = normalizeDeliveries(state.deliveries);
  if (!Array.isArray(state.events)) state.events = [];
  state.events = (state.events as AttendedEvent[]).filter((event): event is AttendedEvent =>
    Boolean(event) && typeof event === 'object' && typeof event.id === 'string')
    .map((event) => ({ id: event.id, day: Number.isFinite(event.day) ? event.day! : state.day ?? 1 }));
  // I salvataggi precedenti M5 non avevano la regione: il centro resta il
  // punto di ingresso compatibile con tutte le versioni già pubblicate.
  if (typeof state.regionId !== 'string' || !REGION_IDS.has(state.regionId)) {
    state.regionId = 'centro';
  }

  for (const vehicle of state.vehicles ?? []) {
    vehicle.garageId ??= null;
  }

  if (!state.social || typeof state.social !== 'object' || Array.isArray(state.social)) {
    state.social = defaultSocial();
  }
  state.social.bonds ??= {};
  state.social.spouseId ??= null;
  state.social.marriedOnDay ??= null;
  for (const [name, affinity] of Object.entries(state.relationships)) {
    const bond = state.social.bonds[name];
    if (!bond) {
      state.social.bonds[name] = {
        name,
        affinity: Number.isFinite(affinity) ? affinity : 0,
        gifts: 0,
        stage: name === state.social.spouseId ? 'spouse' : 'acquaintance',
      };
    } else {
      bond.affinity ??= Number.isFinite(affinity) ? affinity : 0;
      bond.gifts ??= 0;
      bond.stage ??= name === state.social.spouseId ? 'spouse' : 'acquaintance';
    }
  }
  for (const [name, bond] of Object.entries(state.social.bonds)) {
    if (!bond || typeof bond !== 'object') {
      delete state.social.bonds[name];
      continue;
    }
    bond.name ??= name;
    bond.affinity = Number.isFinite(bond.affinity) ? bond.affinity : 0;
    bond.gifts = Number.isFinite(bond.gifts) ? bond.gifts : 0;
    bond.stage ??= 'acquaintance';
  }

  if (!Array.isArray(state.pets)) state.pets = [];
  const petIds = new Set<string>();
  state.pets = state.pets.filter((pet): pet is PetState => Boolean(pet) && typeof pet === 'object')
    .map((pet, index) => {
      const id = typeof pet.id === 'string' && pet.id ? pet.id : `pet-${index + 1}`;
      if (petIds.has(id)) return { ...defaultPet(`pet-${index + 10}`), ...pet, id: `pet-${index + 10}` };
      petIds.add(id);
      return {
        ...defaultPet(id), ...pet, id,
        hunger: Number.isFinite(pet.hunger) ? pet.hunger : 70,
        mood: Number.isFinite(pet.mood) ? pet.mood : 75,
      };
    });

  const vehicleIds = new Set<string>();
  state.vehicles = state.vehicles.filter((v): v is VehicleState => Boolean(v) && typeof v === 'object')
    .map((vehicle, index) => {
      const id = typeof vehicle.id === 'string' && vehicle.id ? vehicle.id : `vehicle-${index + 1}`;
      if (vehicleIds.has(id)) return { ...vehicle, id: `vehicle-${index + 10}` };
      vehicleIds.add(id);
      return {
        ...vehicle, id,
        condition: Number.isFinite(vehicle.condition) ? Math.max(0, Math.min(100, vehicle.condition!)) : 100,
        odometer: Number.isFinite(vehicle.odometer) ? Math.max(0, vehicle.odometer!) : 0,
        lastServiceDay: Number.isFinite(vehicle.lastServiceDay) ? vehicle.lastServiceDay! : (state.day ?? 1),
        garageId: vehicle.garageId ?? null,
      };
    });
  return state;
}

function verify(envelope: Envelope): GameState {
  if (!envelope || typeof envelope !== 'object') throw new Error('Salvataggio non valido');
  if (envelope.version > SAVE_VERSION) throw new Error('Salvataggio da una versione futura');
  if (checksum(JSON.stringify(envelope.payload)) !== envelope.checksum) {
    throw new Error('Checksum non valido: salvataggio corrotto');
  }
  const state = envelope.payload;
  if (!state || !state.player || typeof state.player.money !== 'number') {
    throw new Error('Dati del giocatore mancanti');
  }
  return migrate(state, envelope.version);
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
      condition: 92, odometer: 18420, lastServiceDay: 1, garageId: null,
    },
  ];
}
