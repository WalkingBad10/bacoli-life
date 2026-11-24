import Phaser from 'phaser';
import placesData from '../data/bacoli_places.json';
import { CAMERA_ZOOM, ITEM_CATALOG, PLAYER_SPEED, RUN_MULTIPLIER, type ItemId } from '../core/config';
import type { Direction, GameState, Place, VehicleState } from '../core/types';
import { Hud } from '../ui/Hud';
import { TimeSystem } from '../systems/TimeSystem';
import { buy, deposit, sell, withdraw, type Wallet } from '../systems/Economy';
import { findPath } from '../systems/Pathfinding';
import { decodeExport, defaultVehicles, encodeExport, loadGame, normalize, saveGame } from '../systems/SaveSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { CollisionSystem } from '../systems/CollisionSystem';
import { buyVehicle, canDrive, consumeFuel, refuel, VEHICLE_CATALOG } from '../systems/VehicleSystem';
import { LINES, STATIONS, planTrip, reachableFrom } from '../systems/TransportSystem';
import {
  FURNITURE_CATALOG, advanceFamily, buyFurniture, createJob, familyActivity,
  startFamily, workShift, type FurnitureId,
} from '../systems/LifeSystem';

const DATA = placesData as unknown as {
  size: { width: number; height: number };
  spawn: { x: number; y: number };
  places: Place[];
};

interface NpcData {
  sprite: Phaser.GameObjects.Sprite;
  key: string;
  name: string;
  path: { x: number; y: number }[];
  speed: number;
  dialogue: string[];
}

const DIALOGUES = [
  'Bella giornata, eh? Mo’ vene ’a brezza da Miseno.',
  'I’o caffè ’e Bar Pina è ’o meglio ’e Bacoli, fidate!',
  'Hai visto ’a piazzetta? ’A sera ce sta sempe quarcuno.',
  'Domani c’è ’o mercato. Porta ’a borsa!',
  'Io vado a Via Spiaggia, fa’ attenzione alle buche.',
  'Ca’ è tutto più bello quanno c’è ’o sole.',
  'A Fusaro ’o tram passes ogni dieci minute, dice.',
  'Miseno è bello, ma ’a salita te la sente!',
];
const NPC_NAMES = [
  'Maria', 'Pasquale', 'Giuseppina', 'Ciro', 'Alessia', 'Rocco',
  'Concetta', 'Enzo', 'Assunta', 'Gennaro', 'Nunzia', 'Peppe',
];
const NPC_KEYS = ['npc_1', 'npc_2', 'npc_3', 'npc_4', 'npc_5', 'npc_6', 'npc_7', 'npc_8'];

export class WorldScene extends Phaser.Scene {
  private readonly timeSystem = new TimeSystem();
  private readonly audio = new AudioSystem();
  private hud!: Hud;
  private player!: Phaser.GameObjects.Sprite;
  private map!: Phaser.Tilemaps.Tilemap;
  private collision!: CollisionSystem;
  private blocked!: Uint8Array;
  private width = DATA.size.width;
  private height = DATA.size.height;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private facing: Direction = 'down';
  private npcs: NpcData[] = [];
  private overlay!: Phaser.GameObjects.Rectangle;
  private lamps: Phaser.GameObjects.Image[] = [];
  private rain?: Phaser.GameObjects.Particles.ParticleEmitter;
  private waterTiles: Phaser.Tilemaps.Tile[] = [];
  private waterTimer = 0;
  private autosaveTimer = 0;
  private lastInteract = 0;
  private lastBellHour = -1;
  private traffic: VehicleState[] = [];
  private vehicleSprites = new Map<string, Phaser.GameObjects.Image>();
  private driving: VehicleState | null = null;
  private state: GameState;

  constructor() {
    super('World');
    const saved = loadGame();
    this.state = saved ?? normalize({
      player: {
        x: DATA.spawn.x * 16 + 8, y: DATA.spawn.y * 16 + 16,
        money: 500, savings: 0, energy: 100, hunger: 100,
        job: null, homeId: 'home-1',
      },
      inventory: {}, relationships: {}, time: 8 * 60, day: 1, weather: 'sun',
      home: { owned: false, address: 'Via Ortensio 12', furniture: [], upgrades: [] },
      family: [], vehicles: defaultVehicles(), jobState: null,
      transport: { ticketBus: 0, ticketTrain: 0, monthlyPass: false, lastTrip: null },
      stats: { distanceWalked: 0, distanceDriven: 0, npcsMet: 0 },
    });
    this.timeSystem.minutes = this.state.time;
    this.timeSystem.day = this.state.day;
    this.timeSystem.weather = this.state.weather;
  }

  create(): void {
    const uiRoot = document.createElement('div');
    document.body.appendChild(uiRoot);
    this.hud = new Hud(uiRoot);
    this.registry.set('hud', this.hud);
    this.registry.set('state', this.state);

    this.map = this.make.tilemap({ key: 'bacoli' });
    const tileset = this.map.addTilesetImage('base', 'tileset.png');
    if (!tileset) throw new Error('Tileset non caricato');
    this.map.createLayer('ground', tileset, 0, 0);
    this.loadCollision();

    this.spawnProps();
    this.spawnPlayer();
    this.setupCamera();
    // Gli ostacoli fissi (panchine, lampioni) devono esistere prima dei veicoli,
    // altrimenti questi ultimi possono nascere dentro un palo.
    this.setupAtmosphere();
    this.spawnVehicles();
    this.spawnTraffic();
    this.spawnNpcs();

    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,E,T,ESC,I,O,V',
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.once('keydown', () => this.audio.start());
    this.input.once('pointerdown', () => this.audio.start());

    this.input.keyboard!.on('keydown-E', () => this.interact());
    this.input.keyboard!.on('keydown-V', () => this.toggleVehicle());
    this.input.keyboard!.on('keydown-T', () => this.openPhone());
    this.input.keyboard!.on('keydown-ESC', () => this.hud.closePanel());
    this.input.keyboard!.on('keydown-I', () => this.exportSave());
    this.input.keyboard!.on('keydown-O', () => this.importSave());

    this.hud.onInteract = () => this.interact();
    this.hud.onPhone = () => this.openPhone();
    this.hud.onSave = () => { this.syncState(); saveGame(this.state); this.hud.toast('Partita salvata'); };
    this.hud.onLoad = () => {
      const loaded = loadGame();
      if (!loaded) { this.hud.toast('Nessun salvataggio trovato'); return; }
      this.state = normalize(loaded);
      this.registry.set('state', this.state);
      this.player.setPosition(this.state.player.x, this.state.player.y);
      this.timeSystem.minutes = this.state.time;
      this.timeSystem.day = this.state.day;
      this.timeSystem.weather = this.state.weather;
      this.syncVehicleSprites();
      this.hud.toast('Partita caricata');
    };

    (window as unknown as { __bacoliDebug?: () => Record<string, unknown> }).__bacoliDebug = () => ({
      player: { x: this.player.x, y: this.player.y },
      npcs: this.npcs.map((n) => ({ x: n.sprite.x, y: n.sprite.y, name: n.name })),
      places: DATA.places.length,
      time: this.timeSystem.clock,
      walkingNpcs: this.npcs.filter((n) => n.path.length > 0).length,
      vehicles: this.state.vehicles.length,
      traffic: this.traffic.length,
      driving: this.driving?.id ?? null,
      fuel: this.driving?.fuel ?? null,
      homeOwned: this.state.home.owned,
      job: this.state.jobState?.title ?? null,
      solidTiles: this.blocked.reduce((sum, value) => sum + value, 0),
    });

    // Hook dedicato ai test E2E: permette di verificare collisioni, guida e
    // viaggi senza affidarsi a sequenze di tasti fragili.
    (window as unknown as { __bacoliTest?: Record<string, unknown> }).__bacoliTest = {
      teleport: (x: number, y: number) => { this.player.setPosition(x, y); },
      canStand: (x: number, y: number, radius = 5) => this.canStand(x, y, radius),
      enterVehicle: () => this.toggleVehicle(),
      travel: (id: string) => this.travel(id),
      giveTickets: () => {
        this.state.inventory.biglietto_bus = (this.state.inventory.biglietto_bus ?? 0) + 5;
        this.state.inventory.biglietto_treno = (this.state.inventory.biglietto_treno ?? 0) + 5;
      },
      giveMoney: (amount: number) => { this.state.player.money += amount; this.syncWallet(); },
      player: () => ({ x: this.player.x, y: this.player.y }),
      lastTrip: () => this.state.transport.lastTrip,
      reachable: () => reachableFrom('bacoli_centro').map((station) => station.id),
      vehicles: () => this.state.vehicles.map((v) => ({ id: v.id, x: v.x, y: v.y, fuel: v.fuel })),
      findWall: () => {
        for (let ty = 2; ty < this.height - 2; ty++) {
          for (let tx = 2; tx < this.width - 2; tx++) {
            if (this.collision.isSolidTile(tx, ty)
              && !this.collision.isSolidTile(tx - 1, ty)
              && !this.collision.isSolidTile(tx - 2, ty)) {
              return {
                solidX: tx * 16 + 8, solidY: ty * 16 + 8,
                startX: (tx - 2) * 16 + 8, startY: ty * 16 + 8,
                boundary: tx * 16,
              };
            }
          }
        }
        return null;
      },
    };

    this.events.once('shutdown', () => {
      this.syncState();
      saveGame(this.state);
      uiRoot.remove();
    });
  }

  private loadCollision(): void {
    const raw = this.cache.json.get('mapdata') as {
      layers: { name: string; data: number[] }[];
    };
    const layer = raw.layers.find((l) => l.name === 'collision');
    this.blocked = new Uint8Array(this.width * this.height);
    layer?.data.forEach((value, index) => {
      this.blocked[index] = value === 1 ? 1 : 0;
    });
    this.collision = new CollisionSystem(this.width, this.height, this.blocked, DATA.places);
  }

  private walkable(tx: number, ty: number): boolean {
    return !this.collision.isSolidTile(tx, ty);
  }

  private canStand(px: number, py: number, radius = 5): boolean {
    return this.collision.canStand(px, py, radius);
  }

  /** Cerca una piazzola libera con abbastanza spazio per un veicolo. */
  private findVehicleSpot(tx: number, ty: number): { x: number; y: number } {
    for (let ring = 0; ring <= 8; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (ring > 0 && Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
          const cx = tx + dx;
          const cy = ty + dy;
          if (cx < 2 || cy < 2 || cx >= this.width - 2 || cy >= this.height - 2) continue;
          const x = cx * 16 + 8;
          const y = cy * 16 + 16;
          if (this.canStand(x, y, 10)) return { x, y };
        }
      }
    }
    return { x: tx * 16 + 8, y: ty * 16 + 16 };
  }

  private spawnPlayer(): void {
    this.player = this.add.sprite(this.state.player.x, this.state.player.y, 'player');
    this.player.setOrigin(0.5, 1);
    this.player.setDepth(this.player.y);
    if (!this.canStand(this.player.x, this.player.y)) {
      this.player.setPosition(DATA.spawn.x * 16 + 8, DATA.spawn.y * 16 + 16);
    }
  }

  private addProp(key: string, tx: number, ty: number, solidRadius = 0): void {
    if (!this.walkable(tx, ty)) return;
    const x = tx * 16 + 8;
    const y = ty * 16 + 16;
    this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y);
    if (solidRadius) this.collision.addSolid({ x, y: y - 8, radius: solidRadius });
  }

  private spawnProps(): void {
    for (let i = 0; i < DATA.places.length; i += 3) {
      const place = DATA.places[i];
      const key = place.kind === 'archaeological_site' ? 'olive_tree' : 'palm';
      const img = this.add.image(place.x * 16 + 8, place.y * 16 + 16, key);
      img.setOrigin(0.5, 1).setScale(0.55).setAlpha(0.9).setDepth(place.y * 16);
    }
    DATA.places.forEach((place) => {
      const bbox = place.footprint;
      if (!bbox.length) return;
      const maxY = Math.max(...bbox.map((p) => p[1]));
      const minX = Math.min(...bbox.map((p) => p[0]));
      const maxX = Math.max(...bbox.map((p) => p[0]));
      const widthPx = Math.max(32, Math.min(80, (maxX - minX + 1) * 16));
      const img = this.add.image(
        (minX + maxX + 1) * 8, (maxY + 1) * 16 + 10, `building_${place.sprite}`,
      );
      img.setOrigin(0.5, 1);
      img.setDisplaySize(widthPx, widthPx * 1.2);
      img.setDepth((maxY + 1) * 16 + 2);
    });

    // Dettagli ambientali nelle strade attorno allo spawn e alla piazzetta.
    const props: [string, number, number, number][] = [
      ['flowerpot', -3, -1, 0], ['flowerpot', 4, 2, 0], ['trash_bin', -2, 4, 5],
      ['bench', -5, 3, 7], ['street_sign', 2, -3, 0], ['parking_sign', 6, 3, 0],
      ['flowerpot', 10, -4, 0], ['trash_bin', -7, -2, 5], ['bench', 12, 6, 7],
    ];
    for (const [key, dx, dy, radius] of props) {
      this.addProp(key, DATA.spawn.x + dx, DATA.spawn.y + dy, radius);
    }
  }

  private vehicleSpriteKey(vehicle: VehicleState): string {
    if (vehicle.kind === 'moto') return 'moto';
    if (vehicle.kind === 'bus') return 'bus';
    const colors = ['car_white', 'car_blue', 'car_red', 'car_yellow'];
    const index = colors.indexOf(vehicle.color);
    return colors[index < 0 ? 0 : index];
  }

  private createVehicleSprite(vehicle: VehicleState, depth = true): Phaser.GameObjects.Image {
    const sprite = this.add.image(vehicle.x, vehicle.y, this.vehicleSpriteKey(vehicle));
    sprite.setOrigin(0.5, 0.8);
    if (depth) sprite.setDepth(vehicle.y);
    this.vehicleSprites.set(vehicle.id, sprite);
    return sprite;
  }

  private spawnVehicles(): void {
    if (!this.state.vehicles.length) this.state.vehicles = defaultVehicles();
    let index = 0;
    for (const vehicle of this.state.vehicles) {
      const tx = DATA.spawn.x + (index % 2 === 0 ? -1 : 1) * (2 + index);
      const ty = DATA.spawn.y + 3 + Math.floor(index / 2) * 2;
      const spot = this.findVehicleSpot(tx, ty);
      vehicle.x = vehicle.x || spot.x;
      vehicle.y = vehicle.y || spot.y;
      if (!this.canStand(vehicle.x, vehicle.y, 10)) {
        vehicle.x = spot.x;
        vehicle.y = spot.y;
      }
      this.createVehicleSprite(vehicle);
      this.collision.addSolid({ id: vehicle.id, x: vehicle.x, y: vehicle.y, radius: 9 });
      index++;
    }
  }

  private spawnTraffic(): void {
    for (let i = 0; i < 4; i++) {
      const bus = i === 0;
      const vehicle: VehicleState = {
        id: `traffic-${i}`, kind: bus ? 'bus' : (i % 2 ? 'car' : 'moto'),
        name: bus ? 'Bus EAV' : 'Traffico',
        x: (DATA.spawn.x + (i - 2) * 6) * 16 + 8,
        y: (DATA.spawn.y + 5) * 16 + 16,
        angle: 0, fuel: 99, maxFuel: 99, color: ['', '#F2EAD8', '#3A6EA5', '#B1403B'][i] ?? '',
        owned: false,
      };
      const spot = this.findVehicleSpot(
        Math.floor(vehicle.x / 16), Math.floor(vehicle.y / 16),
      );
      if (!this.canStand(spot.x, spot.y, 10)) continue;
      vehicle.x = spot.x;
      vehicle.y = spot.y;
      this.traffic.push(vehicle);
      this.createVehicleSprite(vehicle);
    }
  }

  private syncVehicleSprites(): void {
    [...this.state.vehicles, ...this.traffic].forEach((vehicle) => {
      this.vehicleSprites.get(vehicle.id)?.setPosition(vehicle.x, vehicle.y);
    });
  }

  private spawnNpcs(): void {
    for (let i = 0; i < NPC_NAMES.length; i++) {
      const key = NPC_KEYS[i % NPC_KEYS.length];
      let tx = DATA.spawn.x + ((i % 7) - 3) * 3;
      let ty = DATA.spawn.y + 2 + Math.floor(i / 7) * 3;
      if (!this.walkable(tx, ty)) { tx = DATA.spawn.x; ty = DATA.spawn.y; }
      const sprite = this.add.sprite(tx * 16 + 8, ty * 16 + 16, key);
      sprite.setOrigin(0.5, 1).setScale(0.9);
      this.npcs.push({
        sprite, key, name: NPC_NAMES[i], path: [], speed: 32 + (i % 5) * 5,
        dialogue: [DIALOGUES[i % DIALOGUES.length], DIALOGUES[(i + 3) % DIALOGUES.length]],
      });
    }
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.width * 16, this.height * 16);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.setZoom(CAMERA_ZOOM);
    cam.setBackgroundColor('#185f76');
  }

  private setupAtmosphere(): void {
    const cam = this.cameras.main;
    this.overlay = this.add.rectangle(0, 0, cam.width, cam.height, 0x0c1823, 0);
    this.overlay.setOrigin(0, 0).setScrollFactor(0).setDepth(9000);

    for (let i = 0; i < 9; i++) {
      const x = DATA.spawn.x * 16 + ((i % 3) - 1) * 160;
      const y = DATA.spawn.y * 16 + 64 + Math.floor(i / 3) * 96;
      if (!this.walkable(Math.floor(x / 16), Math.floor(y / 16))) continue;
      const lamp = this.add.image(x, y, 'lamp').setOrigin(0.5, 1).setDepth(y + 1);
      const glow = this.add.image(x, y - 40, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(y);
      glow.setAlpha(0);
      this.lamps.push(lamp);
      lamp.setData('glow', glow);
      this.collision.addSolid({ x, y: y - 8, radius: 3 });
    }

    const ground = this.map.getLayer('ground');
    if (ground) {
      const layer = ground.tilemapLayer;
      layer?.forEachTile((tile) => {
        if (tile.index >= 8 && tile.index <= 11 && this.waterTiles.length < 1400) {
          this.waterTiles.push(tile);
        }
      });
    }

    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      this.overlay.setSize(size.width, size.height);
    });
    this.applyWeather();
  }

  private applyWeather(): void {
    if (this.rain) {
      this.rain.destroy();
      this.rain = undefined;
    }
    if (this.timeSystem.weather === 'rain') {
      this.rain = this.add.particles(0, 0, 'raindrop', {
        x: { min: -200, max: this.scale.width + 200 },
        y: -20,
        speedY: { min: 480, max: 720 },
        speedX: { min: -60, max: -20 },
        lifespan: 1600,
        quantity: 3,
        frequency: 30,
      });
      this.rain.setScrollFactor(0).setDepth(9500);
    }
  }

  update(_time: number, delta: number): void {
    if (this.hud.panelOpen) {
      this.player.anims.stop();
      return;
    }
    this.timeSystem.update(delta);
    this.state.time = this.timeSystem.minutes;
    this.state.day = this.timeSystem.day;
    this.state.weather = this.timeSystem.weather;
    this.state.player.hunger = Math.max(0, this.state.player.hunger - delta * 0.00005);
    advanceFamily(this.state.family, delta / 3_600_000);

    const daylight = this.timeSystem.daylight;
    this.audio.setWeather(this.timeSystem.weather);
    this.audio.setNight(this.timeSystem.isNight);
    if (this.timeSystem.hour !== this.lastBellHour) {
      this.lastBellHour = this.timeSystem.hour;
      if ([7, 12, 18].includes(this.lastBellHour)) this.audio.ringBell();
    }
    this.overlay.setAlpha((1 - daylight) * 0.62);
    this.lamps.forEach((lamp) => {
      const glow = lamp.getData('glow') as Phaser.GameObjects.Image | undefined;
      if (glow) glow.setAlpha((1 - daylight) * 0.85);
    });

    this.waterTimer += delta;
    if (this.waterTimer > 280) {
      this.waterTimer = 0;
      this.waterTiles.forEach((tile) => {
        tile.index = 8 + ((tile.index - 7) % 4);
      });
    }

    this.movePlayer(delta);
    this.updateNpcs(delta);
    this.updateTraffic(delta);

    this.autosaveTimer += delta;
    if (this.autosaveTimer > 45_000) {
      this.autosaveTimer = 0;
      this.syncState();
      saveGame(this.state);
    }
    this.hud.update(this.state, this.timeSystem);
  }

  private inputVector(): { dx: number; dy: number; fast: boolean } {
    const k = this.keys;
    let dx = (k.D?.isDown || k.RIGHT?.isDown ? 1 : 0) - (k.A?.isDown || k.LEFT?.isDown ? 1 : 0);
    let dy = (k.S?.isDown || k.DOWN?.isDown ? 1 : 0) - (k.W?.isDown || k.UP?.isDown ? 1 : 0);
    dx += this.hud.move.x;
    dy += this.hud.move.y;
    return { dx, dy, fast: k.SHIFT?.isDown || this.hud.running };
  }

  private movePlayer(delta: number): void {
    const { dx, dy, fast } = this.inputVector();
    if (dx === 0 && dy === 0) {
      if (!this.driving) {
        this.player.anims.stop();
        this.player.setFrame(this.faceFrame());
      }
      return;
    }
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    if (this.driving) {
      if (!canDrive(this.driving)) {
        this.hud.toast('Carburante esaurito: scendi dal veicolo');
        this.toggleVehicle();
        return;
      }
      const speed = VEHICLE_CATALOG[this.driving.kind].speed * (delta / 1000);
      const beforeX = this.player.x;
      const beforeY = this.player.y;
      const drivingId = this.driving.id;
      const moved = this.collision.move(beforeX, beforeY, nx * speed, ny * speed, 9, drivingId);
      const distance = Math.hypot(moved.x - beforeX, moved.y - beforeY);
      this.player.setPosition(moved.x, moved.y);
      this.driving.x = moved.x;
      this.driving.y = moved.y;
      this.collision.updateSolid(drivingId, moved.x, moved.y);
      consumeFuel(this.driving, distance);
      this.state.stats.distanceDriven += distance;
      const sprite = this.vehicleSprites.get(drivingId);
      sprite?.setPosition(moved.x, moved.y).setDepth(moved.y);
      return;
    }
    const speed = PLAYER_SPEED * (fast ? RUN_MULTIPLIER : 1) * (delta / 1000);
    const beforeX = this.player.x;
    const beforeY = this.player.y;
    const moved = this.collision.move(beforeX, beforeY, nx * speed, ny * speed, 5);
    this.player.setPosition(moved.x, moved.y);
    this.state.stats.distanceWalked += Math.hypot(moved.x - beforeX, moved.y - beforeY);
    this.facing = Math.abs(nx) > Math.abs(ny)
      ? (nx > 0 ? 'right' : 'left')
      : (ny > 0 ? 'down' : 'up');
    this.player.anims.play(`walk-${this.facing}-player`, true);
    this.player.setDepth(this.player.y);
    if (fast) this.state.player.energy = Math.max(0, this.state.player.energy - delta * 0.0025);
  }

  private faceFrame(): number {
    return ({ down: 0, left: 4, right: 8, up: 12 })[this.facing];
  }

  private updateNpcs(delta: number): void {
    for (const npc of this.npcs) {
      if (!npc.path.length) {
        const tx = Phaser.Math.Clamp(
          Math.floor(npc.sprite.x / 16) + Phaser.Math.Between(-14, 14), 2, this.width - 3,
        );
        const ty = Phaser.Math.Clamp(
          Math.floor(npc.sprite.y / 16) + Phaser.Math.Between(-14, 14), 2, this.height - 3,
        );
        const from = { x: Math.floor(npc.sprite.x / 16), y: Math.floor(npc.sprite.y / 16) };
        npc.path = findPath(from, { x: tx, y: ty }, (x, y) => this.walkable(x, y));
      }
      const next = npc.path[0];
      if (next) {
        const tx = next.x * 16 + 8;
        const ty = next.y * 16 + 16;
        const angle = Math.atan2(ty - npc.sprite.y, tx - npc.sprite.x);
        const step = npc.speed * (delta / 1000);
        const nx = npc.sprite.x + Math.cos(angle) * step;
        const ny = npc.sprite.y + Math.sin(angle) * step;
        if (Math.hypot(tx - nx, ty - ny) < 4) {
          npc.sprite.setPosition(tx, ty);
          npc.path.shift();
        } else {
          npc.sprite.setPosition(nx, ny);
        }
        const dir: Direction = Math.abs(tx - npc.sprite.x) > Math.abs(ty - npc.sprite.y)
          ? (tx > npc.sprite.x ? 'right' : 'left')
          : (ty > npc.sprite.y ? 'down' : 'up');
        npc.sprite.anims.play(`walk-${dir}-${npc.key}`, true);
        npc.sprite.setDepth(npc.sprite.y);
      } else {
        npc.sprite.anims.stop();
      }
    }
  }

  private updateTraffic(delta: number): void {
    for (const vehicle of this.traffic) {
      const current = { x: Math.floor(vehicle.x / 16), y: Math.floor(vehicle.y / 16) };
      if (!this.walkable(current.x + 1, current.y) && !this.walkable(current.x - 1, current.y)) {
        vehicle.x = (DATA.spawn.x + Phaser.Math.Between(-5, 5)) * 16 + 8;
        vehicle.y = (DATA.spawn.y + 5) * 16 + 16;
      }
      const target = this.walkable(current.x + 2, current.y)
        ? { x: current.x + 2, y: current.y }
        : { x: current.x - 2, y: current.y };
      const step = 26 * (delta / 1000);
      vehicle.x += Math.sign(target.x - current.x) * step;
      const sprite = this.vehicleSprites.get(vehicle.id);
      sprite?.setPosition(vehicle.x, vehicle.y).setDepth(vehicle.y);
      if (vehicle.x > (DATA.spawn.x + 12) * 16 || vehicle.x < (DATA.spawn.x - 12) * 16) {
        vehicle.x = (DATA.spawn.x + Phaser.Math.Between(-8, 8)) * 16 + 8;
        vehicle.y = (DATA.spawn.y + 5) * 16 + 16;
      }
    }
  }

  private nearestPlace(): Place | null {
    let best: Place | null = null;
    let distance = 96;
    for (const place of DATA.places) {
      const d = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, place.x * 16 + 8, place.y * 16 + 16,
      );
      if (d < distance) { distance = d; best = place; }
    }
    return best;
  }

  private nearestVehicle(): VehicleState | null {
    let best: VehicleState | null = null;
    let distance = 42;
    for (const vehicle of this.state.vehicles) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, vehicle.x, vehicle.y);
      if (d < distance) { distance = d; best = vehicle; }
    }
    return best;
  }

  private nearestNpc(): NpcData | null {
    let best: NpcData | null = null;
    let distance = 42;
    for (const npc of this.npcs) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.sprite.x, npc.sprite.y);
      if (d < distance) { distance = d; best = npc; }
    }
    return best;
  }

  private toggleVehicle(): void {
    if (this.driving) {
      this.driving = null;
      this.player.setVisible(true);
      this.player.setFrame(this.faceFrame());
      this.hud.toast('Sei sceso dal veicolo');
      return;
    }
    const vehicle = this.nearestVehicle();
    if (!vehicle) { this.hud.toast('Nessun veicolo nelle vicinanze'); return; }
    if (!canDrive(vehicle)) { this.hud.toast('Il veicolo non è guidabile: controlla il carburante'); return; }
    this.driving = vehicle;
    this.player.setVisible(false);
    this.hud.toast(`Stai guidando: ${vehicle.name}`);
  }

  private interact(): void {
    if (this.time.now - this.lastInteract < 250) return;
    this.lastInteract = this.time.now;
    if (this.hud.panelOpen) { this.hud.closePanel(); return; }
    if (this.driving) { this.toggleVehicle(); return; }
    if (this.nearestVehicle()) { this.toggleVehicle(); return; }

    const npc = this.nearestNpc();
    const place = this.nearestPlace();
    if (npc && (!place || Phaser.Math.Distance.Between(
      this.player.x, this.player.y, npc.sprite.x, npc.sprite.y,
    ) < 42)) {
      const line = Phaser.Math.RND.pick(npc.dialogue);
      this.state.relationships[npc.name] = (this.state.relationships[npc.name] ?? 0) + 1;
      this.state.stats.npcsMet++;
      this.hud.openInfo(npc.name, [line, `<small>Amicizia: ${this.state.relationships[npc.name]}</small>`], [
        { label: 'Ciao!', action: () => this.hud.closePanel() },
      ]);
      return;
    }
    if (!place) {
      this.hud.toast('Nessun luogo, persona o veicolo nelle vicinanze');
      return;
    }
    this.openPlace(place);
  }

  private wallet(): Wallet {
    return {
      money: this.state.player.money,
      savings: this.state.player.savings,
      inventory: this.state.inventory,
    };
  }

  private syncWallet(): void {
    this.state.player.money = this.wallet().money;
    this.state.player.savings = this.wallet().savings;
    this.state.inventory = this.wallet().inventory;
  }

  private buyItem(item: ItemId): void {
    const ok = buy(this.wallet(), item);
    this.syncWallet();
    this.hud.toast(ok ? `Hai comprato: ${ITEM_CATALOG[item].name}` : 'Denaro insufficiente');
    if (ok && item === 'caffe') this.state.player.energy = Math.min(100, this.state.player.energy + 8);
    if (ok && ['pizza', 'cornetto', 'gelato', 'spesa'].includes(item)) {
      this.state.player.hunger = Math.min(100, this.state.player.hunger + 20);
    }
  }

  private enterInterior(place: Place): void {
    this.hud.closePanel();
    this.scene.launch('Interior', {
      kind: place.kind, name: place.name,
      returnX: this.player.x, returnY: this.player.y,
    });
    this.scene.pause();
  }

  private work(place: Place): void {
    if (!this.state.jobState) {
      this.state.jobState = createJob('barista');
      this.state.jobState.workplace = place.name;
      this.state.player.job = this.state.jobState.title;
    }
    const shift = workShift(this.state.jobState, 2);
    this.state.player.money += shift.wage;
    this.state.player.energy = Math.max(0, this.state.player.energy - shift.energyCost);
    this.timeSystem.minutes += shift.hours * 60;
    this.hud.closePanel();
    this.hud.toast(`Turno completato: +€ ${shift.wage.toFixed(2)} · energia -${shift.energyCost}`);
  }

  private travel(destinationId: string): void {
    const current = STATIONS.find((s) => s.id === 'bacoli_centro')!;
    const trip = planTrip(current.id, destinationId);
    if (!trip) { this.hud.toast('Tratta non disponibile'); return; }
    const needed: ItemId = trip.line.startsWith('bus') ? 'biglietto_bus' : 'biglietto_treno';
    if (!this.state.transport.monthlyPass && !(this.state.inventory[needed] > 0)) {
      this.hud.toast(`Serve un ${ITEM_CATALOG[needed].name}`);
      return;
    }
    if (!this.state.transport.monthlyPass) this.state.inventory[needed]--;
    this.state.transport.lastTrip = trip.to.name;
    this.timeSystem.minutes += trip.minutes;
    this.player.setPosition(trip.to.position.x * 16 + 8, trip.to.position.y * 16 + 16);
    if (!this.canStand(this.player.x, this.player.y)) {
      this.player.setPosition(DATA.spawn.x * 16 + 8, DATA.spawn.y * 16 + 16);
    }
    this.hud.closePanel();
    this.hud.toast(`${LINES.find((l) => l.id === trip.line)?.name} → ${trip.to.name}`);
  }

  private openFurnitureShop(place: Place): void {
    const items = Object.entries(FURNITURE_CATALOG) as [FurnitureId, typeof FURNITURE_CATALOG[FurnitureId]][];
    const buttons = items.map(([id, spec]) => ({
      label: `${spec.name} · € ${spec.price}${this.state.home.furniture.includes(id) ? ' ✓' : ''}`,
      action: () => {
        const wallet = this.wallet();
        const ok = this.state.home.furniture.includes(id)
          ? false
          : buyFurniture(this.state.home, wallet, id);
        this.syncWallet();
        this.hud.toast(ok ? `${spec.name} aggiunto a casa` : 'Già posseduto o denaro insufficiente');
        if (ok) familyActivity(this.state.family, 'walk');
        this.openFurnitureShop(place);
      },
    }));
    buttons.push({ label: 'Torna a casa', action: () => this.openPlace(place) });
    this.hud.openInfo('Arredamento', [
      `Saldo: € ${this.state.player.money.toFixed(2)} · arredi: ${this.state.home.furniture.length}/${items.length}`,
    ], buttons);
  }

  private openPlace(place: Place): void {
    const shop = () => {
      this.hud.openShop(place.name, this.wallet(), {
        buy: (item) => this.buyItem(item),
        sell: (item) => { sell(this.wallet(), item); this.syncWallet(); },
        exit: () => this.hud.closePanel(),
      });
    };
    const enter = () => this.enterInterior(place);

    if (place.kind === 'home' || place.kind === 'house') {
      const actions = [
        { label: 'Entra', action: enter },
        { label: 'Arreda casa', action: () => this.openFurnitureShop(place) },
        { label: 'Dormi (energia 100)', action: () => {
          this.state.player.energy = 100;
          this.timeSystem.minutes += 480;
          this.hud.closePanel();
          this.hud.toast('Hai dormito: energia ripristinata');
        } },
        { label: 'Cena con la famiglia', action: () => {
          const bonus = familyActivity(this.state.family, 'meal');
          this.state.player.hunger = Math.min(100, this.state.player.hunger + 30);
          this.hud.closePanel();
          this.hud.toast(this.state.family.length
            ? `Cena condivisa: umore +${bonus}`
            : 'Cena veloce: fame +30');
        } },
        { label: 'Chiudi', action: () => this.hud.closePanel() },
      ];
      if (!this.state.home.owned) {
        actions.unshift({ label: 'Acquista casa (€ 25.000)', action: () => {
          if (this.state.player.money < 25_000) { this.hud.toast('Servono € 25.000'); return; }
          this.state.player.money -= 25_000;
          this.state.home.owned = true;
          this.state.player.homeId = place.id;
          const created = startFamily(this.state.home, this.state.family);
          this.hud.toast(created
            ? 'Ora questa è la tua casa: Giuseppina e Ciro si sono trasferiti con te'
            : 'Ora questa è la tua casa');
          this.openPlace(place);
        } });
      }
      this.hud.openInfo(place.name, [
        this.state.home.owned
          ? `La tua casa · arredi ${this.state.home.furniture.length} · famiglia ${this.state.family.length}`
          : 'Una casa in affitto. Puoi acquistarla quando avrai abbastanza denaro.',
      ], actions);
    } else if (place.kind === 'beach') {
      this.hud.openInfo('Spiaggia', ['L’acqua è limpida e il sole scalda la sabbia.'], [
        { label: 'Fai il bagno', action: () => {
          this.state.player.energy = Math.min(100, this.state.player.energy + 12);
          this.hud.closePanel();
          this.hud.toast('Che ristoro! Energia +12');
        } },
        { label: 'Prendi il sole', action: () => { this.hud.closePanel(); this.hud.toast('Ti sei rilassato sullo schermo'); } },
        { label: 'Chiudi', action: () => this.hud.closePanel() },
      ]);
    } else if (place.kind === 'bank') {
      this.hud.openInfo(place.name, [`Conto: € ${this.state.player.money.toFixed(2)} · Risparmi: € ${this.state.player.savings.toFixed(2)}`], [
        { label: 'Deposita € 20', action: () => { deposit(this.wallet(), 20); this.syncWallet(); this.openPlace(place); } },
        { label: 'Preleva € 20', action: () => { withdraw(this.wallet(), 20); this.syncWallet(); this.openPlace(place); } },
        { label: 'Chiudi', action: () => this.hud.closePanel() },
      ]);
    } else if (place.kind === 'fuel') {
      const vehicle = this.state.vehicles[0];
      this.hud.openInfo(place.name, [
        vehicle ? `${vehicle.name}: ${vehicle.fuel.toFixed(1)}/${vehicle.maxFuel} litri` : 'Nessun veicolo posseduto.',
      ], [
        { label: 'Rifornisci 10 litri', action: () => {
          if (!vehicle) { this.hud.toast('Serve un veicolo'); return; }
          const ok = refuel(vehicle, this.wallet(), 10);
          this.syncWallet();
          this.hud.toast(ok ? 'Serbatoio rifornito' : 'Denaro insufficiente o serbatoio pieno');
          this.openPlace(place);
        } },
        { label: 'Acquista benzina (1 L)', action: () => { this.buyItem('benzina'); this.openPlace(place); } },
        { label: 'Chiudi', action: () => this.hud.closePanel() },
      ]);
    } else if (place.kind === 'dealership') {
      this.hud.openInfo(place.name, ['Concessionaria: scegli il tuo prossimo veicolo.'], [
        { label: 'Compra utilitaria (€ 4.200)', action: () => {
          const id = `car-${this.state.vehicles.length}`;
          const vehicle = buyVehicle(this.wallet(), 'car', id);
          this.syncWallet();
          if (!vehicle) { this.hud.toast('Denaro insufficiente'); return; }
          vehicle.x = this.player.x + 20;
          vehicle.y = this.player.y;
          this.state.vehicles.push(vehicle);
          this.createVehicleSprite(vehicle);
          this.collision.addSolid({ id: vehicle.id, x: vehicle.x, y: vehicle.y, radius: 9 });
          this.hud.toast('Hai comprato un’utilitaria');
          this.openPlace(place);
        } },
        { label: 'Compra Vespa (€ 2.100)', action: () => {
          const id = `moto-${this.state.vehicles.length}`;
          const vehicle = buyVehicle(this.wallet(), 'moto', id);
          this.syncWallet();
          if (!vehicle) { this.hud.toast('Denaro insufficiente'); return; }
          vehicle.x = this.player.x + 20;
          vehicle.y = this.player.y;
          this.state.vehicles.push(vehicle);
          this.createVehicleSprite(vehicle);
          this.collision.addSolid({ id: vehicle.id, x: vehicle.x, y: vehicle.y, radius: 9 });
          this.hud.toast('Hai comprato una Vespa');
          this.openPlace(place);
        } },
        { label: 'Chiudi', action: () => this.hud.closePanel() },
      ]);
    } else if (place.kind === 'workplace') {
      this.hud.openInfo(place.name, [
        this.state.jobState ? `Lavoro: ${this.state.jobState.title} · € ${this.state.jobState.hourlyWage}/ora`
          : 'C’è una posizione disponibile: barista.',
      ], [
        { label: 'Lavora 2 ore', action: () => this.work(place) },
        { label: 'Chiudi', action: () => this.hud.closePanel() },
      ]);
    } else if (place.kind === 'railway' || place.kind === 'bus_stop') {
      const options = reachableFrom('bacoli_centro').map((station) => ({
        label: `${station.name} (${station.lines.join(', ')})`,
        action: () => this.travel(station.id),
      }));
      this.hud.openInfo(place.name, ['Orari EAV e biglietti disponibili nello smartphone.'], [
        ...options,
        { label: 'Chiudi', action: () => this.hud.closePanel() },
      ]);
    } else if (place.kind === 'archaeological_site') {
      this.hud.openInfo(place.name, [
        'Un sito archeologico della zona: chi visita porta a casa un piccolo souvenir.',
      ], [
        { label: 'Visita (€ 12)', action: () => {
          if (buy(this.wallet(), 'souvenir')) {
            this.syncWallet();
            this.hud.toast('Souvenir acquistato');
          } else this.hud.toast('Denaro insufficiente');
          this.hud.closePanel();
        } },
        { label: 'Chiudi', action: () => this.hud.closePanel() },
      ]);
    } else {
      this.hud.openInfo(place.name, [`Benvenuto da ${place.name}.`], [
        { label: 'Entra', action: enter },
        { label: 'Acquista / ordina', action: shop },
        { label: 'Parla con il personale', action: () => this.hud.openInfo(
          'Personale', ['Che bella giornata! Vuoi qualcosa da bere o da mangiare?'],
          [{ label: 'Grazie!', action: () => this.hud.closePanel() }],
        ) },
        { label: 'Chiudi', action: () => this.hud.closePanel() },
      ]);
    }
  }

  private openPhone(): void {
    if (this.hud.panelOpen) { this.hud.closePanel(); return; }
    const trips = reachableFrom('bacoli_centro').map((station) => {
      const trip = planTrip('bacoli_centro', station.id);
      return {
        label: `Viaggia: ${station.name}${trip ? ` · ${trip.lineName}` : ''}`,
        action: () => this.travel(station.id),
      };
    });
    this.hud.openPhone({
      order: (item) => { this.buyItem(item); this.hud.toast(`Ordine ricevuto: ${ITEM_CATALOG[item].name}`); },
      call: (name) => this.hud.toast(`Chiamata a ${name}...`),
      tickets: () => { this.buyItem('biglietto_bus'); this.buyItem('biglietto_treno'); },
      jobs: () => {
        this.state.jobState ??= createJob('barista');
        this.state.player.job = this.state.jobState.title;
        this.hud.toast(`Assunto come ${this.state.player.job}`);
      },
      map: () => this.hud.toast(`Sei in Via Ortensio (${Math.floor(this.player.x / 16)}, ${Math.floor(this.player.y / 16)})`),
      exit: () => this.hud.closePanel(),
    });
    // Voci aggiuntive: viaggi EAV e famiglia.
    const panel = document.getElementById('hud-panel-body');
    if (panel) {
      if (trips.length) {
        const title = document.createElement('div');
        title.className = 'panel-title';
        title.textContent = 'Trasporti pubblici';
        panel.appendChild(title);
        trips.slice(0, 6).forEach((trip) => {
          const button = document.createElement('button');
          button.className = 'panel-action';
          button.textContent = trip.label;
          button.onclick = trip.action;
          panel.appendChild(button);
        });
      }
      const family = document.createElement('div');
      family.className = 'panel-title';
      family.textContent = `Famiglia · ${this.state.family.length || 'nessun membro'}`;
      panel.appendChild(family);
      if (!this.state.family.length) {
        const hint = document.createElement('p');
        hint.textContent = 'Acquista una casa per fondare una famiglia.';
        panel.appendChild(hint);
      }
      this.state.family.forEach((member) => {
        const button = document.createElement('button');
        button.className = 'panel-action';
        button.textContent = `${member.name} · ${member.relation} · umore ${Math.round(member.mood)}`;
        button.onclick = () => {
          const bonus = familyActivity(this.state.family, 'walk');
          this.hud.toast(`Passeggiata con ${member.name}: umore +${bonus}`);
        };
        panel.appendChild(button);
      });
    }
  }

  private syncState(): void {
    this.state.player.x = this.player.x;
    this.state.player.y = this.player.y;
    this.syncWallet();
  }

  private exportSave(): void {
    this.syncState();
    const code = encodeExport(this.state);
    navigator.clipboard?.writeText(code).then(
      () => this.hud.toast('Salvataggio copiato negli appunti'),
      () => this.hud.toast('Copia non riuscita'),
    );
  }

  private importSave(): void {
    const code = window.prompt('Incolla il codice del salvataggio:');
    if (!code) return;
    try {
      const loaded = normalize(decodeExport(code));
      this.state = loaded;
      this.registry.set('state', loaded);
      this.player.setPosition(loaded.player.x, loaded.player.y);
      this.syncVehicleSprites();
      this.hud.toast('Salvataggio importato');
    } catch (error) {
      this.hud.toast(error instanceof Error ? error.message : 'Importazione fallita');
    }
  }
}
