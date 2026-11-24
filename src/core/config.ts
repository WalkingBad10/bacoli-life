export const GAME_KEY = 'bacoli-life';

export const TILE = 16;
export const PLAYER_SPEED = 92;
export const RUN_MULTIPLIER = 1.85;
export const CAMERA_ZOOM = 2;
export const DAY_LENGTH_SECONDS = 24 * 60; // 24 minuti reali = 24 ore di gioco

export const ITEM_CATALOG = {
  caffe: { name: 'Caffè', price: 1.2, category: 'food' },
  pizza: { name: 'Pizza margherita', price: 8, category: 'food' },
  cornetto: { name: 'Cornetto', price: 2.5, category: 'food' },
  gelato: { name: 'Gelato', price: 3.5, category: 'food' },
  spesa: { name: 'Spesa settimanale', price: 35, category: 'food' },
  benzina: { name: 'Benzina (1 litro)', price: 1.85, category: 'fuel' },
  biglietto_bus: { name: 'Biglietto autobus', price: 1.5, category: 'transport' },
  biglietto_treno: { name: 'Biglietto Cumana', price: 2.2, category: 'transport' },
  souvenir: { name: 'Souvenir', price: 12, category: 'misc' },
} as const;

export type ItemId = keyof typeof ITEM_CATALOG;
