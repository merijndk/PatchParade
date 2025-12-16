import type { PlayerState } from "../types/index.js";

interface BumperBallsConfig {
  worldWidth: number;
  worldHeight: number;
  arenaRadius: number;
  playerRadius: number;
  moveAcceleration: number;
  friction: number;
  maxSpeed: number;
  dashSpeed: number;
  dashCooldown: number;
  dashDuration: number;
}

interface PlayerPhysics {
  playerId: string;
  velocityX: number;
  velocityY: number;
  dashCooldownRemaining: number;
  isDashing: boolean;
}

export class BumperBallsManager {
  private playerPhysics: Map<string, PlayerPhysics> = new Map();
  private config: BumperBallsConfig;
  private playerInputs: Map<string, { dirX: number; dirY: number }> = new Map();

  constructor(config: BumperBallsConfig) {
    this.config = config;
  }

  initializePlayer(playerId: string): void {
    this.playerPhysics.set(playerId, {
      playerId,
      velocityX: 0,
      velocityY: 0,
      dashCooldownRemaining: 0,
      isDashing: false,
    });
    this.playerInputs.set(playerId, { dirX: 0, dirY: 0 });
  }

  updatePlayerInput(playerId: string, dirX: number, dirY: number): void {
    this.playerInputs.set(playerId, { dirX, dirY });
  }

  activateDash(playerId: string): { success: boolean; dirX?: number; dirY?: number } {
    const physics = this.playerPhysics.get(playerId);
    if (!physics || physics.dashCooldownRemaining > 0) {
      return { success: false };
    }

    const currentSpeed = Math.sqrt(
      physics.velocityX ** 2 + physics.velocityY ** 2
    );

    if (currentSpeed < 0.1) {
      return { success: false };
    }

    const dirX = physics.velocityX / currentSpeed;
    const dirY = physics.velocityY / currentSpeed;
    physics.velocityX = dirX * this.config.dashSpeed;
    physics.velocityY = dirY * this.config.dashSpeed;

    physics.isDashing = true;
    physics.dashCooldownRemaining = this.config.dashCooldown;

    setTimeout(() => {
      physics.isDashing = false;
    }, this.config.dashDuration);

    return { success: true, dirX, dirY };
  }

  updatePhysics(
    players: Map<string, PlayerState>,
    deltaTime: number
  ): {
    eliminatedPlayers: string[];
    physicsState: Map<string, PlayerPhysics>;
  } {
    const eliminatedPlayers: string[] = [];

    // 1. Apply input acceleration and friction
    this.playerPhysics.forEach((physics, playerId) => {
      const player = players.get(playerId);
      if (!player || !player.isAlive) return;

      const input = this.playerInputs.get(playerId) || { dirX: 0, dirY: 0 };

      // Apply acceleration from input
      if (input.dirX !== 0 || input.dirY !== 0) {
        physics.velocityX +=
          input.dirX * this.config.moveAcceleration * deltaTime;
        physics.velocityY +=
          input.dirY * this.config.moveAcceleration * deltaTime;
      }

      // Apply friction
      physics.velocityX *= this.config.friction;
      physics.velocityY *= this.config.friction;

      // Clamp to max speed
      const speed = Math.sqrt(physics.velocityX ** 2 + physics.velocityY ** 2);
      if (speed > this.config.maxSpeed) {
        physics.velocityX = (physics.velocityX / speed) * this.config.maxSpeed;
        physics.velocityY = (physics.velocityY / speed) * this.config.maxSpeed;
      }

      // Update position
      player.x += physics.velocityX * deltaTime;
      player.y += physics.velocityY * deltaTime;

      // Update dash cooldown
      if (physics.dashCooldownRemaining > 0) {
        physics.dashCooldownRemaining -= deltaTime * 1000;
        if (physics.dashCooldownRemaining < 0) {
          physics.dashCooldownRemaining = 0;
        }
      }
    });

    // 2. Check player-to-player collisions and resolve
    const alivePlayers = Array.from(players.values()).filter((p) => p.isAlive);
    for (let i = 0; i < alivePlayers.length; i++) {
      for (let j = i + 1; j < alivePlayers.length; j++) {
        const p1 = alivePlayers[i];
        const p2 = alivePlayers[j];

        if (this.checkPlayerCollision(p1, p2)) {
          this.resolveCollision(
            p1,
            this.playerPhysics.get(p1.id)!,
            p2,
            this.playerPhysics.get(p2.id)!
          );
        }
      }
    }

    // 3. Check arena boundaries
    players.forEach((player, playerId) => {
      if (!player.isAlive) return;

      if (this.checkArenaBounds(player)) {
        eliminatedPlayers.push(playerId);
      }
    });

    return {
      eliminatedPlayers,
      physicsState: this.playerPhysics,
    };
  }

  private checkPlayerCollision(p1: PlayerState, p2: PlayerState): boolean {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distanceSquared = dx * dx + dy * dy;
    const minDistance = this.config.playerRadius * 2;

    return distanceSquared < minDistance * minDistance;
  }

  private resolveCollision(
    p1: PlayerState,
    physics1: PlayerPhysics,
    p2: PlayerState,
    physics2: PlayerPhysics
  ): void {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return;

    const normalX = dx / distance;
    const normalY = dy / distance;

    const relVelX = physics2.velocityX - physics1.velocityX;
    const relVelY = physics2.velocityY - physics1.velocityY;
    const velAlongNormal = relVelX * normalX + relVelY * normalY;

    if (velAlongNormal > 0) return;

    const restitution = 1.5;
    let bumpMultiplier = 1.0;

    if (physics1.isDashing || physics2.isDashing) {
      bumpMultiplier = 2.5;
    }

    const impulseMagnitude = (-(1 + restitution) * velAlongNormal) / 2;
    const impulse = impulseMagnitude * bumpMultiplier;

    physics1.velocityX -= impulse * normalX;
    physics1.velocityY -= impulse * normalY;
    physics2.velocityX += impulse * normalX;
    physics2.velocityY += impulse * normalY;

    const overlap = this.config.playerRadius * 2 - distance;
    if (overlap > 0) {
      const separationX = (normalX * overlap) / 2;
      const separationY = (normalY * overlap) / 2;
      p1.x -= separationX;
      p1.y -= separationY;
      p2.x += separationX;
      p2.y += separationY;
    }
  }

  private checkArenaBounds(player: PlayerState): boolean {
    const centerX = this.config.worldWidth / 2;
    const centerY = this.config.worldHeight / 2;

    const dx = player.x - centerX;
    const dy = player.y - centerY;
    const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);

    return distanceFromCenter > this.config.arenaRadius;
  }

  getPhysicsState(playerId: string): PlayerPhysics | undefined {
    return this.playerPhysics.get(playerId);
  }

  reset(): void {
    this.playerPhysics.clear();
    this.playerInputs.clear();
  }
}
