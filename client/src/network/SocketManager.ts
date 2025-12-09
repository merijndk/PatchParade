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

  // Lobby events
  sendToggleReady(): void {
    this.socket.emit('lobby:toggle-ready');
  }

  sendReturnToLobby(): void {
    this.socket.emit('results:return-to-lobby');
  }

  // Player events
  onWelcome(callback: (data: { playerId: string; players: Record<string, PlayerState> }) => void): void {
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

  // Lobby ready events
  onPlayerReadyChanged(callback: (data: { playerId: string; isReady: boolean }) => void): void {
    this.socket.on('lobby:player-ready-changed', callback);
  }

  onAllReady(callback: () => void): void {
    this.socket.on('lobby:all-ready', callback);
  }

  // Game phase events
  onPhaseChanged(callback: (phase: GamePhase) => void): void {
    this.socket.on('game:phase-changed', callback);
  }

  onCountdownTick(callback: (count: number) => void): void {
    this.socket.on('game:countdown-tick', callback);
  }

  // Clean up all event listeners (but keep socket connection alive)
  removeAllListeners(): void {
    this.socket.off('player:welcome');
    this.socket.off('player:joined');
    this.socket.off('player:left');
    this.socket.off('player:moved');
    this.socket.off('lobby:player-ready-changed');
    this.socket.off('lobby:all-ready');
    this.socket.off('game:phase-changed');
    this.socket.off('game:countdown-tick');
  }

  disconnect(): void {
    this.socket.disconnect();
  }
}

