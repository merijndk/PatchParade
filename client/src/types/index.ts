export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  color: number;
  isReady: boolean;
  isAlive: boolean;
  points: number;
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
    pointsAwarded: number;
    totalPoints: number;
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
  'game:started': (data: { config: MinigameConfig; players: Record<string, PlayerState> }) => void;
  'game:ended': (results: GameResults) => void;
  'minigame:obstacle-dodge:obstacle-spawn': (obstacle: ObstacleState) => void;
  'minigame:obstacle-dodge:obstacle-update': (data: { id: string; x: number; speed: number }) => void;
  'minigame:obstacle-dodge:obstacle-remove': (obstacleId: string) => void;
  'minigame:obstacle-dodge:player-death': (data: { playerId: string; timestamp: number }) => void;
}

export interface ClientToServerEvents {
  'player:move': (position: { x: number; y: number }) => void;
  'lobby:toggle-ready': () => void;
  'results:return-to-lobby': () => void;
  'minigame:ready': () => void;
}
