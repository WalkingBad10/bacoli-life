export type Direction = 'down' | 'left' | 'right' | 'up';

export type PlaceKind =
  | 'home' | 'cafe' | 'bar' | 'restaurant' | 'shop' | 'pharmacy'
  | 'fuel' | 'bank' | 'post_office' | 'archaeological_site' | 'beach' | 'railway';

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  x: number;
  y: number;
  sprite: number;
  footprint: [number, number][];
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
}

export interface Point {
  x: number;
  y: number;
}
