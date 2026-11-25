import './style.css';
import Phaser from 'phaser';
import { BootScene } from './BootScene';
import { WorldScene } from './WorldScene';
import { InteriorScene } from './InteriorScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'rebuild2-game',
  backgroundColor: '#1b2527',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true,
  },
  scene: [BootScene, WorldScene, InteriorScene],
};

const game = new Phaser.Game(config);
(window as unknown as { __rebuild2Game?: Phaser.Game }).__rebuild2Game = game;
