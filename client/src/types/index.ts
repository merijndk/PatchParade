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
  // Obstacle Dodge
  initialBarSpeed?: number;
  barAcceleration?: number;
  spawnInterval?: number;
  gapSize?: number;
  barWidth?: number;
  barHeight?: number;
  // Bumper Balls
  arenaRadius?: number;
  moveAcceleration?: number;
  friction?: number;
  maxSpeed?: number;
  dashSpeed?: number;
  dashCooldown?: number;
  dashDuration?: number;
  // Wind (Bumper Balls)
  windSpawnChance?: number;
  windForceMagnitude?: number;
  windDuration?: number;
  windInitialDelay?: number;
}

export interface PhysicsStateUpdate {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  dashCooldown: number;
}

export interface MinigameInfo {
  id: string;
  name: string;
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
  'player:welcome': (data: { playerId: string; players: Record<string, PlayerState>; availableMinigames: MinigameInfo[] }) => void;
  'player:joined': (player: PlayerState) => void;
  'player:left': (playerId: string) => void;
  'player:moved': (data: { id: string; x: number; y: number }) => void;
  'player:name-changed': (data: { playerId: string; name: string }) => void;
  'lobby:player-ready-changed': (data: { playerId: string; isReady: boolean }) => void;
  'lobby:all-ready': () => void;
  'lobby:state-sync': (players: Record<string, PlayerState>) => void;
  'lobby:vote-changed': (data: { playerId: string; minigameId: string | null }) => void;
  'lobby:vote-tally': (data: { votes: Record<string, number>; selectedMinigame: string | null }) => void;
  'game:phase-changed': (phase: GamePhase) => void;
  'game:countdown-tick': (count: number) => void;
  'game:started': (data: { config: MinigameConfig; players: Record<string, PlayerState> }) => void;
  'game:ended': (results: GameResults) => void;
  'minigame:obstacle-dodge:obstacle-spawn': (obstacle: ObstacleState) => void;
  'minigame:obstacle-dodge:obstacle-update': (data: { id: string; x: number; speed: number }) => void;
  'minigame:obstacle-dodge:obstacle-remove': (obstacleId: string) => void;
  'minigame:obstacle-dodge:player-death': (data: { playerId: string; timestamp: number }) => void;
  'minigame:bumper-balls:physics-update': (data: Record<string, PhysicsStateUpdate>) => void;
  'minigame:bumper-balls:dash-activated': (data: { playerId: string; dirX: number; dirY: number }) => void;
  'minigame:bumper-balls:player-eliminated': (data: { playerId: string }) => void;
  'minigame:bumper-balls:wind-started': (data: { dirX: number; dirY: number }) => void;
  'minigame:bumper-balls:wind-ended': () => void;
}

export interface ClientToServerEvents {
  'player:move': (position: { x: number; y: number }) => void;
  'player:change-name': (name: string) => void;
  'lobby:toggle-ready': () => void;
  'lobby:vote-minigame': (minigameId: string) => void;
  'results:return-to-lobby': () => void;
  'minigame:ready': () => void;
  'minigame:bumper-balls:dash': () => void;
  'minigame:bumper-balls:input': (data: { dirX: number; dirY: number }) => void;
}
