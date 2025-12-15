import Phaser from 'phaser';
import { SocketManager } from '../network/SocketManager';
import type { PlayerState } from '../types';

export class LobbyScene extends Phaser.Scene {
  private socketManager!: SocketManager;
  private playerListText!: Phaser.GameObjects.Text;
  private playerTextObjects: Phaser.GameObjects.Text[] = [];
  private readyButton!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private players: Map<string, PlayerState> = new Map();
  private localPlayerId: string = '';
  private isLocalPlayerReady: boolean = false;
  private nameInputBox!: Phaser.GameObjects.Rectangle;
  private nameInputText!: Phaser.GameObjects.Text;
  private nameInputActive: boolean = false;
  private currentNameInput: string = '';
  private changeNameButton!: Phaser.GameObjects.Text;

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

    // Name change UI
    this.add.text(400, 100, 'Change Name:', {
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.nameInputBox = this.add.rectangle(320, 145, 200, 40, 0x333333)
      .setStrokeStyle(2, 0x666666)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.activateNameInput());

    this.nameInputText = this.add.text(320, 145, 'Click to type...', {
      fontSize: '16px',
      color: '#888888'
    }).setOrigin(0.5);

    this.changeNameButton = this.add.text(480, 145, 'Change', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#0066cc',
      padding: { left: 15, right: 15, top: 8, bottom: 8 }
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => this.changeName())
    .on('pointerover', () => this.changeNameButton.setStyle({ backgroundColor: '#0088ff' }))
    .on('pointerout', () => this.changeNameButton.setStyle({ backgroundColor: '#0066cc' }));

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (!this.nameInputActive) return;

      if (event.key === 'Enter') {
        this.changeName();
      } else if (event.key === 'Backspace') {
        this.currentNameInput = this.currentNameInput.slice(0, -1);
        this.updateNameInputDisplay();
      } else if (event.key === 'Escape') {
        this.deactivateNameInput();
      } else if (event.key.length === 1 && this.currentNameInput.length < 20) {
        this.currentNameInput += event.key;
        this.updateNameInputDisplay();
      }
    });

    // Player list
    this.playerListText = this.add.text(400, 240, '', {
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

    this.socketManager.onPlayerNameChanged((data) => {
      const player = this.players.get(data.playerId);
      if (player) {
        player.name = data.name;
        this.updatePlayerList();
      }
    });
  }

  activateNameInput(): void {
    this.nameInputActive = true;
    this.nameInputBox.setStrokeStyle(2, 0x0088ff);
    this.currentNameInput = '';
    this.updateNameInputDisplay();
  }

  deactivateNameInput(): void {
    this.nameInputActive = false;
    this.nameInputBox.setStrokeStyle(2, 0x666666);
    this.currentNameInput = '';
    this.nameInputText.setText('Click to type...');
    this.nameInputText.setStyle({ color: '#888888' });
  }

  updateNameInputDisplay(): void {
    if (this.currentNameInput.length === 0) {
      this.nameInputText.setText('Click to type...');
      this.nameInputText.setStyle({ color: '#888888' });
    } else {
      this.nameInputText.setText(this.currentNameInput);
      this.nameInputText.setStyle({ color: '#ffffff' });
    }
  }

  changeName(): void {
    const newName = this.currentNameInput.trim();
    if (newName.length > 0) {
      this.socketManager.sendChangeName(newName);
      this.deactivateNameInput();
    }
  }

  toggleReady(): void {
    console.log('Toggling ready state');
    this.socketManager.sendToggleReady();
  }

  updatePlayerList(): void {
    // Clear existing player text objects
    this.playerTextObjects.forEach(textObj => textObj.destroy());
    this.playerTextObjects = [];

    // Update header
    this.playerListText.setText(`Players (${this.players.size}):`);

    // Sort players by points (descending)
    const sortedPlayers = Array.from(this.players.values()).sort((a, b) => b.points - a.points);

    // Create individual text objects for each player
    let yOffset = 280;
    sortedPlayers.forEach(player => {
      const color = player.isReady ? '#00ff00' : '#ffffff';
      const pointsDisplay = ` - ${player.points} pts`;
      const youMarker = player.id === this.localPlayerId ? ' (You)' : '';

      const playerText = this.add.text(400, yOffset, `${player.name}${youMarker}${pointsDisplay}`, {
        fontSize: '20px',
        color: color,
        align: 'center'
      }).setOrigin(0.5);

      this.playerTextObjects.push(playerText);
      yOffset += 30;
    });
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
    this.playerTextObjects.forEach(textObj => textObj.destroy());
    this.playerTextObjects = [];
    this.socketManager.removeAllListeners();
  }
}
