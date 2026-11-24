import Phaser from 'phaser';

/**
 * Sovrimpressione diagnostica per la revisione metrica.
 *
 * Disegna solo la finestra visibile: la mappa del centro è 463x722 tile,
 * quindi un overlay completo creerebbe centinaia di migliaia di primitive.
 * La griglia serve a controllare che 1 tile = 1 metro = 16 px, i quadrati
 * rossi mostrano i tile solidi e i contorni blu le impronte OSM degli edifici.
 */
export class DebugOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly solid: Uint8Array;
  private readonly footprints: ReadonlyArray<readonly [number, number, number, number]>;
  private readonly width: number;
  private readonly height: number;
  private readonly tile: number;
  private readonly solidCount: number;
  private enabled = false;

  constructor(
    scene: Phaser.Scene,
    options: {
      solid: Uint8Array;
      footprints: ReadonlyArray<readonly [number, number, number, number]>;
      width: number;
      height: number;
      tile: number;
    },
  ) {
    this.solid = options.solid;
    this.footprints = options.footprints;
    this.width = options.width;
    this.height = options.height;
    this.tile = options.tile;
    this.solidCount = 0;
    for (const byte of this.solid) {
      for (let bit = 0; bit < 8; bit++) this.solidCount += (byte >> bit) & 1;
    }
    this.graphics = scene.add.graphics().setDepth(1_000_000).setScrollFactor(1);
    this.label = scene.add.text(12, 12, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#d3b59d',
      backgroundColor: '#0c1823cc', padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(1_000_001);
    this.graphics.setVisible(false);
    this.label.setVisible(false);
  }

  get active(): boolean {
    return this.enabled;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    this.graphics.setVisible(this.enabled);
    this.label.setVisible(this.enabled);
    if (!this.enabled) this.graphics.clear();
    return this.enabled;
  }

  /** Chiamato a ogni frame quando l'overlay è attivo. */
  update(camera: Phaser.Cameras.Scene2D.Camera): void {
    if (!this.enabled) return;
    const g = this.graphics;
    g.clear();

    const left = Math.max(0, Math.floor(camera.worldView.left / this.tile));
    const right = Math.min(this.width - 1, Math.ceil(camera.worldView.right / this.tile));
    const top = Math.max(0, Math.floor(camera.worldView.top / this.tile));
    const bottom = Math.min(this.height - 1, Math.ceil(camera.worldView.bottom / this.tile));

    g.lineStyle(1, 0x3a9ff3, 0.22);
    for (let x = left; x <= right; x++) {
      g.lineBetween(x * this.tile, top * this.tile, x * this.tile, (bottom + 1) * this.tile);
    }
    for (let y = top; y <= bottom; y++) {
      g.lineBetween(left * this.tile, y * this.tile, (right + 1) * this.tile, y * this.tile);
    }

    g.fillStyle(0xd23b3b, 0.35);
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        const index = y * this.width + x;
        if (this.solid[index >> 3]! & (1 << (index & 7))) {
          g.fillRect(x * this.tile, y * this.tile, this.tile, this.tile);
        }
      }
    }

    g.lineStyle(2, 0x185f76, 0.9);
    for (const [minX, minY, maxX, maxY] of this.footprints) {
      if (maxX < left || minX > right || maxY < top || minY > bottom) continue;
      g.strokeRect(
        minX * this.tile, minY * this.tile,
        (maxX - minX + 1) * this.tile, (maxY - minY + 1) * this.tile,
      );
    }

    this.label.setText(
      `DEBUG 1m=16px · tile ${this.tile}px · camera ${Math.round(camera.worldView.left)},${Math.round(camera.worldView.top)} · solidi ${this.solidCount}`,
    );
  }
}
