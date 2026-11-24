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
  stats: { distanceWalked: number; distanceDriven: number; npcsMet: number };
}

export interface Point {
  x: number;
  y: number;
}
