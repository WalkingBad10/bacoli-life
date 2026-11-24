import Phaser from 'phaser';
import type { LineId } from '../systems/TransportSystem';
import type { TimeSystem } from '../systems/TimeSystem';

export interface TransitData {
  line: LineId;
  lineName: string;
  fromName: string;
  toName: string;
  stops: string[];
  minutes: number;
  timeSystem: TimeSystem;
  onArrive: () => void;
}

const SKY = 0x9ecfe0;
const SEA = 0x185f76;
const FOAM = 0x3a9ff3;
const SHADOW = 0x0c1823;
const SAND = 0xd3b59d;
const TERRACOTTA = 0xb67352;
const OLIVE = 0x4c6e44;

const PASSENGER_KEYS = ['npc_1', 'npc_2', 'npc_3', 'npc_4', 'npc_5', 'npc_6'];

/** Interno animato di treno/autobus con paesaggio scorrevole e passeggeri. */
export class TransitScene extends Phaser.Scene {
  private data2!: TransitData;
  private scenery!: Phaser.GameObjects.TileSprite;
  private progress!: Phaser.GameObjects.Graphics;
  private status!: Phaser.GameObjects.Text;
  private stopLabel!: Phaser.GameObjects.Text;
  private passengers: Phaser.GameObjects.Sprite[] = [];
  private doors: Phaser.GameObjects.Rectangle[] = [];
  private elapsed = 0;
  private elapsedMinutes = 0;
  private durationMs = 4000;
  private completed = false;

  constructor() {
    super('Transit');
  }

  create(data: TransitData): void {
    this.data2 = data;
    this.elapsed = 0;
    this.elapsedMinutes = 0;
    this.completed = false;
    this.durationMs = Phaser.Math.Clamp(data.minutes * 520, 3600, 7200);
    this.passengers = [];
    this.doors = [];

    const width = this.scale.width;
    const height = this.scale.height;
    this.cameras.main.setBackgroundColor('#0c1823');
    this.cameras.main.setSize(width, height);
    this.cameras.main.fadeIn(260, 12, 24, 35);

    this.makeSceneryTexture();
    this.scenery = this.add.tileSprite(width / 2, height / 2, width, height, 'transit_scenery')
      .setDepth(0)
      .setAlpha(0.94);
    this.drawInterior(width, height);
    this.addPassengers(width, height);
    this.addLabels(width, height);
    this.openDoors();
    this.time.delayedCall(750, () => this.closeDoors());

    this.input.keyboard?.on('keydown-ESC', () => this.finish());
    this.input.keyboard?.on('keydown-SPACE', () => this.finish());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      const w = window as unknown as { __bacoliTransit?: Record<string, unknown> };
      delete w.__bacoliTransit;
    });
    const hook = window as unknown as { __bacoliTransit?: Record<string, unknown> };
    hook.__bacoliTransit = {
      progress: () => Math.min(1, this.elapsed / this.durationMs),
      complete: () => this.finish(),
      line: () => this.data2.line,
      passengers: () => this.passengers.length,
      sceneryX: () => this.scenery.tilePositionX,
      minutes: () => this.elapsedMinutes,
    };
  }

  private makeSceneryTexture(): void {
    if (this.textures.exists('transit_scenery')) return;
    const g = this.add.graphics();
    g.fillStyle(SKY);
    g.fillRect(0, 0, 192, 34);
    g.fillStyle(0xd3e7e5);
    g.fillRect(0, 14, 192, 4);
    g.fillStyle(SEA);
    g.fillRect(0, 34, 192, 30);
    g.fillStyle(FOAM, 0.42);
    for (let x = 0; x < 192; x += 12) g.fillRect(x, 36 + (x % 3) * 2, 7, 2);
    g.fillStyle(0x0c1823, 0.22);
    for (let x = 0; x < 192; x += 24) g.fillRect(x + 4, 48, 14, 2);

    // Costiera flegrea stilizzata: colline, case basse e pini.
    g.fillStyle(OLIVE);
    for (let x = 0; x < 192; x += 32) {
      g.fillTriangle(x, 34, x + 16, 12 + (x % 16), x + 32, 34);
    }
    g.fillStyle(SAND);
    for (let x = 0; x < 192; x += 24) {
      g.fillRect(x + 2, 22, 10, 12);
      g.fillStyle(TERRACOTTA);
      g.fillRect(x + 2, 19, 10, 3);
      g.fillStyle(SHADOW, 0.55);
      g.fillRect(x + 5, 26, 3, 4);
      g.fillStyle(SAND);
    }
    g.fillStyle(OLIVE);
    for (let x = 0; x < 192; x += 48) {
      g.fillRect(x + 18, 16, 2, 18);
      g.fillTriangle(x + 10, 20, x + 19, 8, x + 28, 20);
    }
    g.generateTexture('transit_scenery', 192, 64);
    g.destroy();
  }

  private drawInterior(width: number, height: number): void {
    const g = this.add.graphics().setDepth(2);
    // Soffitto e pavimento danno profondità al finestrino.
    g.fillStyle(SHADOW, 0.96);
    g.fillRect(0, 0, width, height * 0.12);
    g.fillStyle(0x6f513d);
    g.fillRect(0, height * 0.73, width, height * 0.27);
    g.fillStyle(0x8a684b);
    g.fillRect(0, height * 0.73, width, 4);

    // Montanti dei finestrini.
    g.fillStyle(SAND);
    const pillars = Math.max(3, Math.floor(width / 210));
    for (let i = 0; i <= pillars; i++) {
      const x = Math.round((i / pillars) * width);
      g.fillRect(x - 4, height * 0.1, 8, height * 0.66);
    }
    g.lineStyle(3, SHADOW, 0.9);
    g.strokeRect(0, height * 0.1, width, height * 0.66);

    // Sedili: due file con schienali e braccioli.
    const seatRows = height > 520 ? 2 : 1;
    for (let row = 0; row < seatRows; row++) {
      const baseY = height * (0.58 + row * 0.1);
      for (let x = 28; x < width - 24; x += 94) {
        g.fillStyle(row === 0 ? OLIVE : TERRACOTTA);
        g.fillRoundedRect(x, baseY, 66, 16, 4);
        g.fillStyle(SHADOW, 0.35);
        g.fillRect(x + 4, baseY + 14, 58, 3);
        g.fillStyle(SAND);
        g.fillRect(x - 3, baseY + 4, 4, 14);
        g.fillRect(x + 65, baseY + 4, 4, 14);
      }
    }

    // Porte automatiche al centro, visibili anche su schermi stretti.
    const doorX = width * 0.52;
    const doorY = height * 0.2;
    const doorH = height * 0.44;
    this.doors.push(
      this.add.rectangle(doorX - 9, doorY + doorH / 2, 16, doorH, TERRACOTTA)
        .setStrokeStyle(2, SHADOW).setDepth(3),
      this.add.rectangle(doorX + 9, doorY + doorH / 2, 16, doorH, TERRACOTTA)
        .setStrokeStyle(2, SHADOW).setDepth(3),
    );
    this.doors.forEach((door, index) => {
      door.setData('closedX', door.x);
      door.setData('openX', door.x + (index === 0 ? -22 : 22));
    });
  }

  private addPassengers(width: number, height: number): void {
    const count = Phaser.Math.Clamp(Math.floor(width / 190) + 2, 3, 7);
    const scale = Phaser.Math.Clamp(height / 420, 0.9, 1.5);
    for (let i = 0; i < count; i++) {
      const key = PASSENGER_KEYS[i % PASSENGER_KEYS.length];
      const x = 48 + (i % 4) * 94 + (i > 3 ? 24 : 0);
      const y = height * (i > 3 ? 0.72 : 0.62);
      const sprite = this.add.sprite(Math.min(x, width - 28), y, key)
        .setFrame((i * 4) % 16)
        .setScale(scale)
        .setOrigin(0.5, 1)
        .setDepth(4);
      sprite.setData('baseY', y);
      this.passengers.push(sprite);
    }
    const player = this.add.sprite(width * 0.28, height * 0.7, 'player')
      .setFrame(8)
      .setScale(scale)
      .setOrigin(0.5, 1)
      .setDepth(5);
    player.setData('baseY', height * 0.7);
    this.passengers.push(player);
  }

  private addLabels(width: number, height: number): void {
    const fontSize = width < 500 ? 13 : 16;
    this.status = this.add.text(width / 2, 14,
      `${this.data2.lineName} · ${this.data2.fromName} → ${this.data2.toName}`, {
        fontFamily: 'monospace', fontSize: `${fontSize}px`, color: '#d3b59d',
        backgroundColor: '#0c1823', padding: { x: 8, y: 4 },
      }).setOrigin(0.5, 0).setDepth(10);

    this.stopLabel = this.add.text(width / 2, height * 0.14,
      `Prossima fermata: ${this.data2.stops[0] ?? this.data2.toName}`, {
        fontFamily: 'monospace', fontSize: `${fontSize - 2}px`, color: '#3a9ff3',
        backgroundColor: '#0c1823', padding: { x: 6, y: 3 },
      }).setOrigin(0.5, 0).setDepth(10);

    this.add.text(10, height - 26, 'Biglietto convalidato · EAV', {
      fontFamily: 'monospace', fontSize: `${fontSize - 3}px`, color: '#d3b59d',
    }).setDepth(10);

    const skip = this.add.text(width - 10, height - 26, 'ARRIVA ⏭', {
      fontFamily: 'monospace', fontSize: `${fontSize - 3}px`, color: '#b67352',
      backgroundColor: '#0c1823', padding: { x: 6, y: 3 },
    }).setOrigin(1, 0).setDepth(10).setInteractive({ useHandCursor: true });
    skip.on('pointerdown', () => this.finish());

    this.progress = this.add.graphics().setDepth(10);
    this.drawProgress(0);
  }

  private drawProgress(ratio: number): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const barW = Math.min(width - 40, 420);
    const x = (width - barW) / 2;
    const y = height - 48;
    this.progress.clear();
    this.progress.fillStyle(SHADOW, 0.9);
    this.progress.fillRect(x - 2, y - 2, barW + 4, 10);
    this.progress.fillStyle(TERRACOTTA);
    this.progress.fillRect(x, y, barW * ratio, 6);
    this.progress.fillStyle(FOAM);
    this.progress.fillRect(x, y, barW * ratio, 2);
  }

  private openDoors(): void {
    this.doors.forEach((door, index) => {
      this.tweens.add({
        targets: door,
        x: door.getData('openX') as number,
        duration: 320,
        ease: 'Sine.easeOut',
        delay: index * 60,
      });
    });
  }

  private closeDoors(): void {
    this.doors.forEach((door) => {
      this.tweens.add({
        targets: door,
        x: door.getData('closedX') as number,
        duration: 280,
        ease: 'Sine.easeIn',
      });
    });
  }

  update(_time: number, delta: number): void {
    if (this.completed) return;
    this.elapsed += delta;
    const ratio = Math.min(1, this.elapsed / this.durationMs);
    const step = Math.min(
      (this.data2.minutes * delta) / this.durationMs,
      Math.max(0, this.data2.minutes - this.elapsedMinutes),
    );
    this.data2.timeSystem.advance(step);
    this.elapsedMinutes += step;

    this.scenery.tilePositionX += delta * (this.data2.line.startsWith('bus') ? 0.08 : 0.13);
    this.passengers.forEach((sprite, index) => {
      const baseY = sprite.getData('baseY') as number;
      sprite.y = baseY + Math.sin(this.elapsed / 180 + index) * 1.6;
    });

    const stopIndex = Math.min(
      this.data2.stops.length - 1,
      Math.floor(ratio * this.data2.stops.length),
    );
    this.stopLabel.setText(`Prossima fermata: ${this.data2.stops[stopIndex] ?? this.data2.toName}`);
    this.drawProgress(ratio);
    if (ratio >= 1) this.finish();
  }

  private finish(): void {
    if (this.completed) return;
    this.completed = true;
    const remaining = Math.max(0, this.data2.minutes - this.elapsedMinutes);
    if (remaining > 0) {
      this.data2.timeSystem.advance(remaining);
      this.elapsedMinutes += remaining;
    }
    this.status.setText(`Arrivo a ${this.data2.toName}`);
    this.cameras.main.fadeOut(240, 12, 24, 35);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.data2.onArrive();
      this.scene.stop();
      this.scene.resume('World');
    });
  }
}
