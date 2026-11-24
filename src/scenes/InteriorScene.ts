import Phaser from 'phaser';
import type { GameState, PlaceKind } from '../core/types';
import type { Hud } from '../ui/Hud';
import { buy, deposit, sell, withdraw, type Wallet } from '../systems/Economy';
import type { TimeSystem } from '../systems/TimeSystem';
import { consumeItem, occupySeat, releaseSeat, type SeatState } from '../systems/ConsumptionSystem';
import { ITEM_CATALOG, type ItemId } from '../core/config';
import {
  FURNITURE_CATALOG, buyFurniture, familyActivity, homeComfort,
  type FurnitureId,
} from '../systems/LifeSystem';

interface InteriorData {
  kind: PlaceKind;
  name: string;
  returnX: number;
  returnY: number;
}

interface FurnitureItem {
  sprite: Phaser.GameObjects.Image;
  action: string;
  radius: number;
}

const ROOM_W = 26;
const ROOM_H = 17;

export class InteriorScene extends Phaser.Scene {
  private data2!: InteriorData;
  private hud!: Hud;
  private state!: GameState;
  private player!: Phaser.GameObjects.Sprite;
  private furniture: FurnitureItem[] = [];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private facing: 'up' | 'down' | 'left' | 'right' = 'down';
  private interactionCount = 0;
  private timeSystem?: TimeSystem;
  private seats: Record<string, SeatState> = {};

  constructor() {
    super('Interior');
  }

  create(data: InteriorData): void {
    this.data2 = data;
    this.hud = this.registry.get('hud') as Hud;
    this.state = this.registry.get('state') as GameState;
    this.timeSystem = this.registry.get('time') as TimeSystem | undefined;
    this.seats = {};
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
        row.push(floorIndex);
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
    this.add.tileSprite(ROOM_W * 8, ROOM_H * 16 - 10, ROOM_W * 16, 20, 'tiles16', 13).setDepth(1);

    this.placeFurniture(data.kind);
    this.player = this.add.sprite(ROOM_W * 8, ROOM_H * 16 - 34, 'player');
    this.player.setOrigin(0.5, 1).setFrame(0).setDepth(500);

    this.cameras.main.setBounds(0, 0, ROOM_W * 16, ROOM_H * 16);
    this.cameras.main.setZoom(2);
    this.cameras.main.centerOn(ROOM_W * 8, ROOM_H * 8);
    this.cameras.main.setBackgroundColor('#1b2c33');

    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,E,ESC',
    ) as typeof this.keys;
    this.input.keyboard!.on('keydown-E', () => this.interact());
    this.input.keyboard!.on('keydown-ESC', () => this.exit());

    this.hud.openInfo(data.name, [
      data.kind === 'home'
        ? `Comfort ${homeComfort(this.state.home)} · famiglia ${this.state.family.length}. Usa gli arredi per riposare, cucinare o guardare la TV.`
        : `Sei dentro ${data.name}. Il personale è disponibile alla cassa.`,
    ], [{ label: 'Esci', action: () => this.exit() }]);
  }

  private addFurniture(key: string, x: number, y: number, action: string): void {
    const img = this.add.image(x * 16 + 8, y * 16 + 16, `f_${key}`);
    img.setOrigin(0.5, 1).setDepth(img.y);
    img.setData('seatId', `${key}-${x}-${y}`);
    this.furniture.push({ sprite: img, action, radius: key === 'table' ? 14 : 10 });
  }

  private canStand(px: number, py: number): boolean {
    if (px < 14 || py < 20 || px > ROOM_W * 16 - 14 || py > ROOM_H * 16 - 12) return false;
    return !this.furniture.some((item) =>
      Math.hypot(px - item.sprite.x, py - item.sprite.y) < 5 + item.radius * 0.6);
  }

  update(delta: number): void {
    const k = this.keys;
    let dx = (k.D?.isDown || k.RIGHT?.isDown ? 1 : 0) - (k.A?.isDown || k.LEFT?.isDown ? 1 : 0);
    let dy = (k.S?.isDown || k.DOWN?.isDown ? 1 : 0) - (k.W?.isDown || k.UP?.isDown ? 1 : 0);
    if (dx === 0 && dy === 0) {
      this.player.anims.stop();
      this.player.setFrame(({ down: 0, left: 4, right: 8, up: 12 })[this.facing]);
      return;
    }
    const len = Math.hypot(dx, dy) || 1;
    const speed = 96 * (k.SHIFT?.isDown ? 1.6 : 1) * (delta / 1000);
    const nx = (dx / len) * speed;
    const ny = (dy / len) * speed;
    const steps = Math.max(1, Math.ceil(Math.hypot(nx, ny) / 3));
    for (let i = 0; i < steps; i++) {
      if (this.canStand(this.player.x + nx / steps, this.player.y)) this.player.x += nx / steps;
      if (this.canStand(this.player.x, this.player.y + ny / steps)) this.player.y += ny / steps;
    }
    this.facing = Math.abs(nx) > Math.abs(ny)
      ? (nx > 0 ? 'right' : 'left')
      : (ny > 0 ? 'down' : 'up');
    this.player.anims.play(`walk-${this.facing}-player`, true);
    this.player.setDepth(this.player.y);
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

  private sync(wallet: Wallet = this.wallet()): void {
    this.state.player.money = wallet.money;
    this.state.player.savings = wallet.savings;
    this.state.inventory = wallet.inventory;
  }

  /** Unico proprietario del tempo: il TimeSystem condiviso con il mondo. */
  private advanceTime(minutes: number): void {
    if (this.timeSystem) this.timeSystem.advance(minutes);
    else {
      this.state.time += minutes;
      this.state.day = Math.floor(this.state.time / (24 * 60)) + 1;
    }
    this.state.time = this.timeSystem?.minutes ?? this.state.time;
    this.state.day = this.timeSystem?.day ?? this.state.day;
    this.state.weather = this.timeSystem?.weather ?? this.state.weather;
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
      this.advanceTime(480);
      this.hud.openInfo('Riposo', ['Hai dormito bene. Energia ripristinata.', `Ora sono le ${this.timeSystem?.clock ?? '08:00'}.`], [
        { label: 'Ok', action: () => this.hud.closePanel() },
      ]);
    } else if (action === 'Guarda la TV' || action === 'Rilassati' || action === 'Siediti') {
      const seatId = nearest.sprite.getData('seatId') as string | undefined;
      let sat = false;
      if (seatId && (this.data2.kind === 'cafe' || this.data2.kind === 'bar'
        || this.data2.kind === 'restaurant')) {
        sat = occupySeat(this.seats, seatId, this.data2.name);
      }
      if (seatId && !sat && (this.data2.kind === 'cafe' || this.data2.kind === 'bar')) {
        this.hud.toast('Quel posto è occupato');
        return;
      }
      const drank = this.data2.kind === 'cafe' || this.data2.kind === 'bar'
        ? consumeItem(this.state, 'caffe') : false;
      if (!drank) this.state.player.energy = Math.min(100, this.state.player.energy + 6);
      const bonus = familyActivity(this.state.family, 'tv');
      this.hud.openInfo(sat ? 'Posto a sedere' : 'TV', [
        sat ? 'Ti sei seduto al tavolino.' : 'Passa un film italiano degli anni ’90 in onda sul canale locale.',
        drank ? 'Hai bevuto un caffè: energia +8.' : '',
        this.state.family.length ? `Serate in famiglia: umore +${bonus}.` : '',
      ].filter(Boolean), [{ label: 'Ok', action: () => this.hud.closePanel() }]);
    } else if (action === 'Mangia' || action === 'Cucina') {
      const item: ItemId = this.data2.kind === 'home' || this.data2.kind === 'house'
        ? 'spesa' : 'pizza';
      const ate = consumeItem(this.state, item);
      if (!ate) {
        this.hud.toast(`Non hai ${item === 'spesa' ? 'spesa' : 'pizze'}: acquistale o ordina dal telefono`);
        return;
      }
      const bonus = familyActivity(this.state.family, 'meal');
      this.hud.openInfo('Cucina', [
        `Hai mangiato: ${item === 'spesa' ? 'una cena preparata in casa' : 'una pizza margherita'}.`,
        this.state.family.length ? `Pranzo insieme: umore +${bonus}.` : '',
      ].filter(Boolean), [{ label: 'Ok', action: () => this.hud.closePanel() }]);
    } else if (action === 'Annaffia' || action === 'Piante') {
      const bonus = familyActivity(this.state.family, 'walk');
      this.hud.openInfo('Piante', [
        'Le piante sul balcone sono più verdi.',
        this.state.family.length ? `Attività condivisa: umore +${bonus}.` : '',
      ].filter(Boolean), [{ label: 'Ok', action: () => this.hud.closePanel() }]);
    } else if (action === 'Arreda') {
      this.openFurnitureMenu();
    } else if (action === 'Caffè' || action === 'Cassa' || action === 'Frigo') {
      const wallet = this.wallet();
      this.hud.openShop(this.data2.name, wallet, {
        buy: (item: ItemId) => {
          const ok = buy(wallet, item);
          this.sync(wallet);
          this.hud.toast(ok ? `Acquistato: ${ITEM_CATALOG[item].name}` : 'Denaro insufficiente');
        },
        sell: (item: ItemId) => { sell(wallet, item); this.sync(wallet); },
        exit: () => this.hud.closePanel(),
      });
    } else if (action === 'Sportello') {
      this.hud.openInfo(this.data2.name, [
        `Conto: € ${this.state.player.money.toFixed(2)} · risparmi: € ${this.state.player.savings.toFixed(2)}`,
      ], [
        { label: 'Deposita € 20', action: () => {
          const wallet = this.wallet();
          deposit(wallet, 20);
          this.sync(wallet);
          this.interactAgain(action);
        } },
        { label: 'Preleva € 20', action: () => {
          const wallet = this.wallet();
          withdraw(wallet, 20);
          this.sync(wallet);
          this.interactAgain(action);
        } },
        { label: 'Esci', action: () => this.hud.closePanel() },
      ]);
    } else if (action === 'Modulistica') {
      this.hud.openInfo('Modulistica', [
        'Moduli per certificati, residenza e pratiche comunali.',
        'Il personale ti indirizza allo sportello corretto.',
      ], [{ label: 'Grazie', action: () => this.hud.closePanel() }]);
    } else if (action === 'Attendi') {
      this.advanceTime(15);
      this.hud.toast(`Hai atteso il tuo turno · ${this.timeSystem?.clock ?? ''}`);
    } else {
      this.interactionCount++;
      const lines: Record<string, string[]> = {
        Scaffale: this.shelfDescription(),
        'Cucina': ['Il cuoco sta preparando le specialità della casa.', 'Profumo di pomodoro e basilico.'],
      };
      this.hud.openInfo(action, lines[action] ?? [
        `Hai interagito con: ${action.toLowerCase()}.`,
        'Un piccolo momento di vita quotidiana a Bacoli.',
      ], [{ label: 'Ok', action: () => this.hud.closePanel() }]);
    }
  }

  private interactAgain(action: string): void {
    this.hud.closePanel();
    this.interactionCount++;
    this.hud.toast(`${action}: operazione completata`);
  }

  private shelfDescription(): string[] {
    switch (this.data2.kind) {
      case 'pharmacy':
        return ['Farmaci, creme solari e rimedi per il mare.', 'Il farmacista consiglia la protezione 50+.'];
      case 'bank':
        return ['Opuscoli su mutui, risparmi e prestiti.', 'Tassi e condizioni in chiaro all’interno.'];
      case 'post_office':
        return ['Buste, francobolli e moduli per spedizioni.', 'Puoi spedire una cartolina dal lungomare.'];
      default:
        return ['Scaffali pieni di prodotti locali.', 'C’è anche un angolo con i dolci tipici di Bacoli.'];
    }
  }

  private openFurnitureMenu(): void {
    const entries = Object.entries(FURNITURE_CATALOG) as [FurnitureId, typeof FURNITURE_CATALOG[FurnitureId]][];
    const buttons = entries.map(([id, spec]) => ({
      label: `${spec.name} · € ${spec.price}${this.state.home.furniture.includes(id) ? ' ✓' : ''}`,
      action: () => {
        const wallet = this.wallet();
        const ok = this.state.home.furniture.includes(id)
          ? false
          : buyFurniture(this.state.home, wallet, id);
        this.sync(wallet);
        this.hud.toast(ok ? `${spec.name} aggiunto a casa` : 'Già posseduto o denaro insufficiente');
        this.openFurnitureMenu();
      },
    }));
    buttons.push({ label: 'Esci', action: () => this.hud.closePanel() });
    this.hud.openInfo('Arredamento', [
      `Saldo: € ${this.state.player.money.toFixed(2)} · comfort ${homeComfort(this.state.home)}`,
    ], buttons);
  }

  private exit(): void {
    this.state.time = this.timeSystem?.minutes ?? this.state.time;
    this.state.day = this.timeSystem?.day ?? this.state.day;
    this.state.weather = this.timeSystem?.weather ?? this.state.weather;
    Object.keys(this.seats).forEach((id) => releaseSeat(this.seats, id));
    this.hud.closePanel();
    this.scene.stop();
    this.scene.resume('World');
    const world = this.scene.get('World') as Phaser.Scene & {
      player?: Phaser.GameObjects.Sprite;
    };
    if (world.player) world.player.setPosition(this.data2.returnX, this.data2.returnY);
  }
}
