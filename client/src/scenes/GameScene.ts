import Phaser from 'phaser';
import { SocketManager } from '../network/SocketManager';
import type { PlayerState, ObstacleState, MinigameConfig } from '../types';

export class GameScene extends Phaser.Scene {
  private socketManager!: SocketManager;
  private localPlayer!: Phaser.GameObjects.Graphics;
  private remotePlayers: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private localPlayerId: string = '';
  private playerSpeed: number = 200;
  private localPlayerX: number = 0;
  private localPlayerY: number = 0;
  private localPlayerColor: number = 0xffffff;

  // Minigame state
  private obstacles: Map<string, { graphics: Phaser.GameObjects.Graphics; state: ObstacleState }> = new Map();
  private deadPlayers: Set<string> = new Set();
  private gameStartTime: number = 0;
  private minigameConfig: MinigameConfig | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Get the shared SocketManager from the registry
    this.socketManager = this.registry.get('socketManager') as SocketManager;

    // Get local player ID from registry (set during lobby)
    this.localPlayerId = this.registry.get('localPlayerId') || '';

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasdKeys = this.input.keyboard!.addKeys('W,A,S,D') as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };

    this.socketManager.onWelcome((data) => {
      this.localPlayerId = data.playerId;
      console.log('Received welcome, player ID:', this.localPlayerId);

      const localPlayerState = data.players[this.localPlayerId];
      if (localPlayerState) {
        this.localPlayerX = localPlayerState.x;
        this.localPlayerY = localPlayerState.y;
        this.localPlayerColor = localPlayerState.color;

        this.localPlayer = this.createPlayerGraphics(localPlayerState.color);
        this.localPlayer.setPosition(this.localPlayerX, this.localPlayerY);
      }

      Object.entries(data.players).forEach(([id, player]) => {
        if (id !== this.localPlayerId) {
          this.addRemotePlayer(player);
        }
      });
    });

    this.socketManager.onPlayerJoined((player) => {
      console.log('Player joined:', player.id);
      this.addRemotePlayer(player);
    });

    this.socketManager.onPlayerLeft((playerId) => {
      console.log('Player left:', playerId);
      const remotePlayer = this.remotePlayers.get(playerId);
      if (remotePlayer) {
        remotePlayer.destroy();
        this.remotePlayers.delete(playerId);
      }
    });

    this.socketManager.onPlayerMoved((data) => {
      const remotePlayer = this.remotePlayers.get(data.id);
      if (remotePlayer) {
        remotePlayer.setPosition(data.x, data.y);
      }
    });

    // Set up minigame-specific socket listeners
    this.setupGameSocketListeners();

    // Signal to server that we're ready to receive game events
    console.log('GameScene initialized, sending minigame:ready');
    this.socketManager.sendMinigameReady();
  }

  private setupGameSocketListeners(): void {
    // Game start event
    this.socketManager.onGameStarted((data) => {
      console.log('Minigame started:', data.config.name);
      this.minigameConfig = data.config;
      this.gameStartTime = Date.now();
      this.deadPlayers.clear();
      this.obstacles.clear();

      // Initialize players from game start data
      Object.entries(data.players).forEach(([id, player]) => {
        if (id === this.localPlayerId) {
          // Create local player
          this.localPlayerX = player.x;
          this.localPlayerY = player.y;
          this.localPlayerColor = player.color;

          // Always create a fresh graphics object
          if (this.localPlayer) {
            this.localPlayer.destroy();
          }
          this.localPlayer = this.createPlayerGraphics(player.color);
          this.localPlayer.setPosition(this.localPlayerX, this.localPlayerY);
        } else {
          // Create or update remote player
          let remotePlayer = this.remotePlayers.get(id);
          if (remotePlayer) {
            remotePlayer.destroy();
          }
          remotePlayer = this.createPlayerGraphics(player.color);
          this.remotePlayers.set(id, remotePlayer);
          remotePlayer.setPosition(player.x, player.y);
        }
      });

      // Show "GO!" message
      const goText = this.add.text(400, 300, 'GO!', {
        fontSize: '64px',
        color: '#00ff00',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      this.tweens.add({
        targets: goText,
        scale: 1.5,
        alpha: 0,
        duration: 800,
        ease: 'Power2',
        onComplete: () => {
          goText.destroy();
        }
      });
    });

    // Obstacle spawn
    this.socketManager.onObstacleSpawn((obstacle) => {
      this.createObstacle(obstacle);
    });

    // Obstacle update (position/speed)
    this.socketManager.onObstacleUpdate((data) => {
      const obstacleEntry = this.obstacles.get(data.id);
      if (obstacleEntry) {
        obstacleEntry.state.x = data.x;
        obstacleEntry.state.speed = data.speed;

        // Update graphics position
        obstacleEntry.graphics.setPosition(data.x, 0);
      }
    });

    // Obstacle remove
    this.socketManager.onObstacleRemove((obstacleId) => {
      const obstacleEntry = this.obstacles.get(obstacleId);
      if (obstacleEntry) {
        obstacleEntry.graphics.destroy();
        this.obstacles.delete(obstacleId);
      }
    });

    // Player death
    this.socketManager.onPlayerDeath((data) => {
      console.log(`Player ${data.playerId} died`);
      this.deadPlayers.add(data.playerId);

      // Visual feedback: fade out dead player
      const remotePlayer = this.remotePlayers.get(data.playerId);
      if (remotePlayer) {
        this.tweens.add({
          targets: remotePlayer,
          alpha: 0.3,
          duration: 300
        });
      }

      // Fade out local player if it's us
      if (data.playerId === this.localPlayerId && this.localPlayer) {
        this.tweens.add({
          targets: this.localPlayer,
          alpha: 0.3,
          duration: 300
        });
      }
    });

    // Game ended - transition to results
    this.socketManager.onGameEnded((results) => {
      console.log('Game ended. Results:', results);
      this.scene.start('ResultsScene', { results });
    });
  }

  private createObstacle(obstacle: ObstacleState): void {
    const graphics = this.add.graphics();

    // Draw the obstacle bar (40px wide, 600px tall) with a gap
    graphics.fillStyle(0xff0000, 0.7);

    // Top solid section
    graphics.fillRect(0, 0, obstacle.width, obstacle.gapY);

    // Bottom solid section
    graphics.fillRect(
      0,
      obstacle.gapY + obstacle.gapSize,
      obstacle.width,
      obstacle.height - (obstacle.gapY + obstacle.gapSize)
    );

    graphics.setPosition(obstacle.x, obstacle.y);

    this.obstacles.set(obstacle.id, {
      graphics,
      state: obstacle
    });
  }

  update(time: number, delta: number): void {
    if (!this.localPlayer) {
      return;
    }

    // If player is dead, don't allow movement
    if (this.deadPlayers.has(this.localPlayerId)) {
      return;
    }

    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown || this.wasdKeys.A.isDown) {
      dx = -1;
    } else if (this.cursors.right.isDown || this.wasdKeys.D.isDown) {
      dx = 1;
    }

    if (this.cursors.up.isDown || this.wasdKeys.W.isDown) {
      dy = -1;
    } else if (this.cursors.down.isDown || this.wasdKeys.S.isDown) {
      dy = 1;
    }

    if (dx !== 0 || dy !== 0) {
      const magnitude = Math.sqrt(dx * dx + dy * dy);
      this.localPlayerX += (dx / magnitude) * this.playerSpeed * (delta / 1000);
      this.localPlayerY += (dy / magnitude) * this.playerSpeed * (delta / 1000);

      this.localPlayerX = Phaser.Math.Clamp(this.localPlayerX, 16, 784);
      this.localPlayerY = Phaser.Math.Clamp(this.localPlayerY, 16, 584);

      this.localPlayer.setPosition(this.localPlayerX, this.localPlayerY);

      this.socketManager.sendMove(this.localPlayerX, this.localPlayerY);
    }
  }

  private createPlayerGraphics(color: number): Phaser.GameObjects.Graphics {
    const graphics = this.add.graphics();
    graphics.fillStyle(color, 1);
    graphics.fillCircle(0, 0, 16);
    return graphics;
  }

  private addRemotePlayer(player: PlayerState): void {
    const graphics = this.createPlayerGraphics(player.color);
    graphics.setPosition(player.x, player.y);
    this.remotePlayers.set(player.id, graphics);
  }

  shutdown(): void {
    // Clean up socket listeners when scene is stopped
    this.socketManager.removeAllListeners();

    // Destroy all graphics objects
    if (this.localPlayer) {
      this.localPlayer.destroy();
    }

    this.remotePlayers.forEach(player => player.destroy());
    this.remotePlayers.clear();

    this.obstacles.forEach(obstacle => obstacle.graphics.destroy());
    this.obstacles.clear();

    this.deadPlayers.clear();
  }
}
