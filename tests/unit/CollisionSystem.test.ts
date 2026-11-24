import { describe, expect, it } from 'vitest';
import { CollisionSystem } from '../../src/systems/CollisionSystem';
import type { Place } from '../../src/core/types';

function grid(width: number, height: number): Uint8Array {
  return new Uint8Array(width * height);
}

function building(): Place {
  return {
    id: 'b1', name: 'Casa', kind: 'home', x: 5, y: 5, sprite: 0,
    footprint: [[4, 4], [5, 4], [4, 5], [5, 5]],
  };
}

describe('Collisioni', () => {
  it('blocca i tile solidi e il bordo mappa', () => {
    const c = new CollisionSystem(10, 10, grid(10, 10));
    expect(c.isSolidTile(0, 5)).toBe(true);
    expect(c.isSolidTile(5, 5)).toBe(false);
  });

  it('considera solide le footprint degli edifici', () => {
    const c = new CollisionSystem(10, 10, grid(10, 10), [building()]);
    expect(c.isSolidTile(4, 4)).toBe(true);
    expect(c.canStand(4 * 16 + 8, 4 * 16 + 8)).toBe(false);
  });

  it('non permette di attraversare un muro avanzando', () => {
    const c = new CollisionSystem(10, 10, grid(10, 10), [building()]);
    let pos = { x: 3 * 16 + 8, y: 4 * 16 + 8 };
    for (let i = 0; i < 60; i++) {
      pos = c.move(pos.x, pos.y, 2, 0);
    }
    expect(pos.x).toBeLessThan(4 * 16);
  });

  it('consente lo scorrimento lungo il muro', () => {
    const c = new CollisionSystem(10, 10, grid(10, 10), [building()]);
    let pos = { x: 3 * 16 + 8, y: 4 * 16 + 8 };
    // Nei primi passi il muro blocca X ma non Y: è lo scorrimento.
    for (let i = 0; i < 5; i++) {
      pos = c.move(pos.x, pos.y, 3, -2);
    }
    expect(pos.y).toBeLessThan(4 * 16);
    expect(pos.x).toBeLessThan(4 * 16);
    // Superato il bordo superiore dell'edificio, il movimento riprende.
    for (let i = 0; i < 25; i++) {
      pos = c.move(pos.x, pos.y, 3, -2);
    }
    expect(pos.y).toBeLessThan(3 * 16);
    expect(pos.x).toBeGreaterThan(6 * 16);
  });

  it('blocca gli oggetti circolari solidi', () => {
    const c = new CollisionSystem(10, 10, grid(10, 10));
    c.addSolid({ x: 80, y: 80, radius: 10 });
    expect(c.canStand(80, 80)).toBe(false);
    expect(c.canStand(40, 40)).toBe(true);
  });

  it('consente al veicolo di ignorare il proprio ostacolo durante la guida', () => {
    const c = new CollisionSystem(20, 20, grid(20, 20));
    c.addSolid({ id: 'car-1', x: 80, y: 80, radius: 9 });
    expect(c.canStand(80, 80, 9)).toBe(false);
    expect(c.canStand(80, 80, 9, 'car-1')).toBe(true);
    const moved = c.move(80, 80, 24, 0, 9, 'car-1');
    expect(moved.x).toBeGreaterThan(95);
  });

  it('aggiorna la posizione degli ostacoli mobili', () => {
    const c = new CollisionSystem(20, 20, grid(20, 20));
    c.addSolid({ id: 'car-1', x: 80, y: 80, radius: 9 });
    c.updateSolid('car-1', 160, 160);
    expect(c.canStand(80, 80, 9)).toBe(true);
    expect(c.canStand(160, 160, 9)).toBe(false);
  });
});
