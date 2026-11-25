import Phaser from 'phaser';

interface InteriorData {
  role: string;
  name: string;
  returnPx: [number, number];
}

const ROOM_W = 512;
const ROOM_H = 384;

export class InteriorScene extends Phaser.Scene {
  private roomData!: InteriorData;
  private player!: Phaser.GameObjects.Image;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private blocks: Phaser.Geom.Rectangle[] = [];

  constructor() {
    super('RebuildInterior');
  }

  init(data: InteriorData): void {
    this.roomData = data;
    this.blocks = [];
  }

  create(): void {
    const frame = this.roomData.role === 'bar' ? 'bar'
      : this.roomData.role === 'pizzeria' ? 'pizzeria'
      : this.roomData.role === 'kitchen' ? 'kitchen' : 'home';
    this.add.image(0, 0, 'interiors', frame).setOrigin(0).setDepth(0);

    if (this.roomData.role === 'bar' || this.roomData.role === 'pizzeria') {
      this.blocks.push(new Phaser.Geom.Rectangle(34, 188, 222, 100));
      this.blocks.push(new Phaser.Geom.Rectangle(276, 206, 198, 96));
      for (const x of (this.roomData.role === 'bar' ? [86, 150, 214] : [96, 176, 256])) {
        this.blocks.push(new Phaser.Geom.Rectangle(x - 14, 294, 28, 26));
      }
    } else {
      this.blocks.push(new Phaser.Geom.Rectangle(36, 178, 132, 108));
      this.blocks.push(new Phaser.Geom.Rectangle(276, 186, 194, 106));
      this.blocks.push(new Phaser.Geom.Rectangle(200, 210, 58, 70));
    }

    this.player = this.add.image(256, 352, 'characters', 'char_0_0_0')
      .setOrigin(0.5, 0.93).setScale(0.8).setDepth(352);
    this.keys = this.input.keyboard?.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      e: Phaser.Input.Keyboard.KeyCodes.E,
      esc: Phaser.Input.Keyboard.KeyCodes.ESC,
    }) as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.e.on('down', () => this.tryExit());
    this.keys.esc.on('down', () => this.tryExit());

    this.add.text(10, 8, `${this.roomData.name} · E/ESC per uscire`, {
      fontFamily: 'monospace', fontSize: '12px', color: '#f3ead7',
      backgroundColor: '#26332f', padding: { x: 6, y: 3 },
    }).setDepth(20);

    const zoom = Math.min(this.scale.width / ROOM_W, this.scale.height / ROOM_H);
    this.cameras.main.setBounds(0, 0, ROOM_W, ROOM_H);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(ROOM_W / 2, ROOM_H / 2);
    this.cameras.main.setBackgroundColor('#1b2527');
  }

  private tryExit(): void {
    if (this.player.y < 336) return;
    this.scene.start('RebuildWorld', { returnPx: this.roomData.returnPx });
  }

  private blocked(x: number, y: number): boolean {
    if (x < 10 || x > ROOM_W - 10 || y < 30 || y > ROOM_H - 8) return true;
    return this.blocks.some((rect) =>
      x > rect.x - 9 && x < rect.x + rect.width + 9 && y > rect.y - 9 && y < rect.y + rect.height + 9);
  }

  update(_time: number, delta: number): void {
    let dx = (this.keys.right.isDown || this.keys.d.isDown ? 1 : 0) -
      (this.keys.left.isDown || this.keys.a.isDown ? 1 : 0);
    let dy = (this.keys.down.isDown || this.keys.s.isDown ? 1 : 0) -
      (this.keys.up.isDown || this.keys.w.isDown ? 1 : 0);
    if (dx === 0 && dy === 0) {
      this.player.setFrame('char_0_0_0');
      return;
    }
    const length = Math.hypot(dx, dy);
    dx = (dx / length) * 70 * (delta / 1000);
    dy = (dy / length) * 70 * (delta / 1000);
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 3));
    for (let i = 0; i < steps; i++) {
      if (!this.blocked(this.player.x + dx / steps, this.player.y + dy / steps)) {
        this.player.x += dx / steps;
        this.player.y += dy / steps;
      }
    }
    this.player.setDepth(this.player.y);
    const direction = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 0 : 2) : (dy >= 0 ? 1 : 3);
    this.player.setFrame(`char_0_${direction}_${Math.floor(this.time.now / 130) % 4}`);
  }
}
