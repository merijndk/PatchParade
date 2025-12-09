import type { Server } from 'socket.io';
import type { PlayerState, ServerToClientEvents, ClientToServerEvents, GamePhase } from '../types/index.js';
import { LobbyManager } from './LobbyManager.js';
import { GamePhaseManager } from './GamePhaseManager.js';

export class GameStateManager {
  private players: Map<string, PlayerState> = new Map();
  private lobbyManager: LobbyManager;
  private phaseManager: GamePhaseManager;
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private readonly worldWidth = 800;
  private readonly worldHeight = 600;
  private readonly padding = 16;

  constructor(io: Server<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io;
    this.lobbyManager = new LobbyManager(this.players);
    this.phaseManager = new GamePhaseManager(io);
  }

  // Player management
  addPlayer(id: string): PlayerState {
    const player: PlayerState = {
      id,
      name: '', // Will be set by caller
      x: this.generateRandomX(),
      y: this.generateRandomY(),
      color: this.generateRandomColor(),
      isReady: false,
      isAlive: true,
    };

    this.players.set(id, player);
    return player;
  }

  removePlayer(id: string): void {
    this.players.delete(id);

    // If we're in lobby and someone leaves, check if we need to cancel countdown
    if (this.phaseManager.getCurrentPhase() === 'lobby' ||
        this.phaseManager.getCurrentPhase() === 'countdown') {
      if (!this.lobbyManager.areAllPlayersReady()) {
        this.phaseManager.cancelCountdown();
      }
    }
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

  // Lobby management
  togglePlayerReady(id: string): void {
    const isReady = this.lobbyManager.togglePlayerReady(id);
    this.io.emit('lobby:player-ready-changed', { playerId: id, isReady });

    console.log(`Player ${id} ready state: ${isReady}`);
    console.log(`Ready count: ${this.lobbyManager.getReadyCount()}/${this.players.size}`);

    if (this.lobbyManager.areAllPlayersReady() && this.players.size > 0) {
      console.log('All players ready! Starting countdown...');
      this.io.emit('lobby:all-ready');
      this.startGame();
    }
  }

  // Game flow
  private startGame(): void {
    this.phaseManager.startCountdown(() => {
      this.phaseManager.transitionTo('playing' as GamePhase);
      console.log('Game would start here (minigame not implemented yet)');

      // For now, just log that we would start the game
      // In full implementation, this would call this.startMinigame('obstacleDodge')

      // After a few seconds, transition back to lobby for testing
      setTimeout(() => {
        this.returnToLobby();
      }, 5000);
    });
  }

  returnToLobby(): void {
    this.lobbyManager.resetReady();
    this.phaseManager.transitionTo('lobby' as GamePhase);

    // Broadcast current player state to all clients
    const allPlayers = this.getAllPlayers();
    this.io.emit('lobby:state-sync', allPlayers);

    console.log('Returned to lobby');
  }

  // Helper methods
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
