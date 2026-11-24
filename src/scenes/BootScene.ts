import Phaser from 'phaser';
import centroData from '../data/bacoli_centro.json';

const CHARACTERS = [
  'player', 'npc_1', 'npc_2', 'npc_3', 'npc_4', 'npc_5', 'npc_6',
  'npc_7', 'npc_8', 'npc_9', 'npc_10', 'npc_11', 'npc_12', 'npc_fisher',
];
const DIRECTIONS = ['down', 'left', 'right', 'up'] as const;
// Carichiamo solo le combinazioni presenti nella mappa reale: 58 facciate e
// 38 tetti invece di 210 texture, con un guadagno evidente su smartphone.
const BUILDING_KEYS = new Set<string>();
const ROOF_KEYS = new Set<string>();
const SHADOW_KEYS = new Set<string>();
for (const place of centroData.places) {
  if (!('bounds' in place) || !place.bounds) continue;
  const width = 'facadeWidth' in place ? place.facadeWidth ?? 128 : 128;
  const floors = 'floors' in place ? place.floors ?? 3 : 3;
  const variant = 'variant' in place ? place.variant ?? 0 : 0;
  BUILDING_KEYS.add(`building_${width}_${floors}_${variant}`);
  ROOF_KEYS.add(`roof_${width}_${variant}`);
  SHADOW_KEYS.add(`shadow_${width}`);
}
const PROPS = [
  'palm', 'olive_tree', 'bench', 'lamp', 'umbrella', 'boat', 'cafe_table',
  'fisher', 'casina', 'flowerpot', 'trash_bin', 'street_sign', 'parking_sign',
  'car_white', 'car_blue', 'car_red', 'car_yellow', 'moto', 'bus', 'train',
];
const FURNITURE = [
  'bed', 'sofa', 'table', 'chair', 'fridge', 'stove', 'shelf', 'tv',
  'espresso', 'register', 'bathtub', 'toilet', 'plant',
  'washing_machine', 'microwave', 'desk', 'crib',
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // Mappa metrica del centro storico: un solo tileset e due buffer binari.
    this.load.spritesheet('tiles16', 'assets/scale/tileset.png', {
      frameWidth: 16, frameHeight: 16,
    });
    this.load.image('room_floors.png', 'assets/scale/room_floors.png');
    this.load.binary('centroGroundBin', 'assets/maps/centro/ground.bin');
    this.load.binary('centroCollisionBin', 'assets/maps/centro/collision.bin');
    this.load.json('centroMeta', 'assets/maps/centro/meta.json');

    // Character sheet nativi alla scala 1 metro = 16 px (adulto 28 px).
    CHARACTERS.forEach((key) => {
      this.load.spritesheet(key, `assets/scale/${key}.png`, {
        frameWidth: 16, frameHeight: 32,
      });
    });

    for (const key of BUILDING_KEYS) {
      this.load.image(key, `assets/scale/${key}.png`);
    }
    for (const key of ROOF_KEYS) {
      this.load.image(key, `assets/scale/${key}.png`);
    }
    for (const key of SHADOW_KEYS) {
      this.load.image(key, `assets/scale/${key}.png`);
    }

    for (const key of PROPS) {
      this.load.image(key, `assets/scale/${key}.png`);
    }
    for (const key of FURNITURE) {
      this.load.image(`f_${key}`, `assets/scale/f_${key}.png`);
    }
    // Gli animali non sono stati rigenerati nella nuova scala.
    for (const key of ['pet_dog', 'pet_cat']) {
      this.load.image(key, `assets/sprites/${key}.png`);
    }
  }

  create(): void {
    CHARACTERS.forEach((key) => {
      DIRECTIONS.forEach((direction, row) => {
        this.anims.create({
          key: `walk-${direction}-${key}`,
          frames: this.anims.generateFrameNumbers(key, { start: row * 4, end: row * 4 + 3 }),
          frameRate: 8,
          repeat: -1,
        });
      });
    });

    // Texture procedurali per effetti atmosferici (non sono grafica definitiva).
    const glow = this.textures.createCanvas('glow', 64, 64);
    if (glow) {
      const ctx = glow.getContext();
      const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(255,214,120,0.75)');
      gradient.addColorStop(1, 'rgba(255,214,120,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      glow.refresh();
    }
    const rain = this.textures.createCanvas('raindrop', 2, 10);
    if (rain) {
      const ctx = rain.getContext();
      ctx.fillStyle = 'rgba(175,215,227,0.85)';
      ctx.fillRect(0, 0, 1, 9);
      rain.refresh();
    }

    this.scene.start('World');
  }
}
