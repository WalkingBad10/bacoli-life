import Phaser from 'phaser';
import type { GameState, PlaceKind } from '../core/types';
import type { Hud } from '../ui/Hud';
import { buy, sell, type Wallet } from '../systems/Economy';
import type { ItemId } from '../core/config';

interface InteriorData {
  kind: PlaceKind;
  name: string;
  returnX: number;
  returnY: number;
}

interface FurnitureItem {
  sprite: Phaser.GameObjects.Image;
  action: string;
}

const ROOM_W = 26;
const ROOM_H = 17;

export class InteriorScene extends Phaser.Scene {
  private data2!: InteriorData;
  private hud!: Hud;
  private state!: GameState;
  private player!: Phaser.GameObjects.Sprite;
  private furniture: FurnitureItem[] = [];
  private keys!: { E: Phaser.Input.Keyboard.Key; ESC: Phaser.Input.Keyboard.Key };

  constructor() {
    super('Interior');
  }

  create(data: InteriorData): void {
    this.data2 = data;
    this.hud = this.registry.get('hud') as Hud;
    this.state = this.registry.get('state') as GameState;
    if (!this.hud || !this.state) {
      this.scene.stop();
      this.scene.resume('World');
      return;
    }

    const floorIndex = data.kind === 'home' ? 0 : data.kind === 'restaurant' ? 2 : 1;
    const grid: number[][] = [];
    for (let y = 0; y < ROOM_H; y++) {
      const row: number[] = [];
      for (let x = 0; x < ROOM_W; x++) {
        row.push((x + y) % 13 === 0 ? (floorIndex + 1) % 4 : floorIndex);
      }
      grid.push(row);
    }
    const roomMap = this.make.tilemap({ data: grid, tileWidth: 16, tileHeight: 16 });
    const tiles = roomMap.addTilesetImage('room_floors.png', 'room_floors.png');
    if (tiles) roomMap.createLayer(0, tiles, 0, 0);

    // Pareti in pietra: la stessa grafica del tileset esterno, usata solo come rivestimento.
    this.add.tileSprite(ROOM_W * 8, 10, ROOM_W * 16, 20, 'tiles16', 13).setDepth(100);
    this.add.tileSprite(10, ROOM_H * 8, 20, ROOM_H * 16, 'tiles16', 13).setDepth(100);
    this.add.tileSprite(ROOM_W * 16 - 10, ROOM_H * 8, 20, ROOM_H * 16, 'tiles16', 13).setDepth(100);
    this.add.tileSprite(ROOM_W * 8, ROOM_H * 16 - 10, ROOM_W * 16, 20, 'tiles16', 6).setDepth(1);
    this.add.image(ROOM_W * 8, ROOM_H * 16 - 10, 'tiles16', 6).setScale(2).setDepth(2);

    this.placeFurniture(data.kind);
    this.player = this.add.sprite(ROOM_W * 8, ROOM_H * 16 - 34, 'player');
    this.player.setOrigin(0.5, 1).setFrame(0).setDepth(500);

    this.cameras.main.setBounds(0, 0, ROOM_W * 16, ROOM_H * 16);
    this.cameras.main.setZoom(2);
    this.cameras.main.centerOn(ROOM_W * 8, ROOM_H * 8);
    this.cameras.main.setBackgroundColor('#1b2c33');

    this.keys = this.input.keyboard!.addKeys('E,ESC') as typeof this.keys;
    this.input.keyboard!.on('keydown-E', () => this.interact());
    this.input.keyboard!.on('keydown-ESC', () => this.exit());

    this.hud.openInfo(data.name, [
      data.kind === 'home' ? 'Sei a casa tua. Usa gli arredi per riposare, cucinare o guardare la TV.'
        : `Sei dentro ${data.name}. Il personale è disponibile alla cassa.`,
    ], [{ label: 'Esci', action: () => this.exit() }]);
  }

  private addFurniture(key: string, x: number, y: number, action: string): void {
    const img = this.add.image(x * 16 + 8, y * 16 + 16, `f_${key}`);
    img.setOrigin(0.5, 1).setDepth(img.y);
    this.furniture.push({ sprite: img, action });
  }

  private placeFurniture(kind: PlaceKind): void {
    if (kind === 'home') {
      this.addFurniture('bed', 4, 4, 'Dormi');
      this.addFurniture('sofa', 11, 4, 'Rilassati');
      this.addFurniture('tv', 18, 4, 'Guarda la TV');
      this.addFurniture('table', 12, 10, 'Mangia');
      this.addFurniture('fridge', 3, 11, 'Cucina');
      this.addFurniture('stove', 7, 11, 'Cucina');
      this.addFurniture('shelf', 20, 10, 'Arreda');
      this.addFurniture('plant', 24, 3, 'Annaffia');
    } else if (kind === 'cafe' || kind === 'bar') {
      this.addFurniture('register', 17, 4, 'Cassa');
      this.addFurniture('espresso', 21, 4, 'Caffè');
      this.addFurniture('shelf', 4, 4, 'Scaffale');
      for (const x of ([[6, 11], [12, 11], [18, 11]] as const)) {
        this.addFurniture('table', x[0], x[1], 'Siediti');
        this.addFurniture('chair', x[0] + 2, x[1], 'Siediti');
      }
    } else if (kind === 'restaurant') {
      this.addFurniture('stove', 4, 4, 'Cucina');
      this.addFurniture('register', 20, 4, 'Cassa');
      for (const x of ([[7, 10], [14, 10], [21, 10]] as const)) {
        this.addFurniture('table', x[0], x[1], 'Mangia');
        this.addFurniture('chair', x[0] + 2, x[1], 'Siediti');
      }
    } else if (kind === 'pharmacy') {
      this.addFurniture('shelf', 4, 4, 'Scaffale');
      this.addFurniture('shelf', 10, 4, 'Scaffale');
      this.addFurniture('register', 20, 6, 'Cassa');
      this.addFurniture('plant', 15, 12, 'Piante');
    } else if (kind === 'bank' || kind === 'post_office') {
      this.addFurniture('register', 8, 5, 'Sportello');
      this.addFurniture('register', 15, 5, 'Sportello');
      this.addFurniture('shelf', 21, 8, 'Modulistica');
      this.addFurniture('table', 9, 11, 'Attendi');
    } else {
      this.addFurniture('shelf', 4, 5, 'Scaffale');
      this.addFurniture('shelf', 11, 5, 'Scaffale');
      this.addFurniture('shelf', 18, 5, 'Scaffale');
      this.addFurniture('register', 20, 12, 'Cassa');
      this.addFurniture('fridge', 4, 12, 'Frigo');
    }
  }

  private wallet(): Wallet {
    return {
      money: this.state.player.money,
      savings: this.state.player.savings,
      inventory: this.state.inventory,
    };
  }

  private sync(): void {
    this.state.player.money = this.wallet().money;
    this.state.player.savings = this.wallet().savings;
    this.state.inventory = this.wallet().inventory;
  }

  private interact(): void {
    if (this.hud.panelOpen) { this.hud.closePanel(); return; }
    let nearest: FurnitureItem | null = null;
    let distance = 58;
    for (const item of this.furniture) {
      const d = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, item.sprite.x, item.sprite.y,
      );
      if (d < distance) { distance = d; nearest = item; }
    }
    if (!nearest) {
      this.hud.openInfo(this.data2.name, ['Non c’è nulla qui vicino.'], [
        { label: 'Esci', action: () => this.exit() },
      ]);
      return;
    }
    const action = nearest.action;
    if (action === 'Dormi') {
      this.state.player.energy = 100;
      this.hud.openInfo('Riposo', ['Hai dormito bene. Energia ripristinata.'], [
        { label: 'Ok', action: () => this.hud.closePanel() },
      ]);
    } else if (action === 'Guarda la TV') {
      this.state.player.energy = Math.min(100, this.state.player.energy + 10);
      this.hud.openInfo('TV', ['Passa un film italiano degli anni ’90 in onda sul canale locale.'], [
        { label: 'Ok', action: () => this.hud.closePanel() },
      ]);
    } else if (action === 'Caffè' || action === 'Cassa') {
      this.hud.openShop(this.data2.name, this.wallet(), {
        buy: (item: ItemId) => {
          const ok = buy(this.wallet(), item);
          this.sync();
          this.hud.toast(ok ? `Acquistato: ${item}` : 'Denaro insufficiente');
        },
        sell: (item: ItemId) => { sell(this.wallet(), item); this.sync(); },
        exit: () => this.hud.closePanel(),
      });
    } else {
      this.hud.openInfo(action, [
        `Hai interagito con: ${action.toLowerCase()}.`,
        'Un piccolo momento di vita quotidiana a Bacoli.',
      ], [{ label: 'Ok', action: () => this.hud.closePanel() }]);
    }
  }

  private exit(): void {
    this.hud.closePanel();
    this.scene.stop();
    this.scene.resume('World');
    const world = this.scene.get('World') as Phaser.Scene & {
      player?: Phaser.GameObjects.Sprite;
    };
    if (world.player) world.player.setPosition(this.data2.returnX, this.data2.returnY);
  }
}
