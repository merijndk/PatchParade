import Phaser from 'phaser';
import { SocketManager } from '../network/SocketManager';
import type { PlayerState } from '../types';

export class LobbyScene extends Phaser.Scene {
  private socketManager!: SocketManager;
  private playerListText!: Phaser.GameObjects.Text;
  private readyButton!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private players: Map<string, PlayerState> = new Map();
  private localPlayerId: string = '';
  private isLocalPlayerReady: boolean = false;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  create(): void {
    // Get the shared SocketManager from the registry
    this.socketManager = this.registry.get('socketManager') as SocketManager;

    // Set up socket listeners FIRST, before creating UI
    this.setupSocketListeners();

    // Title
    this.add.text(400, 50, 'PATCHPARADE LOBBY', {
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Player list
    this.playerListText = this.add.text(400, 200, '', {
      fontSize: '20px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);

    // Ready button
    this.readyButton = this.add.text(400, 450, 'READY', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#00cc00',
      padding: { left: 20, right: 20, top: 10, bottom: 10 }
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => this.toggleReady())
    .on('pointerover', () => this.readyButton.setStyle({ backgroundColor: '#00ff00' }))
    .on('pointerout', () => {
      const bgColor = this.isLocalPlayerReady ? '#cc0000' : '#00cc00';
      this.readyButton.setStyle({ backgroundColor: bgColor });
    });

    // Status text
    this.statusText = this.add.text(400, 520, 'Waiting for players...', {
      fontSize: '18px',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    // After everything is set up, request current lobby state
    this.socketManager.requestLobbyState();
  }

  setupSocketListeners(): void {
    this.socketManager.onWelcome((data) => {
      this.localPlayerId = data.playerId;
      console.log('Welcome! My ID:', this.localPlayerId);

      // Store player ID in registry for other scenes to use
      this.registry.set('localPlayerId', data.playerId);

      Object.values(data.players).forEach(player => {
        this.players.set(player.id, player);
      });
      this.updatePlayerList();
    });

    this.socketManager.onPlayerJoined((player) => {
      console.log('Player joined:', player.name);
      this.players.set(player.id, player);
      this.updatePlayerList();
    });

    this.socketManager.onPlayerLeft((playerId) => {
      const player = this.players.get(playerId);
      if (player) {
        console.log('Player left:', player.name);
      }
      this.players.delete(playerId);
      this.updatePlayerList();
    });

    this.socketManager.onPlayerReadyChanged((data) => {
      const player = this.players.get(data.playerId);
      if (player) {
        player.isReady = data.isReady;

        if (data.playerId === this.localPlayerId) {
          this.isLocalPlayerReady = data.isReady;
          this.updateReadyButton();
        }

        this.updatePlayerList();
      }
    });

    this.socketManager.onAllReady(() => {
      console.log('All players ready!');
      this.statusText.setText('All players ready! Starting countdown...');
    });

    this.socketManager.onPhaseChanged((phase) => {
      console.log('Phase changed to:', phase);
      if (phase === 'countdown') {
        this.scene.start('CountdownScene');
      }
    });

    this.socketManager.onLobbyStateSync((players) => {
      console.log('Received lobby state sync');

      // Clear existing players
      this.players.clear();

      // Populate with synced player state
      Object.values(players).forEach(player => {
        this.players.set(player.id, player);
      });

      // Update the display
      this.updatePlayerList();
    });
  }

  toggleReady(): void {
    console.log('Toggling ready state');
    this.socketManager.sendToggleReady();
  }

  updatePlayerList(): void {
    let text = `Players (${this.players.size}):\n\n`;

    this.players.forEach(player => {
      const readyStatus = player.isReady ? '[READY]' : '[NOT READY]';
      const youMarker = player.id === this.localPlayerId ? ' (You)' : '';
      text += `${player.name}${youMarker} ${readyStatus}\n`;
    });

    this.playerListText.setText(text);
  }

  updateReadyButton(): void {
    if (this.isLocalPlayerReady) {
      this.readyButton.setText('NOT READY');
      this.readyButton.setStyle({ backgroundColor: '#cc0000' });
    } else {
      this.readyButton.setText('READY');
      this.readyButton.setStyle({ backgroundColor: '#00cc00' });
    }
  }

  shutdown(): void {
    // Clean up socket listeners when scene is stopped
    this.socketManager.removeAllListeners();
  }
}
