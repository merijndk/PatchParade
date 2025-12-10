import Phaser from 'phaser';
import { SocketManager } from '../network/SocketManager';
import type { GameResults } from '../types';

export class ResultsScene extends Phaser.Scene {
  private socketManager!: SocketManager;
  private results!: GameResults;

  constructor() {
    super({ key: 'ResultsScene' });
  }

  init(data: { results: GameResults }): void {
    this.results = data.results;
  }

  create(): void {
    this.socketManager = this.registry.get('socketManager') as SocketManager;

    // Listen for phase changes (when any player clicks return to lobby)
    this.socketManager.onPhaseChanged((phase) => {
      if (phase === 'lobby') {
        this.scene.start('LobbyScene');
      }
    });

    // Title
    this.add.text(400, 50, 'GAME OVER', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Winner announcement
    if (this.results.winner) {
      const winnerRanking = this.results.rankings[0];
      this.add.text(400, 120, `WINNER: ${winnerRanking.playerName}`, {
        fontSize: '32px',
        color: '#ffff00',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const survivalSeconds = (winnerRanking.survivalTime / 1000).toFixed(2);
      this.add.text(400, 160, `Survived: ${survivalSeconds}s | +${winnerRanking.pointsAwarded} points`, {
        fontSize: '20px',
        color: '#ffff00'
      }).setOrigin(0.5);
    } else {
      this.add.text(400, 120, 'NO SURVIVORS', {
        fontSize: '32px',
        color: '#ff0000',
        fontStyle: 'bold'
      }).setOrigin(0.5);
    }

    // Rankings
    let yPos = 220;
    this.add.text(400, yPos, 'Rankings:', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    yPos += 40;

    this.results.rankings.forEach((ranking, index) => {
      const survivalSeconds = (ranking.survivalTime / 1000).toFixed(2);
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;

      this.add.text(400, yPos, `${medal} ${ranking.playerName}`, {
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      yPos += 25;

      this.add.text(400, yPos, `${survivalSeconds}s | +${ranking.pointsAwarded} pts (Total: ${ranking.totalPoints})`, {
        fontSize: '14px',
        color: '#aaaaaa'
      }).setOrigin(0.5);
      yPos += 30;
    });

    // Return to lobby button
    const returnButton = this.add.text(400, 550, 'RETURN TO LOBBY', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#0066cc',
      padding: { left: 15, right: 15, top: 8, bottom: 8 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.returnToLobby())
      .on('pointerover', () => returnButton.setStyle({ backgroundColor: '#0088ff' }))
      .on('pointerout', () => returnButton.setStyle({ backgroundColor: '#0066cc' }));
  }

  private returnToLobby(): void {
    this.socketManager.sendReturnToLobby();
    this.scene.start('LobbyScene');
  }

  shutdown(): void {
    this.socketManager.removeAllListeners();
  }
}
