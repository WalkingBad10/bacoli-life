import Phaser from 'phaser';

const CHARACTERS = ['player', 'npc_1', 'npc_2', 'npc_3', 'npc_4'];
const DIRECTIONS = ['down', 'left', 'right', 'up'] as const;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.image('tileset.png', 'assets/tiles/tileset.png');
    this.load.spritesheet('tiles16', 'assets/tiles/tileset.png', {
      frameWidth: 16, frameHeight: 16,
    });
    this.load.image('room_floors.png', 'assets/tiles/room_floors.png');
    this.load.tilemapTiledJSON('bacoli', 'assets/maps/bacoli.json');
    this.load.json('mapdata', 'assets/maps/bacoli.json');

    CHARACTERS.forEach((key) => {
      this.load.spritesheet(key, `assets/sprites/${key}.png`, {
        frameWidth: 16, frameHeight: 32,
      });
    });
    for (let i = 0; i < 6; i++) {
      this.load.image(`building_${i}`, `assets/buildings/building_${i}.png`);
    }
    for (const key of ['palm', 'olive_tree', 'bench', 'lamp', 'umbrella', 'boat']) {
      this.load.image(key, `assets/sprites/${key}.png`);
    }
    for (const key of ['bed', 'sofa', 'table', 'chair', 'fridge', 'stove', 'shelf', 'tv',
      'espresso', 'register', 'bathtub', 'toilet', 'plant']) {
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
