import Phaser from 'phaser';
import placesData from '../data/bacoli_places.json';
import { CAMERA_ZOOM, PLAYER_SPEED, RUN_MULTIPLIER, type ItemId } from '../core/config';
import type { Direction, GameState, Place } from '../core/types';
import { Hud } from '../ui/Hud';
import { TimeSystem } from '../systems/TimeSystem';
import { buy, deposit, sell, withdraw, type Wallet } from '../systems/Economy';
import { findPath } from '../systems/Pathfinding';
import { loadGame, saveGame, encodeExport, decodeExport } from '../systems/SaveSystem';
import { AudioSystem } from '../systems/AudioSystem';

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
  'Ca’ è tutto più bello quando c’è ’o sole。’',
];

export class WorldScene extends Phaser.Scene {
  private readonly timeSystem = new TimeSystem();
  private readonly audio = new AudioSystem();
  private hud!: Hud;
  private player!: Phaser.GameObjects.Sprite;
  private map!: Phaser.Tilemaps.Tilemap;
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
  private state: GameState;

  constructor() {
    super('World');
    const saved = loadGame();
    this.state = saved ?? {
      player: {
        x: DATA.spawn.x * 16 + 8, y: DATA.spawn.y * 16 + 16,
        money: 500, savings: 0, energy: 100, hunger: 100,
        job: null, homeId: 'home-1',
      },
      inventory: {}, relationships: {}, time: 8 * 60, day: 1, weather: 'sun',
    };
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
    this.spawnNpcs();
    this.setupCamera();
    this.setupAtmosphere();

    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,E,T,ESC,I,O',
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.once('keydown', () => this.audio.start());
    this.input.once('pointerdown', () => this.audio.start());

    this.input.keyboard!.on('keydown-E', () => this.interact());
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
      this.state = loaded;
      this.registry.set('state', loaded);
      this.player.setPosition(loaded.player.x, loaded.player.y);
      this.timeSystem.minutes = loaded.time;
      this.timeSystem.day = loaded.day;
      this.timeSystem.weather = loaded.weather;
      this.hud.toast('Partita caricata');
    };

    (window as unknown as { __bacoliDebug?: () => Record<string, unknown> }).__bacoliDebug = () => ({
      player: { x: this.player.x, y: this.player.y },
      npcs: this.npcs.map((n) => ({ x: n.sprite.x, y: n.sprite.y, name: n.name })),
      places: DATA.places.length,
      time: this.timeSystem.clock,
      walkingNpcs: this.npcs.filter((n) => n.path.length > 0).length,
    });

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
  }

  private walkable(tx: number, ty: number): boolean {
    if (tx < 1 || ty < 1 || tx >= this.width - 1 || ty >= this.height - 1) return false;
    return this.blocked[ty * this.width + tx] === 0;
  }

  private canStand(px: number, py: number): boolean {
    return this.walkable(Math.floor((px - 5) / 16), Math.floor((py - 4) / 16))
      && this.walkable(Math.floor((px + 5) / 16), Math.floor((py - 4) / 16))
      && this.walkable(Math.floor(px / 16), Math.floor((py - 2) / 16));
  }

  private spawnPlayer(): void {
    this.player = this.add.sprite(this.state.player.x, this.state.player.y, 'player');
    this.player.setOrigin(0.5, 1);
    this.player.setDepth(this.player.y);
    if (!this.canStand(this.player.x, this.player.y)) {
      this.player.setPosition(DATA.spawn.x * 16 + 8, DATA.spawn.y * 16 + 16);
    }
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
  }

  private spawnNpcs(): void {
    const keys = ['npc_1', 'npc_2', 'npc_3', 'npc_4', 'player'];
    const names = ['Maria', 'Pasquale', 'Giuseppina', 'Ciro', 'Alessia'];
    for (let i = 0; i < keys.length; i++) {
      let tx = DATA.spawn.x + (i - 2) * 3;
      let ty = DATA.spawn.y + 2 + i % 2;
      if (!this.walkable(tx, ty)) {
        tx = DATA.spawn.x;
        ty = DATA.spawn.y;
      }
      const sprite = this.add.sprite(tx * 16 + 8, ty * 16 + 16, keys[i]);
      sprite.setOrigin(0.5, 1).setScale(0.9);
      this.npcs.push({
        sprite, key: keys[i], name: names[i], path: [], speed: 34 + i * 4,
        dialogue: DIALOGUES.slice(i, i + 2),
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

    for (let i = 0; i < this.npcs.length; i++) {
      const x = DATA.spawn.x * 16 + (i % 3) * 96;
      const y = DATA.spawn.y * 16 + 40;
      if (!this.walkable(Math.floor(x / 16), Math.floor(y / 16))) continue;
      const lamp = this.add.image(x, y, 'lamp').setOrigin(0.5, 1).setDepth(y + 1);
      const glow = this.add.image(x, y - 40, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(y);
      glow.setAlpha(0);
      this.lamps.push(lamp);
      lamp.setData('glow', glow);
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

    this.autosaveTimer += delta;
    if (this.autosaveTimer > 45_000) {
      this.autosaveTimer = 0;
      this.syncState();
      saveGame(this.state);
    }
    this.hud.update(this.state, this.timeSystem);
  }

  private movePlayer(delta: number): void {
    const k = this.keys;
    let dx = (k.D?.isDown || k.RIGHT?.isDown ? 1 : 0) - (k.A?.isDown || k.LEFT?.isDown ? 1 : 0);
    let dy = (k.S?.isDown || k.DOWN?.isDown ? 1 : 0) - (k.W?.isDown || k.UP?.isDown ? 1 : 0);
    dx += this.hud.move.x;
    dy += this.hud.move.y;
    if (dx === 0 && dy === 0) {
      this.player.anims.stop();
      this.player.setFrame(this.faceFrame());
      return;
    }
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const fast = k.SHIFT?.isDown || this.hud.running;
    const speed = PLAYER_SPEED * (fast ? RUN_MULTIPLIER : 1) * (delta / 1000);
    const nx = this.player.x + dx * speed;
    const ny = this.player.y + dy * speed;
    if (this.canStand(nx, this.player.y)) this.player.x = nx;
    if (this.canStand(this.player.x, ny)) this.player.y = ny;
    this.facing = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');
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

  private nearestNpc(): NpcData | null {
    let best: NpcData | null = null;
    let distance = 42;
    for (const npc of this.npcs) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.sprite.x, npc.sprite.y);
      if (d < distance) { distance = d; best = npc; }
    }
    return best;
  }

  private interact(): void {
    if (this.time.now - this.lastInteract < 250) return;
    this.lastInteract = this.time.now;
    if (this.hud.panelOpen) { this.hud.closePanel(); return; }

    const npc = this.nearestNpc();
    const place = this.nearestPlace();
    if (npc && (!place || Phaser.Math.Distance.Between(
      this.player.x, this.player.y, npc.sprite.x, npc.sprite.y,
    ) < 42)) {
      const line = Phaser.Math.RND.pick(npc.dialogue);
      this.state.relationships[npc.name] = (this.state.relationships[npc.name] ?? 0) + 1;
      this.hud.openInfo(npc.name, [line, `<small>Amicizia: ${this.state.relationships[npc.name]}</small>`], [
        { label: 'Ciao!', action: () => this.hud.closePanel() },
      ]);
      return;
    }
    if (!place) {
      this.hud.toast('Nessun luogo o persona nelle vicinanze');
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
    this.hud.toast(ok ? `Hai comprato: ${item}` : 'Denaro insufficiente');
    if (ok && item === 'caffe') this.state.player.energy = Math.min(100, this.state.player.energy + 8);
    if (ok && ['pizza', 'cornetto', 'gelato', 'spesa'].includes(item)) {
      this.state.player.hunger = Math.min(100, this.state.player.hunger + 20);
    }
  }

  private openPlace(place: Place): void {
    const shop = () => {
      this.hud.openShop(place.name, this.wallet(), {
        buy: (item) => this.buyItem(item),
        sell: (item) => { sell(this.wallet(), item); this.syncWallet(); },
        exit: () => this.hud.closePanel(),
      });
    };
    const enter = () => {
      this.hud.closePanel();
      this.scene.launch('Interior', {
        kind: place.kind, name: place.name,
        returnX: this.player.x, returnY: this.player.y,
      });
      this.scene.pause();
    };

    if (place.kind === 'home') {
      this.hud.openInfo(place.name, ['La tua casa. Puoi entrare, dormire e cucinare.'], [
        { label: 'Entra in casa', action: enter },
        { label: 'Dormi (ripristina energia)', action: () => {
          this.state.player.energy = 100;
          this.timeSystem.minutes = Math.min(this.timeSystem.minutes + 480, 23 * 60 + 59);
          this.hud.closePanel();
          this.hud.toast('Hai dormito: energia ripristinata');
        } },
        { label: 'Chiudi', action: () => this.hud.closePanel() },
      ]);
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
    } else if (place.kind === 'archaeological_site') {
      this.hud.openInfo(place.name, [
        'Un sito archeologico della zona: who visited leaves a small souvenir.',
      ], [
        { label: 'Visita (€ 3)', action: () => {
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
    this.hud.openPhone({
      order: (item) => { this.buyItem(item); this.hud.toast(`Ordine ricevuto: ${item}`); },
      call: (name) => this.hud.toast(`Chiamata a ${name}...`),
      tickets: () => { this.buyItem('biglietto_bus'); },
      jobs: () => {
        this.state.player.job = this.state.player.job ?? 'Barista';
        this.hud.toast(`Assunto come ${this.state.player.job}`);
      },
      map: () => this.hud.toast(`Sei in Via Ortensio (${Math.floor(this.player.x / 16)}, ${Math.floor(this.player.y / 16)})`),
      exit: () => this.hud.closePanel(),
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
      const loaded = decodeExport(code);
      this.state = loaded;
      this.player.setPosition(loaded.player.x, loaded.player.y);
      this.hud.toast('Salvataggio importato');
    } catch (error) {
      this.hud.toast(error instanceof Error ? error.message : 'Importazione fallita');
    }
  }
}
