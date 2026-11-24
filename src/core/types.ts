export type Direction = 'down' | 'left' | 'right' | 'up';

export type PlaceKind =
  | 'home' | 'cafe' | 'bar' | 'restaurant' | 'shop' | 'pharmacy'
  | 'fuel' | 'bank' | 'post_office' | 'archaeological_site' | 'beach' | 'railway'
  | 'dealership' | 'workplace' | 'parking' | 'bus_stop' | 'house'
  | 'garage' | 'pescheria' | 'gelateria' | 'office' | 'delivery';

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  x: number;
  y: number;
  sprite: number;
  /** Vecchi dataset: elenco completo dei tile dell'impronta. */
  footprint?: [number, number][];
  /** Nuovo dataset metrico: [minX, minY, maxX, maxY] in tile da 1 metro. */
  bounds?: [number, number, number, number];
  /** Metadati della ricostruzione metrica del centro storico (1 tile = 1 m). */
  floors?: number;
  facadeWidth?: number;
  variant?: number;
  marker?: boolean;
  meters?: { width: number; depth: number; area: number };
  source?: string;
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
  /** Collegamento alla casa attiva nei salvataggi v4. */
  id?: string;
  street?: string;
}

/** Una casa acquistabile: Via Ortensio, Via Spiaggia, centro e frazioni. */
export interface HomeRecord {
  id: string;
  address: string;
  street: string;
  price: number;
  owned: boolean;
  furniture: string[];
  upgrades: string[];
  style: 'historic' | 'seafront' | 'villa' | 'apartment';
}

export interface FamilyMember {
  name: string;
  relation: string;
  age: number;
  mood: number;
  /** Routine scolastica/lavorativa usata dalla simulazione oraria. */
  schedule?: 'work' | 'school' | 'home' | 'baby';
  child?: boolean;
}

export interface JobState {
  id: string;
  title: string;
  workplace: string;
  hourlyWage: number;
  hoursWorked: number;
  daysWorked: number;
  level?: number;
  xp?: number;
}

/** Stato di carriera: esperienza, promozioni e busta paga settimanale. */
export interface CareerState {
  level: number;
  xp: number;
  shifts: number;
  promotions: number;
  lastPayDay: number;
  unpaidWage: number;
  totalEarned: number;
}

/** Attività commerciale acquistabile e gestibile. */
export interface BusinessState {
  id: string;
  placeId: string;
  name: string;
  kind: PlaceKind;
  owned: boolean;
  open: boolean;
  stock: number;
  earnings: number;
  employees: number;
  level: number;
  price: number;
  lastCollectedDay: number;
}

/** Ordine a domicilio con corriere visibile nel mondo. */
export interface DeliveryOrder {
  id: string;
  item: string;
  quantity: number;
  from: string;
  eta: number;
  status: 'preparing' | 'onway' | 'delivered';
  x: number;
  y: number;
  destinationId: string;
}

export interface AttendedEvent {
  id: string;
  day: number;
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
  /** Aggiunti nella versione 4 del salvataggio; normalizzati sempre. */
  homes?: HomeRecord[];
  activeHomeId?: string;
  businesses?: BusinessState[];
  deliveries?: DeliveryOrder[];
  career?: CareerState;
  events?: AttendedEvent[];
  stats: { distanceWalked: number; distanceDriven: number; npcsMet: number };
}

export interface Point {
  x: number;
  y: number;
}
