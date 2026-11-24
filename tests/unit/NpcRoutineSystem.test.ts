import { describe, expect, it } from 'vitest';
import { NPC_PROFILES, routineLabel, routineSlot } from '../../src/systems/NpcRoutineSystem';

describe('Routine quotidiane NPC', () => {
  it('define almeno 24 abitanti con ruoli diversi', () => {
    expect(NPC_PROFILES.length).toBeGreaterThanOrEqual(24);
    expect(new Set(NPC_PROFILES.map((p) => p.name)).size).toBe(NPC_PROFILES.length);
    expect(new Set(NPC_PROFILES.map((p) => p.role)).size).toBeGreaterThan(8);
  });

  it('porta gli NPC a casa di notte e al lavoro di giorno', () => {
    expect(routineSlot('Maria', 23)).toBe('home');
    expect(routineSlot('Maria', 3)).toBe('home');
    expect(routineSlot('Maria', 10)).toBe('work');
    expect(routineSlot('Maria', 14)).toBe('lunch');
    expect(routineSlot('Maria', 19)).toBe('errands');
  });

  it('sfasa le routine in base alla personalità', () => {
    const early = routineSlot('Maria', 16);
    const late = routineSlot('Concetta', 16);
    expect(['beach', 'work']).toContain(early);
    expect(['beach', 'work']).toContain(late);
    expect(routineLabel('evening')).toBe('in piazza');
  });
});
