import type { PlayerState } from '../types/index.js';

export class LobbyManager {
  private players: Map<string, PlayerState>;

  constructor(players: Map<string, PlayerState>) {
    this.players = players;
  }

  togglePlayerReady(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (player) {
      player.isReady = !player.isReady;
      return player.isReady;
    }
    return false;
  }

  areAllPlayersReady(): boolean {
    if (this.players.size === 0) return false;

    for (const player of this.players.values()) {
      if (!player.isReady) return false;
    }

    return true;
  }

  resetReady(): void {
    this.players.forEach(p => {
      p.isReady = false;
    });
  }

  getReadyCount(): number {
    let count = 0;
    this.players.forEach(p => {
      if (p.isReady) count++;
    });
    return count;
  }
}
