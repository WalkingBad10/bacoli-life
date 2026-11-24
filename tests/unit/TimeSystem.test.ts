import { describe, expect, it } from 'vitest';
import { TimeSystem } from '../../src/systems/TimeSystem';

describe('Ciclo giorno/notte', () => {
  it('avanza le ore e cambia giorno', () => {
    const time = new TimeSystem();
    time.minutes = 23 * 60 + 58;
    time.update(60_000);
    expect(time.day).toBe(2);
    expect(time.hour).toBe(0);
  });

  it('la luce diurna è massima a mezzogiorno e zero di notte', () => {
    const time = new TimeSystem();
    time.minutes = 12 * 60;
    expect(time.daylight).toBe(1);
    time.minutes = 2 * 60;
    expect(time.daylight).toBe(0);
    expect(time.isNight).toBe(true);
  });

  it('formatta l\'orario con due cifre', () => {
    const time = new TimeSystem();
    time.minutes = 9 * 60 + 5;
    expect(time.clock).toBe('09:05');
  });

  it('avanza di minuti frazionari senza perdere il viaggio', () => {
    const time = new TimeSystem();
    time.minutes = 10 * 60;
    time.advance(1.5);
    time.advance(2.25);
    expect(time.minutes).toBeCloseTo(10 * 60 + 3.75);

    time.minutes = 23 * 60 + 59;
    time.advance(90);
    expect(time.day).toBe(2);
    expect(time.hour).toBe(1);
    expect(time.minute).toBe(29);
  });
});
