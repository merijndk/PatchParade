import Phaser from 'phaser';
import { SocketManager } from '../network/SocketManager';
import { PlayerState } from '../types';

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

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Get the shared SocketManager from the registry
    this.socketManager = this.registry.get('socketManager') as SocketManager;

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
  }

  update(time: number, delta: number): void {
    if (!this.localPlayer) {
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
  }
}
