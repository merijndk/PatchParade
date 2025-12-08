import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#2d2d2d',
  parent: 'game-container',
  scene: [GameScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
};

new Phaser.Game(config);
