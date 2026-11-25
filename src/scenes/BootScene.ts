import Phaser from 'phaser';
import worldData from '../data/bacoli_world.json';
import { loadGame } from '../systems/SaveSystem';
import { regionTextureKeys } from '../systems/AssetKeys';

interface WorldRegionData {
  id: string;
  places: Array<{
    bounds?: [number, number, number, number];
    facadeWidth?: number;
    floors?: number;
    variant?: number;
  }>;
}

const CHARACTERS = [
  'player', 'npc_1', 'npc_2', 'npc_3', 'npc_4', 'npc_5', 'npc_6',
  'npc_7', 'npc_8', 'npc_9', 'npc_10', 'npc_11', 'npc_12', 'npc_fisher',
];
const DIRECTIONS = ['down', 'left', 'right', 'up'] as const;
// Solo la regione attiva entra nel primo avvio. Le altre facciate vengono
// caricate da WorldScene.ensureRegionTextures() al momento del viaggio.
const SAVED_REGION = loadGame()?.regionId ?? 'centro';
const INITIAL_REGION = (worldData.regions as WorldRegionData[])
  .find((region) => region.id === SAVED_REGION) ?? (worldData.regions as WorldRegionData[])[0];
const INITIAL_TEXTURES = regionTextureKeys(INITIAL_REGION.places);
const PROPS = [
  'palm', 'olive_tree', 'bench', 'lamp', 'umbrella', 'boat', 'cafe_table',
  'fisher', 'casina', 'flowerpot', 'trash_bin', 'street_sign', 'parking_sign',
  'bus_stop',
  'car_white', 'car_blue', 'car_red', 'car_yellow', 'moto', 'bus', 'train',
  'station_eav', 'platform', 'rail',
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
    // Tutte le regioni M5 usano lo stesso tileset e la scala universale.
    this.load.spritesheet('tiles16', 'assets/scale/tileset.png', {
      frameWidth: 16, frameHeight: 16,
    });
    this.load.image('room_floors.png', 'assets/scale/room_floors.png');
    for (const region of worldData.regions as WorldRegionData[]) {
      this.load.binary(`ground_${region.id}`, `assets/maps/${region.id}/ground.bin`);
      this.load.binary(`collision_${region.id}`, `assets/maps/${region.id}/collision.bin`);
      // Classi stradali OSM: asfalto/basolato percorribili, marciapiedi pedonali.
      this.load.binary(`roads_${region.id}`, `assets/maps/${region.id}/roads.bin`);
      this.load.json(`meta_${region.id}`, `assets/maps/${region.id}/meta.json`);
    }

    // Character sheet nativi alla scala 1 metro = 16 px (adulto 28 px).
    CHARACTERS.forEach((key) => {
      this.load.spritesheet(key, `assets/scale/${key}.png`, {
        frameWidth: 16, frameHeight: 32,
      });
    });

    for (const key of INITIAL_TEXTURES) {
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
