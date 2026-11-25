import Phaser from 'phaser';
import worldData from '../data/bacoli_world.json';
import type { GameState, PlaceKind } from '../core/types';
import type { Hud } from '../ui/Hud';
import { buy, deposit, sell, withdraw, type Wallet } from '../systems/Economy';
import type { TimeSystem } from '../systems/TimeSystem';
import { consumeItem, occupySeat, releaseSeat, useItem, type SeatState } from '../systems/ConsumptionSystem';
import { ITEM_CATALOG, type ItemId } from '../core/config';
import {
  FURNITURE_CATALOG, buyFurniture, familyActivity, homeComfort,
  type FurnitureId,
} from '../systems/LifeSystem';
import { activeHome } from '../systems/HomeSystem';

interface InteriorData {
  kind: PlaceKind;
  name: string;
  returnX: number;
  returnY: number;
  placeId?: string;
  regionId?: string;
  floors?: number;
  facadeWidth?: number;
  source?: string;
}

type InteriorTemplate =
  | 'home' | 'bar' | 'pizzeria' | 'fish' | 'supermarket'
  | 'tobacco' | 'church' | 'workshop' | 'pharmacy'
  | 'bank' | 'post_office' | 'shop' | 'hotel' | 'lido'
  | 'station' | 'fuel' | 'generic';

interface WorldPlace {
  id: string;
  kind: string;
  name: string;
  floors?: number;
  facadeWidth?: number;
  source?: string;
}

interface FurnitureItem {
  sprite: Phaser.GameObjects.Image;
  action: string;
  radius: number;
}

// Una stanza è misurata in metri: 1 tile = 1 m = 16 px.
const ROOM_W = 24;
const ROOM_H = 16;

/** Interni riconoscibili: la tipologia reale del luogo guida arredi e servizi. */
function templateFor(kind: PlaceKind, name: string, place?: WorldPlace): InteriorTemplate {
  const text = `${name} ${place?.kind ?? ''} ${place?.source ?? ''}`.toLowerCase();
  // Il nome OSM ha priorità sulla tipologia generica "home": una casa che è
  // anche B&B, chiesa o albergo deve aprire gli arredi del servizio reale.
  if (/hotel|alberg|pensione|b&b|residence|affittacamere/.test(text)) return 'hotel';
  if (/stazione|fermata|railway|bus_stop|station/.test(text)) return 'station';
  if (/distributore|benzina|carburante|fuel|service_station/.test(text)) return 'fuel';
  if (/lido|stabiliment|balnear|spiaggia|beach/.test(text)) return 'lido';
  if (/pizzeri|pizza|pizzeria/.test(text)) return 'pizzeria';
  if (/pesce|pescheria|ristorante|trattoria|sapori|taverna|cucina|marina/.test(text)) return 'fish';
  if (/super|mercato|alimentari|conad|coop/.test(text)) return 'supermarket';
  if (/tabach|tabacc|edicola|farmacia/.test(text) && !/farmacia/.test(text)) return 'tobacco';
  if (/chies|basil|santuar|duomo|parrocchia/.test(text)) return 'church';
  if (/officina|garage|meccan|carrozzeria/.test(text)) return 'workshop';
  if (kind === 'home' || kind === 'house') return 'home';
  if (kind === 'pharmacy') return 'pharmacy';
  if (kind === 'bank') return 'bank';
  if (kind === 'post_office') return 'post_office';
  if (kind === 'bar' || kind === 'cafe' || kind === 'gelateria') return 'bar';
  if (kind === 'shop' || kind === 'pescheria' || kind === 'delivery') return 'shop';
  return 'generic';
}

/** Larghezza reale in pixel degli arredi (1 m = 16 px). */
const FURNITURE_WIDTH: Record<string, number> = {
  bed: 40, sofa: 40, table: 32, chair: 16, fridge: 16, stove: 20,
  shelf: 24, tv: 24, espresso: 14, register: 18, bathtub: 40,
  toilet: 14, plant: 18, washing_machine: 20, microwave: 22,
  desk: 36, crib: 28,
};

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
  private template: InteriorTemplate = 'generic';
  private placeData?: WorldPlace;
  private staff?: Phaser.GameObjects.Sprite;

  constructor() {
    super('Interior');
  }

  create(data: InteriorData): void {
    this.data2 = data;
    this.hud = this.registry.get('hud') as Hud;
    this.state = this.registry.get('state') as GameState;
    this.timeSystem = this.registry.get('time') as TimeSystem | undefined;
    this.seats = {};
    // La scena viene riutilizzata a ogni ingresso: senza azzerare questi
    // riferimenti, arredi e personale della visita precedente resterebbero
    // attivi dentro il nuovo locale.
    this.furniture = [];
    this.staff = undefined;
    this.interactionCount = 0;
    if (!this.hud || !this.state) {
      this.scene.stop();
      this.scene.resume('World');
      return;
    }

    // placeId è la chiave reale del luogo OSM: la stanza eredita tipologia e
    // piano dal dato, non da una lista di template scollegata dal mondo.
    for (const region of worldData.regions) {
      const found = (region.places as WorldPlace[]).find((place) => place.id === data.placeId);
      if (found) { this.placeData = found; break; }
    }
    this.template = templateFor(data.kind, data.name, this.placeData);
    // Hook di sola diagnostica: verifica che la stanza usi davvero il luogo
    // OSM passato dal mondo, non un template scelto a caso dal nome.
    (window as unknown as { __bacoliInterior?: () => unknown }).__bacoliInterior = () => ({
      template: this.template,
      placeId: this.placeData?.id ?? data.placeId ?? null,
      regionId: data.regionId ?? null,
      name: data.name,
      floors: this.placeData?.floors ?? data.floors ?? null,
      facadeWidth: this.placeData?.facadeWidth ?? data.facadeWidth ?? null,
      source: this.placeData?.source ?? data.source ?? null,
      furniture: this.furniture.map((item) => item.action),
      staff: Boolean(this.staff),
      interactionCount: this.interactionCount,
    });
    const realFloors = this.placeData?.floors ?? data.floors ?? 3;
    const floorIndex = this.template === 'home' ? 0
      : this.template === 'church' ? 3
        : this.template === 'fish' || this.template === 'pizzeria' || realFloors >= 3 ? 2 : 1;
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

    // Porta d'ingresso: varco reale nella parete bassa, con ombra e maniglia.
    const doorX = ROOM_W * 8;
    const doorY = ROOM_H * 16 - 10;
    this.add.rectangle(doorX, doorY, 34, 20, 0x0c1823).setDepth(2);
    this.add.rectangle(doorX, doorY - 1, 28, 18, 0x825834).setDepth(2);
    this.add.rectangle(doorX - 9, doorY - 1, 2, 14, 0x4e3f2d).setDepth(2);
    this.add.circle(doorX + 8, doorY, 1.6, 0xe6ab2d).setDepth(3);

    this.addWallSign(data.name);
    this.placeFurniture(data.kind);
    this.addStaff();
    this.player = this.add.sprite(ROOM_W * 8, ROOM_H * 16 - 30, 'player');
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
        ? `Comfort ${homeComfort(activeHome(this.state))} · famiglia ${this.state.family.length}. Usa gli arredi per riposare, cucinare o guardare la TV.`
        : `Sei dentro ${data.name}. Il personale è disponibile alla cassa.`,
    ], [{ label: 'Esci', action: () => this.exit() }]);
  }

  private addWallSign(name: string): void {
    const label = name.length > 28 ? `${name.slice(0, 27)}…` : name;
    this.add.text(ROOM_W * 8, 34, label, {
      fontFamily: 'monospace', fontSize: '13px', color: '#f2ead8',
      backgroundColor: '#825834', padding: { x: 8, y: 3 },
    }).setOrigin(0.5, 0).setDepth(120);
    // Un secondo pannello rende leggibile la funzione del locale anche senza HUD.
    const subtitle: Record<InteriorTemplate, string> = {
      home: 'CASA · VITA QUOTIDIANA', bar: 'CAFFÈ · BAR', pizzeria: 'PIZZERIA',
      fish: 'RISTORANTE DI PESCE', supermarket: 'SUPERMERCATO',
      tobacco: 'TABACCHERIA · EDICOLA', church: 'LUOGO DI CULTO',
      workshop: 'OFFICINA', pharmacy: 'FARMACIA', bank: 'BANCA',
      post_office: 'POSTE', shop: 'NEGOZIO', hotel: 'ALBERGO · RICEVIMENTO',
      lido: 'LIDO · SPIAGGIA', station: 'STAZIONE · BIGLIETTERIA',
      fuel: 'DISTRIBUTORE · CARBURANTE', generic: 'ESERCIZIO LOCALE',
    };
    this.add.text(ROOM_W * 8, 58, subtitle[this.template], {
      fontFamily: 'monospace', fontSize: '11px', color: '#e6ab2d',
      backgroundColor: '#0c1823', padding: { x: 6, y: 2 },
    }).setOrigin(0.5, 0).setDepth(120);
  }

  /** Personale dietro il banco: parla, vende e descrive il servizio reale. */
  private addStaff(): void {
    if (this.template === 'home' || this.template === 'church') return;
    const keys: Partial<Record<InteriorTemplate, string>> = {
      bar: 'npc_2', pizzeria: 'npc_4', fish: 'npc_fisher',
      supermarket: 'npc_6', tobacco: 'npc_8', workshop: 'npc_10',
      pharmacy: 'npc_5', bank: 'npc_3', post_office: 'npc_7', shop: 'npc_9',
      hotel: 'npc_11', lido: 'npc_fisher', station: 'npc_6', fuel: 'npc_10',
    };
    const key = keys[this.template] ?? 'npc_1';
    const x = this.template === 'bank' || this.template === 'post_office' ? 8 * 16 + 8 : 17 * 16 + 8;
    const y = 4 * 16 + 16;
    this.staff = this.add.sprite(x, y, key).setFrame(0)
      .setOrigin(0.5, 1).setDepth(y);
  }

  private addFurniture(key: string, x: number, y: number, action: string): void {
    const img = this.add.image(x * 16 + 8, y * 16 + 16, `f_${key}`);
    // Le texture sorgente sono state disegnate ad alta risoluzione: qui vengono
    // riportate alla loro dimensione reale con scala uniforme, senza deformarle.
    const targetWidth = FURNITURE_WIDTH[key] ?? 24;
    img.setScale(targetWidth / img.width);
    img.setOrigin(0.5, 1).setDepth(img.y);
    img.setData('seatId', `${key}-${x}-${y}`);
    this.add.ellipse(img.x, img.y - 1, img.displayWidth * 0.85, 5, 0x0c1823, 0.24)
      .setDepth(img.y - 1);
    this.furniture.push({
      sprite: img, action, radius: Math.max(7, img.displayWidth * 0.45),
    });
  }

  private canStand(px: number, py: number): boolean {
    if (px < 12 || py < 18 || px > ROOM_W * 16 - 12 || py > ROOM_H * 16 - 10) return false;
    return !this.furniture.some((item) =>
      Math.hypot(px - item.sprite.x, py - item.sprite.y) < 6 + item.radius * 0.5);
  }

  update(_time: number, delta: number): void {
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

  private placeFurniture(_kind: PlaceKind): void {
    if (this.template === 'home') {
      this.addFurniture('bed', 3, 3, 'Dormi');
      this.addFurniture('sofa', 8, 3, 'Rilassati');
      this.addFurniture('tv', 13, 3, 'Guarda la TV');
      this.addFurniture('table', 9, 8, 'Mangia');
      this.addFurniture('chair', 12, 8, 'Siediti');
      this.addFurniture('fridge', 3, 11, 'Cucina');
      this.addFurniture('stove', 6, 11, 'Cucina');
      this.addFurniture('shelf', 17, 8, 'Arreda');
      this.addFurniture('plant', 21, 3, 'Annaffia');
      // Gli arredi acquistati compaiono davvero nella stanza: la casa è
      // personalizzabile e non solo una lista di ID nel salvataggio.
      const extras: [FurnitureId, number, number, string][] = [
        ['washing_machine', 21, 11, 'Lava i panni'],
        ['microwave', 6, 3, 'Scalda'],
        ['desk', 15, 3, 'Scrivi'],
        ['crib', 21, 6, 'Culla'],
      ];
      for (const [id, x, y, action] of extras) {
        if (activeHome(this.state).furniture.includes(id)) this.addFurniture(id, x, y, action);
      }
      return;
    }

    if (this.template === 'bar') {
      this.addFurniture('register', 15, 3, 'Cassa');
      this.addFurniture('espresso', 18, 3, 'Caffè');
      this.addFurniture('shelf', 3, 3, 'Scaffale');
      this.addFurniture('fridge', 3, 11, 'Frigo');
      for (const [tx, ty] of [[5, 9], [11, 11], [17, 9]] as const) {
        this.addFurniture('table', tx, ty, 'Siediti');
        this.addFurniture('chair', tx + 2, ty, 'Siediti');
      }
      this.addFurniture('plant', 21, 11, 'Piante');
      return;
    }

    if (this.template === 'pizzeria') {
      this.addFurniture('stove', 3, 3, 'Forno a legna');
      this.addFurniture('register', 18, 3, 'Cassa');
      this.addFurniture('shelf', 8, 3, 'Scaffale');
      for (const [tx, ty] of [[5, 9], [10, 9], [15, 9]] as const) {
        this.addFurniture('table', tx, ty, 'Mangia');
        this.addFurniture('chair', tx + 2, ty, 'Siediti');
      }
      this.addFurniture('fridge', 3, 11, 'Frigo');
      this.addFurniture('plant', 21, 11, 'Piante');
      return;
    }

    if (this.template === 'fish') {
      this.addFurniture('fridge', 3, 3, 'Vetrina pesce');
      this.addFurniture('stove', 7, 3, 'Cucina');
      this.addFurniture('register', 18, 3, 'Cassa');
      for (const [tx, ty] of [[5, 10], [11, 10], [17, 10]] as const) {
        this.addFurniture('table', tx, ty, 'Mangia');
        this.addFurniture('chair', tx + 2, ty, 'Siediti');
      }
      this.addFurniture('plant', 21, 4, 'Piante');
      return;
    }

    if (this.template === 'supermarket') {
      for (const tx of [3, 7, 11, 15]) {
        this.addFurniture('shelf', tx, 4, 'Scaffale');
        this.addFurniture('shelf', tx, 8, 'Scaffale');
      }
      this.addFurniture('fridge', 3, 12, 'Frigo');
      this.addFurniture('register', 20, 12, 'Cassa');
      this.addFurniture('plant', 20, 4, 'Piante');
      return;
    }

    if (this.template === 'tobacco') {
      this.addFurniture('shelf', 3, 3, 'Tabacchi');
      this.addFurniture('shelf', 8, 3, 'Giornali');
      this.addFurniture('register', 18, 4, 'Cassa');
      this.addFurniture('shelf', 3, 11, 'Scaffale');
      this.addFurniture('desk', 12, 11, 'Ritira');
      this.addFurniture('plant', 20, 11, 'Piante');
      return;
    }

    if (this.template === 'church') {
      this.addFurniture('shelf', 11, 3, 'Altare');
      this.addFurniture('register', 18, 3, 'Offerte');
      for (const tx of [4, 8, 12, 16, 20]) this.addFurniture('sofa', tx, 9, 'Prega');
      this.addFurniture('plant', 3, 4, 'Annaffia');
      this.addFurniture('plant', 21, 4, 'Annaffia');
      return;
    }

    if (this.template === 'workshop') {
      this.addFurniture('shelf', 3, 3, 'Ricambi');
      this.addFurniture('desk', 10, 3, 'Ripara');
      this.addFurniture('register', 18, 11, 'Cassa');
      this.addFurniture('table', 5, 10, 'Ripara');
      this.addFurniture('chair', 8, 10, 'Siediti');
      this.addFurniture('fridge', 21, 3, 'Frigo');
      return;
    }

    if (this.template === 'pharmacy') {
      this.addFurniture('shelf', 3, 3, 'Scaffale');
      this.addFurniture('shelf', 8, 3, 'Scaffale');
      this.addFurniture('fridge', 14, 3, 'Farmaci');
      this.addFurniture('register', 18, 5, 'Cassa');
      this.addFurniture('plant', 13, 11, 'Piante');
      this.addFurniture('table', 5, 11, 'Attendi');
      return;
    }

    if (this.template === 'hotel') {
      this.addFurniture('register', 5, 3, 'Cassa');
      this.addFurniture('desk', 10, 3, 'Check-in');
      this.addFurniture('shelf', 19, 3, 'Bagagli');
      for (const tx of [4, 9, 14, 19]) {
        this.addFurniture('bed', tx, 10, 'Dormi');
        this.addFurniture('plant', tx + 2, 10, 'Piante');
      }
      return;
    }

    if (this.template === 'lido') {
      this.addFurniture('register', 4, 3, 'Cassa');
      this.addFurniture('fridge', 9, 3, 'Frigo');
      this.addFurniture('shelf', 19, 3, 'Attrezzatura');
      for (const [tx, ty] of [[5, 9], [11, 9], [17, 9]] as const) {
        this.addFurniture('chair', tx, ty, 'Prendersole');
        this.addFurniture('table', tx + 2, ty, 'Siediti');
      }
      this.addFurniture('plant', 21, 12, 'Piante');
      return;
    }

    if (this.template === 'station') {
      this.addFurniture('register', 5, 3, 'Biglietti');
      this.addFurniture('shelf', 11, 3, 'Orari');
      this.addFurniture('desk', 18, 3, 'Ricevimento');
      for (const tx of [4, 9, 14, 19]) this.addFurniture('chair', tx, 10, 'Siediti');
      this.addFurniture('plant', 21, 11, 'Piante');
      return;
    }

    if (this.template === 'fuel') {
      this.addFurniture('register', 5, 3, 'Cassa');
      this.addFurniture('shelf', 10, 3, 'Ricambi');
      this.addFurniture('fridge', 15, 3, 'Bevande');
      this.addFurniture('desk', 20, 3, 'Ricevimento');
      this.addFurniture('table', 8, 10, 'Ripara');
      this.addFurniture('plant', 20, 11, 'Piante');
      return;
    }

    if (this.template === 'bank' || this.template === 'post_office') {
      this.addFurniture('register', 6, 4, 'Sportello');
      this.addFurniture('register', 12, 4, 'Sportello');
      this.addFurniture('shelf', 19, 7, 'Modulistica');
      this.addFurniture('table', 8, 10, 'Attendi');
      this.addFurniture('chair', 11, 10, 'Siediti');
      return;
    }

    this.addFurniture('shelf', 3, 4, 'Scaffale');
    this.addFurniture('shelf', 9, 4, 'Scaffale');
    this.addFurniture('shelf', 15, 4, 'Scaffale');
    this.addFurniture('register', 18, 11, 'Cassa');
    this.addFurniture('fridge', 3, 11, 'Frigo');
    this.addFurniture('plant', 21, 4, 'Piante');
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
    if (this.staff && Phaser.Math.Distance.Between(
      this.player.x, this.player.y, this.staff.x, this.staff.y,
    ) < 64) {
      this.openStaffDialogue();
      return;
    }
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
      const dining = ['bar', 'pizzeria', 'fish'].includes(this.template);
      if (seatId && dining) sat = occupySeat(this.seats, seatId, this.data2.name);
      if (seatId && !sat && dining) {
        this.hud.toast('Quel posto è occupato');
        return;
      }
      const drank = this.template === 'bar' ? consumeItem(this.state, 'caffe') : false;
      if (!drank) this.state.player.energy = Math.min(100, this.state.player.energy + 6);
      const bonus = familyActivity(this.state.family, 'tv');
      this.hud.openInfo(sat ? 'Posto a sedere' : 'TV', [
        sat ? 'Ti sei seduto al tavolino.' : 'Passa un film italiano degli anni ’90 in onda sul canale locale.',
        drank ? 'Hai bevuto un caffè: energia +8.' : '',
        this.state.family.length ? `Serate in famiglia: umore +${bonus}.` : '',
      ].filter(Boolean), [{ label: 'Ok', action: () => this.hud.closePanel() }]);
    } else if (action === 'Mangia' || action === 'Cucina') {
      const item: ItemId = this.template === 'home' ? 'spesa'
        : this.template === 'fish' ? 'pesce' : 'pizza';
      const ate = consumeItem(this.state, item);
      if (!ate) {
        this.hud.toast(`Non hai ${ITEM_CATALOG[item].name.toLowerCase()}: acquistalo o ordina dal telefono`);
        return;
      }
      const bonus = familyActivity(this.state.family, 'meal');
      this.hud.openInfo('Cucina', [
        `Hai mangiato: ${item === 'spesa' ? 'una cena preparata in casa' : ITEM_CATALOG[item].name}.`,
        this.state.family.length ? `Pranzo insieme: umore +${bonus}.` : '',
      ].filter(Boolean), [{ label: 'Ok', action: () => this.hud.closePanel() }]);
    } else if (action === 'Lava i panni') {
      if (!useItem(this.state, 'detersivo')) {
        this.hud.toast('Serve del detersivo: lo trovi al negozio');
        return;
      }
      this.advanceTime(30);
      const bonus = familyActivity(this.state.family, 'walk');
      this.hud.openInfo('Lavatrice', [
        'Bucato profumato: hai usato una lavatrice di casa.',
        this.state.family.length ? `Umore +${bonus} · ${this.timeSystem?.clock ?? ''}` : '',
      ].filter(Boolean), [{ label: 'Ok', action: () => this.hud.closePanel() }]);
    } else if (action === 'Scalda') {
      if (!consumeItem(this.state, 'pizza')) {
        this.hud.toast('Non hai nulla da scalare: compra una pizza');
        return;
      }
      this.advanceTime(5);
      this.state.player.hunger = Math.min(100, this.state.player.hunger + 18);
      this.hud.openInfo('Microonde', ['Pizza calda e fame +18.'], [
        { label: 'Ok', action: () => this.hud.closePanel() },
      ]);
    } else if (action === 'Scrivi') {
      this.advanceTime(15);
      this.state.player.energy = Math.max(0, this.state.player.energy - 3);
      this.hud.openInfo('Scrivania', [
        'Hai aggiornato il curriculum e letto le offerte di lavoro locali.',
        `Lavoro attuale: ${this.state.jobState?.title ?? 'nessuno'} · ${this.timeSystem?.clock ?? ''}`,
      ], [{ label: 'Ok', action: () => this.hud.closePanel() }]);
    } else if (action === 'Culla') {
      const baby = this.state.family.find((member) => member.child && member.age < 2);
      if (!baby) { this.hud.toast('La culla è vuota'); return; }
      baby.mood = Math.min(100, baby.mood + 12);
      this.advanceTime(10);
      this.hud.openInfo('Culla', [`${baby.name} si è addormentato sereno.`], [
        { label: 'Ok', action: () => this.hud.closePanel() },
      ]);
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
    } else if (action === 'Forno a legna') {
      if (!consumeItem(this.state, 'spesa')) {
        this.hud.toast('Serve la spesa per preparare la pizza');
        return;
      }
      this.advanceTime(15);
      this.state.inventory.pizza = (this.state.inventory.pizza ?? 0) + 1;
      this.hud.openInfo('Forno a legna', [
        'Hai preparato una pizza margherita con farina, pomodoro e basilico locali.',
        `Ora sono le ${this.timeSystem?.clock ?? ''}.`,
      ], [{ label: 'Ok', action: () => this.hud.closePanel() }]);
    } else if (action === 'Vetrina pesce' || action === 'Tabacchi' || action === 'Giornali'
      || action === 'Ritira' || action === 'Farmaci') {
      this.openShop(action);
    } else if (action === 'Prega' || action === 'Altare') {
      this.advanceTime(10);
      this.state.player.energy = Math.min(100, this.state.player.energy + 4);
      const bonus = familyActivity(this.state.family, 'walk');
      this.hud.openInfo(action === 'Prega' ? 'Preghiera' : 'Altare', [
        'Un momento di silenzio nella chiesa del paese.',
        this.state.family.length ? `Umore condiviso +${bonus}.` : '',
      ].filter(Boolean), [{ label: 'Amen', action: () => this.hud.closePanel() }]);
    } else if (action === 'Offerte') {
      const wallet = this.wallet();
      if (!buy(wallet, 'candela')) { this.hud.toast('Offerta non disponibile'); return; }
      this.sync(wallet);
      this.advanceTime(5);
      this.hud.openInfo('Offerte', ['Hai acceso una candela votiva.'], [
        { label: 'Ok', action: () => this.hud.closePanel() },
      ]);
    } else if (action === 'Ripara' || action === 'Ricambi') {
      this.repairVehicle();
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

  private openShop(title: string): void {
    const wallet = this.wallet();
    this.hud.openShop(title === 'Vetrina pesce' ? 'Pescheria' : this.data2.name, wallet, {
      buy: (item: ItemId) => {
        const ok = buy(wallet, item);
        this.sync(wallet);
        this.hud.toast(ok ? `Acquistato: ${ITEM_CATALOG[item].name}` : 'Denaro insufficiente');
      },
      sell: (item: ItemId) => { sell(wallet, item); this.sync(wallet); },
      exit: () => this.hud.closePanel(),
    });
  }

  private repairVehicle(): void {
    const vehicle = this.state.vehicles.find((item) => (item.condition ?? 100) < 100);
    if (!vehicle) { this.hud.toast('I veicoli sono già in ordine'); return; }
    const price = 25;
    if (this.state.player.money < price) {
      this.hud.toast(`Serve € ${price} per la riparazione`);
      return;
    }
    this.state.player.money -= price;
    vehicle.condition = 100;
    vehicle.lastServiceDay = this.state.day;
    this.advanceTime(45);
    this.hud.openInfo('Officina', [
      `${vehicle.name} riparata: € ${price}.`,
      `Condition 100 · ${this.timeSystem?.clock ?? ''}`,
    ], [{ label: 'Grazie', action: () => this.hud.closePanel() }]);
  }

  private openStaffDialogue(): void {
    const lines: Partial<Record<InteriorTemplate, string[]>> = {
      bar: ['Il barista è napoletano doc: caffè forte e cornetto appena sfornato.', 'Ti consiglia il caffè della mattina.'],
      pizzeria: ['Il pizzaiolo stende l’impasto davanti al forno a legna.', 'Margherita, marinara o pizza di ricotta: scegli dal banco.'],
      fish: ['Il pescivendolo ha il pesce di Miseno arrivato stamattina.', 'Ti spiega quale cottura si addice al pesce azzurro.'],
      supermarket: ['Il commesso riordina gli scaffali e controlla le scadenze.', 'C’è un reparto frutta e verdura locale.'],
      tobacco: ['Il tabaccaio vende quotidiani, sigarette e francobolli.', 'Puoi ritirare anche le ricette.'],
      workshop: ['Il meccanico ha il Scanner EAV pronto per la manutenzione.', 'Controlla olio, freni e gomme prima del viaggio.'],
      pharmacy: ['Il farmacista consiglia protezione solare per la spiaggia.', 'Puoi acquistare farmaci da banco.'],
      bank: ['L’operatore ti illustra mutui e risparmio.', 'Lo sportello è operativo negli orari di apertura.'],
      post_office: ['L’addetto ti consegna moduli e francobolli.', 'Puoi spedire una cartolina dal lungomare.'],
      shop: ['Il negoziante conosce tutti i prodotti tipici del posto.', 'Chiedi pure consigli sui souvenir.'],
      generic: ['Il personale è disponibile al banco.', 'Puoi acquistare i prodotti esposti.'],
    };
    this.interactionCount++;
    this.hud.openInfo('Personale', lines[this.template] ?? lines.generic!, [
      { label: 'Acquista', action: () => { this.hud.closePanel(); this.openShop('Personale'); } },
      { label: 'Grazie', action: () => this.hud.closePanel() },
    ]);
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
    const home = activeHome(this.state);
    const entries = Object.entries(FURNITURE_CATALOG) as [FurnitureId, typeof FURNITURE_CATALOG[FurnitureId]][];
    const buttons = entries.map(([id, spec]) => ({
      label: `${spec.name} · € ${spec.price}${home.furniture.includes(id) ? ' ✓' : ''}`,
      action: () => {
        const wallet = this.wallet();
        const ok = home.furniture.includes(id) ? false : buyFurniture(home, wallet, id);
        this.sync(wallet);
        this.hud.toast(ok ? `${spec.name} aggiunto a casa` : 'Già posseduto o denaro insufficiente');
        // Il nuovo arredo diventa subito visibile e utilizzabile nella stanza.
        this.scene.restart(this.data2);
      },
    }));
    buttons.push({ label: 'Esci', action: () => this.hud.closePanel() });
    this.hud.openInfo('Arredamento', [
      `Saldo: € ${this.state.player.money.toFixed(2)} · comfort ${homeComfort(home)}`,
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
