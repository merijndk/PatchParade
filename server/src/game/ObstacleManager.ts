import type { ObstacleState } from '../types/index.js';

interface ObstacleManagerConfig {
  worldWidth: number;
  worldHeight: number;
  barWidth: number;
  barHeight: number;
  gapSize: number;
  initialSpeed: number;
  acceleration: number;
  padding: number;
}

export class ObstacleManager {
  private obstacles: Map<string, ObstacleState> = new Map();
  private config: ObstacleManagerConfig;
  private currentSpeed: number;
  private obstacleCounter: number = 0;
  private lastSpawnTime: number = 0;
  private spawnInterval: number;

  constructor(config: ObstacleManagerConfig, spawnInterval: number) {
    this.config = config;
    this.currentSpeed = config.initialSpeed;
    this.spawnInterval = spawnInterval;
  }

  // Spawn new obstacle if interval has passed
  updateSpawning(currentTime: number): ObstacleState | null {
    if (currentTime - this.lastSpawnTime >= this.spawnInterval) {
      this.lastSpawnTime = currentTime;
      return this.spawnObstacle();
    }
    return null;
  }

  private spawnObstacle(): ObstacleState {
    const id = this.generateObstacleId();
    const gapY = this.generateRandomGapPosition();

    const obstacle: ObstacleState = {
      id,
      x: 0, // Spawn on left edge
      y: 0,
      width: this.config.barWidth,
      height: this.config.barHeight,
      gapY,
      gapSize: this.config.gapSize,
      speed: this.currentSpeed,
    };

    this.obstacles.set(id, obstacle);

    // Increase speed for next obstacle (acceleration)
    this.currentSpeed += this.config.acceleration;

    return obstacle;
  }

  // Update all obstacles' x positions based on speed and delta time
  updateObstacles(deltaTime: number): void {
    this.obstacles.forEach(obstacle => {
      obstacle.x += obstacle.speed * deltaTime;
    });
  }

  // Remove obstacles that have exited the right side of world
  removeExpiredObstacles(): string[] {
    const removedIds: string[] = [];

    this.obstacles.forEach((obstacle, id) => {
      if (obstacle.x > this.config.worldWidth) {
        this.obstacles.delete(id);
        removedIds.push(id);
      }
    });

    return removedIds;
  }

  // Check if player collides with any obstacle
  checkCollision(playerId: string, playerX: number, playerY: number, playerRadius: number): boolean {
    for (const obstacle of this.obstacles.values()) {
      if (this.isPlayerCollidingWithObstacle(playerX, playerY, playerRadius, obstacle)) {
        return true;
      }
    }
    return false;
  }

  private isPlayerCollidingWithObstacle(
    playerX: number,
    playerY: number,
    playerRadius: number,
    obstacle: ObstacleState
  ): boolean {
    // Player is a circle, obstacle is a rectangle with a gap
    // We need to check if the circle intersects with the solid parts of the rectangle

    const obstacleLeft = obstacle.x;
    const obstacleRight = obstacle.x + obstacle.width;

    // Quick check: if player is not horizontally aligned with obstacle, no collision
    if (playerX + playerRadius < obstacleLeft || playerX - playerRadius > obstacleRight) {
      return false;
    }

    // Check if player is in the gap (safe zone)
    const gapTop = obstacle.gapY;
    const gapBottom = obstacle.gapY + obstacle.gapSize;

    // If player center is completely within the gap vertically, check if it's safe
    if (playerY - playerRadius >= gapTop && playerY + playerRadius <= gapBottom) {
      // Player is safely within the gap
      return false;
    }

    // Check collision with top solid section [0, gapY]
    if (this.circleRectangleIntersect(
      playerX, playerY, playerRadius,
      obstacleLeft, 0, obstacle.width, gapTop
    )) {
      return true;
    }

    // Check collision with bottom solid section [gapY + gapSize, height]
    const bottomHeight = obstacle.height - gapBottom;
    if (this.circleRectangleIntersect(
      playerX, playerY, playerRadius,
      obstacleLeft, gapBottom, obstacle.width, bottomHeight
    )) {
      return true;
    }

    return false;
  }

  // Circle-rectangle intersection test
  private circleRectangleIntersect(
    circleX: number,
    circleY: number,
    radius: number,
    rectX: number,
    rectY: number,
    rectWidth: number,
    rectHeight: number
  ): boolean {
    // Find the closest point on the rectangle to the circle center
    const closestX = this.clamp(circleX, rectX, rectX + rectWidth);
    const closestY = this.clamp(circleY, rectY, rectY + rectHeight);

    // Calculate distance between circle center and closest point
    const distanceX = circleX - closestX;
    const distanceY = circleY - closestY;
    const distanceSquared = distanceX * distanceX + distanceY * distanceY;

    // Check if distance is less than radius
    return distanceSquared < radius * radius;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  // Get obstacle by ID
  getObstacle(id: string): ObstacleState | undefined {
    return this.obstacles.get(id);
  }

  // Get all obstacles (for broadcasting to clients)
  getAllObstacles(): Record<string, ObstacleState> {
    const obstaclesObject: Record<string, ObstacleState> = {};
    this.obstacles.forEach((obstacle, id) => {
      obstaclesObject[id] = obstacle;
    });
    return obstaclesObject;
  }

  // Reset manager for new game
  reset(): void {
    this.obstacles.clear();
    this.obstacleCounter = 0;
    this.lastSpawnTime = 0;
    this.currentSpeed = this.config.initialSpeed;
  }

  // Helper to calculate random gap position
  private generateRandomGapPosition(): number {
    // Gap should be positioned so it's fully within the world bounds
    // Gap can be anywhere from padding to (worldHeight - gapSize - padding)
    const minY = this.config.padding;
    const maxY = this.config.worldHeight - this.config.gapSize - this.config.padding;
    return minY + Math.random() * (maxY - minY);
  }

  // Helper to generate unique obstacle ID
  private generateObstacleId(): string {
    return `obstacle_${this.obstacleCounter++}`;
  }
}
