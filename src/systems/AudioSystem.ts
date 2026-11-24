import { Howl, Howler } from 'howler';
import type { Weather } from './TimeSystem';

/** Audio originale sintetizzato, riprodotto con Howler.js. */
export class AudioSystem {
  private readonly music = new Howl({ src: ['assets/audio/music.wav'], loop: true, volume: 0.28 });
  private readonly sea = new Howl({ src: ['assets/audio/sea.wav'], loop: true, volume: 0.32 });
  private readonly gulls = new Howl({ src: ['assets/audio/gulls.wav'], loop: true, volume: 0.18 });
  private readonly rain = new Howl({ src: ['assets/audio/rain.wav'], loop: true, volume: 0.3 });
  private readonly bell = new Howl({ src: ['assets/audio/bell.wav'], volume: 0.35 });
  private started = false;
  private lastWeather: Weather | null = null;

  start(): void {
    if (this.started) return;
    this.started = true;
    Howler.volume(0.75);
    this.music.play();
    this.sea.play();
    this.gulls.play();
  }

  setWeather(weather: Weather): void {
    if (this.lastWeather === weather) return;
    this.lastWeather = weather;
    if (weather === 'rain') {
      if (!this.rain.playing()) this.rain.play();
      this.sea.volume(0.18);
      this.gulls.volume(0.04);
    } else {
      if (this.rain.playing()) this.rain.stop();
      this.sea.volume(0.32);
      this.gulls.volume(weather === 'cloud' ? 0.1 : 0.18);
    }
  }

  setNight(night: boolean): void {
    this.music.volume(night ? 0.18 : 0.28);
  }

  ringBell(): void {
    if (this.started) this.bell.play();
  }

  stop(): void {
    [this.music, this.sea, this.gulls, this.rain].forEach((sound) => sound.stop());
    this.started = false;
  }
}
