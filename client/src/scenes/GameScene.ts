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
  private shiftKey!: Phaser.Input.Keyboard.Key;
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

  // Bumper Balls state
  private dashCooldown: number = 0;
  private arenaGraphics: Phaser.GameObjects.Graphics | null = null;
  private dashCooldownIndicator: Phaser.GameObjects.Graphics | null = null;
  private windArrows: Phaser.GameObjects.Graphics | null = null;
  private windIndicatorText: Phaser.GameObjects.Text | null = null;

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
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    // Listen for Shift key press for dash
    this.shiftKey.on('down', () => {
      if (this.dashCooldown <= 0 && !this.deadPlayers.has(this.localPlayerId)) {
        this.socketManager.sendDash();
        this.dashCooldown = 1500; // Optimistic cooldown
      }
    });

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

      // Create arena for Bumper Balls
      if (data.config.name === 'Bumper Balls') {
        this.createArena();
        this.dashCooldownIndicator = this.add.graphics();
        this.dashCooldownIndicator.setDepth(10);
      }

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

    // Bumper Balls physics update
    this.socketManager.onBumperBallsPhysicsUpdate((data) => {
      Object.entries(data).forEach(([playerId, state]) => {
        if (playerId === this.localPlayerId) {
          // Update local player position
          this.localPlayerX = state.x;
          this.localPlayerY = state.y;
          if (this.localPlayer) {
            this.localPlayer.setPosition(state.x, state.y);
          }
          // Update dash cooldown from server
          this.dashCooldown = state.dashCooldown;
        } else {
          // Update remote player
          const remotePlayer = this.remotePlayers.get(playerId);
          if (remotePlayer) {
            remotePlayer.setPosition(state.x, state.y);
          }
        }
      });
    });

    // Bumper Balls dash activation (visual effects)
    this.socketManager.onBumperBallsDashActivated((data) => {
      const player = data.playerId === this.localPlayerId
        ? this.localPlayer
        : this.remotePlayers.get(data.playerId);

      if (player) {
        // Flash effect
        this.tweens.add({
          targets: player,
          scaleX: 1.3,
          scaleY: 1.3,
          duration: 100,
          yoyo: true,
          ease: 'Power2'
        });

        // Trail effect - appears behind the player (opposite of dash direction)
        const trail = this.add.graphics();
        trail.fillStyle(0xffffff, 0.5);

        // Calculate trail position (opposite direction of dash)
        const trailDistance = 30; // Distance behind player
        const trailX = player.x - data.dirX * trailDistance;
        const trailY = player.y - data.dirY * trailDistance;

        trail.fillCircle(trailX, trailY, 20);
        this.tweens.add({
          targets: trail,
          alpha: 0,
          x: trail.x - data.dirX * 60,    // Move away from dash direction
          y: trail.y - data.dirY * 60,    // Move away from dash direction
          duration: 300,
          onComplete: () => trail.destroy()
        });
      }
    });

    // Bumper Balls player elimination
    this.socketManager.onBumperBallsPlayerEliminated((data) => {
      console.log(`Player ${data.playerId} eliminated!`);
      this.deadPlayers.add(data.playerId);

      const player = data.playerId === this.localPlayerId
        ? this.localPlayer
        : this.remotePlayers.get(data.playerId);

      if (player) {
        // Fall off animation
        this.tweens.add({
          targets: player,
          alpha: 0,
          scaleX: 0.5,
          scaleY: 0.5,
          duration: 500,
          ease: 'Power2'
        });
      }
    });

    // Wind events
    this.socketManager.onWindStarted((data) => {
      this.showWindEffect(data.dirX, data.dirY);
    });

    this.socketManager.onWindEnded(() => {
      this.clearWindEffect();
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

  private createArena(): void {
    const centerX = 400;
    const centerY = 300;
    const arenaRadius = 280;

    this.arenaGraphics = this.add.graphics();

    // Ice surface (light blue fill)
    this.arenaGraphics.fillStyle(0xd0f0ff, 0.3);
    this.arenaGraphics.fillCircle(centerX, centerY, arenaRadius);

    // Arena border (thick white stroke)
    this.arenaGraphics.lineStyle(8, 0xffffff, 1);
    this.arenaGraphics.strokeCircle(centerX, centerY, arenaRadius);

    // Danger zone indicator (red glow near edge)
    this.arenaGraphics.lineStyle(4, 0xff0000, 0.5);
    this.arenaGraphics.strokeCircle(centerX, centerY, arenaRadius - 10);

    // Ice texture effects (decorative lines)
    this.arenaGraphics.lineStyle(1, 0xffffff, 0.2);

    // Draw radial ice cracks
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const x1 = centerX + Math.cos(angle) * 50;
      const y1 = centerY + Math.sin(angle) * 50;
      const x2 = centerX + Math.cos(angle) * (arenaRadius - 20);
      const y2 = centerY + Math.sin(angle) * (arenaRadius - 20);
      this.arenaGraphics.lineBetween(x1, y1, x2, y2);
    }

    // Draw concentric circles for depth
    this.arenaGraphics.strokeCircle(centerX, centerY, arenaRadius * 0.3);
    this.arenaGraphics.strokeCircle(centerX, centerY, arenaRadius * 0.6);

    // Set arena behind players
    this.arenaGraphics.setDepth(-2);
  }

  update(time: number, delta: number): void {
    if (!this.localPlayer) {
      return;
    }

    // Update dash cooldown
    if (this.dashCooldown > 0) {
      this.dashCooldown -= delta;
      if (this.dashCooldown < 0) {
        this.dashCooldown = 0;
      }
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

    // Check if we're playing Bumper Balls
    if (this.minigameConfig && this.minigameConfig.name === 'Bumper Balls') {
      // Normalize diagonal movement
      if (dx !== 0 && dy !== 0) {
        const magnitude = Math.sqrt(2);
        dx /= magnitude;
        dy /= magnitude;
      }

      // Send input to server (ALWAYS, even when (0,0) to clear server-side input)
      this.socketManager.sendBumperBallsInput(dx, dy);

      // Draw dash cooldown indicator
      if (this.dashCooldownIndicator) {
        this.dashCooldownIndicator.clear();

        if (this.dashCooldown > 0) {
          const cooldownPercent = this.dashCooldown / 1500;
          const barWidth = 30;
          const barHeight = 4;
          const x = this.localPlayerX - barWidth / 2;
          const y = this.localPlayerY + 25;

          // Background
          this.dashCooldownIndicator.fillStyle(0x000000, 0.5);
          this.dashCooldownIndicator.fillRect(x, y, barWidth, barHeight);

          // Cooldown progress
          this.dashCooldownIndicator.fillStyle(0x00ffff, 1);
          this.dashCooldownIndicator.fillRect(
            x,
            y,
            barWidth * (1 - cooldownPercent),
            barHeight
          );
        }
      }
    } else {
      // Obstacle Dodge movement (existing behavior)
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

  private showWindEffect(dirX: number, dirY: number): void {
    // Clear any existing wind visuals
    this.clearWindEffect();

    // Create wind arrows
    this.windArrows = this.add.graphics();
    this.windArrows.setDepth(-1); // Behind players

    // Draw multiple arrows showing wind direction
    const arrowCount = 8;
    const arenaRadius = 280;
    const arrowLength = 40;
    const arrowAngle = Math.atan2(dirY, dirX);

    this.windArrows.lineStyle(3, 0xffffff, 0.6);

    for (let i = 0; i < arrowCount; i++) {
      const angle = (Math.PI * 2 / arrowCount) * i;
      const distance = arenaRadius * 0.7;
      const centerX = 400 + Math.cos(angle) * distance;
      const centerY = 300 + Math.sin(angle) * distance;

      // Arrow line
      const startX = centerX - Math.cos(arrowAngle) * arrowLength / 2;
      const startY = centerY - Math.sin(arrowAngle) * arrowLength / 2;
      const endX = centerX + Math.cos(arrowAngle) * arrowLength / 2;
      const endY = centerY + Math.sin(arrowAngle) * arrowLength / 2;

      this.windArrows.lineBetween(startX, startY, endX, endY);

      // Arrow head
      const headLength = 10;
      const headAngle = Math.PI / 6;

      this.windArrows.lineBetween(
        endX,
        endY,
        endX - Math.cos(arrowAngle - headAngle) * headLength,
        endY - Math.sin(arrowAngle - headAngle) * headLength
      );

      this.windArrows.lineBetween(
        endX,
        endY,
        endX - Math.cos(arrowAngle + headAngle) * headLength,
        endY - Math.sin(arrowAngle + headAngle) * headLength
      );
    }

    // Wind indicator text
    this.windIndicatorText = this.add.text(400, 50, 'WIND ACTIVE!', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    });
    this.windIndicatorText.setOrigin(0.5);
    this.windIndicatorText.setDepth(10);

    // Fade in animation
    this.windArrows.setAlpha(0);
    this.windIndicatorText.setAlpha(0);

    this.tweens.add({
      targets: [this.windArrows, this.windIndicatorText],
      alpha: 1,
      duration: 300
    });
  }

  private clearWindEffect(): void {
    if (this.windArrows) {
      this.tweens.add({
        targets: this.windArrows,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          this.windArrows?.destroy();
          this.windArrows = null;
        }
      });
    }

    if (this.windIndicatorText) {
      this.tweens.add({
        targets: this.windIndicatorText,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          this.windIndicatorText?.destroy();
          this.windIndicatorText = null;
        }
      });
    }
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

    // Clean up Bumper Balls graphics
    if (this.arenaGraphics) {
      this.arenaGraphics.destroy();
      this.arenaGraphics = null;
    }

    if (this.dashCooldownIndicator) {
      this.dashCooldownIndicator.destroy();
      this.dashCooldownIndicator = null;
    }

    // Clean up wind visuals
    this.clearWindEffect();

    this.deadPlayers.clear();
  }
}
