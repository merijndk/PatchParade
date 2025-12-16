import { io, Socket } from 'socket.io-client';
import { ServerToClientEvents, ClientToServerEvents, PlayerState, GamePhase } from '../types';

export class SocketManager {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
    this.socket = io(this.serverUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.socket.on('connect', () => {
      console.log('Connected to server:', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });
  }

  // Player movement
  sendMove(x: number, y: number): void {
    this.socket.emit('player:move', { x, y });
  }

  sendChangeName(name: string): void {
    this.socket.emit('player:change-name', name);
  }

  // Lobby events
  sendToggleReady(): void {
    this.socket.emit('lobby:toggle-ready');
  }

  requestLobbyState(): void {
    this.socket.emit('lobby:request-state');
  }

  sendReturnToLobby(): void {
    this.socket.emit('results:return-to-lobby');
  }

  sendMinigameReady(): void {
    this.socket.emit('minigame:ready');
  }

  sendVoteMinigame(minigameId: string): void {
    this.socket.emit('lobby:vote-minigame', minigameId);
  }

  // Bumper Balls events
  sendDash(): void {
    this.socket.emit('minigame:bumper-balls:dash');
  }

  sendBumperBallsInput(dirX: number, dirY: number): void {
    this.socket.emit('minigame:bumper-balls:input', { dirX, dirY });
  }

  // Player events
  onWelcome(callback: (data: { playerId: string; players: Record<string, PlayerState>; availableMinigames: import('../types').MinigameInfo[] }) => void): void {
    this.socket.on('player:welcome', callback);
  }

  onPlayerJoined(callback: (player: PlayerState) => void): void {
    this.socket.on('player:joined', callback);
  }

  onPlayerLeft(callback: (playerId: string) => void): void {
    this.socket.on('player:left', callback);
  }

  onPlayerMoved(callback: (data: { id: string; x: number; y: number }) => void): void {
    this.socket.on('player:moved', callback);
  }

  onPlayerNameChanged(callback: (data: { playerId: string; name: string }) => void): void {
    this.socket.on('player:name-changed', callback);
  }

  // Lobby ready events
  onPlayerReadyChanged(callback: (data: { playerId: string; isReady: boolean }) => void): void {
    this.socket.on('lobby:player-ready-changed', callback);
  }

  onAllReady(callback: () => void): void {
    this.socket.on('lobby:all-ready', callback);
  }

  onLobbyStateSync(callback: (players: Record<string, PlayerState>) => void): void {
    this.socket.on('lobby:state-sync', callback);
  }

  onVoteChanged(callback: (data: { playerId: string; minigameId: string | null }) => void): void {
    this.socket.on('lobby:vote-changed', callback);
  }

  onVoteTally(callback: (data: { votes: Record<string, number>; selectedMinigame: string | null }) => void): void {
    this.socket.on('lobby:vote-tally', callback);
  }

  // Game phase events
  onPhaseChanged(callback: (phase: GamePhase) => void): void {
    this.socket.on('game:phase-changed', callback);
  }

  onCountdownTick(callback: (count: number) => void): void {
    this.socket.on('game:countdown-tick', callback);
  }

  // Game events
  onGameStarted(callback: (data: { config: import('../types').MinigameConfig; players: Record<string, import('../types').PlayerState> }) => void): void {
    this.socket.on('game:started', callback);
  }

  onGameEnded(callback: (results: import('../types').GameResults) => void): void {
    this.socket.on('game:ended', callback);
  }

  // Obstacle events
  onObstacleSpawn(callback: (obstacle: import('../types').ObstacleState) => void): void {
    this.socket.on('minigame:obstacle-dodge:obstacle-spawn', callback);
  }

  onObstacleUpdate(callback: (data: { id: string; x: number; speed: number }) => void): void {
    this.socket.on('minigame:obstacle-dodge:obstacle-update', callback);
  }

  onObstacleRemove(callback: (obstacleId: string) => void): void {
    this.socket.on('minigame:obstacle-dodge:obstacle-remove', callback);
  }

  onPlayerDeath(callback: (data: { playerId: string; timestamp: number }) => void): void {
    this.socket.on('minigame:obstacle-dodge:player-death', callback);
  }

  // Bumper Balls events
  onBumperBallsPhysicsUpdate(callback: (data: Record<string, import('../types').PhysicsStateUpdate>) => void): void {
    this.socket.on('minigame:bumper-balls:physics-update', callback);
  }

  onBumperBallsDashActivated(callback: (data: { playerId: string }) => void): void {
    this.socket.on('minigame:bumper-balls:dash-activated', callback);
  }

  onBumperBallsPlayerEliminated(callback: (data: { playerId: string }) => void): void {
    this.socket.on('minigame:bumper-balls:player-eliminated', callback);
  }

  // Clean up all event listeners (but keep socket connection alive)
  removeAllListeners(): void {
    this.socket.off('player:welcome');
    this.socket.off('player:joined');
    this.socket.off('player:left');
    this.socket.off('player:moved');
    this.socket.off('player:name-changed');
    this.socket.off('lobby:player-ready-changed');
    this.socket.off('lobby:all-ready');
    this.socket.off('lobby:state-sync');
    this.socket.off('lobby:vote-changed');
    this.socket.off('lobby:vote-tally');
    this.socket.off('game:phase-changed');
    this.socket.off('game:countdown-tick');
    this.socket.off('game:started');
    this.socket.off('game:ended');
    this.socket.off('minigame:obstacle-dodge:obstacle-spawn');
    this.socket.off('minigame:obstacle-dodge:obstacle-update');
    this.socket.off('minigame:obstacle-dodge:obstacle-remove');
    this.socket.off('minigame:obstacle-dodge:player-death');
    this.socket.off('minigame:bumper-balls:physics-update');
    this.socket.off('minigame:bumper-balls:dash-activated');
    this.socket.off('minigame:bumper-balls:player-eliminated');
  }

  disconnect(): void {
    this.socket.disconnect();
  }
}

