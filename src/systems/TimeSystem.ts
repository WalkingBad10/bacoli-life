import { DAY_LENGTH_SECONDS } from '../core/config';

export type Weather = 'sun' | 'cloud' | 'rain';

export class TimeSystem {
  /** minuti di gioco dall'inizio della giornata. */
  minutes = 8 * 60;
  day = 1;
  weather: Weather = 'sun';

  update(deltaMs: number): void {
    this.advance((deltaMs / 1000) * (24 * 60) / DAY_LENGTH_SECONDS);
  }

  /** Avanza di minuti di gioco gestendo il cambio giorno e il meteo. */
  advance(minutes: number): void {
    this.minutes += minutes;
    while (this.minutes >= 24 * 60) {
      this.minutes -= 24 * 60;
      this.day += 1;
      this.weather = this.rollWeather();
    }
  }

  private rollWeather(): Weather {
    const roll = (this.day * 37) % 100;
    if (roll < 18) return 'rain';
    if (roll < 42) return 'cloud';
    return 'sun';
  }

  get hour(): number {
    return Math.floor(this.minutes / 60);
  }

  get minute(): number {
    return Math.floor(this.minutes % 60);
  }

  get clock(): string {
    return `${String(this.hour).padStart(2, '0')}:${String(this.minute).padStart(2, '0')}`;
  }

  /** 0 = notte, 1 = pieno giorno. */
  get daylight(): number {
    const h = this.minutes / 60;
    if (h < 5 || h > 21) return 0;
    if (h < 7) return (h - 5) / 2;
    if (h > 19) return (21 - h) / 2;
    return 1;
  }

  get isNight(): boolean {
    return this.daylight < 0.25;
  }
}
