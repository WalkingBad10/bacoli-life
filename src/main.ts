import './style.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { InteriorScene } from './scenes/InteriorScene';
import { TransitScene } from './scenes/TransitScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0c1823',
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
  scene: [BootScene, WorldScene, InteriorScene, TransitScene],
};

const game = new Phaser.Game(config);

// Hook reads-only per i test automatici e per il debug in console.
(window as unknown as { __bacoli?: Phaser.Game }).__bacoli = game;
