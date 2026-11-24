import Phaser from 'phaser';

const CHARACTERS = [
  'player', 'npc_1', 'npc_2', 'npc_3', 'npc_4', 'npc_5', 'npc_6',
  'npc_7', 'npc_8', 'npc_9', 'npc_10', 'npc_11', 'npc_12',
];
const DIRECTIONS = ['down', 'left', 'right', 'up'] as const;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // Un solo tileset e due buffer binari: niente più JSON Tiled da 1,4 MB
    // scaricato e parsato due volte.
    this.load.spritesheet('tiles16', 'assets/tiles/tileset.png', {
      frameWidth: 16, frameHeight: 16,
    });
    this.load.image('room_floors.png', 'assets/tiles/room_floors.png');
    this.load.binary('groundBin', 'assets/maps/bacoli-ground.bin');
    this.load.binary('collisionBin', 'assets/maps/bacoli-collision.bin');
    this.load.json('mapmeta', 'assets/maps/bacoli-map.meta.json');

    CHARACTERS.forEach((key) => {
      this.load.spritesheet(key, `assets/sprites/${key}.png`, {
        frameWidth: 16, frameHeight: 32,
      });
    });
    for (const size of [32, 48, 64, 80]) {
      for (let variant = 0; variant < 12; variant++) {
        this.load.image(
          `building_fine_${size}_${variant}`,
          `assets/buildings/building_fine_${size}_${variant}.png`,
        );
      }
    }
    for (const key of ['palm', 'olive_tree', 'bench', 'lamp', 'umbrella', 'boat',
      'flowerpot', 'trash_bin', 'street_sign', 'parking_sign']) {
      this.load.image(key, `assets/sprites/${key}.png`);
    }
    for (const key of ['car_white', 'car_blue', 'car_red', 'car_yellow', 'moto', 'bus']) {
      this.load.image(key, `assets/sprites/${key}.png`);
    }
    for (const key of ['pet_dog', 'pet_cat']) {
      this.load.image(key, `assets/sprites/${key}.png`);
    }
    for (const key of ['bed', 'sofa', 'table', 'chair', 'fridge', 'stove', 'shelf', 'tv',
      'espresso', 'register', 'bathtub', 'toilet', 'plant',
      'washing_machine', 'microwave', 'desk', 'crib']) {
      this.load.image(`f_${key}`, `assets/sprites/f_${key}.png`);
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

    // Texturelegate per effetti atmosferici (non sono grafica definitiva).
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
