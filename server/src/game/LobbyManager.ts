import type { PlayerState } from '../types/index.js';

export class LobbyManager {
  private players: Map<string, PlayerState>;
  private votes: Map<string, string> = new Map();

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

  voteForMinigame(playerId: string, minigameId: string): void {
    if (this.players.has(playerId)) {
      this.votes.set(playerId, minigameId);
    }
  }

  getPlayerVote(playerId: string): string | null {
    return this.votes.get(playerId) ?? null;
  }

  tallyVotes(): { votes: Record<string, number>; selectedMinigame: string | null } {
    const voteCounts: Record<string, number> = {};

    this.votes.forEach((minigameId) => {
      voteCounts[minigameId] = (voteCounts[minigameId] || 0) + 1;
    });

    if (Object.keys(voteCounts).length === 0) {
      return { votes: {}, selectedMinigame: null };
    }

    const maxVotes = Math.max(...Object.values(voteCounts));
    const winners = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);

    const selectedMinigame = winners.length === 1
      ? winners[0]
      : winners[Math.floor(Math.random() * winners.length)];

    return { votes: voteCounts, selectedMinigame };
  }

  resetVotes(): void {
    this.votes.clear();
  }

  removePlayerVote(playerId: string): void {
    this.votes.delete(playerId);
  }
}
