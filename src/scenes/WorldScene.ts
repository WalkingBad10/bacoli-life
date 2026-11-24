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
import {
  buyVehicle, canDrive, consumeFuel, needsService, refuel, serviceVehicle,
  SERVICE_PRICE, VEHICLE_CATALOG,
} from '../systems/VehicleSystem';
import { LINES, STATIONS, planTrip, reachableFrom, type Station } from '../systems/TransportSystem';
import {
  NPC_PROFILES, routineLabel, routineSlot,
  type NpcProfile, type RoutineSlot,
} from '../systems/NpcRoutineSystem';
import {
  FURNITURE_CATALOG, advanceFamily, buyFurniture, createJob, familyActivity,
  startFamily, workShift, type FurnitureId,
} from '../systems/LifeSystem';
import { advancePets, adoptPet, feedPet, followPet, petLabel, type PetSpecies } from '../systems/PetSystem';
import { bondOf, canMarry, giveGift, marry, talkTo } from '../systems/RelationshipSystem';
import { consumeItem } from '../systems/ConsumptionSystem';

const DATA = placesData as unknown as {
  size: { width: number; height: number };
  spawn: { x: number; y: number };
  places: Place[];
};

interface NpcData {
  sprite: Phaser.GameObjects.Sprite;
  key: string;
  name: string;
  profile: NpcProfile;
  index: number;
  slot: RoutineSlot | null;
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
  private boats: Phaser.GameObjects.Image[] = [];
  private rain?: Phaser.GameObjects.Particles.ParticleEmitter;
  private waterTiles: Phaser.Tilemaps.Tile[] = [];
  private waterTimer = 0;
  private autosaveTimer = 0;
  private lastInteract = 0;
  private lastBellHour = -1;
  private traffic: VehicleState[] = [];
  private vehicleSprites = new Map<string, Phaser.GameObjects.Image>();
  private petSprites = new Map<string, Phaser.GameObjects.Image>();
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
      social: { bonds: {}, spouseId: null, marriedOnDay: null },
      pets: [],
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
    this.registry.set('time', this.timeSystem);

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
    this.spawnUrbanDetails();
    this.syncPetSprites();

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
      this.syncPetSprites();
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
      pets: this.state.pets.length,
      spouse: this.state.social.spouseId,
      bonds: Object.keys(this.state.social.bonds).length,
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
      giveMoney: (amount: number) => {
        const wallet = this.wallet();
        wallet.money += amount;
        this.syncWallet(wallet);
      },
      player: () => ({ x: this.player.x, y: this.player.y }),
      lastTrip: () => this.state.transport.lastTrip,
      reachable: () => reachableFrom(this.originStation().id).map((station) => station.id),
      origin: () => this.originStation().id,
      tripLine: (id: string) => planTrip(this.originStation().id, id)?.line ?? null,
      vehicles: () => this.state.vehicles.map((v) => ({ id: v.id, x: v.x, y: v.y, fuel: v.fuel })),
      state: () => ({
        pets: this.state.pets.map((p) => ({ ...p })),
        spouse: this.state.social.spouseId,
        family: this.state.family.map((m) => ({ ...m })),
        condition: this.state.vehicles[0]?.condition ?? null,
        inventory: { ...this.state.inventory },
      }),
      adopt: (species: PetSpecies) => this.adopt(species),
      feedPet: (id: string) => this.feedPet(id),
      propose: (name: string) => this.propose(name),
      service: () => this.serviceVehicle(),
      buyHome: () => this.buyHome(),
      setAffinity: (name: string, value: number) => {
        this.state.relationships[name] = value;
        bondOf(this.state, name).affinity = value;
      },
      damage: () => { if (this.state.vehicles[0]) this.state.vehicles[0].condition = 40; },
      money: () => this.state.player.money,
      giveItem: (id: ItemId, count: number) => {
        this.state.inventory[id] = (this.state.inventory[id] ?? 0) + count;
      },
      setTime: (hour: number) => { this.timeSystem.minutes = hour * 60; },
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

  private facadeVariant(id: string): number {
    let hash = 2166136261;
    for (let i = 0; i < id.length; i++) {
      hash ^= id.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 12;
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
      const size = widthPx <= 32 ? 32 : widthPx <= 48 ? 48 : widthPx <= 64 ? 64 : 80;
      const key = `building_fine_${size}_${this.facadeVariant(place.id)}`;
      const img = this.add.image(
        (minX + maxX + 1) * 8, (maxY + 1) * 16 + 10, key,
      );
      img.setOrigin(0.5, 1);
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

  /** Verde e arredo urbano distribuiti nelle frazioni, non solo allo spawn. */
  private spawnUrbanDetails(): void {
    const keys = ['flowerpot', 'olive_tree', 'palm', 'trash_bin', 'bench', 'flowerpot'];
    let placed = 0;
    for (let i = 0; i < DATA.places.length && placed < 54; i += 4) {
      const place = DATA.places[i];
      const tx = place.x + ((i % 3) - 1) * 3;
      const ty = place.y + (i % 2 === 0 ? 2 : -2);
      if (!this.walkable(tx, ty) || !this.canStand(tx * 16 + 8, ty * 16 + 16, 6)) continue;
      const key = keys[Math.floor((i / 4) % keys.length)];
      const scale = key === 'olive_tree' || key === 'palm' ? 0.4 : 0.55;
      const x = tx * 16 + 8;
      const y = ty * 16 + 16;
      this.add.image(x, y, key)
        .setOrigin(0.5, 1)
        .setScale(scale)
        .setAlpha(0.92)
        .setDepth(y);
      placed++;
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
    const colors = ['#F2EAD8', '#3A6EA5', '#B1403B', '#E6AB2D'];
    for (let i = 0; i < 8; i++) {
      const bus = i === 0 || i === 4;
      const kind = bus ? 'bus' : i % 3 === 0 ? 'moto' : 'car';
      const vehicle: VehicleState = {
        id: `traffic-${i}`, kind,
        name: bus ? 'Bus EAV' : 'Traffico',
        x: (DATA.spawn.x + (i - 4) * 7) * 16 + 8,
        y: (DATA.spawn.y + 5 + Math.floor(i / 4) * 4) * 16 + 16,
        angle: 0, fuel: 99, maxFuel: 99, color: colors[i % colors.length],
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
      this.collision.addSolid({ id: vehicle.id, x: vehicle.x, y: vehicle.y, radius: 8 });
    }
  }

  private syncVehicleSprites(): void {
    [...this.state.vehicles, ...this.traffic].forEach((vehicle) => {
      this.vehicleSprites.get(vehicle.id)?.setPosition(vehicle.x, vehicle.y);
    });
  }

  private spawnNpcs(): void {
    NPC_PROFILES.forEach((profile, i) => {
      const key = NPC_KEYS[i % NPC_KEYS.length];
      const anchor = DATA.places[(i * 17 + 5) % DATA.places.length];
      let tx = anchor.x + ((i % 3) - 1) * 2;
      let ty = anchor.y + (i % 2 === 0 ? 2 : -2);
      if (!this.walkable(tx, ty)) { tx = DATA.spawn.x + ((i % 5) - 2); ty = DATA.spawn.y + 2; }
      if (!this.walkable(tx, ty)) { tx = DATA.spawn.x; ty = DATA.spawn.y; }
      const sprite = this.add.sprite(tx * 16 + 8, ty * 16 + 16, key);
      sprite.setOrigin(0.5, 1).setScale(0.9);
      this.npcs.push({
        sprite, key, name: profile.name, profile, index: i, slot: null, path: [],
        speed: 30 + (i % 6) * 5,
        dialogue: [
          DIALOGUES[i % DIALOGUES.length],
          DIALOGUES[(i + 3) % DIALOGUES.length],
          `${profile.role} a Bacoli: ${routineLabel(routineSlot(profile.name, 12))}.`,
        ],
      });
    });
  }

  /** Barche decorative: galleggiano sull'acqua senza diventare ostacoli. */
  private spawnBoats(): void {
    const spots = this.waterTiles.filter((tile, index) => {
      if (index % 71 !== 0) return false;
      const right = this.waterTiles.find((other) => other.x === tile.x + 1 && other.y === tile.y);
      return Boolean(right);
    });
    spots.slice(0, 9).forEach((tile, index) => {
      const x = tile.pixelX + 8;
      const y = tile.pixelY + 8;
      const boat = this.add.image(x, y, 'boat')
        .setOrigin(0.5, 0.6)
        .setScale(0.62)
        .setAlpha(0.9)
        .setDepth(y - 12);
      boat.setData('baseX', x);
      boat.setData('baseY', y);
      boat.setData('phase', index * 1.7);
      this.boats.push(boat);
    });
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
    this.spawnBoats();

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
    this.updatePetSprites(delta);

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
    if (this.waterTimer > 260) {
      this.waterTimer = 0;
      this.waterTiles.forEach((tile) => {
        const offset = (tile.x + Math.floor(tile.y / 2)) % 5 === 0 ? 2 : 1;
        tile.index = 8 + ((tile.index - 8 + offset) % 4);
      });
    }
    this.boats.forEach((boat) => {
      const phase = boat.getData('phase') as number;
      const t = this.time.now / 900 + phase;
      boat.x = (boat.getData('baseX') as number) + Math.sin(t) * 5;
      boat.y = (boat.getData('baseY') as number) + Math.sin(t * 1.4) * 2;
      boat.setAngle(Math.sin(t) * 3);
    });

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

  /** Destinazione della routine, scelta in modo deterministico tra i luoghi reali. */
  private routineTarget(slot: RoutineSlot, index: number): { x: number; y: number } {
    const kinds: Record<RoutineSlot, string[]> = {
      home: ['home', 'house'],
      commute: ['railway', 'bus_stop'],
      work: ['workplace', 'shop', 'bank', 'post_office'],
      lunch: ['cafe', 'restaurant', 'bar'],
      beach: ['beach'],
      errands: ['shop', 'pharmacy', 'bank', 'post_office'],
      evening: ['cafe', 'bar', 'restaurant'],
    };
    const pool = DATA.places.filter((place) => kinds[slot].includes(place.kind));
    const source = pool.length ? pool : DATA.places;
    const place = source[(index * 7 + slot.length) % source.length];
    const spot = this.findVehicleSpot(place.x, place.y + 2);
    return { x: Math.floor(spot.x / 16), y: Math.floor(spot.y / 16) };
  }

  private updateNpcs(delta: number): void {
    let pathBudget = 3;
    for (const npc of this.npcs) {
      const slot = routineSlot(npc.name, this.timeSystem.hour);
      const changed = npc.slot !== slot;
      if (changed) { npc.slot = slot; npc.path = []; }
      if (!npc.path.length && pathBudget > 0) {
        pathBudget--;
        const from = { x: Math.floor(npc.sprite.x / 16), y: Math.floor(npc.sprite.y / 16) };
        const target = changed
          ? this.routineTarget(slot, npc.index)
          : {
            x: Phaser.Math.Clamp(from.x + Phaser.Math.Between(-4, 4), 2, this.width - 3),
            y: Phaser.Math.Clamp(from.y + Phaser.Math.Between(-4, 4), 2, this.height - 3),
          };
        npc.path = findPath(from, target, (x, y) => this.walkable(x, y));
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
        const spot = this.findVehicleSpot(DATA.spawn.x + Phaser.Math.Between(-8, 8), DATA.spawn.y + 5);
        vehicle.x = spot.x;
        vehicle.y = spot.y;
      }
      const goesRight = this.walkable(current.x + 2, current.y);
      const target = { x: current.x + (goesRight ? 2 : -2), y: current.y };
      const step = (vehicle.kind === 'bus' ? 20 : 30) * (delta / 1000);
      vehicle.x += Math.sign(target.x - current.x) * step;
      const sprite = this.vehicleSprites.get(vehicle.id);
      sprite?.setPosition(vehicle.x, vehicle.y).setDepth(vehicle.y).setFlipX(!goesRight);
      if (vehicle.x > (DATA.spawn.x + 18) * 16 || vehicle.x < (DATA.spawn.x - 18) * 16) {
        const spot = this.findVehicleSpot(DATA.spawn.x + Phaser.Math.Between(-10, 10), DATA.spawn.y + 5);
        vehicle.x = spot.x;
        vehicle.y = spot.y;
      }
      this.collision.updateSolid(vehicle.id, vehicle.x, vehicle.y);
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

  /** Adozione dal telefono o da un negozio: crea subito lo sprite visibile. */
  private adopt(species: PetSpecies): void {
    const wallet = this.wallet();
    const pet = adoptPet(this.state, species, wallet);
    this.syncWallet(wallet);
    if (!pet) { this.hud.toast('Denaro insufficiente o limite animali raggiunto'); return; }
    this.syncPetSprites();
    this.hud.toast(`${pet.name} è venuto a vivere con te`);
  }

  private feedPet(id: string): void {
    const pet = this.state.pets.find((item) => item.id === id);
    if (!pet || !feedPet(this.state, pet)) {
      this.hud.toast('Serve della spesa nell’inventario');
      return;
    }
    this.hud.toast(`${pet.name} ha mangiato: fame ${Math.round(pet.hunger)}`);
  }

  private propose(name: string): void {
    const check = canMarry(this.state, name);
    if (!check.ok) { this.hud.toast(check.reason ?? 'Non è possibile'); return; }
    if (!marry(this.state, name)) { this.hud.toast('Matrimonio non riuscito'); return; }
    this.hud.toast(`Ti sei sposato con ${name}!`);
  }

  /** Acquisto casa usato anche dai test E2E: same guard del pannello casa. */
  private buyHome(): void {
    if (this.state.home.owned || this.state.player.money < 25_000) return;
    this.state.player.money -= 25_000;
    this.state.home.owned = true;
    this.state.player.homeId = 'home-1';
    startFamily(this.state.home, this.state.family);
  }

  private serviceVehicle(): void {
    const vehicle = this.driving ?? this.state.vehicles[0];
    if (!vehicle) { this.hud.toast('Serve un veicolo posseduto'); return; }
    const wallet = this.wallet();
    const ok = serviceVehicle(vehicle, wallet, this.timeSystem.day);
    this.syncWallet(wallet);
    this.hud.toast(ok
      ? `Tagliando completato (€ ${SERVICE_PRICE})`
      : 'Tagliando non necessario o denaro insufficiente');
  }

  /** Mantiene sprite e dati animali allineati dopo adozione, load e import. */
  private syncPetSprites(): void {
    for (const [id, sprite] of this.petSprites) {
      if (this.state.pets.some((pet) => pet.id === id)) continue;
      sprite.destroy();
      this.petSprites.delete(id);
    }
    this.state.pets.forEach((pet) => {
      let sprite = this.petSprites.get(pet.id);
      if (!sprite) {
        sprite = this.add.image(pet.x, pet.y, `pet_${pet.species}`)
          .setOrigin(0.5, 1).setDepth(pet.y);
        this.petSprites.set(pet.id, sprite);
      }
      sprite.setPosition(pet.x, pet.y);
    });
  }

  private updatePetSprites(delta: number): void {
    if (!this.state.pets.length) return;
    advancePets(this.state.pets, delta / 3_600_000);
    this.state.pets.forEach((pet, index) => {
      // Segue a lato del giocatore e non attraversa muri o acqua.
      const side = pet.x >= this.player.x ? 16 : -16;
      const beforeX = pet.x;
      const beforeY = pet.y;
      followPet(pet, this.player.x + side, this.player.y, delta);
      const valid = (x: number, y: number) => this.canStand(x, y, 4)
        && this.walkable(Math.floor(x / 16), Math.floor(y / 16));
      if (!valid(pet.x, pet.y)) {
        // Scorrimento assiale: evita muri e acqua senza teletrasportare l'animale.
        const movedX = pet.x;
        const movedY = pet.y;
        if (valid(movedX, beforeY)) {
          pet.x = movedX;
          pet.y = beforeY;
        } else if (valid(beforeX, movedY)) {
          pet.x = beforeX;
          pet.y = movedY;
        } else {
          pet.x = beforeX;
          pet.y = beforeY;
        }
      }
      const sprite = this.petSprites.get(pet.id);
      sprite?.setPosition(pet.x, pet.y + Math.sin(this.time.now / 320 + index) * 1.2)
        .setDepth(pet.y + 1)
        .setFlipX(pet.x > this.player.x);
    });
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
    if (!canDrive(vehicle)) {
      this.hud.toast('Il veicolo non è guidabile: carburante o motore da officina');
      return;
    }
    this.driving = vehicle;
    this.player.setVisible(false);
    const warning = (vehicle.condition ?? 100) < 35 ? ' · passa in officina!' : '';
    this.hud.toast(`Stai guidando: ${vehicle.name}${warning}`);
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
      const affinity = talkTo(this.state, npc.name);
      this.state.stats.npcsMet++;
      const bond = bondOf(this.state, npc.name);
      const actions = [
        { label: 'Ciao!', action: () => this.hud.closePanel() },
        { label: `Regala un souvenir (€ 15) · affinità ${affinity}`, action: () => {
          const wallet = this.wallet();
          const ok = giveGift(this.state, npc.name, wallet);
          this.syncWallet(wallet);
          this.hud.toast(ok ? `${npc.name} ha gradito il regalo` : 'Denaro insufficiente');
          this.interact();
        } },
      ];
      if (canMarry(this.state, npc.name).ok && bond.stage !== 'spouse') {
        actions.push({ label: 'Proponi matrimonio', action: () => this.propose(npc.name) });
      }
      this.hud.openInfo(npc.name, [
        line,
        `<small>${npc.profile.role} · affinità ${affinity} · ${bond.stage}</small>`,
      ], actions);
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

  /** Applica un wallet già mutato: passarlo evita di perdere denaro e risparmi. */
  private syncWallet(wallet: Wallet = this.wallet()): void {
    this.state.player.money = wallet.money;
    this.state.player.savings = wallet.savings;
    this.state.inventory = wallet.inventory;
  }

  private buyItem(item: ItemId): void {
    const wallet = this.wallet();
    const ok = buy(wallet, item);
    this.syncWallet(wallet);
    this.hud.toast(ok
      ? `Hai comprato: ${ITEM_CATALOG[item].name} · consumalo con E o dal telefono`
      : 'Denaro insufficiente');
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
    this.timeSystem.advance(shift.hours * 60);
    this.hud.closePanel();
    this.hud.toast(`Turno completato: +€ ${shift.wage.toFixed(2)} · energia -${shift.energyCost}`);
  }

  /** Fermata attiva più vicina: permette di prendere la Cumana presso Baia/Fusaro. */
  private originStation(): Station {
    const fallback = STATIONS.find((s) => s.id === 'bacoli_centro')!;
    let best = fallback;
    let bestDistance = Infinity;
    for (const station of STATIONS) {
      if (station.status !== 'active' || station.position.x <= 0 || station.position.y <= 0) continue;
      const distance = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        station.position.x * 16 + 8, station.position.y * 16 + 16,
      );
      if (distance < bestDistance) { bestDistance = distance; best = station; }
    }
    return best;
  }

  private travel(destinationId: string): void {
    const current = this.originStation();
    const trip = planTrip(current.id, destinationId) ?? planTrip('bacoli_centro', destinationId);
    if (!trip) { this.hud.toast('Tratta non disponibile'); return; }
    const needed: ItemId = trip.line.startsWith('bus') ? 'biglietto_bus' : 'biglietto_treno';
    if (!this.state.transport.monthlyPass && !(this.state.inventory[needed] > 0)) {
      this.hud.toast(`Serve un ${ITEM_CATALOG[needed].name}`);
      return;
    }
    if (!this.state.transport.monthlyPass) this.state.inventory[needed]--;
    if (this.driving) this.toggleVehicle();
    this.state.transport.lastTrip = trip.to.name;
    const lineName = LINES.find((l) => l.id === trip.line)?.name ?? 'EAV';
    const stops = (LINES.find((l) => l.id === trip.line)?.stations ?? [])
      .map((id) => STATIONS.find((station) => station.id === id))
      .filter((station): station is Station => Boolean(station) && station!.status === 'active')
      .map((station) => station.name);
    this.hud.closePanel();
    this.hud.toast(`${lineName} → ${trip.to.name}`);
    this.scene.launch('Transit', {
      line: trip.line,
      lineName,
      fromName: trip.from.name,
      toName: trip.to.name,
      stops: stops.length ? stops : [trip.from.name, trip.to.name],
      minutes: trip.minutes,
      timeSystem: this.timeSystem,
      onArrive: () => this.finishTrip(trip.to),
    });
    this.scene.pause();
  }

  /** Arrivo della tratta animata: sincronizza orologio e posizione nel mondo. */
  private finishTrip(destination: Station): void {
    this.state.time = this.timeSystem.minutes;
    this.state.day = this.timeSystem.day;
    this.state.weather = this.timeSystem.weather;
    const tx = destination.position.x;
    const ty = destination.position.y;
    let x = tx * 16 + 8;
    let y = ty * 16 + 16;
    if (!this.canStand(x, y)) {
      let found = false;
      for (let ring = 1; ring <= 6 && !found; ring++) {
        for (let dy = -ring; dy <= ring && !found; dy++) {
          for (let dx = -ring; dx <= ring && !found; dx++) {
            if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
            const cx = (tx + dx) * 16 + 8;
            const cy = (ty + dy) * 16 + 16;
            if (this.canStand(cx, cy)) { x = cx; y = cy; found = true; }
          }
        }
      }
      if (!found) { x = DATA.spawn.x * 16 + 8; y = DATA.spawn.y * 16 + 16; }
    }
    this.player.setPosition(x, y);
    this.cameras.main.centerOn(x, y);
    this.hud.toast(`Sei arrivato: ${destination.name}`);
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
        this.syncWallet(wallet);
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
      const wallet = this.wallet();
      this.hud.openShop(place.name, wallet, {
        buy: (item) => {
          const ok = buy(wallet, item);
          this.syncWallet(wallet);
          this.hud.toast(ok
            ? `Hai comprato: ${ITEM_CATALOG[item].name} · consumalo con E o dal telefono`
            : 'Denaro insufficiente');
        },
        sell: (item) => { sell(wallet, item); this.syncWallet(wallet); },
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
          this.timeSystem.advance(480);
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
        { label: 'Deposita € 20', action: () => {
          const wallet = this.wallet();
          deposit(wallet, 20);
          this.syncWallet(wallet);
          this.openPlace(place);
        } },
        { label: 'Preleva € 20', action: () => {
          const wallet = this.wallet();
          withdraw(wallet, 20);
          this.syncWallet(wallet);
          this.openPlace(place);
        } },
        { label: 'Chiudi', action: () => this.hud.closePanel() },
      ]);
    } else if (place.kind === 'fuel') {
      const vehicle = this.state.vehicles[0];
      this.hud.openInfo(place.name, [
        vehicle
          ? `${vehicle.name}: ${vehicle.fuel.toFixed(1)}/${vehicle.maxFuel} litri · `
            + `condizione ${Math.round(vehicle.condition ?? 100)}% · `
            + `${Math.round(vehicle.odometer ?? 0)} km · `
            + `${needsService(vehicle, this.timeSystem.day) ? 'tagliando consigliato' : 'motore a posto'}`
          : 'Nessun veicolo posseduto.',
      ], [
        { label: 'Rifornisci 10 litri', action: () => {
          if (!vehicle) { this.hud.toast('Serve un veicolo'); return; }
          const wallet = this.wallet();
          const ok = refuel(vehicle, wallet, 10);
          this.syncWallet(wallet);
          this.hud.toast(ok ? 'Serbatoio rifornito' : 'Denaro insufficiente o serbatoio pieno');
          this.openPlace(place);
        } },
        { label: `Tagliando officina (€ ${SERVICE_PRICE})`, action: () => {
          this.serviceVehicle();
          this.openPlace(place);
        } },
        { label: 'Acquista benzina (1 L)', action: () => { this.buyItem('benzina'); this.openPlace(place); } },
        { label: 'Chiudi', action: () => this.hud.closePanel() },
      ]);
    } else if (place.kind === 'dealership') {
      this.hud.openInfo(place.name, ['Concessionaria: scegli il tuo prossimo veicolo.'], [
        { label: 'Compra utilitaria (€ 4.200)', action: () => {
          const id = `car-${this.state.vehicles.length}`;
          const wallet = this.wallet();
          const vehicle = buyVehicle(wallet, 'car', id);
          this.syncWallet(wallet);
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
          const wallet = this.wallet();
          const vehicle = buyVehicle(wallet, 'moto', id);
          this.syncWallet(wallet);
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
      const options = reachableFrom(this.originStation().id).map((station) => ({
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
          const wallet = this.wallet();
          if (buy(wallet, 'souvenir')) {
            this.syncWallet(wallet);
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
    const trips = reachableFrom(this.originStation().id).map((station) => {
      const trip = planTrip(this.originStation().id, station.id);
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
      family.textContent = `Famiglia · ${this.state.family.length || 'nessun membro'}`
        + (this.state.social.spouseId ? ` · coniuge ${this.state.social.spouseId}` : '');
      panel.appendChild(family);
      if (!this.state.family.length) {
        const hint = document.createElement('p');
        hint.textContent = 'Acquista una casa e parla con gli abitanti per sposarti.';
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

      const pets = document.createElement('div');
      pets.className = 'panel-title';
      pets.textContent = `Animali · ${this.state.pets.length}/3`;
      panel.appendChild(pets);
      ([['dog', 'Adotta cane · € 180'], ['cat', 'Adotta gatto · € 120']] as const)
        .forEach(([species, label]) => {
          const button = document.createElement('button');
          button.className = 'panel-action';
          button.textContent = label;
          button.onclick = () => this.adopt(species);
          panel.appendChild(button);
        });
      this.state.pets.forEach((pet) => {
        const button = document.createElement('button');
        button.className = 'panel-action';
        button.textContent = petLabel(pet);
        button.onclick = () => this.feedPet(pet.id);
        panel.appendChild(button);
      });

      const food = document.createElement('div');
      food.className = 'panel-title';
      food.textContent = 'Consuma dall’inventario';
      panel.appendChild(food);
      (['caffe', 'pizza', 'cornetto', 'gelato'] as ItemId[]).forEach((item) => {
        const owned = this.state.inventory[item] ?? 0;
        const button = document.createElement('button');
        button.className = 'panel-action';
        button.textContent = `${ITEM_CATALOG[item].name} · ${owned} posseduti`;
        button.onclick = () => {
          const ok = consumeItem(this.state, item);
          this.hud.toast(ok ? `Hai consumato: ${ITEM_CATALOG[item].name}` : 'Non ne possiedi');
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
      this.syncPetSprites();
      this.hud.toast('Salvataggio importato');
    } catch (error) {
      this.hud.toast(error instanceof Error ? error.message : 'Importazione fallita');
    }
  }
}
