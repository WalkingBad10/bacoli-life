import Phaser from 'phaser';
import { CollisionWorld } from './CollisionWorld';
import { LaneNetwork, LaneRunner } from './LaneNetwork';
import { findPath } from './Pathfinding';
import { obbCorners, obbHitsPolygon } from './geometry';
import type {
  FocusData, Footprint, Lane, LaneData, MapMeta, Point2, TiledMap,
} from './types';

const TILE = 16;
const FLOOR_PX = 52;
const PLAYER_RADIUS = 6;
const PLAYER_SPEED = 92;
const VEHICLE_SPEED = 74;

interface Npc {
  sprite: Phaser.GameObjects.Image;
  path: Point2[];
  pathIndex: number;
  variant: number;
  direction: number;
  phase: number;
  timer: number;
}

interface Vehicle {
  sprite: Phaser.GameObjects.Image;
  runner: LaneRunner;
  bus: boolean;
  color: number;
}

interface RebuildHook {
  ready: boolean;
  player: { x: number; y: number };
  blockedX: boolean;
  blockedY: boolean;
  blockedFrames: number;
  vehicles: Array<{ x: number; y: number; angle: number; frame: string; bus: boolean; onDrivableLane: boolean }>;
  buildings: number;
  props: number;
  npcPathNodes: number;
  playerScalePx: number;
  carScalePx: number;
  busScalePx: number;
  insideBuilding: boolean;
  debugVisible: boolean;
  visibleText: string[];
}

declare global {
  interface Window {
    __rebuild2?: RebuildHook;
  }
}

function rowsOf(data: number[], width: number, height: number): number[][] {
  const rows: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row = data.slice(y * width, (y + 1) * width);
    rows.push(row.map((gid) => (gid <= 0 ? -1 : gid - 1)));
  }
  return rows;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class WorldScene extends Phaser.Scene {
  private collision!: CollisionWorld;
  private network!: LaneNetwork;
  private player!: Phaser.GameObjects.Image;
  private roads!: Uint8Array;
  private roadWidth = 0;
  private npcs: Npc[] = [];
  private vehicles: Vehicle[] = [];
  private prompt!: Phaser.GameObjects.Text;
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private debugVisible = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private focus!: FocusData;
  private hook!: RebuildHook;
  private returnPx: [number, number] | null = null;
  private animationTimer = 0;
  private lastBlocked = false;
  private placedProps = 0;

  constructor() {
    super('RebuildWorld');
  }

  init(data: { returnPx?: [number, number] }): void {
    this.returnPx = data?.returnPx ?? null;
    this.npcs = [];
    this.vehicles = [];
    this.placedProps = 0;
  }

  create(): void {
    const tiled = this.cache.json.get('r2-map') as TiledMap;
    const meta = this.cache.json.get('r2-meta') as MapMeta;
    this.focus = this.cache.json.get('r2-focus') as FocusData;
    const laneData = this.cache.json.get('r2-lanes') as LaneData;
    const solidBuffer = this.cache.binary.get('r2-collision') as ArrayBuffer;
    const roadBuffer = this.cache.binary.get('r2-roads') as ArrayBuffer;
    this.roads = new Uint8Array(roadBuffer);
    this.roadWidth = meta.width;
    this.collision = new CollisionWorld(
      this.footprintsOf(tiled), new Uint8Array(solidBuffer), meta.width, meta.height, TILE,
    );
    this.network = new LaneNetwork(laneData);

    this.buildTileLayers(tiled, meta);
    const footprints = this.footprintsOf(tiled);
    this.buildBuildings(footprints);
    this.buildProps(footprints);
    this.buildVehicles(laneData);
    this.buildPlayer();
    this.buildNpcs();
    this.buildHud();

    this.cameras.main.setBounds(0, 0, meta.width * TILE, meta.height * TILE);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(2);
    this.cameras.main.setBackgroundColor('#c9c2b4');

    this.hook = {
      ready: true,
      player: { x: this.player.x, y: this.player.y },
      blockedX: false, blockedY: false, blockedFrames: 0,
      vehicles: [], buildings: footprints.length, props: this.placedProps,
      npcPathNodes: 0, playerScalePx: this.player.scaleY * 40,
      carScalePx: 64, busScalePx: 176, insideBuilding: false, debugVisible: false,
      visibleText: this.visibleTexts(),
    };
    window.__rebuild2 = this.hook;
  }

  private visibleTexts(): string[] {
    return this.children.list
      .filter((child): child is Phaser.GameObjects.Text =>
        child instanceof Phaser.GameObjects.Text && child.visible && child.alpha > 0 && child.text.length > 0)
      .map((child) => child.text);
  }

  private footprintsOf(tiled: TiledMap): Footprint[] {
    const layer = tiled.layers.find((item) => item.name === 'footprints');
    // L'object group contiene anche i POI puntuali: solo gli edifici hanno poligono.
    return (layer?.objects ?? []).filter((item) => item.type === 'building' && Array.isArray(item.polygon));
  }

  private buildTileLayers(tiled: TiledMap, meta: MapMeta): void {
    const names = ['ground', 'road_marks', 'decals'];
    for (let depth = 0; depth < names.length; depth++) {
      const layer = tiled.layers.find((item) => item.name === names[depth]);
      if (!layer || !Array.isArray(layer.data)) continue;
      const map = this.make.tilemap({
        data: rowsOf(layer.data as number[], meta.width, meta.height),
        tileWidth: TILE, tileHeight: TILE,
      });
      const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
      if (!tileset) continue;
      const rendered = map.createLayer(0, tileset, 0, 0);
      rendered?.setDepth(depth);
    }
  }

  private buildBuildings(footprints: Footprint[]): void {
    for (const footprint of footprints) {
      const points = footprint.polygon;
      if (!points || points.length < 3) continue;
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (const point of points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
      const cx = (minX + maxX) / 2;
      const osmId = String(footprint.properties?.osm_id ?? footprint.id);
      const role = Object.entries(this.focus.roles).find(([, value]) => value.osm_id === osmId)?.[0];
      const shop = role === 'bar' || role === 'pizzeria';
      const hash = footprint.id % 97;
      const style = hash % 3;
      const color = hash % 12;
      const floors = clamp(footprint.properties?.levels ?? 2, 1, 4);
      const frame = `facade_${style}_${color}_${shop ? 1 : 0}_${floors}`;
      const displayWidth = Math.max(54, maxX - minX);
      const displayHeight = FLOOR_PX * (floors + 1) + 34;

      this.add.image(cx + 5, maxY + 5, 'shadow')
        .setDisplaySize(displayWidth, 18).setAlpha(0.48).setDepth(maxY - 1);
      this.add.image(cx, maxY, 'facades', frame)
        .setOrigin(0.5, 1).setDisplaySize(displayWidth, displayHeight).setDepth(maxY);
      // Nessuna etichetta: i locali si riconoscono dalla facciata e dal prompt
      // contestuale E. I marker testuali non fanno parte della scena giocabile.
    }
  }

  private buildProps(footprints: Footprint[]): void {
    const candidates: Array<{ x: number; y: number; frame: string; width: number; height: number }> = [];
    const roles = Object.values(this.focus.roles);
    for (const role of roles) {
      const [dx, dy] = role.door_px;
      candidates.push({ x: dx - 34, y: dy + 16, frame: 'bench', width: 44, height: 26 });
      candidates.push({ x: dx + 38, y: dy + 12, frame: 'planter', width: 34, height: 30 });
      candidates.push({ x: dx + 12, y: dy + 30, frame: 'bin', width: 22, height: 30 });
      candidates.push({ x: dx - 60, y: dy - 18, frame: 'lamp', width: 26, height: 76 });
    }
    const townhall = this.focus.landmarks.townhall_px as [number, number] | undefined;
    if (townhall && townhall.length === 2) {
      candidates.push({ x: townhall[0] + 28, y: townhall[1] + 20, frame: 'fountain', width: 72, height: 72 });
      candidates.push({ x: townhall[0] - 44, y: townhall[1] + 16, frame: 'tree', width: 52, height: 76 });
      candidates.push({ x: townhall[0] + 64, y: townhall[1] - 12, frame: 'palm', width: 60, height: 96 });
    }
    // La segnaletica del bus solo presso fermate reali già presenti nel dataset.
    for (const [index, lane] of this.network.lanes.filter((item) => item.bus_compatible).slice(0, 4).entries()) {
      const point = lane.points[0];
      candidates.push({ x: point.x, y: point.y, frame: 'sign', width: 26, height: 44 + index * 0 });
    }
    let placed = 0;
    for (const candidate of candidates) {
      const spot = this.findSidewalk(candidate.x, candidate.y, 160) ?? this.findSidewalk(candidate.x, candidate.y, 96, [2]);
      if (!spot) continue;
      this.add.image(spot.x, spot.y, 'props', candidate.frame)
        .setDisplaySize(candidate.width, candidate.height).setDepth(spot.y + 2);
      placed++;
    }
    // Alberi residenziali: solo su aree verdi, lontano dai solidi.
    for (const footprint of footprints.slice(0, 120)) {
      const point = footprint.polygon[0];
      if (!point) continue;
      const x = point.x + 22;
      const y = point.y + 18;
      if (this.collision.roadClassAt(x, y, this.roads, this.roadWidth) !== 0) continue;
      if (this.collision.blockedAt(x, y, 12)) continue;
      this.add.image(x, y, 'props', 'tree').setDisplaySize(52, 76).setDepth(y + 1);
      placed++;
      if (placed >= 46) break;
    }
    this.placedProps = placed;
  }

  private findSidewalk(x: number, y: number, maxRadius: number, allowed: number[] = [3]): Point2 | null {
    for (let radius = 0; radius <= maxRadius; radius += 8) {
      for (let index = 0; index < 16; index++) {
        const angle = (index / 16) * Math.PI * 2;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        const roadClass = this.collision.roadClassAt(px, py, this.roads, this.roadWidth);
        if (!allowed.includes(roadClass)) continue;
        if (this.collision.blockedAt(px, py, 8)) continue;
        return { x: px, y: py };
      }
    }
    return null;
  }

  private buildVehicles(laneData: LaneData): void {
    const cars = this.network.compatible(false);
    const buses = this.network.compatible(true);
    const [sx, sy] = this.focus.spawn_px;
    const near = (lane: Lane) => {
      const p = lane.points[0];
      return Math.hypot(p.x - sx, p.y - sy);
    };
    const chosenCars = [...cars].sort((a, b) => near(a) - near(b))
      .filter((lane, index, all) => all.findIndex((item) => item.osm_id === lane.osm_id) === index)
      .slice(0, 3);
    const chosenBus = [...buses].sort((a, b) => near(a) - near(b))[0];
    const entries: Array<{ lane: Lane; bus: boolean; color: number }> = [
      ...chosenCars.map((lane, index) => ({ lane, bus: false, color: index % 4 })),
    ];
    if (chosenBus) entries.push({ lane: chosenBus, bus: true, color: 0 });
    for (const entry of entries) {
      const runner = new LaneRunner(this.network, entry.lane, entry.bus);
      const pose = runner.pose();
      const frame = entry.bus ? `bus_${entry.color}_${pose.direction}` : `car_${entry.color}_${pose.direction}`;
      const sprite = this.add.image(pose.x, pose.y, 'vehicles', frame)
        .setDisplaySize(entry.bus ? 176 : 64, entry.bus ? 54 : 34)
        .setDepth(pose.y);
      this.vehicles.push({ sprite, runner, bus: entry.bus, color: entry.color });
    }
    void laneData;
  }

  private buildPlayer(): void {
    const [x, y] = this.returnPx ?? this.focus.spawn_px;
    this.player = this.add.image(x, y, 'characters', 'char_0_0_0')
      .setOrigin(0.5, 0.93).setScale(0.7).setDepth(y);
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
      f1: Phaser.Input.Keyboard.KeyCodes.F1,
    }) as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.f1.on('down', () => {
      this.debugVisible = !this.debugVisible;
      this.debugGraphics.setVisible(this.debugVisible);
      if (this.hook) this.hook.debugVisible = this.debugVisible;
    });
    this.keys.e.on('down', () => this.tryEnter());
    this.debugGraphics = this.add.graphics().setDepth(1_000_000).setVisible(false);
  }

  private buildNpcs(): void {
    const [sx, sy] = this.focus.spawn_px;
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      let x = sx + Math.cos(angle) * (70 + i * 9);
      let y = sy + Math.sin(angle) * (54 + i * 7);
      if (this.collision.blockedAt(x, y, PLAYER_RADIUS)) {
        x = sx + Math.cos(angle) * 48;
        y = sy + Math.sin(angle) * 42;
      }
      const sprite = this.add.image(x, y, 'characters', `char_${i + 1}_0_0`)
        .setOrigin(0.5, 0.93).setScale(0.7).setDepth(y);
      const npc: Npc = {
        sprite, path: [], pathIndex: 0, variant: i + 1, direction: 0, phase: 0,
        timer: 500 + i * 130,
      };
      this.assignNpcTarget(npc);
      this.npcs.push(npc);
    }
    this.refreshNpcPathMetric();
  }

  private walkableTile(col: number, row: number): boolean {
    if (col < 0 || row < 0 || col >= this.roadWidth || row >= this.roads.length / this.roadWidth) return false;
    const x = (col + 0.5) * TILE;
    const y = (row + 0.5) * TILE;
    if (this.collision.roadClassAt(x, y, this.roads, this.roadWidth) === 0) return false;
    return !this.collision.blockedAt(x, y, PLAYER_RADIUS);
  }

  private assignNpcTarget(npc: Npc): void {
    const col = Math.floor(npc.sprite.x / TILE);
    const row = Math.floor(npc.sprite.y / TILE);
    for (let attempt = 0; attempt < 40; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 6 + Math.random() * 14;
      const targetCol = col + Math.round(Math.cos(angle) * distance);
      const targetRow = row + Math.round(Math.sin(angle) * distance);
      if (!this.walkableTile(targetCol, targetRow)) continue;
      const path = findPath(
        { x: npc.sprite.x, y: npc.sprite.y },
        { x: (targetCol + 0.5) * TILE, y: (targetRow + 0.5) * TILE },
        (c, r) => this.walkableTile(c, r),
        this.roadWidth, this.roads.length / this.roadWidth, TILE, 1800,
      );
      if (path.length > 1) {
        npc.path = path;
        npc.pathIndex = 1;
        return;
      }
    }
    npc.path = [];
    npc.pathIndex = 0;
  }

  private refreshNpcPathMetric(): void {
    if (!this.hook) return;
    this.hook.npcPathNodes = this.npcs.reduce((total, npc) => total + npc.path.length, 0);
  }

  private buildHud(): void {
    this.add.text(12, 12,
      'BACOLI LIFE 2.0 · ANTEPRIMA — Via Ortensio / Via Spiaggia\n' +
      'Frecce o WASD: cammina · E: entra · F1: hitbox · Esc: esci',
      {
        fontFamily: 'monospace', fontSize: '12px', color: '#e7eee6',
        backgroundColor: '#1d2a2c', padding: { x: 8, y: 6 },
      },
    ).setScrollFactor(0).setDepth(2_000_000).setAlpha(0.92);
    this.prompt = this.add.text(this.scale.width / 2, this.scale.height - 46, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#f2ead7',
      backgroundColor: '#26332f', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(2_000_000).setAlpha(0);
  }

  private tryEnter(): void {
    for (const [role, place] of Object.entries(this.focus.roles)) {
      const [dx, dy] = place.door_px;
      if (Math.hypot(this.player.x - dx, this.player.y - dy) < 58) {
        this.scene.start('RebuildInterior', {
          role, name: place.name, returnPx: [this.player.x, this.player.y],
        });
        return;
      }
    }
  }

  update(time: number, delta: number): void {
    if (!this.player || !this.hook) return;
    const left = this.keys.left.isDown || this.keys.a.isDown;
    const right = this.keys.right.isDown || this.keys.d.isDown;
    const up = this.keys.up.isDown || this.keys.w.isDown;
    const down = this.keys.down.isDown || this.keys.s.isDown;
    let dx = (right ? 1 : 0) - (left ? 1 : 0);
    let dy = (down ? 1 : 0) - (up ? 1 : 0);
    const length = Math.hypot(dx, dy);
    if (length > 0) {
      dx = (dx / length) * PLAYER_SPEED * (delta / 1000);
      dy = (dy / length) * PLAYER_SPEED * (delta / 1000);
      const result = this.collision.move(this.player.x, this.player.y, dx, dy, PLAYER_RADIUS);
      this.player.setPosition(result.x, result.y).setDepth(result.y);
      this.hook.blockedX = result.blockedX;
      this.hook.blockedY = result.blockedY;
      if (result.blockedX || result.blockedY) {
        this.hook.blockedFrames++;
        this.lastBlocked = true;
      } else {
        this.lastBlocked = false;
      }
      const direction = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 0 : 2) : (dy >= 0 ? 1 : 3);
      this.animationTimer += delta;
      const phase = Math.floor(this.animationTimer / 110) % 4;
      this.player.setFrame(`char_0_${direction}_${phase}`);
    } else {
      this.hook.blockedX = false;
      this.hook.blockedY = false;
      this.animationTimer = 0;
      this.player.setFrame('char_0_0_0');
    }
    this.hook.player.x = this.player.x;
    this.hook.player.y = this.player.y;
    this.hook.insideBuilding = this.collision.blockedAt(this.player.x, this.player.y, 0);

    this.updateVehicles(delta);
    this.updateNpcs(delta);
    this.updatePrompt();
    this.hook.visibleText = this.visibleTexts();
    if (this.debugVisible) {
      const view = this.cameras.main.worldView;
      this.collision.drawDebug(this.debugGraphics, {
        x: view.x, y: view.y, width: view.width, height: view.height,
      });
    }
    void time;
  }

  private updateVehicles(delta: number): void {
    this.vehicles.forEach((vehicle, index) => {
      const previous = vehicle.runner.pose();
      vehicle.runner.update(delta, vehicle.bus ? VEHICLE_SPEED * 0.72 : VEHICLE_SPEED);
      const pose = vehicle.runner.pose();
      const length = vehicle.bus ? 176 : 64;
      const width = vehicle.bus ? 54 : 34;
      const corners = obbCorners(pose, length, width, pose.angle);
      const hitsVehicle = this.vehicles.some((other) => {
        if (other === vehicle) return false;
        const otherPose = other.runner.pose();
        const otherCorners = obbCorners(otherPose, other.bus ? 176 : 64, other.bus ? 54 : 34, otherPose.angle);
        return obbHitsPolygon(corners, otherCorners);
      });
      if (hitsVehicle || this.collision.obbHitsAny(corners, PLAYER_RADIUS)) {
        vehicle.runner.update(-delta, vehicle.bus ? VEHICLE_SPEED * 0.72 : VEHICLE_SPEED);
        vehicle.runner.update(delta, 0);
        vehicle.sprite.setPosition(previous.x, previous.y);
      } else {
        vehicle.sprite.setPosition(pose.x, pose.y).setDepth(pose.y);
      }
      const finalPose = vehicle.runner.pose();
      const frame = vehicle.bus
        ? `bus_${vehicle.color}_${finalPose.direction}`
        : `car_${vehicle.color}_${finalPose.direction}`;
      vehicle.sprite.setFrame(frame);
      if (this.hook) {
        this.hook.vehicles[index] = {
          x: vehicle.sprite.x, y: vehicle.sprite.y,
          angle: finalPose.angle, frame, bus: vehicle.bus,
          onDrivableLane: vehicle.runner.lane.drivable && (!vehicle.bus || vehicle.runner.lane.bus_compatible),
        };
      }
    });
  }

  private updateNpcs(delta: number): void {
    this.animationTimer += delta;
    for (const npc of this.npcs) {
      npc.timer -= delta;
      if (npc.pathIndex >= npc.path.length || npc.timer <= 0) {
        this.assignNpcTarget(npc);
        npc.timer = 1800 + Math.random() * 2200;
      }
      const target = npc.path[npc.pathIndex];
      if (!target) {
        npc.phase = 0;
        npc.sprite.setFrame(`char_${npc.variant}_${npc.direction}_0`);
        continue;
      }
      const dx = target.x - npc.sprite.x;
      const dy = target.y - npc.sprite.y;
      const remaining = Math.hypot(dx, dy);
      if (remaining < 4) {
        npc.pathIndex++;
        npc.phase = 0;
      } else {
        const step = Math.min(46 * (delta / 1000), remaining);
        const result = this.collision.move(
          npc.sprite.x, npc.sprite.y,
          (dx / remaining) * step, (dy / remaining) * step,
          PLAYER_RADIUS,
        );
        npc.sprite.setPosition(result.x, result.y).setDepth(result.y);
        npc.direction = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 0 : 2) : (dy >= 0 ? 1 : 3);
        npc.phase = Math.floor(this.animationTimer / 150) % 4;
      }
      npc.sprite.setFrame(`char_${npc.variant}_${npc.direction}_${npc.phase}`);
    }
    this.refreshNpcPathMetric();
  }

  private updatePrompt(): void {
    let nearest: { name: string; role: string; distance: number } | null = null;
    for (const [role, place] of Object.entries(this.focus.roles)) {
      const [dx, dy] = place.door_px;
      const distance = Math.hypot(this.player.x - dx, this.player.y - dy);
      if (distance < 58 && (!nearest || distance < nearest.distance)) {
        nearest = { name: place.name, role, distance };
      }
    }
    if (nearest) {
      const label = nearest.role === 'bar' ? 'BAR' : nearest.role === 'pizzeria' ? 'PIZZERIA' : 'CASA';
      this.prompt.setText(`E — entra in ${label}: ${nearest.name}`).setAlpha(1);
    } else {
      this.prompt.setAlpha(0);
    }
    void this.lastBlocked;
  }
}
