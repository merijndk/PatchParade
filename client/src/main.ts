import Phaser from 'phaser';
import { LobbyScene } from './scenes/LobbyScene';
import { CountdownScene } from './scenes/CountdownScene';
import { GameScene } from './scenes/GameScene';
import { ResultsScene } from './scenes/ResultsScene';
import { SocketManager } from './network/SocketManager';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#2d2d2d',
  parent: 'game-container',
  scene: [LobbyScene, CountdownScene, GameScene, ResultsScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
};

const game = new Phaser.Game(config);

// Create a single SocketManager instance and store it in the registry
// This allows all scenes to share the same socket connection
const serverUrl = (import.meta as any).env?.VITE_SERVER_URL || 'http://localhost:3000';
const socketManager = new SocketManager(serverUrl);
game.registry.set('socketManager', socketManager);
