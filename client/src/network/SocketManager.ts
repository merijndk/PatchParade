import { io, Socket } from 'socket.io-client';
import { ServerToClientEvents, ClientToServerEvents, PlayerState } from '../types';

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

  sendMove(x: number, y: number): void {
    this.socket.emit('player:move', { x, y });
  }

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

  disconnect(): void {
    this.socket.disconnect();
  }
}
