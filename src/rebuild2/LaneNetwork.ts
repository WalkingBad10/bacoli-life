import type { Lane, LaneData, Point2 } from './types';

function asPoint(value: Point2 | [number, number]): Point2 {
  return Array.isArray(value) ? { x: value[0], y: value[1] } : value;
}

export interface VehiclePose {
  x: number;
  y: number;
  angle: number;
  direction: number;
}

function distance(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Grafo di corsie reali, con vincoli di guidabilità e compatibilità bus. */
export class LaneNetwork {
  readonly lanes: Lane[];
  private readonly byFrom = new Map<string, Lane[]>();

  constructor(data: LaneData) {
    this.lanes = data.lanes.map((lane) => ({
      ...lane,
      points: lane.points.map((point) => asPoint(point as Point2 | [number, number])),
    }));
    for (const lane of this.lanes) {
      const list = this.byFrom.get(lane.from) ?? [];
      list.push(lane);
      this.byFrom.set(lane.from, list);
    }
  }

  compatible(bus: boolean): Lane[] {
    return this.lanes.filter((lane) => lane.drivable && lane.length_px > 90 && (!bus || lane.bus_compatible));
  }

  next(lane: Lane, bus: boolean): Lane | null {
    const candidates = (this.byFrom.get(lane.to) ?? []).filter(
      (item) => item.drivable && item.id !== lane.id && (!bus || item.bus_compatible) && item.points.length > 1,
    );
    if (candidates.length === 0) return null;
    const end = lane.points[lane.points.length - 1];
    const connected = candidates.filter((item) => distance(end, item.points[0]) < 48);
    const pool = connected.length > 0 ? connected : candidates;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}

/** Percorre una corsia senza mai uscire dalla polilinea; in caso di capolinea torna indietro. */
export class LaneRunner {
  private points: Point2[];
  private index = 0;
  private progress = 0;
  private reversed = false;

  constructor(private readonly network: LaneNetwork, public lane: Lane, private readonly bus: boolean) {
    this.points = lane.points;
    this.index = 0;
  }

  pose(): VehiclePose {
    const a = this.points[this.index];
    const b = this.points[Math.min(this.index + 1, this.points.length - 1)];
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const direction = Math.abs(dx) >= Math.abs(dy)
      ? (dx >= 0 ? 0 : 2)
      : (dy >= 0 ? 1 : 3);
    return { x: a.x + (b.x - a.x) * this.progress, y: a.y + (b.y - a.y) * this.progress, angle, direction };
  }

  update(deltaMs: number, speedPxPerSec: number): void {
    let remaining = (speedPxPerSec * deltaMs) / 1000;
    let guard = 0;
    while (remaining > 0 && guard++ < 16) {
      const a = this.points[this.index];
      const b = this.points[this.index + 1];
      if (!b) {
        this.turnAroundOrSwitch();
        continue;
      }
      const segment = distance(a, b);
      const available = segment * (1 - this.progress);
      if (available <= 0) {
        this.index++;
        this.progress = 0;
        continue;
      }
      if (remaining < available) {
        this.progress += remaining / segment;
        remaining = 0;
      } else {
        remaining -= available;
        this.index++;
        this.progress = 0;
        if (this.index >= this.points.length - 1) this.turnAroundOrSwitch();
      }
    }
  }

  private turnAroundOrSwitch(): void {
    const next = this.network.next(this.lane, this.bus);
    if (next) {
      this.lane = next;
      this.points = next.points;
      this.index = 0;
      this.progress = 0;
      if (distance(this.points[0], this.points[this.points.length - 1]) < 1) this.reversed = false;
      return;
    }
    this.points = [...this.points].reverse();
    this.index = 0;
    this.progress = 0;
    this.reversed = !this.reversed;
  }

  get isReversed(): boolean {
    return this.reversed;
  }
}
