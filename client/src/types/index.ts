export interface PlayerState {
  id: string;
  x: number;
  y: number;
  color: number;
}

export interface ServerToClientEvents {
  'player:welcome': (data: { playerId: string; players: Record<string, PlayerState> }) => void;
  'player:joined': (player: PlayerState) => void;
  'player:left': (playerId: string) => void;
  'player:moved': (data: { id: string; x: number; y: number }) => void;
}

export interface ClientToServerEvents {
  'player:move': (position: { x: number; y: number }) => void;
}
