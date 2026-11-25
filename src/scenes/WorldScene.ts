import Phaser from 'phaser';
import worldData from '../data/bacoli_world.json';
import { CAMERA_ZOOM, ITEM_CATALOG, PLAYER_SPEED, RUN_MULTIPLIER, type ItemId } from '../core/config';
import type { Direction, GameState, Place, VehicleState } from '../core/types';
import { Hud, type PhoneSection } from '../ui/Hud';
import { TimeSystem } from '../systems/TimeSystem';
import { buy, deposit, sell, withdraw, type Wallet } from '../systems/Economy';
import { findPath } from '../systems/Pathfinding';
import { decodeExport, defaultVehicles, encodeExport, loadGame, normalize, saveGame } from '../systems/SaveSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { CollisionSystem } from '../systems/CollisionSystem';
import { DebugOverlay } from '../systems/DebugOverlay';
import { RoadGraph, type RoadPoint } from '../systems/RoadGraph';
import { regionTextureKeys } from '../systems/AssetKeys';
import {
  buyVehicle, canDrive, consumeFuel, needsService, refuel, serviceVehicle,
  SERVICE_PRICE, VEHICLE_CATALOG,
} from '../systems/VehicleSystem';
import {
  LINES, STATIONS, eavAlerts, planTrip, reachableFrom, type Station,
} from '../systems/TransportSystem';
import {
  NPC_PROFILES, routineLabel, routineSlot,
  type NpcProfile, type NpcKind, type RoutineSlot,
} from '../systems/NpcRoutineSystem';
import {
  FURNITURE_CATALOG, JOB_CATALOG, advanceFamilyRoutine, buyFurniture, createJob,
  familyActivity, familyRoutineLabel, haveChild, startFamily, workShift,
  type FurnitureId, type JobId,
} from '../systems/LifeSystem';
import { advancePets, adoptPet, feedPet, followPet, petLabel, type PetSpecies } from '../systems/PetSystem';
import { bondOf, canMarry, giveGift, marry, talkTo } from '../systems/RelationshipSystem';
import { consumeItem } from '../systems/ConsumptionSystem';
import { careerLabel, defaultCareer, settlePayday } from '../systems/CareerSystem';
import {
  HOME_OFFERS, activeHome, buyHome, homeComfortLabel,
  setActiveHome, syncHomeMirror,
} from '../systems/HomeSystem';
import {
  advanceBusinesses, businessLabel, buyBusiness, collectEarnings,
  hireEmployee, normalizeBusinesses, restockBusiness, upgradeBusiness, isOpenAt,
} from '../systems/BusinessSystem';
import {
  advanceDeliveries, deliveryLabel, moveCourier, orderDelivery,
} from '../systems/DeliverySystem';
import { attendLocalEvent, eventForDay, eventLabel, nextEvent } from '../systems/EventSystem';

interface RegionData {
  id: string;
  name: string;
  bounds: { south: number; north: number; west: number; east: number };
  scale: {
    metersPerPixel: number;
    metersPerTile: number;
    adultHeightPx: number;
    floorHeightPx: number;
  };
  size: { width: number; height: number };
  spawn: { x: number; y: number };
  stations: Record<string, { x: number; y: number }>;
  places: Place[];
}

const WORLD = worldData as unknown as { regions: RegionData[] };
const DEFAULT_REGION = WORLD.regions.find((region) => region.id === 'centro') ?? WORLD.regions[0];

const BUILDING_WIDTHS = [
  ...Array.from({ length: 23 }, (_, index) => 96 + index * 16),
  480, 512, 544, 576, 608, 640, 672, 704, 768, 832, 896, 960, 1024, 1088,
] as const;
const ROOF_HEIGHT = 24;

interface NpcData {
  sprite: Phaser.GameObjects.Sprite;
  key: string;
  name: string;
  profile: NpcProfile;
  kind: NpcKind;
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
  'Sono venuto da Napoli per il lago: che posto!',
  'Il pesce di stamattina era proprio fresco.',
  'Oggi la spiaggia è piena di famiglie.',
];
const NPC_KEYS = [
  'npc_1', 'npc_2', 'npc_3', 'npc_4', 'npc_5', 'npc_6',
  'npc_7', 'npc_8', 'npc_9', 'npc_10', 'npc_11', 'npc_12',
];

export class WorldScene extends Phaser.Scene {
  private readonly timeSystem = new TimeSystem();
  private readonly audio = new AudioSystem();
  private hud!: Hud;
  private player!: Phaser.GameObjects.Sprite;
  private map!: Phaser.Tilemaps.Tilemap;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private collision!: CollisionSystem;
  private blocked!: Uint8Array;
  private region: RegionData = DEFAULT_REGION;
  private width = this.region.size.width;
  private height = this.region.size.height;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private debugOverlay!: DebugOverlay;
  private facing: Direction = 'down';
  private npcs: NpcData[] = [];
  private overlay!: Phaser.GameObjects.Rectangle;
  private resizeHandler?: (size: Phaser.Structs.Size) => void;
  private lamps: Phaser.GameObjects.Image[] = [];
  private boats: Phaser.GameObjects.Image[] = [];
  private rain?: Phaser.GameObjects.Particles.ParticleEmitter;
  private waterTiles: Phaser.Tilemaps.Tile[] = [];
  private waterTimer = 0;
  private autosaveTimer = 0;
  private lastInteract = 0;
  private lastBellHour = -1;
  private traffic: VehicleState[] = [];
  /** Rotta OSM rimasta da percorrere per ogni veicolo del traffico. */
  private trafficPaths = new Map<string, RoadPoint[]>();
  private trafficTargets = new Map<string, RoadPoint>();
  private trafficStalls = new Map<string, number>();
  private npcStalls = new Map<number, number>();
  private roadGraph!: RoadGraph;
  /** Occupazione dell'arredo: evita sovrapposizioni fra oggetti e ingressi. */
  private urbanOccupied: Array<{ x: number; y: number; radius: number }> = [];
  /** Ombre proiettate ai piedi: la profondità è sempre calcolata dal punto di contatto. */
  private actorShadows = new Map<string, Phaser.GameObjects.Ellipse>();
  private busStops = 0;
  /** Binari disegnati solo sulle stazioni ferroviarie attive della regione. */
  private railMarkers: Array<{ id: string; x: number; y: number }> = [];
  private vehicleSprites = new Map<string, Phaser.GameObjects.Image>();
  private petSprites = new Map<string, Phaser.GameObjects.Image>();
  private courierSprites = new Map<string, Phaser.GameObjects.Image>();
  private eventDecorations: Phaser.GameObjects.Image[] = [];
  private driving: VehicleState | null = null;
  private lastDay: number;
  /** Regione da cui è partito l'ultimo viaggio, per la compatibilità E2E del gate Baia. */
  private tripOriginRegion = 'centro';
  /** Spawn già scelto prima di un restart: il vecchio scene non deve riscriverlo. */
  private pendingSpawn: { x: number; y: number } | null = null;
  private state: GameState;

  constructor() {
    super('World');
    const saved = loadGame();
    this.state = saved ?? normalize({
      player: {
        x: this.region.spawn.x * 16 + 8, y: this.region.spawn.y * 16 + 16,
        money: 500, savings: 0, energy: 100, hunger: 100,
        job: null, homeId: 'home-1',
      },
      inventory: {}, relationships: {}, time: 8 * 60, day: 1, weather: 'sun',
      home: { owned: false, address: 'Via Ortensio 12', furniture: [], upgrades: [] },
      family: [], vehicles: defaultVehicles(), jobState: null,
      transport: { ticketBus: 0, ticketTrain: 0, monthlyPass: false, lastTrip: null },
      social: { bonds: {}, spouseId: null, marriedOnDay: null },
      pets: [],
      career: defaultCareer(),
      activeHomeId: 'home-1',
      businesses: [],
      deliveries: [],
      events: [],
      stats: { distanceWalked: 0, distanceDriven: 0, npcsMet: 0 },
    });
    this.selectRegion();
    this.timeSystem.minutes = this.state.time;
    this.timeSystem.day = this.state.day;
    this.timeSystem.weather = this.state.weather;
    this.lastDay = this.state.day;
  }

  /** Cambia regione e posizione in modo atomico attraverso scene.restart(). */
  private restartInRegion(target: RegionData, x: number, y: number): void {
    this.state.regionId = target.id;
    this.state.player.x = x;
    this.state.player.y = y;
    this.pendingSpawn = { x, y };
    saveGame(this.state);
    this.scene.restart();
  }

  /** Rilegge la regione dal salvataggio: serve anche a ogni scene.restart(). */
  private selectRegion(): void {
    const requested = this.state.regionId ?? 'centro';
    const region = WORLD.regions.find((item) => item.id === requested);
    if (region) {
      this.region = region;
      this.width = region.size.width;
      this.height = region.size.height;
      this.state.regionId = region.id;
    }
  }

  create(): void {
    // Il Scene non viene ricostruito da scene.restart(): gli sprite della
    // regione precedente sono già stati distrutti e vanno dimenticati.
    this.selectRegion();
    // Viaggiare non ricarica BootScene: le facciate della regione di arrivo
    // vengono lette dal disco una sola volta, poi il create riparte pulito.
    const missingTextures = regionTextureKeys(this.region.places)
      .filter((key) => !this.textures.exists(key));
    if (missingTextures.length) {
      for (const key of missingTextures) {
        this.load.image(key, `assets/scale/${key}.png`);
      }
      this.load.once('complete', () => this.scene.restart());
      this.load.start();
      return;
    }
    this.npcs = [];
    this.traffic = [];
    this.trafficPaths.clear();
    this.trafficTargets.clear();
    this.trafficStalls.clear();
    this.npcStalls.clear();
    this.actorShadows.clear();
    this.busStops = 0;
    this.railMarkers = [];
    this.urbanOccupied = [];
    this.driving = null;
    this.vehicleSprites.clear();
    this.petSprites.clear();
    this.courierSprites.clear();
    this.eventDecorations = [];
    this.lamps = [];
    this.boats = [];
    this.waterTiles = [];
    const uiRoot = document.createElement('div');
    document.body.appendChild(uiRoot);
    this.hud = new Hud(uiRoot);
    const arrivalToast = this.registry.get('arrivalToast') as string | undefined;
    if (arrivalToast) {
      this.registry.remove('arrivalToast');
      this.hud.toast(arrivalToast);
    }
    this.registry.set('hud', this.hud);
    this.registry.set('state', this.state);
    this.registry.set('time', this.timeSystem);
    // Le attività commerciali seguono i luoghi reali della mappa; le case e la
    // carriera vengono migrate qui dai salvataggi v1-v3.
    this.state.businesses = normalizeBusinesses(this.state.businesses, this.region.places);
    syncHomeMirror(this.state);
    this.lastDay = this.state.day;

    const meta = this.cache.json.get(`meta_${this.region.id}`) as {
      width: number; height: number; tileWidth: number; tileHeight: number;
      tilesetName: string; firstGid: number;
    };
    const ground = new Uint8Array(this.cache.binary.get(`ground_${this.region.id}`));
    if (ground.length !== meta.width * meta.height) {
      throw new Error('Buffer mappa non valido');
    }
    const rows: number[][] = [];
    for (let y = 0; y < meta.height; y++) {
      rows.push(Array.from(ground.subarray(y * meta.width, (y + 1) * meta.width)));
    }
    this.map = this.make.tilemap({
      data: rows, tileWidth: meta.tileWidth, tileHeight: meta.tileHeight,
    });
    const tileset = this.map.addTilesetImage(
      meta.tilesetName, 'tiles16',
      meta.tileWidth, meta.tileHeight, 0, 0, meta.firstGid,
    );
    if (!tileset) throw new Error('Tileset non caricato');
    const layer = this.map.createLayer(0, tileset, 0, 0);
    if (!layer) throw new Error('Layer ground non creato');
    this.groundLayer = layer;
    this.loadCollision();
    const roadClasses = new Uint8Array(this.cache.binary.get(`roads_${this.region.id}`));
    if (roadClasses.length !== meta.width * meta.height) {
      throw new Error('Buffer stradale non valido');
    }
    this.roadGraph = new RoadGraph(roadClasses, meta.width, meta.height, this.blocked);
    this.spawnStations();

    this.spawnProps();
    this.spawnPlayer();
    this.pendingSpawn = null;
    this.setupCamera();
    // Gli ostacoli fissi (panchine, lampioni) devono esistere prima dei veicoli,
    // altrimenti questi ultimi possono nascere dentro un palo.
    this.setupAtmosphere();
    this.spawnVehicles();
    this.spawnTraffic();
    this.spawnNpcs();
    this.spawnBusStops();
    this.spawnUrbanDetails();
    this.syncPetSprites();
    this.syncCourierSprites();
    this.applyEventDecorations();

    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,E,T,ESC,I,O,V,G',
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.once('keydown', () => this.audio.start());
    this.input.once('pointerdown', () => this.audio.start());

    this.input.keyboard!.on('keydown-E', () => this.interact());
    this.input.keyboard!.on('keydown-V', () => this.toggleVehicle());
    this.input.keyboard!.on('keydown-T', () => this.openPhone());
    this.input.keyboard!.on('keydown-ESC', () => this.hud.closePanel());
    this.input.keyboard!.on('keydown-I', () => this.exportSave());
    this.input.keyboard!.on('keydown-O', () => this.importSave());
    this.input.keyboard!.on('keydown-G', () => {
      const active = this.debugOverlay.toggle();
      this.hud.toast(active ? 'Debug scala attivo' : 'Debug scala disattivo');
    });

    this.hud.onInteract = () => this.interact();
    this.hud.onPhone = () => this.openPhone();
    this.hud.onSave = () => { this.syncState(); saveGame(this.state); this.hud.toast('Partita salvata'); };
    this.hud.onLoad = () => {
      const loaded = loadGame();
      if (!loaded) { this.hud.toast('Nessun salvataggio trovato'); return; }
      this.state = normalize(loaded);
      this.state.businesses = normalizeBusinesses(this.state.businesses, this.region.places);
      syncHomeMirror(this.state);
      this.registry.set('state', this.state);
      this.player.setPosition(this.state.player.x, this.state.player.y);
      this.syncPlayerActor();
      this.timeSystem.minutes = this.state.time;
      this.timeSystem.day = this.state.day;
      this.timeSystem.weather = this.state.weather;
      this.lastDay = this.state.day;
      this.syncVehicleSprites();
      this.syncPetSprites();
      this.syncCourierSprites();
      this.applyEventDecorations();
      this.hud.toast('Partita caricata');
    };

    (window as unknown as { __bacoliDebug?: () => Record<string, unknown> }).__bacoliDebug = () => {
      // Durante il caricamento dinamico delle facciate la scena può riavviarsi:
      // l'hook della visita precedente resta visibile finché il nuovo create non
      // ricrea player e sistemi. Non deve mai leggere campi non inizializzati.
      if (!this.scene.isActive() || !this.player?.anims || !this.timeSystem
        || !this.collision || !this.hud) {
        return { region: this.region?.id ?? null, loading: true };
      }
      return {
        player: { x: this.player.x, y: this.player.y },
      npcs: this.npcs.map((n) => ({ x: n.sprite.x, y: n.sprite.y, name: n.name })),
      places: this.region.places.length,
      region: this.region.id,
      regions: WORLD.regions.length,
      station: this.originStation().id,
      time: this.timeSystem.clock,
      walkingNpcs: this.npcs.filter((n) => n.path.length > 0).length,
      vehicles: this.state.vehicles.length,
      traffic: this.traffic.length,
      urbanProps: this.urbanOccupied.length,
      urbanSpots: this.urbanOccupied,
      lamps: this.lamps.length,
      busStops: this.busStops,
      rails: this.railMarkers,
      trainSprites: this.children.list
        .filter((child): child is Phaser.GameObjects.Image =>
          child instanceof Phaser.GameObjects.Image && child.texture.key.startsWith('train'))
        .map((sprite) => ({ x: sprite.x, y: sprite.y, texture: sprite.texture.key })),
      alerts: eavAlerts(this.originStation().id).map((alert) => alert.id),
      loadedTextures: this.textures.getTextureKeys().length,
      actors: [
        { id: 'player', x: this.player.x, y: this.player.y, radius: 5 },
        ...this.npcs.map((npc) => ({
          id: `npc-${npc.index}`, x: npc.sprite.x, y: npc.sprite.y, radius: 5,
        })),
        ...this.traffic.map((vehicle) => ({
          id: vehicle.id, x: vehicle.x, y: vehicle.y, radius: this.vehicleRadius(vehicle),
        })),
        ...this.state.pets.map((pet) => ({
          id: `pet-${pet.id}`, x: pet.x, y: pet.y, radius: 4,
        })),
      ],
      trafficRoutes: this.traffic.map((vehicle) => ({
        id: vehicle.id,
        x: vehicle.x, y: vehicle.y,
        remaining: this.trafficPaths.get(vehicle.id)?.length ?? 0,
        target: this.trafficTargets.get(vehicle.id) ?? null,
        stalls: this.trafficStalls.get(vehicle.id) ?? 0,
      })),
      // Profondità calcolata sempre dai piedi: sprite e ombra condividono y.
      shadows: [...this.actorShadows.entries()].map(([id, shadow]) => ({
        id, x: shadow.x, y: shadow.y, depth: shadow.depth, visible: shadow.visible,
      })),
      playerAnim: this.player.anims.currentAnim?.key ?? null,
      playerDepth: this.player.depth,
      driving: this.driving?.id ?? null,
      fuel: this.driving?.fuel ?? null,
      homeOwned: this.state.home.owned,
      job: this.state.jobState?.title ?? null,
      pets: this.state.pets.length,
      spouse: this.state.social.spouseId,
      bonds: Object.keys(this.state.social.bonds).length,
      solidTiles: this.blocked.reduce((sum, value) => sum + value, 0),
      npcKinds: this.npcs.reduce<Record<string, number>>((counts, npc) => {
        counts[npc.kind] = (counts[npc.kind] ?? 0) + 1;
        return counts;
      }, {}),
      visibleNpcs: this.npcs.filter((npc) => npc.sprite.visible).length,
      ownedBusinesses: this.state.businesses?.filter((b) => b.owned).length ?? 0,
      ownedHomes: this.state.homes?.filter((h) => h.owned).length ?? 0,
      activeHome: activeHome(this.state).id,
      careerLevel: this.state.career?.level ?? 1,
      deliveries: this.state.deliveries?.length ?? 0,
      event: eventForDay(this.timeSystem.day)?.id ?? null,
        debugOverlay: this.debugOverlay.active,
      };
    };

    // Hook dedicato ai test E2E: permette di verificare collisioni, guida e
    // viaggi senza affidarsi a sequenze di tasti fragili.
    (window as unknown as { __bacoliTest?: Record<string, unknown> }).__bacoliTest = {
      debugOverlay: () => this.debugOverlay.active,
      teleport: (x: number, y: number) => {
        this.player.setPosition(x, y);
        this.syncPlayerActor();
      },
      canStand: (x: number, y: number, radius = 5, ignoreId?: string | string[]) =>
        this.canStand(x, y, radius, ignoreId),
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
      region: () => this.region.id,
      regions: () => WORLD.regions.map((region) => region.id),
      /** Solo per QA visiva: cambia regione metrica senza acquistare biglietti. */
      setRegion: (id: string) => {
        const target = WORLD.regions.find((item) => item.id === id);
        if (!target) return false;
        this.restartInRegion(
          target, target.spawn.x * 16 + 8, target.spawn.y * 16 + 16,
        );
        return true;
      },
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
        homes: (this.state.homes ?? []).map((home) => ({ ...home })),
        activeHome: activeHome(this.state).id,
        businesses: (this.state.businesses ?? []).map((business) => ({ ...business })),
        deliveries: (this.state.deliveries ?? []).map((order) => ({ ...order })),
        career: { ...(this.state.career ?? defaultCareer()) },
        events: (this.state.events ?? []).map((event) => ({ ...event })),
        day: this.state.day,
        region: this.region.id,
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
      setDay: (day: number) => {
        this.timeSystem.day = Math.max(1, Math.floor(day));
        this.state.day = this.timeSystem.day;
        this.lastDay = this.state.day;
        this.applyEventDecorations();
      },
      buyHomeAt: (id: string) => this.purchaseHome(id),
      homes: () => (this.state.homes ?? []).map((home) => ({ ...home, furniture: [...home.furniture] })),
      activeHome: () => activeHome(this.state).id,
      setHome: (id: string) => setActiveHome(this.state, id),
      haveChild: () => this.growFamily(),
      career: () => ({ ...(this.state.career ?? defaultCareer()) }),
      workAt: (placeId?: string) => this.startWork(placeId),
      businesses: () => (this.state.businesses ?? []).map((business) => ({ ...business })),
      buyBusinessAt: (placeId: string) => this.purchaseBusiness(placeId),
      manageBusiness: (id: string) => this.manageBusiness(id),
      openNow: (placeId: string) => {
        const place = this.region.places.find((item) => item.id === placeId);
        return place ? isOpenAt(place.kind, this.timeSystem.hour) : false;
      },
      orderDelivery: (item: ItemId) => this.orderFood(item),
      deliveries: () => (this.state.deliveries ?? []).map((order) => ({ ...order })),
      advanceDelivery: (minutes: number) => this.advanceDeliveryMinutes(minutes),
      celebrateEvent: () => this.celebrateEvent(),
      parkInGarage: (vehicleId: string, garageId: string) => this.parkInGarage(vehicleId, garageId),
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
      // Un cambio regione ha già scritto la nuova posizione: il vecchio sprite
      // non deve sovrascriverla con le coordinate della regione precedente.
      if (!this.pendingSpawn) this.syncState();
      saveGame(this.state);
      if (this.resizeHandler) this.scale.off('resize', this.resizeHandler);
      this.hud.destroy();
      uiRoot.remove();
    });
  }

  private loadCollision(): void {
    const bits = new Uint8Array(this.cache.binary.get(`collision_${this.region.id}`));
    // L'overlay legge direttamente la bitmask: niente decompressione per frame.
    this.debugOverlay = new DebugOverlay(this, {
      solid: bits,
      footprints: this.region.places
        .filter((place): place is Place & { bounds: [number, number, number, number] } =>
          Boolean(place.bounds))
        .map((place) => place.bounds),
      width: this.width,
      height: this.height,
      tile: 16,
    });
    this.blocked = new Uint8Array(this.width * this.height);
    for (let i = 0; i < this.blocked.length; i++) {
      this.blocked[i] = (bits[i >> 3] >> (i & 7)) & 1;
    }
    // Le impronte degli edifici sono già codificate nel buffer binario: passare
    // anche i luoghi aggiungerebbe rettangoli approssimati sopra l'OSM reale.
    this.collision = new CollisionSystem(this.width, this.height, this.blocked);
  }

  private walkable(tx: number, ty: number): boolean {
    return !this.collision.isSolidTile(tx, ty);
  }

  private canStand(
    px: number, py: number, radius = 5, ignoreId?: string | string[],
  ): boolean {
    return this.collision.canStand(px, py, radius, ignoreId);
  }

  /** Raggio del solido circolare coerente con le dimensioni native del veicolo. */
  private vehicleRadius(vehicle: VehicleState): number {
    if (vehicle.kind === 'bus') return 22;
    if (vehicle.kind === 'moto') return 6;
    return 10;
  }

  /** Cerca una piazzola libera con abbastanza spazio per un veicolo. */
  private findVehicleSpot(
    tx: number, ty: number, radius = 10,
  ): { x: number; y: number } {
    for (let ring = 0; ring <= 8; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (ring > 0 && Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
          const cx = tx + dx;
          const cy = ty + dy;
          if (cx < 2 || cy < 2 || cx >= this.width - 2 || cy >= this.height - 2) continue;
          const x = cx * 16 + 8;
          const y = cy * 16 + 16;
          if (this.canStand(x, y, radius)) return { x, y };
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
      this.player.setPosition(this.region.spawn.x * 16 + 8, this.region.spawn.y * 16 + 16);
    }
    const shadow = this.add.ellipse(this.player.x, this.player.y - 1, 13, 4, 0x0c1823, 0.28)
      .setDepth(this.player.y - 1);
    this.actorShadows.set('player', shadow);
    // Il protagonista è un ostacolo per NPC, animali e traffico come ogni altro
    // attore: il raggio coincide con la sagoma pedonale di 16x32 px.
    this.collision.addSolid({ id: 'player', x: this.player.x, y: this.player.y, radius: 5 });
  }

  /** Allinea solido e ombra del giocatore dopo ogni spostamento o caricamento. */
  private syncPlayerActor(): void {
    this.collision.updateSolid('player', this.player.x, this.player.y);
    this.actorShadows.get('player')
      ?.setPosition(this.player.x, this.player.y - 1)
      .setDepth(this.player.y - 1);
  }

  /** Variante della facciata: i dati OSM hanno priorità, poi tipologia e nome. */
  private facadeVariant(place: Place): number {
    if (typeof place.variant === 'number') {
      return Phaser.Math.Clamp(Math.floor(place.variant), 0, 3);
    }
    const name = place.name.toLowerCase();
    if (/chies|basil|santuar|duomo/.test(name)) return 3;
    if (/villa|palazz|castell/.test(name)) return 2;
    if (/centro|piazza/.test(name)) return 0;
    if (['bar', 'cafe', 'restaurant', 'gelateria'].includes(place.kind)) return 1;
    if (['shop', 'pharmacy', 'pescheria', 'post_office'].includes(place.kind)) return 2;

    let hash = 2166136261;
    const signature = `${place.kind}:${place.id}`;
    for (let i = 0; i < signature.length; i++) {
      hash ^= signature.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % 4;
  }

  private facadeWidth(place: Place): number {
    const width = place.facadeWidth ?? 128;
    return (BUILDING_WIDTHS as readonly number[]).includes(width) ? width : 128;
  }

  private facadeFloors(place: Place): number {
    return Phaser.Math.Clamp(Math.floor(place.floors ?? 3), 1, 4);
  }

  /** Stazioni EAV reali: binario, banchina e fabbricato sulle coordinate OSM. */
  private spawnStations(): void {
    for (const station of STATIONS) {
      if (station.status !== 'active') continue;
      if (!station.lines.some((line) => line === 'cumana' || line === 'circumflegrea')) continue;
      const spawn = this.region.stations[station.id];
      if (!spawn) continue;
      const x = spawn.x * 16 + 8;
      const y = spawn.y * 16 + 16;
      this.add.image(x, y + 8, 'rail').setOrigin(0.5, 1).setDepth(y + 7);
      this.railMarkers.push({ id: station.id, x, y });
      this.add.image(x, y, 'platform').setOrigin(0.5, 1).setDepth(y + 6);
      this.add.image(x, y - 6, 'station_eav').setOrigin(0.5, 1).setDepth(y + 5);
    }
  }

  /** Segnaposto dei POI puntuali: nessun edificio inventato e nessuna collisione. */
  private markerKey(place: Place): string {
    if (place.kind === 'beach') return 'palm';
    if (place.kind === 'archaeological_site') return 'olive_tree';
    if (place.kind === 'railway') return 'platform';
    if (place.kind === 'parking') return 'parking_sign';
    if (place.kind === 'cafe' || place.kind === 'bar' || place.kind === 'gelateria') return 'cafe_table';
    if (place.kind === 'restaurant') return 'umbrella';
    if (place.kind === 'pescheria') return 'boat';
    if (place.kind === 'fuel') return 'car_white';
    return 'street_sign';
  }

  private addMarker(place: Place): void {
    const x = place.x * 16 + 8;
    const y = place.y * 16 + 16;
    this.add.image(x, y, this.markerKey(place)).setOrigin(0.5, 1).setDepth(y);
  }

  private spawnProps(): void {
    this.region.places.forEach((place) => {
      const bbox = place.bounds;
      if (!bbox) {
        if (place.marker) this.addMarker(place);
        return;
      }
      const [minX, , maxX, maxY] = bbox;
      const width = this.facadeWidth(place);
      const floors = this.facadeFloors(place);
      const variant = this.facadeVariant(place);
      const centerX = (minX + maxX + 1) * 8;
      const baseY = (maxY + 1) * 16 + 8;

      this.add.image(centerX, baseY + 6, `shadow_${width}`)
        .setOrigin(0.5, 1).setDepth(baseY - 1);
      this.add.image(centerX, baseY, `building_${width}_${floors}_${variant}`)
        .setOrigin(0.5, 1).setDepth(baseY + 2);
      const buildingHeight = floors * this.region.scale.floorHeightPx + 4;
      this.add.image(centerX, baseY - buildingHeight + ROOF_HEIGHT, `roof_${width}_${variant}`)
        .setOrigin(0.5, 1).setDepth(baseY + 3);
    });
  }

  /**
   * Arredo urbano regolato: ogni oggetto nasce solo su marciapiede/basolato
   * vicino a un luogo o a una strada, con raggio d'ingombro reale e distanza
   * minima dagli altri oggetti. Niente oggetti in mezzo all'asfalto o in zone
   * vuote, niente raggi finti usati solo come filtro e mai come collisione.
   */
  private placeUrbanProp(
    key: string, tx: number, ty: number, radius: number, requireSurface = true,
  ): boolean {
    const surface = this.roadGraph.surfaceAt(tx, ty);
    if (requireSurface && surface !== 2 && surface !== 3 && surface !== 0) return false;
    if (surface === 1 || !this.walkable(tx, ty)) return false;
    const x = tx * 16 + 8;
    const y = ty * 16 + 16;
    if (!this.canStand(x, y, radius)) return false;
    const gap = this.urbanOccupied.some((other) =>
      Math.hypot(other.x - x, other.y - y) < other.radius + radius + 8);
    if (gap) return false;
    // L'ingresso dei palazzi resta libero: nessun ostacolo entro 10 px.
    if (this.region.places.some((place) => place.bounds && Math.hypot(
      place.x * 16 + 8 - x, place.y * 16 + 16 - y) < 12)) return false;

    const sprite = this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y);
    if (key === 'lamp') {
      const glow = this.add.image(x, y - 40, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(y);
      glow.setAlpha(0);
      sprite.setData('glow', glow);
      this.lamps.push(sprite);
    }
    this.collision.addSolid({ id: `prop-${key}-${tx}-${ty}`, x, y: y - 8, radius });
    this.urbanOccupied.push({ x, y, radius });
    return true;
  }

  /** Cerca il primo punto pedonale libero in una piccola spirale locale. */
  private placeUrbanNear(
    key: string, px: number, py: number, radius: number,
  ): boolean {
    const offsets = [
      [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1],
      [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2],
    ];
    return offsets.some(([dx, dy]) => this.placeUrbanProp(key, px + dx, py + dy, radius));
  }

  /** Fermate bus OSM reali: cartello sul marciapiede, non in mezzo all'asfalto. */
  private spawnBusStops(): void {
    const stops = this.region.places.filter((place) => place.kind === 'bus_stop');
    for (const place of stops) {
      if (this.placeUrbanNear('bus_stop', place.x, place.y, 4)) this.busStops++;
    }
  }

  /** Verde e arredo urbano distribuiti secondo la funzione del luogo OSM. */
  private spawnUrbanDetails(): void {
    const cafes = this.region.places.filter((place) =>
      ['cafe', 'bar', 'restaurant', 'gelateria', 'pescheria'].includes(place.kind));
    const green = this.region.places.filter((place) =>
      ['park', 'garden', 'piazzetta', 'archaeological_site', 'beach'].includes(place.kind));
    const services = this.region.places.filter((place) =>
      ['shop', 'pharmacy', 'post_office', 'bank', 'office'].includes(place.kind));

    cafes.slice(0, 26).forEach((place, index) => {
      this.placeUrbanNear('cafe_table', place.x + 1, place.y + 1, 10);
      if (index % 2 === 0) this.placeUrbanNear('flowerpot', place.x - 1, place.y + 1, 6);
      if (index % 3 === 0) this.placeUrbanNear('bench', place.x + 2, place.y + 2, 12);
    });
    green.slice(0, 18).forEach((place, index) => {
      const key = place.kind === 'beach' ? 'palm' : 'olive_tree';
      this.placeUrbanNear(key, place.x + (index % 2 ? 2 : -2), place.y + 1, 5);
      if (index % 3 === 0) this.placeUrbanNear('bench', place.x, place.y + 2, 12);
    });
    services.slice(0, 20).forEach((place, index) => {
      if (index % 2 === 0) this.placeUrbanNear('trash_bin', place.x + 1, place.y - 1, 6);
      if (index % 4 === 0) this.placeUrbanNear('flowerpot', place.x - 1, place.y - 1, 6);
    });

    // Lampioni e segnaletica lungo i marciapiedi, non a intervalli ciechi.
    let lamps = 0;
    for (let ty = 4; ty < this.height - 4 && lamps < 40; ty += 9) {
      for (let tx = 4; tx < this.width - 4 && lamps < 40; tx += 9) {
        if (this.roadGraph.surfaceAt(tx, ty) !== 3) continue;
        if (!this.roadGraph.drivable(tx + 1, ty) && !this.roadGraph.drivable(tx - 1, ty)
          && !this.roadGraph.drivable(tx, ty + 1) && !this.roadGraph.drivable(tx, ty - 1)) continue;
        if (this.placeUrbanProp('lamp', tx, ty, 3)) lamps++;
      }
    }
    let signs = 0;
    for (let ty = 6; ty < this.height - 6 && signs < 8; ty += 17) {
      for (let tx = 6; tx < this.width - 6 && signs < 8; tx += 17) {
        if (this.roadGraph.surfaceAt(tx, ty) !== 3) continue;
        const cross = [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .filter(([dx, dy]) => this.roadGraph.drivable(tx + dx, ty + dy)).length;
        if (cross < 3) continue;
        const key = signs % 2 === 0 ? 'street_sign' : 'parking_sign';
        if (this.placeUrbanProp(key, tx, ty, 3)) signs++;
      }
    }

    this.region.places.filter((place) => place.kind === 'beach').slice(0, 6).forEach((place) => {
      const tx = place.x + 2;
      const ty = place.y + 1;
      if (!this.walkable(tx, ty)) return;
      this.add.image(tx * 16 + 8, ty * 16 + 16, 'fisher').setOrigin(0.5, 1).setDepth(ty * 16 + 16);
    });
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
      // I veicoli in garage non devono comparire né ostacolare la strada.
      if (vehicle.garageId) { index++; continue; }
      const tx = this.region.spawn.x + (index % 2 === 0 ? -1 : 1) * (2 + index);
      const ty = this.region.spawn.y + 3 + Math.floor(index / 2) * 2;
      const radius = this.vehicleRadius(vehicle);
      const spot = this.findVehicleSpot(tx, ty, radius);
      vehicle.x = vehicle.x || spot.x;
      vehicle.y = vehicle.y || spot.y;
      if (!this.canStand(vehicle.x, vehicle.y, radius)) {
        vehicle.x = spot.x;
        vehicle.y = spot.y;
      }
      this.createVehicleSprite(vehicle);
      this.collision.addSolid({ id: vehicle.id, x: vehicle.x, y: vehicle.y, radius });
      index++;
    }
  }

  /**
   * Piazzola stradale libera: i veicoli devono nascere sull'asfalto/basolato
   * OSM, non su un marciapiede, e non sovrapposti a un altro veicolo.
   */
  private findRoadSpot(
    tx: number, ty: number, radius: number, salt: number,
  ): { x: number; y: number } | null {
    for (let ring = 0; ring <= 20; ring++) {
      const start = (salt * 7 + ring * 13) % Math.max(1, ring * 8);
      for (let k = 0; k < Math.max(1, ring * 8); k++) {
        const index = (start + k) % Math.max(1, ring * 8);
        const dir = Math.floor(index / Math.max(1, ring)) % 8;
        const step = ring === 0 ? 0 : 1 + (index % ring);
        const dx = ring === 0 ? 0 : [[1, 0], [1, 1], [0, 1], [-1, 1],
          [-1, 0], [-1, -1], [0, -1], [1, -1]][dir][0] * step;
        const dy = ring === 0 ? 0 : [[1, 0], [1, 1], [0, 1], [-1, 1],
          [-1, 0], [-1, -1], [0, -1], [1, -1]][dir][1] * step;
        const cx = tx + dx;
        const cy = ty + dy;
        if (!this.roadGraph.drivable(cx, cy)) continue;
        const x = cx * 16 + 8;
        const y = cy * 16 + 16;
        if (!this.canStand(x, y, radius)) continue;
        const clear = [...this.traffic, ...this.state.vehicles].every((other) => (
          Math.hypot(other.x - x, other.y - y) > radius + this.vehicleRadius(other) + 8
        ));
        if (clear) return { x, y };
      }
    }
    return null;
  }

  private spawnTraffic(): void {
    const colors = ['#F2EAD8', '#3A6EA5', '#B1403B', '#E6AB2D'];
    for (let i = 0; i < 8; i++) {
      const bus = i === 0 || i === 4;
      const kind = bus ? 'bus' : i % 3 === 0 ? 'moto' : 'car';
      const vehicle: VehicleState = {
        id: `traffic-${i}`, kind,
        name: bus ? 'Bus EAV' : 'Traffico',
        x: 0, y: 0,
        angle: 0, fuel: 99, maxFuel: 99, color: colors[i % colors.length],
        owned: false,
      };
      const radius = this.vehicleRadius(vehicle);
      const spot = this.findRoadSpot(
        this.region.spawn.x + (i - 4) * 6,
        this.region.spawn.y + 5 + Math.floor(i / 4) * 3, radius, i,
      );
      if (!spot) continue;
      vehicle.x = spot.x;
      vehicle.y = spot.y;
      this.traffic.push(vehicle);
      this.createVehicleSprite(vehicle);
      this.collision.addSolid({ id: vehicle.id, x: vehicle.x, y: vehicle.y, radius });
      const here = { x: Math.floor(spot.x / 16), y: Math.floor(spot.y / 16) };
      const target = this.roadGraph.pickDestination(here, i);
      if (target) {
        this.trafficTargets.set(vehicle.id, target);
        this.trafficPaths.set(vehicle.id, this.roadGraph.route(here, target));
      }
    }
  }

  private syncVehicleSprites(): void {
    [...this.state.vehicles, ...this.traffic].forEach((vehicle) => {
      this.vehicleSprites.get(vehicle.id)?.setPosition(vehicle.x, vehicle.y);
    });
  }

  private spawnNpcs(): void {
    NPC_PROFILES.forEach((profile, i) => {
      const key = profile.kind === 'fisher'
        ? 'npc_fisher' : NPC_KEYS[i % NPC_KEYS.length];
      const anchor = this.region.places[(i * 17 + 5) % this.region.places.length];
      const spot = this.freePedestrianTile(anchor.x, anchor.y, i);
      const tx = spot.x;
      const ty = spot.y;
      const x = tx * 16 + 8;
      const y = ty * 16 + 16;
      const sprite = this.add.sprite(x, y, key);
      sprite.setOrigin(0.5, 1).setDepth(y);
      const shadow = this.add.ellipse(x, y - 1, 12, 4, 0x0c1823, 0.24)
        .setDepth(y - 1);
      this.actorShadows.set(`npc-${i}`, shadow);
      this.collision.addSolid({ id: `npc-${i}`, x, y, radius: 5 });
      this.npcs.push({
        sprite, key, name: profile.name, profile,
        kind: profile.kind ?? 'resident',
        index: i, slot: null, path: [],
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

    // I lampioni sono generati da spawnUrbanDetails() solo sui marciapiedi OSM;
    // qui restano solo l'overlay atmosferico e l'animazione dell'acqua.

    this.groundLayer.forEachTile((tile) => {
      if (tile.index >= 8 && tile.index <= 11 && this.waterTiles.length < 1400) {
        this.waterTiles.push(tile);
      }
    });
    this.spawnBoats();

    this.resizeHandler = (size: Phaser.Structs.Size) => {
      this.overlay.setSize(size.width, size.height);
    };
    this.scale.on('resize', this.resizeHandler);
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
    // create() può tornare prima di costruire la scena mentre carica le facciate
    // della nuova regione: in quel frame gli sprite sono già stati distrutti.
    if (!this.player?.anims || !this.hud || !this.collision || !this.debugOverlay) return;
    this.debugOverlay.update(this.cameras.main);
    if (this.hud.panelOpen) {
      this.player.anims.stop();
      return;
    }
    const gameMinutes = delta / 1000;
    this.timeSystem.update(delta);
    this.state.time = this.timeSystem.minutes;
    this.state.day = this.timeSystem.day;
    this.state.weather = this.timeSystem.weather;
    this.state.player.hunger = Math.max(0, this.state.player.hunger - delta * 0.00005);
    advanceFamilyRoutine(this.state.family, delta / 3_600_000, this.timeSystem.hour);
    this.updatePetSprites(delta);
    this.updateDeliveries(delta);
    advanceBusinesses(this.state.businesses ?? [], gameMinutes, this.timeSystem.hour);
    if (this.timeSystem.day !== this.lastDay) this.onNewDay();

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
      this.syncPlayerActor();
      return;
    }
    const speed = PLAYER_SPEED * (fast ? RUN_MULTIPLIER : 1) * (delta / 1000);
    const beforeX = this.player.x;
    const beforeY = this.player.y;
    // Il solido del giocatore lo rappresenta per gli altri attori: va ignorato
    // quando si calcola il suo stesso passo, altrimenti si blocca su sé stesso.
    const moved = this.collision.move(beforeX, beforeY, nx * speed, ny * speed, 5, 'player');
    this.player.setPosition(moved.x, moved.y);
    this.state.stats.distanceWalked += Math.hypot(moved.x - beforeX, moved.y - beforeY);
    this.facing = Math.abs(nx) > Math.abs(ny)
      ? (nx > 0 ? 'right' : 'left')
      : (ny > 0 ? 'down' : 'up');
    this.player.anims.play(`walk-${this.facing}-player`, true);
    this.player.setDepth(this.player.y);
    this.syncPlayerActor();
    if (fast) this.state.player.energy = Math.max(0, this.state.player.energy - delta * 0.0025);
  }

  private faceFrame(): number {
    return ({ down: 0, left: 4, right: 8, up: 12 })[this.facing];
  }

  /**
   * Tile pedonale libero vicino a un luogo, con rotazione deterministica e
   * distanza minima fra pedoni: evita che routine diverse convergeano tutte
   * sulla stessa casella o che gli NPC si accatastino allo spawn.
   */
  private freePedestrianTile(tx: number, ty: number, salt: number): { x: number; y: number } {
    const dirs = [
      [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
    ];
    const distant = (x: number, y: number) => this.npcs.every((npc) => {
      const dx = npc.sprite.x - (x * 16 + 8);
      const dy = npc.sprite.y - (y * 16 + 16);
      return dx * dx + dy * dy > 144 // almeno 12 px fra pedoni
        && this.canStand(x * 16 + 8, y * 16 + 16, 5);
    });
    for (let radius = 0; radius <= 14; radius++) {
      const cells = radius === 0 ? 1 : radius * 8;
      const offset = (salt * 3 + radius * 5) % Math.max(1, cells);
      for (let k = 0; k < cells; k++) {
        const index = (offset + k) % cells;
        const dx = radius === 0 ? 0 : dirs[Math.floor(index / radius) % 8][0] * (1 + index % radius);
        const dy = radius === 0 ? 0 : dirs[Math.floor(index / radius) % 8][1] * (1 + index % radius);
        const x = tx + dx;
        const y = ty + dy;
        if (this.walkable(x, y) && distant(x, y)) return { x, y };
      }
    }
    for (let r = 0; r <= 8; r++) {
      const x = this.region.spawn.x + r;
      const y = this.region.spawn.y + (r % 3);
      if (this.walkable(x, y) && distant(x, y)) return { x, y };
    }
    return { x: this.region.spawn.x, y: this.region.spawn.y };
  }

  /** Destinazione della routine, scelta in modo deterministico tra i luoghi reali. */
  private routineTarget(
    slot: RoutineSlot, index: number, kind: NpcKind = 'resident',
  ): { x: number; y: number } {
    const kinds: Record<RoutineSlot, string[]> = {
      home: ['home', 'house'],
      commute: ['railway', 'bus_stop'],
      work: ['workplace', 'shop', 'bank', 'post_office', 'office', 'garage'],
      lunch: ['cafe', 'restaurant', 'bar', 'gelateria'],
      beach: ['beach'],
      errands: ['shop', 'pharmacy', 'bank', 'post_office', 'pescheria'],
      evening: ['cafe', 'bar', 'restaurant', 'piazzetta'],
    };
    let wanted = kinds[slot];
    if (kind === 'fisher') wanted = slot === 'beach' || slot === 'work'
      ? ['beach', 'pescheria'] : wanted;
    if (kind === 'tourist' || kind === 'bather') wanted = slot === 'evening'
      ? ['cafe', 'gelateria', 'bar'] : ['beach', 'archaeological_site'];
    let pool = this.region.places.filter((place) => wanted.includes(place.kind));
    if (!pool.length) pool = this.region.places.filter((place) => kinds[slot].includes(place.kind));
    const source = pool.length ? pool : this.region.places;
    const place = source[(index * 7 + slot.length) % source.length];
    return this.freePedestrianTile(place.x, place.y, index + slot.length);
  }

  private updateNpcs(delta: number): void {
    let pathBudget = 3;
    // Culling: gli NPC fuori schermo non aggiornano animazioni e collisioni.
    const view = this.cameras.main.worldView;
    const bounds = new Phaser.Geom.Rectangle(
      view.x - 96, view.y - 96, view.width + 192, view.height + 192,
    );
    for (const npc of this.npcs) {
      if (!npc.sprite.active || !npc.sprite.anims) continue;
      const solidId = `npc-${npc.index}`;
      const shadow = this.actorShadows.get(solidId);
      const onScreen = Phaser.Geom.Rectangle.Contains(bounds, npc.sprite.x, npc.sprite.y);
      npc.sprite.setVisible(onScreen);
      shadow?.setVisible(onScreen);
      if (!onScreen) { npc.sprite.anims.stop(); continue; }
      const slot = routineSlot(npc.name, this.timeSystem.hour);
      const changed = npc.slot !== slot;
      if (changed) { npc.slot = slot; npc.path = []; }
      if (!npc.path.length && pathBudget > 0) {
        pathBudget--;
        const from = { x: Math.floor(npc.sprite.x / 16), y: Math.floor(npc.sprite.y / 16) };
        const target = changed
          ? this.routineTarget(slot, npc.index, npc.kind)
          : {
            x: Phaser.Math.Clamp(from.x + Phaser.Math.Between(-4, 4), 2, this.width - 3),
            y: Phaser.Math.Clamp(from.y + Phaser.Math.Between(-4, 4), 2, this.height - 3),
          };
        const clear = (x: number, y: number) => this.walkable(x, y)
          && this.canStand(x * 16 + 8, y * 16 + 16, 5, solidId);
        npc.path = findPath(from, target, clear);
        if (!npc.path.length) npc.path = findPath(from, target, (x, y) => this.walkable(x, y));
      }
      const next = npc.path[0];
      if (next) {
        const tx = next.x * 16 + 8;
        const ty = next.y * 16 + 16;
        const angle = Math.atan2(ty - npc.sprite.y, tx - npc.sprite.x);
        const step = npc.speed * (delta / 1000);
        const moved = this.collision.move(
          npc.sprite.x, npc.sprite.y, Math.cos(angle) * step, Math.sin(angle) * step, 5, solidId,
        );
        const progressed = Math.hypot(moved.x - npc.sprite.x, moved.y - npc.sprite.y);
        const reached = Math.hypot(tx - moved.x, ty - moved.y) < 4
          && this.canStand(tx, ty, 5, solidId);
        if (reached) {
          npc.sprite.setPosition(tx, ty);
          npc.path.shift();
        } else {
          npc.sprite.setPosition(moved.x, moved.y);
        }
        if (progressed < step * 0.25) {
          const stalls = (this.npcStalls.get(npc.index) ?? 0) + 1;
          this.npcStalls.set(npc.index, stalls);
          if (stalls > 10) { npc.path = []; this.npcStalls.set(npc.index, 0); }
        } else {
          this.npcStalls.set(npc.index, 0);
        }
        const dir: Direction = Math.abs(tx - npc.sprite.x) > Math.abs(ty - npc.sprite.y)
          ? (tx > npc.sprite.x ? 'right' : 'left')
          : (ty > npc.sprite.y ? 'down' : 'up');
        npc.sprite.anims.play(`walk-${dir}-${npc.key}`, true);
        npc.sprite.setDepth(npc.sprite.y);
      } else {
        npc.sprite.anims.stop();
      }
      this.collision.updateSolid(solidId, npc.sprite.x, npc.sprite.y);
      shadow?.setPosition(npc.sprite.x, npc.sprite.y - 1).setDepth(npc.sprite.y - 1);
    }
  }

  private updateTraffic(delta: number): void {
    let routeBudget = 4; // A* limitato per frame: la strada non si teletrasporta.
    for (const [index, vehicle] of this.traffic.entries()) {
      const sprite = this.vehicleSprites.get(vehicle.id);
      let path = this.trafficPaths.get(vehicle.id) ?? [];

      // Ricalcolo solo quando serve: percorso finito, tile non più guidabile o
      // veicolo bloccato da un ostacolo per troppo tempo.
      if (!path.length && routeBudget > 0) {
        routeBudget--;
        const here = { x: Math.floor(vehicle.x / 16), y: Math.floor(vehicle.y / 16) };
        const target = this.roadGraph.pickDestination(here, index + this.state.day * 7)
          ?? this.roadGraph.nearest(here.x + 12, here.y + 4);
        if (target) {
          this.trafficTargets.set(vehicle.id, target);
          path = this.roadGraph.route(here, target);
          this.trafficPaths.set(vehicle.id, path);
        }
      }

      const next = path[0];
      if (next) {
        const tx = next.x * 16 + 8;
        const ty = next.y * 16 + 16;
        const dx = tx - vehicle.x;
        const dy = ty - vehicle.y;
        const distance = Math.hypot(dx, dy);
        const radius = this.vehicleRadius(vehicle);
        const speed = (vehicle.kind === 'bus' ? 22 : vehicle.kind === 'moto' ? 36 : 30) * (delta / 1000);
        const ratio = Math.min(1, speed / distance);
        const nx = vehicle.x + dx * ratio;
        const ny = vehicle.y + dy * ratio;
        const blocked = !this.canStand(nx, ny, radius, vehicle.id);
        if (blocked) {
          const stalls = (this.trafficStalls.get(vehicle.id) ?? 0) + 1;
          this.trafficStalls.set(vehicle.id, stalls);
          if (stalls > 45) { path.length = 0; this.trafficStalls.set(vehicle.id, 0); }
        } else {
          this.trafficStalls.set(vehicle.id, 0);
          vehicle.x = nx;
          vehicle.y = ny;
          vehicle.angle = Math.atan2(dy, dx) * 180 / Math.PI;
        }
        if (Math.hypot(tx - vehicle.x, ty - vehicle.y) < 3) {
          path.shift();
          // Punto successivo già raggiunto: evita un frame fermo su tile corti.
          while (path.length && Math.hypot(path[0].x * 16 + 8 - vehicle.x,
            path[0].y * 16 + 16 - vehicle.y) < 3) path.shift();
        }
        sprite?.setFlipX(dx < 0);
      }
      sprite?.setPosition(vehicle.x, vehicle.y).setDepth(vehicle.y);
      this.collision.updateSolid(vehicle.id, vehicle.x, vehicle.y);
    }
  }

  private nearestPlace(): Place | null {
    let best: Place | null = null;
    let distance = 96;
    for (const place of this.region.places) {
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

  /** Compatibilità con i test E2E: acquista la prima casa reale. */
  private buyHome(): void {
    this.purchaseHome(HOME_OFFERS[0].id);
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

  // ---------------------------------------------------------------------------
  // Milestone 4: carriera, case, famiglia, attività, consegne ed eventi.
  // ---------------------------------------------------------------------------

  /** Compra una delle case reali e la rende attiva senza perdere i vecchi arredi. */
  private purchaseHome(id: string): boolean {
    const wallet = this.wallet();
    const home = buyHome(this.state, id, wallet);
    this.syncWallet(wallet);
    if (!home) { this.hud.toast('Casa non disponibile o denaro insufficiente'); return false; }
    if (!this.state.family.length) startFamily(this.state.home, this.state.family);
    this.hud.toast(`Hai comprato ${home.address}. È ora la tua casa attiva.`);
    return true;
  }

  /** Un figlio viene al mondo solo in una famiglia già formata. */
  private growFamily(): void {
    const wallet = this.wallet();
    const child = haveChild(this.state.family, wallet, this.state.social.spouseId);
    this.syncWallet(wallet);
    if (!child) {
      this.hud.toast('Serve un partner, una casa e € 600 per accogliere un figlio');
      return;
    }
    this.hud.toast(`${child.name} è nato: la famiglia ha ora ${this.state.family.length} membri`);
  }

  /** Avanza tutte le simulazioni che usano il tempo, senza tick passivi. */
  private advanceSimulation(minutes: number): void {
    advanceFamilyRoutine(this.state.family, minutes / 60, this.timeSystem.hour);
    this.advanceDeliveryMinutes(minutes);
    advanceBusinesses(this.state.businesses ?? [], minutes, this.timeSystem.hour);
    this.timeSystem.advance(minutes);
    this.state.time = this.timeSystem.minutes;
    this.state.day = this.timeSystem.day;
    this.state.weather = this.timeSystem.weather;
    if (this.timeSystem.day !== this.lastDay) this.onNewDay();
  }

  /** Nuovo giorno: meteo, festa, busta paga e compleanni dei più piccoli. */
  private onNewDay(): void {
    this.lastDay = this.timeSystem.day;
    this.state.day = this.timeSystem.day;
    this.applyWeather();
    this.applyEventDecorations();
    const wallet = this.wallet();
    const pay = settlePayday(this.state.career ?? (this.state.career = defaultCareer()),
      this.timeSystem.day, wallet);
    this.syncWallet(wallet);
    for (const member of this.state.family) {
      if (member.child && member.schedule !== 'baby') member.age += 1 / 365;
      if (member.schedule === 'baby' && member.age >= 1) member.schedule = 'school';
    }
    this.hud.toast(pay > 0
      ? `Nuovo giorno: busta paga +€ ${pay.toFixed(2)} · ${eventLabel(this.timeSystem.day)}`
      : `Buongiorno! ${eventLabel(this.timeSystem.day)}`);
  }

  /** Turno di lavoro con carriera: sceglie il mestiere in base al livello. */
  private startWork(placeId?: string): void {
    if (!this.state.jobState) {
      const level = this.state.career?.level ?? 1;
      const available = (Object.keys(JOB_CATALOG) as JobId[])
        .filter((id) => JOB_CATALOG[id].minLevel <= level);
      const id = available[Math.min(available.length - 1, Math.floor((level - 1) / 2))] ?? 'barista';
      this.state.jobState = createJob(id);
      this.state.player.job = this.state.jobState.title;
    }
    const place = placeId ? this.region.places.find((item) => item.id === placeId) : undefined;
    if (place) this.state.jobState.workplace = place.name;
    const spec = JOB_CATALOG[this.state.jobState.id as JobId];
    if (spec && (this.state.career?.level ?? 1) < spec.minLevel) {
      this.hud.toast(`Serve il livello ${spec.minLevel} per questo lavoro`);
      return;
    }
    const wallet = this.wallet();
    const shift = workShift(this.state.jobState, 2, this.state.career);
    wallet.money = Math.round((wallet.money + shift.wage) * 100) / 100;
    this.syncWallet(wallet);
    this.state.player.energy = Math.max(0, this.state.player.energy - shift.energyCost);
    this.advanceSimulation(shift.hours * 60);
    this.hud.closePanel();
    this.hud.toast(`Turno: +€ ${shift.wage.toFixed(2)} · +${shift.xp} XP · ${careerLabel(this.state.career)}`);
  }

  private purchaseBusiness(placeId: string): void {
    const place = this.region.places.find((item) => item.id === placeId);
    if (!place) return;
    const wallet = this.wallet();
    const business = buyBusiness(this.state, place, wallet);
    this.syncWallet(wallet);
    if (!business) { this.hud.toast('Attività non disponibile o denaro insufficiente'); return; }
    this.hud.toast(`${business.name} è tua! Gli incassi si accumulano quando è aperta.`);
    this.manageBusiness(business.id);
  }

  /** Gestore dell'attività: cassa, scorte, personale e ampliamento. */
  private manageBusiness(id: string): void {
    const business = this.state.businesses?.find((item) => item.id === id);
    if (!business || !business.owned) { this.hud.toast('Non possiedi questa attività'); return; }
    const restockCost = 120 + business.level * 40;
    const hireCost = 450 + business.employees * 250;
    const upgradeCost = 900 * business.level;
    this.hud.openInfo(business.name, [
      businessLabel(business, this.timeSystem.hour),
      `Scorte ${Math.round(business.stock)}/99 · dipendenti ${business.employees} · livello ${business.level}`,
      `Incasso orario stimato: € ${(business.level * (18 + business.employees * 6)).toFixed(2)}`,
    ], [
      { label: `Incassa € ${business.earnings.toFixed(2)}`, action: () => {
        const wallet = this.wallet();
        const amount = collectEarnings(business, wallet);
        this.syncWallet(wallet);
        this.hud.toast(amount > 0 ? `Incassato € ${amount.toFixed(2)}` : 'La cassa è vuota');
        this.manageBusiness(id);
      } },
      { label: `Riordina scorte (€ ${restockCost})`, action: () => {
        const wallet = this.wallet();
        const ok = restockBusiness(business, wallet);
        this.syncWallet(wallet);
        this.hud.toast(ok ? 'Scorte ripristinate' : 'Denaro insufficiente o scorte già piene');
        this.manageBusiness(id);
      } },
      { label: `Assumi un addetto (€ ${hireCost})`, action: () => {
        const wallet = this.wallet();
        const ok = hireEmployee(business, wallet);
        this.syncWallet(wallet);
        this.hud.toast(ok ? 'Nuovo addetto assunto' : 'Denaro insufficiente o organico completo');
        this.manageBusiness(id);
      } },
      { label: `Amplia attività (€ ${upgradeCost})`, action: () => {
        const wallet = this.wallet();
        const ok = upgradeBusiness(business, wallet);
        this.syncWallet(wallet);
        this.hud.toast(ok ? `Attività al livello ${business.level}` : 'Denaro insufficiente o livello massimo');
        this.manageBusiness(id);
      } },
      { label: business.open ? 'Chiudi al pubblico' : 'Riapri al pubblico', action: () => {
        business.open = !business.open;
        this.manageBusiness(id);
      } },
      { label: 'Torna al mondo', action: () => this.hud.closePanel() },
    ]);
  }

  /** Ordine a domicilio: il corriere parte dal locale e arriva a casa. */
  private orderFood(item: ItemId): void {
    const place = this.nearestPlace();
    const wallet = this.wallet();
    const order = orderDelivery(
      this.state, wallet, item, place?.name ?? 'Bar Pina', this.player.x, this.player.y,
    );
    this.syncWallet(wallet);
    if (!order) { this.hud.toast('Denaro insufficiente per la consegna'); return; }
    this.syncCourierSprites();
    this.hud.toast(`${deliveryLabel(order)} · il corriere è partito`);
  }

  private advanceDeliveryMinutes(minutes: number): void {
    if (!(this.state.deliveries ?? []).some((order) => order.status !== 'delivered')) return;
    const arrived = advanceDeliveries(this.state, minutes);
    this.syncCourierSprites();
    if (arrived.length) {
      this.hud.toast(`${arrived.length} consegna/e arrivate: controlla la dispensa`);
    }
  }

  private updateDeliveries(delta: number): void {
    if (!(this.state.deliveries ?? []).some((order) => order.status !== 'delivered')) return;
    const arrived = advanceDeliveries(this.state, delta / 1000);
    const home = activeHome(this.state);
    const place = this.region.places.find((item) => item.name.includes(home.street))
      ?? this.region.places.find((item) => item.kind === 'home');
    const tx = place ? place.x * 16 + 8 : this.region.spawn.x * 16 + 8;
    const ty = place ? place.y * 16 + 16 : this.region.spawn.y * 16 + 16;
    for (const order of this.state.deliveries ?? []) {
      if (order.status !== 'delivered') moveCourier(order, tx, ty, delta);
      this.courierSprites.get(order.id)?.setPosition(order.x, order.y).setDepth(order.y + 2);
    }
    if (arrived.length) {
      this.syncCourierSprites();
      this.hud.toast(`${arrived.length} consegna/e arrivate: controlla la dispensa`);
    }
  }

  private syncCourierSprites(): void {
    for (const [id, sprite] of this.courierSprites) {
      if ((this.state.deliveries ?? []).some((order) => order.id === id && order.status !== 'delivered')) continue;
      sprite.destroy();
      this.courierSprites.delete(id);
    }
    for (const order of this.state.deliveries ?? []) {
      if (order.status === 'delivered' || this.courierSprites.has(order.id)) continue;
      const sprite = this.add.image(order.x, order.y, 'moto')
        .setOrigin(0.5, 1).setDepth(order.y + 2);
      this.courierSprites.set(order.id, sprite);
    }
  }

  /** Bandiere, ombrelloni e luminarie seguono il calendario degli eventi. */
  private applyEventDecorations(): void {
    this.eventDecorations.forEach((decoration) => decoration.destroy());
    this.eventDecorations = [];
    const event = eventForDay(this.timeSystem.day);
    if (!event || event.decoration === 'none') return;
    const key = event.decoration === 'lights' ? 'lamp'
      : event.decoration === 'flags' ? 'street_sign' : 'umbrella';
    this.lamps.slice(0, 6).forEach((lamp, index) => {
      const x = lamp.x + 14 + (index % 2) * 10;
      const y = lamp.y + 2;
      if (!this.walkable(Math.floor(x / 16), Math.floor(y / 16))) return;
      const decoration = this.add.image(x, y, key)
        .setOrigin(0.5, 1).setDepth(y + 1);
      this.eventDecorations.push(decoration);
    });
  }

  private celebrateEvent(): void {
    const event = eventForDay(this.timeSystem.day);
    if (!event) { this.hud.toast(`${eventLabel(this.timeSystem.day)} · ${nextEvent(this.timeSystem.day).event.description}`); return; }
    const wallet = this.wallet();
    const result = attendLocalEvent(this.state, wallet, event.id);
    this.syncWallet(wallet);
    this.hud.toast(result.okay
      ? `${event.name}: +€ ${result.reward} · umore +${result.mood}`
      : 'Hai già partecipato a questa festa oggi');
  }

  /** Parcheggia o ritira un veicolo: nessun ostacolo quando è in garage. */
  private parkInGarage(vehicleId: string, garageId: string): boolean {
    const vehicle = this.state.vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) { this.hud.toast('Veicolo non trovato'); return false; }
    if (vehicle.garageId) {
      vehicle.garageId = null;
      const radius = this.vehicleRadius(vehicle);
      const spot = this.findVehicleSpot(
        Math.floor(this.player.x / 16) + 1, Math.floor(this.player.y / 16), radius,
      );
      vehicle.x = spot.x;
      vehicle.y = spot.y;
      this.createVehicleSprite(vehicle);
      this.collision.addSolid({ id: vehicle.id, x: vehicle.x, y: vehicle.y, radius });
      this.hud.toast(`${vehicle.name} è di nuovo in strada`);
    } else {
      vehicle.garageId = garageId;
      this.vehicleSprites.get(vehicle.id)?.destroy();
      this.vehicleSprites.delete(vehicle.id);
      this.collision.removeSolid(vehicle.id);
      if (this.driving?.id === vehicle.id) this.toggleVehicle();
      this.hud.toast(`${vehicle.name} parcheggiato in garage`);
    }
    return true;
  }

  /** Mantiene sprite e dati animali allineati dopo adozione, load e import. */
  private syncPetSprites(): void {
    for (const [id, sprite] of this.petSprites) {
      if (this.state.pets.some((pet) => pet.id === id)) continue;
      sprite.destroy();
      this.petSprites.delete(id);
      const solidId = `pet-${id}`;
      this.collision.removeSolid(solidId);
      this.actorShadows.get(solidId)?.destroy();
      this.actorShadows.delete(solidId);
    }
    this.state.pets.forEach((pet) => {
      let sprite = this.petSprites.get(pet.id);
      if (!sprite) {
        sprite = this.add.image(pet.x, pet.y, `pet_${pet.species}`)
          .setOrigin(0.5, 1).setDepth(pet.y);
        this.petSprites.set(pet.id, sprite);
        const solidId = `pet-${pet.id}`;
        this.collision.addSolid({ id: solidId, x: pet.x, y: pet.y, radius: 4 });
        this.actorShadows.set(solidId, this.add.ellipse(
          pet.x, pet.y - 1, 10, 3, 0x0c1823, 0.22,
        ).setDepth(pet.y - 1));
      }
      sprite.setPosition(pet.x, pet.y);
    });
  }

  private updatePetSprites(delta: number): void {
    if (!this.state.pets.length) return;
    advancePets(this.state.pets, delta / 3_600_000);
    this.state.pets.forEach((pet, index) => {
      // Segue a lato del giocatore e non attraversa muri, acqua o altri attori.
      const solidId = `pet-${pet.id}`;
      const side = pet.x >= this.player.x ? 16 : -16;
      const beforeX = pet.x;
      const beforeY = pet.y;
      followPet(pet, this.player.x + side, this.player.y, delta);
      const valid = (x: number, y: number) => this.canStand(x, y, 4, solidId)
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
      this.collision.updateSolid(solidId, pet.x, pet.y);
      this.actorShadows.get(solidId)
        ?.setPosition(pet.x, pet.y - 1)
        .setDepth(pet.y - 1);
    });
  }

  private toggleVehicle(): void {
    if (this.driving) {
      this.driving = null;
      // Il pedone non può restare dentro il solido del veicolo: cerca un
      // marciapiede libero accanto alla portiera prima di tornare giocabile.
      const spot = this.findVehicleSpot(
        Math.floor(this.player.x / 16) + 1, Math.floor(this.player.y / 16), 5,
      );
      this.player.setPosition(spot.x, spot.y);
      this.state.player.x = spot.x;
      this.state.player.y = spot.y;
      this.collision.addSolid({ id: 'player', x: spot.x, y: spot.y, radius: 5 });
      this.player.setVisible(true);
      this.actorShadows.get('player')?.setVisible(true);
      this.player.setFrame(this.faceFrame());
      this.syncPlayerActor();
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
    // Durante la guida il solido del pedone coinciderebbe con quello del
    // veicolo e impedirebbe ogni movimento: resta solo il raggio dell'auto.
    this.collision.removeSolid('player');
    this.player.setVisible(false);
    this.actorShadows.get('player')?.setVisible(false);
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
      placeId: place.id, regionId: this.region.id,
      floors: place.floors, facadeWidth: place.facadeWidth, source: place.source,
    });
    this.scene.pause();
  }

  private work(place: Place): void {
    this.startWork(place.id);
  }

  /** Fermata attiva più vicina nella regione metrica attualmente giocata. */
  private originStation(): Station {
    const local = STATIONS.filter((station) => station.status === 'active'
      && Boolean(this.region.stations[station.id]));
    const fallback = local[0] ?? STATIONS.find((station) => station.id === 'bacoli_centro')!;
    let best = fallback;
    let bestDistance = Infinity;
    for (const station of local) {
      const spawn = this.region.stations[station.id];
      const distance = Math.hypot(this.player.x - (spawn.x * 16 + 8), this.player.y - (spawn.y * 16 + 16));
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
    this.tripOriginRegion = this.region.id;
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

  /** Arrivo della tratta: sincronizza tempo e ricostruisce la regione di arrivo. */
  private finishTrip(destination: Station): void {
    this.state.time = this.timeSystem.minutes;
    this.state.day = this.timeSystem.day;
    this.state.weather = this.timeSystem.weather;
    // Il gate storico di Baia apparteneva alla mappa del centro ed è ancora
    // usato dai test pubblicati: solo quel viaggio resta nel centro storico.
    const legacyBaia = destination.id === 'baia_station' && this.tripOriginRegion === 'centro';
    const target = legacyBaia ? this.region
      : WORLD.regions.find((region) => region.id === destination.mapRegion) ?? this.region;
    const spawn = legacyBaia ? { x: 268, y: 256 }
      : target.stations[destination.id] ?? target.spawn;
    const x = spawn.x * 16 + 8;
    const y = spawn.y * 16 + 16;
    this.state.regionId = target.id;
    this.state.player.x = x;
    this.state.player.y = y;
    this.registry.set('arrivalToast', `Sei arrivato: ${destination.name}`);
    if (target.id !== this.region.id) {
      this.pendingSpawn = { x, y };
      saveGame(this.state);
      this.scene.restart();
      return;
    }
    let finalX = x;
    let finalY = y;
    if (!this.canStand(finalX, finalY)) {
      let found = false;
      for (let ring = 1; ring <= 6 && !found; ring++) {
        for (let dy = -ring; dy <= ring && !found; dy++) {
          for (let dx = -ring; dx <= ring && !found; dx++) {
            if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
            const cx = (spawn.x + dx) * 16 + 8;
            const cy = (spawn.y + dy) * 16 + 16;
            if (this.canStand(cx, cy)) { finalX = cx; finalY = cy; found = true; }
          }
        }
      }
      if (!found) {
        finalX = this.region.spawn.x * 16 + 8;
        finalY = this.region.spawn.y * 16 + 16;
      }
    }
    this.player.setPosition(finalX, finalY);
    this.state.player.x = finalX;
    this.state.player.y = finalY;
    this.cameras.main.centerOn(finalX, finalY);
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
      const owned = (this.state.homes ?? []).filter((home) => home.owned);
      const actions = [
        { label: 'Entra in casa', action: enter },
        { label: 'Arreda casa', action: () => this.openFurnitureShop(place) },
        { label: 'Dormi fino al mattino', action: () => {
          this.state.player.energy = 100;
          const untilMorning = (8 - this.timeSystem.hour + 24) % 24 || 24;
          this.advanceSimulation(untilMorning * 60);
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
        { label: 'Passeggiata in famiglia', action: () => {
          const bonus = familyActivity(this.state.family, 'walk');
          this.advanceSimulation(60);
          this.hud.closePanel();
          this.hud.toast(`Umore +${bonus} · un’ora di passeggiata`);
        } },
        { label: 'Chiudi', action: () => this.hud.closePanel() },
      ];
      const home = activeHome(this.state);
      actions.unshift({ label: owned.length ? `Case possedute: ${owned.length} · cambia` : 'Acquista una casa', action: () => {
        const list = owned.length
          ? owned.map((item) => ({
            label: `${item.address}${item.id === home.id ? ' · attiva ✓' : ''}`,
            action: () => {
              setActiveHome(this.state, item.id);
              this.hud.toast(`Casa attiva: ${item.address}`);
              this.openPlace(place);
            },
          }))
          : HOME_OFFERS.map((item) => ({
            label: `${item.address} · € ${item.price.toLocaleString('it-IT')}`,
            action: () => {
              if (this.purchaseHome(item.id)) this.openPlace(place);
              else this.openPlace(place);
            },
          }));
        if (owned.length) {
          list.push(...HOME_OFFERS.filter((item) => !item.owned)
            .map((item) => ({
              label: `Acquista anche ${item.address} · € ${item.price.toLocaleString('it-IT')}`,
              action: () => { this.purchaseHome(item.id); this.openPlace(place); },
            })));
        }
        this.hud.openInfo('Le tue case', [
          `Casa attiva: ${home.address} · comfort ${homeComfortLabel(home).split('comfort ')[1] ?? 0}`,
          `Saldo: € ${this.state.player.money.toFixed(2)}`,
        ], [...list, { label: 'Indietro', action: () => this.openPlace(place) }]);
      } });
      this.hud.openInfo(place.name, [
        home.owned
          ? `La tua casa · arredi ${home.furniture.length} · famiglia ${this.state.family.length}`
          : 'Questa casa è in affitto. Puoi acquistare una casa con il telefono o da qui.',
        ...this.state.family.map((member) =>
          `${member.name} · ${member.relation} · ${familyRoutineLabel(member, this.timeSystem.hour)}`),
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
          this.collision.addSolid({
            id: vehicle.id, x: vehicle.x, y: vehicle.y, radius: this.vehicleRadius(vehicle),
          });
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
          this.collision.addSolid({
            id: vehicle.id, x: vehicle.x, y: vehicle.y, radius: this.vehicleRadius(vehicle),
          });
          this.hud.toast('Hai comprato una Vespa');
          this.openPlace(place);
        } },
        { label: 'Chiudi', action: () => this.hud.closePanel() },
      ]);
    } else if (place.kind === 'parking' || place.kind === 'garage') {
      const vehicles = this.state.vehicles.filter((vehicle) => vehicle.owned);
      this.hud.openInfo(place.name, [
        `${vehicles.length} veicolo/i · ${vehicles.filter((v) => v.garageId).length} in garage.`,
        'Parcheggiare rimuove l’ostacolo dalla strada; ritirare lo riporta accanto a te.',
      ], [
        ...vehicles.map((vehicle) => ({
          label: vehicle.garageId
            ? `Ritira ${vehicle.name}`
            : `Parcheggia ${vehicle.name}`,
          action: () => {
            this.parkInGarage(vehicle.id, `garage-${place.id}`);
            this.openPlace(place);
          },
        })),
        { label: 'Chiudi', action: () => this.hud.closePanel() },
      ]);
    } else if (place.kind === 'workplace') {
      this.hud.openInfo(place.name, [
        this.state.jobState ? `Lavoro: ${this.state.jobState.title} · € ${this.state.jobState.hourlyWage}/ora`
          : 'C’è una posizione disponibile: barista.',
        careerLabel(this.state.career),
        this.state.jobState
          ? `Turni: ${this.state.jobState.daysWorked} · livello ${this.state.career?.level ?? 1}`
          : 'Il primo turno ti assume automaticamente.',
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
      const open = isOpenAt(place.kind, this.timeSystem.hour);
      const business = this.state.businesses?.find((item) => item.placeId === place.id);
      const actions: { label: string; action: () => void }[] = [
        { label: open ? 'Entra nel locale' : 'Attendi un’ora e riprova', action: () => {
          if (open) enter();
          else {
            this.advanceSimulation(60);
            this.hud.toast(`Sono le ${this.timeSystem.clock}: riprova a entrare`);
            this.openPlace(place);
          }
        } },
        { label: open ? 'Acquista / ordina' : 'Attendi per acquistare', action: () => {
          if (open) shop();
          else {
            this.advanceSimulation(60);
            this.hud.toast(`Orario aggiornato: ${this.timeSystem.clock}`);
            this.openPlace(place);
          }
        } },
      ];
      if (business?.owned) {
        actions.push({ label: `Gestisci attività · cassa € ${business.earnings.toFixed(2)}`,
          action: () => this.manageBusiness(business.id) });
      } else if (business) {
        actions.push({ label: `Acquista l’attività (€ ${business.price.toLocaleString('it-IT')})`,
          action: () => { this.purchaseBusiness(place.id); this.openPlace(place); } });
      }
      actions.push(
        { label: 'Parla con il personale', action: () => this.hud.openInfo(
          'Personale', [open ? 'Che bella giornata! Vuoi qualcosa da bere o da mangiare?'
            : 'Ora siamo chiusi: torna più tardi, per favore.'],
          [{ label: 'Grazie!', action: () => this.hud.closePanel() }],
        ) },
        { label: 'Chiudi', action: () => this.hud.closePanel() },
      );
      this.hud.openInfo(place.name, [
        `Benvenuto da ${place.name}.`,
        business ? businessLabel(business, this.timeSystem.hour) : open ? 'Aperto ora' : 'Chiuso in questo orario',
      ], actions);
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
    const career = this.state.career ?? defaultCareer();
    const businessList = (this.state.businesses ?? []).filter((item) => item.owned);
    const deliveryList = (this.state.deliveries ?? []).filter((item) => item.status !== 'delivered');
    const currentEvent = eventForDay(this.timeSystem.day);
    const sections: PhoneSection[] = [
      {
        title: 'Trasporti pubblici',
        rows: trips.slice(0, 6),
      },
      {
        title: 'Avvisi EAV',
        rows: eavAlerts(this.originStation().id).map((alert) => ({
          label: `${alert.severity === 'warning' ? 'AVVISO' : 'INFO'} · ${alert.title}`,
          action: () => this.hud.openInfo(alert.title, [alert.body, alert.source], [
            { label: 'Ho capito', action: () => this.hud.closePanel() },
          ]),
        })),
      },
      {
        title: `Famiglia · ${this.state.family.length || 'nessun membro'}`
          + (this.state.social.spouseId ? ` · coniuge ${this.state.social.spouseId}` : ''),
        rows: this.state.family.length
          ? this.state.family.map((member) => ({
            label: `${member.name} · ${familyRoutineLabel(member, this.timeSystem.hour)} · umore ${Math.round(member.mood)}`,
            action: () => {
              const bonus = familyActivity(this.state.family, 'walk');
              this.hud.toast(`Passeggiata con ${member.name}: umore +${bonus}`);
            },
          }))
          : [{ label: 'Acquista una casa e parla con gli abitanti per sposarti', action: () => undefined }],
      },
      {
        title: `Animali · ${this.state.pets.length}/3`,
        rows: [
          { label: 'Adotta cane · € 180', action: () => this.adopt('dog') },
          { label: 'Adotta gatto · € 120', action: () => this.adopt('cat') },
          ...this.state.pets.map((pet) => ({ label: petLabel(pet), action: () => this.feedPet(pet.id) })),
        ],
      },
      {
        title: 'Consuma dall’inventario',
        rows: (['caffe', 'pizza', 'cornetto', 'gelato', 'spesa', 'pesce', 'dolce'] as ItemId[])
          .map((item) => ({
            label: `${ITEM_CATALOG[item].name} · ${this.state.inventory[item] ?? 0} posseduti`,
            action: () => {
              const ok = consumeItem(this.state, item);
              this.hud.toast(ok ? `Hai consumato: ${ITEM_CATALOG[item].name}` : 'Non ne possiedi');
            },
          })),
      },
      {
        title: `Carriera · ${careerLabel(this.state.career)}`,
        rows: [
          { label: `Esperienza ${career.xp}/${24 + (career.level - 1) * 16} XP · ${career.promotions} promozioni`, action: () => undefined },
          { label: `Lavora 2 ore (${this.state.jobState?.title ?? 'barista'})`, action: () => this.startWork() },
          { label: `Ritira busta paga (giorno ${career.lastPayDay + 7})`, action: () => {
            const wallet = this.wallet();
            const pay = settlePayday(career, this.timeSystem.day, wallet);
            this.syncWallet(wallet);
            this.hud.toast(pay > 0 ? `Busta paga: +€ ${pay.toFixed(2)}` : 'Non ancora scaduta');
          } },
        ],
      },
      {
        title: 'Case e famiglia',
        rows: [
          { label: `Casa attiva: ${activeHome(this.state).address}`, action: () => undefined },
          ...(this.state.homes ?? []).filter((home) => home.owned).map((home) => ({
            label: home.id === activeHome(this.state).id ? `${home.address} · attiva` : `Trasferiti in ${home.address}`,
            action: () => { setActiveHome(this.state, home.id); this.hud.toast(`Casa attiva: ${home.address}`); },
          })),
          ...HOME_OFFERS.filter((home) => !home.owned).map((home) => ({
            label: `Acquista ${home.address} · € ${home.price.toLocaleString('it-IT')}`,
            action: () => this.purchaseHome(home.id),
          })),
          { label: 'Un nuovo figlio (€ 600)', action: () => this.growFamily() },
        ],
      },
      {
        title: `Attività commerciali · ${businessList.length}/${this.state.businesses?.length ?? 0}`,
        rows: [
          ...businessList.map((business) => ({
            label: `${business.name} · € ${business.earnings.toFixed(2)}`,
            action: () => this.manageBusiness(business.id),
          })),
          ...(this.state.businesses ?? []).filter((item) => !item.owned).slice(0, 8).map((business) => ({
            label: `Acquista ${business.name} · € ${business.price.toLocaleString('it-IT')}`,
            action: () => this.purchaseBusiness(business.placeId),
          })),
        ],
      },
      {
        title: `Consegne a domicilio · ${deliveryList.length} in corso`,
        rows: [
          ...deliveryList.map((order) => ({
            label: deliveryLabel(order),
            action: () => this.hud.toast(deliveryLabel(order)),
          })),
          { label: 'Ordina pizza a domicilio (€ 13,50)', action: () => this.orderFood('pizza') },
          { label: 'Ordina caffè a domicilio (€ 4,50)', action: () => this.orderFood('caffe') },
          { label: 'Affretta le consegne di 30 minuti', action: () => {
            this.advanceSimulation(30);
            this.hud.toast(`Sono le ${this.timeSystem.clock}`);
          } },
        ],
      },
      {
        title: 'Eventi del territorio',
        rows: [
          { label: eventLabel(this.timeSystem.day), action: () => undefined },
          ...(currentEvent ? [{
            label: `Partecipa a ${currentEvent.name} (+€ ${currentEvent.reward})`,
            action: () => this.celebrateEvent(),
          }] : []),
        ],
      },
    ];
    this.hud.openPhone({
      order: (item) => this.orderFood(item),
      call: (name) => this.hud.toast(`Chiamata a ${name}...`),
      tickets: () => { this.buyItem('biglietto_bus'); this.buyItem('biglietto_treno'); },
      jobs: () => {
        this.state.jobState ??= createJob('barista');
        this.state.player.job = this.state.jobState.title;
        this.hud.toast(`Assunto come ${this.state.player.job}`);
      },
      map: () => this.hud.toast(`Sei in Via Ortensio (${Math.floor(this.player.x / 16)}, ${Math.floor(this.player.y / 16)})`),
      exit: () => this.hud.closePanel(),
      sections,
    });
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
      loaded.businesses = normalizeBusinesses(loaded.businesses, this.region.places);
      syncHomeMirror(loaded);
      this.state = loaded;
      this.registry.set('state', loaded);
      this.player.setPosition(loaded.player.x, loaded.player.y);
      this.timeSystem.minutes = loaded.time;
      this.timeSystem.day = loaded.day;
      this.timeSystem.weather = loaded.weather;
      this.lastDay = loaded.day;
      this.applyWeather();
      this.syncVehicleSprites();
      this.syncPetSprites();
      this.syncCourierSprites();
      this.applyEventDecorations();
      this.hud.toast('Salvataggio importato');
    } catch (error) {
      this.hud.toast(error instanceof Error ? error.message : 'Importazione fallita');
    }
  }
}
