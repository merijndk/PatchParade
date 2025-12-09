export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  color: number;
  isReady: boolean;
  isAlive: boolean;
}

export enum GamePhase {
  LOBBY = 'lobby',
  COUNTDOWN = 'countdown',
  PLAYING = 'playing',
  RESULTS = 'results'
}

export interface ObstacleState {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  gapY: number;
  gapSize: number;
  speed: number;
}

export interface MinigameConfig {
  name: string;
  initialBarSpeed: number;
  barAcceleration: number;
  spawnInterval: number;
  gapSize: number;
  barWidth: number;
  barHeight: number;
}

export interface GameResults {
  winner: string | null;
  rankings: Array<{
    playerId: string;
    playerName: string;
    survivalTime: number;
  }>;
}

export interface ServerToClientEvents {
  'player:welcome': (data: { playerId: string; players: Record<string, PlayerState> }) => void;
  'player:joined': (player: PlayerState) => void;
  'player:left': (playerId: string) => void;
  'player:moved': (data: { id: string; x: number; y: number }) => void;
  'lobby:player-ready-changed': (data: { playerId: string; isReady: boolean }) => void;
  'lobby:all-ready': () => void;
  'lobby:state-sync': (players: Record<string, PlayerState>) => void;
  'game:phase-changed': (phase: GamePhase) => void;
  'game:countdown-tick': (count: number) => void;
  'game:started': (config: MinigameConfig) => void;
  'game:ended': (results: GameResults) => void;
  'minigame:obstacle-spawned': (obstacle: ObstacleState) => void;
  'minigame:obstacle-updated': (data: { id: string; x: number; speed: number }) => void;
  'minigame:obstacle-removed': (obstacleId: string) => void;
  'minigame:player-died': (data: { playerId: string; timestamp: number }) => void;
}

export interface ClientToServerEvents {
  'player:move': (position: { x: number; y: number }) => void;
  'lobby:toggle-ready': () => void;
  'results:return-to-lobby': () => void;
}
