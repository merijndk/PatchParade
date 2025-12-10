import Phaser from 'phaser';
import { SocketManager } from '../network/SocketManager';

export class CountdownScene extends Phaser.Scene {
  private socketManager!: SocketManager;
  private countdownText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'CountdownScene' });
  }

  create(): void {
    // Get the shared SocketManager from the registry
    this.socketManager = this.registry.get('socketManager') as SocketManager;

    // Title
    this.add.text(400, 150, 'GET READY!', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Countdown number (will be updated)
    this.countdownText = this.add.text(400, 300, '3', {
      fontSize: '128px',
      color: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.setupSocketListeners();
  }

  setupSocketListeners(): void {
    this.socketManager.onCountdownTick((count) => {
      console.log('Countdown tick:', count);

      // Update text
      this.countdownText.setText(count.toString());

      // Animate the countdown number
      this.countdownText.setScale(0.5);
      this.tweens.add({
        targets: this.countdownText,
        scale: 1.2,
        duration: 300,
        yoyo: true,
        ease: 'Bounce.easeOut'
      });

      // Play a sound effect (optional - you'd need to load this first)
      // this.sound.play('countdown');
    });

    this.socketManager.onPhaseChanged((phase) => {
      console.log('Phase changed to:', phase);

      if (phase === 'playing') {
        // Start GameScene immediately so it can receive game:started event
        this.scene.start('GameScene');
      } else if (phase === 'results') {
        // Game ended, will be handled by GameScene
      } else if (phase === 'lobby') {
        // Return to lobby
        this.scene.start('LobbyScene');
      }
    });
  }

  showStartMessage(): void {
    // Clear countdown text
    this.countdownText.setText('GO!');
    this.countdownText.setStyle({ color: '#00ff00' });

    this.tweens.add({
      targets: this.countdownText,
      scale: 1.5,
      alpha: 0,
      duration: 1000,
      ease: 'Power2'
    });

    // Show a message that the game would start
    this.add.text(400, 300, 'Game Starting...', {
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5).setAlpha(0).setData('fadeIn', true);

    const message = this.add.text(400, 350, '(Returning to lobby)', {
      fontSize: '18px',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    this.tweens.add({
      targets: message,
      alpha: { from: 0, to: 1 },
      duration: 500
    });
  }

  shutdown(): void {
    // Clean up socket listeners when scene is stopped
    this.socketManager.removeAllListeners();
  }
}
