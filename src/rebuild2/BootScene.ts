import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('RebuildBoot');
  }

  preload(): void {
    const base = 'rebuild2';
    this.load.spritesheet('tiles', `${base}/assets/tileset.png`, { frameWidth: 16, frameHeight: 16 });
    this.load.atlas('facades', `${base}/assets/facades.png`, `${base}/assets/facades.json`);
    this.load.atlas('characters', `${base}/assets/characters.png`, `${base}/assets/characters.json`);
    this.load.atlas('vehicles', `${base}/assets/vehicles.png`, `${base}/assets/vehicles.json`);
    this.load.atlas('props', `${base}/assets/props.png`, `${base}/assets/props.json`);
    this.load.atlas('interiors', `${base}/assets/interiors.png`, `${base}/assets/interiors.json`);
    this.load.image('shadow', `${base}/assets/shadow.png`);
    this.load.json('r2-map', `${base}/maps/sample/sample.tiled.json`);
    this.load.json('r2-meta', `${base}/maps/sample/meta.json`);
    this.load.json('r2-focus', `${base}/maps/sample/focus.json`);
    this.load.json('r2-lanes', `${base}/maps/sample/lanes.json`);
    this.load.binary('r2-collision', `${base}/maps/sample/collision.bin`);
    this.load.binary('r2-roads', `${base}/maps/sample/roads.bin`);

    const bar = this.add.graphics();
    bar.fillStyle(0x1b2b33, 1);
    bar.fillRect(0, 0, this.scale.width, this.scale.height);
    this.add.text(this.scale.width / 2, this.scale.height / 2, 'BACOLI LIFE 2.0 — caricamento campione', {
      fontFamily: 'monospace', fontSize: '14px', color: '#d8e2dc',
    }).setOrigin(0.5);
    this.load.on('progress', (value: number) => {
      bar.clear();
      bar.fillStyle(0x1b2b33, 1);
      bar.fillRect(0, 0, this.scale.width, this.scale.height);
      bar.fillStyle(0x9dc4a8, 1);
      bar.fillRect(0, this.scale.height - 6, this.scale.width * value, 6);
    });
  }

  create(): void {
    this.scene.start('RebuildWorld');
  }
}
