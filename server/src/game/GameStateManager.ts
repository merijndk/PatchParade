import type { Server } from 'socket.io';
import type { PlayerState, ServerToClientEvents, ClientToServerEvents, GamePhase, MinigameConfig, GameResults } from '../types/index.js';
import { LobbyManager } from './LobbyManager.js';
import { GamePhaseManager } from './GamePhaseManager.js';
import { ObstacleManager } from './ObstacleManager.js';
import { ConfigLoader } from '../config/ConfigLoader.js';

export class GameStateManager {
  private players: Map<string, PlayerState> = new Map();
  private lobbyManager: LobbyManager;
  private phaseManager: GamePhaseManager;
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private readonly worldWidth = 800;
  private readonly worldHeight = 600;
  private readonly padding = 16;

  // Minigame state
  private obstacleManager: ObstacleManager | null = null;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private gameStartTime: number = 0;
  private deathTimes: Map<string, number> = new Map();
  private deathOrder: string[] = [];
  private minigameConfig: MinigameConfig | null = null;
  private minigameReadyPlayers: Set<string> = new Set();
  private isWaitingForMinigameReady: boolean = false;

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
      points: 0,
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

    // If waiting for minigame ready signals, remove from ready set and recheck
    if (this.isWaitingForMinigameReady) {
      this.minigameReadyPlayers.delete(id);
      console.log(`Player ${id} disconnected while waiting for ready. ${this.minigameReadyPlayers.size}/${this.players.size} ready.`);

      // Check if remaining players are all ready
      if (this.minigameReadyPlayers.size === this.players.size && this.players.size > 0) {
        console.log('All remaining players ready! Broadcasting game:started...');
        this.isWaitingForMinigameReady = false;
        this.minigameReadyPlayers.clear();

        // Broadcast game start event to all clients with player positions
        this.io.emit('game:started', {
          config: this.minigameConfig,
          players: this.getAllPlayers()
        });

        this.startGameLoop();
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

  changePlayerName(id: string, name: string): void {
    const player = this.players.get(id);
    if (player) {
      player.name = name.trim() || player.name;
      this.io.emit("player:name-changed", { playerId: id, name: player.name });
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
      console.log('Starting minigame: obstacleDodge');
      this.startMinigame('obstacleDodge');
    });
  }

  private startMinigame(minigameName: string): void {
    try {
      // Load minigame configuration
      this.minigameConfig = ConfigLoader.getConfig(minigameName);

      // Reset all players to alive and spawn them at starting position
      const spawnX = this.worldWidth - 100; // 100px from right edge
      const spawnY = this.worldHeight / 2;   // Vertically centered

      this.players.forEach(player => {
        player.isAlive = true;
        player.x = spawnX;
        player.y = spawnY;
      });

      // Initialize obstacle manager
      this.obstacleManager = new ObstacleManager(
        {
          worldWidth: this.worldWidth,
          worldHeight: this.worldHeight,
          barWidth: this.minigameConfig.barWidth,
          barHeight: this.minigameConfig.barHeight,
          gapSize: this.minigameConfig.gapSize,
          initialSpeed: this.minigameConfig.initialBarSpeed,
          acceleration: this.minigameConfig.barAcceleration,
          padding: this.padding,
        },
        this.minigameConfig.spawnInterval
      );

      this.gameStartTime = Date.now();
      this.deathTimes.clear();
      this.deathOrder = [];

      // Wait for all clients to be ready before starting the game loop
      this.isWaitingForMinigameReady = true;
      this.minigameReadyPlayers.clear();

      console.log(`Waiting for ${this.players.size} clients to send minigame:ready...`);

      // DON'T start game loop yet - wait for all clients to signal ready!
    } catch (error) {
      console.error('Failed to start minigame:', error);
    }
  }

  onMinigameReady(playerId: string): void {
    if (!this.isWaitingForMinigameReady) {
      console.warn(`Received minigame:ready from ${playerId} but not waiting for ready`);
      return;
    }

    this.minigameReadyPlayers.add(playerId);
    console.log(`Player ${playerId} ready (${this.minigameReadyPlayers.size}/${this.players.size})`);

    // Check if all players are ready
    if (this.minigameReadyPlayers.size === this.players.size) {
      console.log('All players ready! Broadcasting game:started...');
      this.isWaitingForMinigameReady = false;
      this.minigameReadyPlayers.clear();

      // Broadcast game start event to all clients with player positions
      this.io.emit('game:started', {
        config: this.minigameConfig,
        players: this.getAllPlayers()
      });

      // NOW start the game loop
      this.startGameLoop();
    }
  }

  private startGameLoop(): void {
    const FRAME_DURATION = 1000 / 60; // 60 FPS
    let lastTime = Date.now();

    this.gameLoopInterval = setInterval(() => {
      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000; // Convert to seconds
      lastTime = now;

      if (!this.obstacleManager) return;

      // 1. Spawn new obstacles if needed
      const newObstacle = this.obstacleManager.updateSpawning(now);
      if (newObstacle) {
        this.io.emit('minigame:obstacle-dodge:obstacle-spawn', newObstacle);
      }

      // 2. Update obstacle positions
      this.obstacleManager.updateObstacles(deltaTime);

      // 3. Check collisions for all alive players
      const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);

      for (const player of alivePlayers) {
        const collision = this.obstacleManager.checkCollision(
          player.id,
          player.x,
          player.y,
          16 // Player radius
        );

        if (collision) {
          this.handlePlayerDeath(player.id, now);
        }
      }

      // 4. Remove expired obstacles and broadcast updates
      const removedIds = this.obstacleManager.removeExpiredObstacles();
      for (const id of removedIds) {
        this.io.emit('minigame:obstacle-dodge:obstacle-remove', id);
      }

      // 5. Broadcast obstacle updates to clients (every frame)
      const allObstacles = this.obstacleManager.getAllObstacles();
      Object.entries(allObstacles).forEach(([id, obstacle]) => {
        this.io.emit('minigame:obstacle-dodge:obstacle-update', {
          id: obstacle.id,
          x: obstacle.x,
          speed: obstacle.speed
        });
      });

      // 6. Check win condition: only 1 or 0 players alive
      const aliveCount = Array.from(this.players.values()).filter(p => p.isAlive).length;
      if (aliveCount <= 1) {
        this.endMinigame();
      }
    }, FRAME_DURATION);
  }

  private handlePlayerDeath(playerId: string, timestamp: number): void {
    const player = this.players.get(playerId);
    if (player && player.isAlive) {
      player.isAlive = false;
      this.deathTimes.set(playerId, timestamp);
      this.deathOrder.push(playerId);

      // Broadcast death event to all clients
      this.io.emit('minigame:obstacle-dodge:player-death', {
        playerId,
        timestamp
      });

      console.log(`Player ${playerId} died at ${new Date(timestamp).toISOString()}`);
    }
  }

  private endMinigame(): void {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }

    this.phaseManager.transitionTo('results' as GamePhase);

    // Award points based on death order
    this.awardPoints();

    // Calculate results
    const results = this.calculateResults();

    // Broadcast results
    this.io.emit('game:ended', results);

    console.log('Minigame ended. Results:', results);

    // Players will manually return to lobby via the button
  }

  private awardPoints(): void {
    const totalPlayers = this.players.size;

    // Award points based on death order (1st death = 1 point, 2nd = 2, etc.)
    this.deathOrder.forEach((playerId, index) => {
      const player = this.players.get(playerId);
      if (player) {
        const points = index + 1; // 1-indexed
        player.points += points;
        console.log(`Player ${playerId} awarded ${points} points (total: ${player.points})`);
      }
    });

    // Award winner (last alive or highest survival time) the maximum points
    const alivePlayer = Array.from(this.players.values()).find(p => p.isAlive);
    if (alivePlayer) {
      alivePlayer.points += totalPlayers;
      console.log(`Winner ${alivePlayer.id} awarded ${totalPlayers} points (total: ${alivePlayer.points})`);
    }
  }

  private calculateResults(): GameResults {
    const alivePlayer = Array.from(this.players.values()).find(p => p.isAlive);
    const totalPlayers = this.players.size;

    const rankings = Array.from(this.players.values())
      .map(player => {
        const deathTime = this.deathTimes.get(player.id);
        const survivalTime = deathTime
          ? deathTime - this.gameStartTime
          : Date.now() - this.gameStartTime;

        // Calculate points awarded this round
        let pointsAwarded = 0;
        if (player.isAlive) {
          pointsAwarded = totalPlayers; // Winner gets max points
        } else {
          const deathIndex = this.deathOrder.indexOf(player.id);
          if (deathIndex !== -1) {
            pointsAwarded = deathIndex + 1;
          }
        }

        return {
          playerId: player.id,
          playerName: player.name,
          survivalTime,
          pointsAwarded,
          totalPoints: player.points
        };
      })
      .sort((a, b) => b.survivalTime - a.survivalTime); // Sort by survival time descending

    return {
      winner: alivePlayer?.id ?? null,
      rankings
    };
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
