// Ideas/todo
// Show scores
// Go to goals score  i.s.o. time
// Collison with rocks
// Collison with each other
// Possiblity to stun each other, or dump each other
// Normal rocks that can't be mined to complicate pathing
// Rocks worth more points, that are also more difficult to mine (e.g 3x points, 2x time)
// Mining progress decays or dissapears when disconnected
// less rocks? 

import type { RockState } from "../types/index.js";

interface MiningMadnessConfig {
    worldWidth: number;
    worldHeight: number;
    gameDuration: number;
    miningTime: number;
    rechargeTime: number;
    rockCount: number;
    rockValue: number;
}

interface MiningProgress {
    playerId: string;
    startTime: number;
    progress: number; // 0-1
}

export class MiningMadnessManager {
    private config: MiningMadnessConfig;
    private rocks: Map<string, RockState> = new Map();
    private playerScores: Map<string, number> = new Map();
    private miningProgress: Map<string, MiningProgress> = new Map(); // rockId -> progress
    private gameStartTime: number = 0;

    constructor(config: MiningMadnessConfig) {
        this.config = config;
    }

    initializeGame(): Record<string, RockState> {
        this.gameStartTime = Date.now();
        this.spawnRocks();
        return Object.fromEntries(this.rocks);
    }

    private spawnRocks(): void {
        const padding = 50;
        const minDistance = 80; // Minimum distance between rocks

        for (let i = 0; i < this.config.rockCount; i++) {
            let attempts = 0;
            let validPosition = false;
            let x = 0;
            let y = 0;

            // Try to find a valid position that's not too close to other rocks
            while (!validPosition && attempts < 50) {
                x = padding + Math.random() * (this.config.worldWidth - padding * 2);
                y = padding + Math.random() * (this.config.worldHeight - padding * 2);

                validPosition = true;
                for (const [, rock] of this.rocks) {
                    const distance = Math.sqrt((x - rock.x) ** 2 + (y - rock.y) ** 2);
                    if (distance < minDistance) {
                        validPosition = false;
                        break;
                    }
                }
                attempts++;
            }

            const rockId = `rock_${i}`;
            this.rocks.set(rockId, {
                id: rockId,
                x,
                y,
                isAvailable: true,
                rechargeTimeRemaining: 0,
            });
        }
    }

    update(deltaTime: number): {
        rocksToRecharge: string[];
        gameEnded: boolean;
    } {
        const currentTime = Date.now();
        const rocksToRecharge: string[] = [];

        // Update rock recharge timers
        for (const [rockId, rock] of this.rocks) {
            if (!rock.isAvailable) {
                rock.rechargeTimeRemaining -= deltaTime * 1000; // Convert to milliseconds
                if (rock.rechargeTimeRemaining <= 0) {
                    rock.isAvailable = true;
                    rock.rechargeTimeRemaining = 0;
                    rocksToRecharge.push(rockId);
                }
            }
        }

        // Check if game should end
        const gameEnded = currentTime - this.gameStartTime >= this.config.gameDuration;

        return { rocksToRecharge, gameEnded };
    }

    startMining(playerId: string, rockId: string): boolean {
        const rock = this.rocks.get(rockId);
        if (!rock || !rock.isAvailable) {
            return false; // Rock not available
        }

        // Check if someone else is already mining this rock
        if (this.miningProgress.has(rockId)) {
            return false;
        }

        this.miningProgress.set(rockId, {
            playerId,
            startTime: Date.now(),
            progress: 0,
        });

        return true;
    }

    updateMiningProgress(rockId: string, playerId: string): {
        progress: number;
        completed: boolean;
    } {
        const progress = this.miningProgress.get(rockId);
        if (!progress || progress.playerId !== playerId) {
            return { progress: 0, completed: false };
        }

        const currentTime = Date.now();
        const elapsed = currentTime - progress.startTime;
        const miningProgress = Math.min(elapsed / this.config.miningTime, 1);

        progress.progress = miningProgress;

        return {
            progress: miningProgress,
            completed: miningProgress >= 1,
        };
    }

    completeMining(rockId: string): { playerId: string; score: number } | null {
        const progress = this.miningProgress.get(rockId);
        if (!progress) {
            return null;
        }

        const rock = this.rocks.get(rockId);
        if (!rock) {
            return null;
        }

        // Award points to player
        const currentScore = this.playerScores.get(progress.playerId) || 0;
        const newScore = currentScore + this.config.rockValue;
        this.playerScores.set(progress.playerId, newScore);

        // Mark rock as unavailable and start recharge
        rock.isAvailable = false;
        rock.rechargeTimeRemaining = this.config.rechargeTime;

        // Remove mining progress
        this.miningProgress.delete(rockId);

        return {
            playerId: progress.playerId,
            score: newScore,
        };
    }

    stopMining(rockId: string, playerId: string): void {
        const progress = this.miningProgress.get(rockId);
        if (progress && progress.playerId === playerId) {
            this.miningProgress.delete(rockId);
        }
    }

    getPlayerScore(playerId: string): number {
        return this.playerScores.get(playerId) || 0;
    }

    getAllRocks(): Record<string, RockState> {
        return Object.fromEntries(this.rocks);
    }

    getFinalScores(): Map<string, number> {
        return new Map(this.playerScores);
    }

    getRechargeProgress(): Record<string, number> {
        const progress: Record<string, number> = {};
        for (const [rockId, rock] of this.rocks) {
            if (!rock.isAvailable && rock.rechargeTimeRemaining > 0) {
                // Calculate progress (0 = just mined, 1 = fully recharged)
                const progressValue = 1 - (rock.rechargeTimeRemaining / this.config.rechargeTime);
                progress[rockId] = Math.max(0, Math.min(1, progressValue));
            }
        }
        return progress;
    }
}