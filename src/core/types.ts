export type Direction = 'down' | 'left' | 'right' | 'up';

export type PlaceKind =
  | 'home' | 'cafe' | 'bar' | 'restaurant' | 'shop' | 'pharmacy'
  | 'fuel' | 'bank' | 'post_office' | 'archaeological_site' | 'beach' | 'railway'
  | 'dealership' | 'workplace' | 'parking' | 'bus_stop' | 'house';

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  x: number;
  y: number;
  sprite: number;
  footprint: [number, number][];
}

export type VehicleKind = 'car' | 'moto' | 'bus';

export interface VehicleState {
  id: string;
  kind: VehicleKind;
  name: string;
  x: number;
  y: number;
  angle: number;
  fuel: number;
  maxFuel: number;
  color: string;
  owned: boolean;
  /** Campi opzionali per compatibilità con i salvataggi v1/v2. */
  condition?: number;
  odometer?: number;
  lastServiceDay?: number;
  garageId?: string | null;
}

export interface HomeState {
  owned: boolean;
  address: string;
  furniture: string[];
  upgrades: string[];
}

export interface FamilyMember {
  name: string;
  relation: string;
  age: number;
  mood: number;
}

export interface JobState {
  id: string;
  title: string;
  workplace: string;
  hourlyWage: number;
  hoursWorked: number;
  daysWorked: number;
}

export interface TransportPass {
  ticketBus: number;
  ticketTrain: number;
  monthlyPass: boolean;
  lastTrip: string | null;
}

export type BondStage = 'acquaintance' | 'friend' | 'dating' | 'engaged' | 'spouse';

export interface BondState {
  name: string;
  affinity: number;
  gifts: number;
  stage: BondStage;
}

export interface SocialState {
  bonds: Record<string, BondState>;
  spouseId: string | null;
  marriedOnDay: number | null;
}

export interface PetState {
  id: string;
  name: string;
  species: 'dog' | 'cat';
  age: number;
  hunger: number;
  mood: number;
  x: number;
  y: number;
  homeId: string | null;
}

export interface PlayerState {
  x: number;
  y: number;
  money: number;
  savings: number;
  energy: number;
  hunger: number;
  job: string | null;
  homeId: string | null;
}

export interface GameState {
  player: PlayerState;
  inventory: Record<string, number>;
  relationships: Record<string, number>;
  time: number;
  day: number;
  weather: 'sun' | 'rain' | 'cloud';
  home: HomeState;
  family: FamilyMember[];
  vehicles: VehicleState[];
  jobState: JobState | null;
  transport: TransportPass;
  social: SocialState;
  pets: PetState[];
  stats: { distanceWalked: number; distanceDriven: number; npcsMet: number };
}

export interface Point {
  x: number;
  y: number;
}
