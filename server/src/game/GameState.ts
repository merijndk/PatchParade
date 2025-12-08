import { PlayerState } from '../types/index.js';

export class GameState {
  private players: Map<string, PlayerState> = new Map();
  private readonly worldWidth = 800;
  private readonly worldHeight = 600;
  private readonly padding = 16;

  addPlayer(id: string): PlayerState {
    const player: PlayerState = {
      id,
      x: this.generateRandomX(),
      y: this.generateRandomY(),
      color: this.generateRandomColor(),
    };

    this.players.set(id, player);
    return player;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
  }

  updatePlayerPosition(id: string, x: number, y: number): void {
    const player = this.players.get(id);
    if (player) {
      player.x = this.clamp(x, this.padding, this.worldWidth - this.padding);
      player.y = this.clamp(y, this.padding, this.worldHeight - this.padding);
    }
  }

  getPlayer(id: string): PlayerState | undefined {
    return this.players.get(id);
  }

  getAllPlayers(): Record<string, PlayerState> {
    const playersObject: Record<string, PlayerState> = {};
    this.players.forEach((player, id) => {
      playersObject[id] = player;
    });
    return playersObject;
  }

  private generateRandomX(): number {
    return Math.random() * (this.worldWidth - this.padding * 2) + this.padding;
  }

  private generateRandomY(): number {
    return Math.random() * (this.worldHeight - this.padding * 2) + this.padding;
  }

  private generateRandomColor(): number {
    return Math.floor(Math.random() * 0xffffff);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
