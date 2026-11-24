import { describe, expect, it } from 'vitest';
import { findPath } from '../../src/systems/Pathfinding';

const open = () => true;

describe('Pathfinding A*', () => {
  it('trova un percorso in linea retta', () => {
    const path = findPath({ x: 0, y: 0 }, { x: 3, y: 0 }, open);
    expect(path).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]);
  });

  it('aggira un ostacolo', () => {
    const blocked = new Set(['2,0', '2,1', '2,2']);
    const path = findPath({ x: 0, y: 1 }, { x: 4, y: 1 },
      (x, y) => !blocked.has(`${x},${y}`));
    expect(path.length).toBeGreaterThan(5);
    expect(path.some((p) => p.y === 3)).toBe(true);
  });

  it('restituisce un array vuoto se la destinazione non è raggiungibile', () => {
    expect(findPath({ x: 0, y: 0 }, { x: 2, y: 2 }, (x, y) => x < 2 && y < 2)).toEqual([]);
  });
});
