import type { Server } from 'socket.io';
import { GamePhase, type ServerToClientEvents, type ClientToServerEvents } from '../types/index.js';

export class GamePhaseManager {
  private currentPhase: GamePhase = GamePhase.LOBBY;
  private countdownTimer: NodeJS.Timeout | null = null;
  private io: Server<ClientToServerEvents, ServerToClientEvents>;

  constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io;
  }

  getCurrentPhase(): GamePhase {
    return this.currentPhase;
  }

  transitionTo(phase: GamePhase): void {
    this.currentPhase = phase;
    this.io.emit('game:phase-changed', phase);
    console.log(`Game phase changed to: ${phase}`);
  }

  startCountdown(onComplete: () => void): void {
    this.transitionTo(GamePhase.COUNTDOWN);

    let count = 3;
    const countdown = () => {
      if (count > 0) {
        this.io.emit('game:countdown-tick', count);
        console.log(`Countdown: ${count}`);
        count--;
        this.countdownTimer = setTimeout(countdown, 1000);
      } else {
        if (this.countdownTimer) {
          clearTimeout(this.countdownTimer);
          this.countdownTimer = null;
        }
        onComplete();
      }
    };

    countdown();
  }

  cancelCountdown(): void {
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
      console.log('Countdown cancelled');
    }
  }
}
