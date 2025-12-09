import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { MinigameConfig } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface MinigameConfigs {
  [key: string]: MinigameConfig;
}

export class ConfigLoader {
  private static configs: MinigameConfigs = {};
  private static loaded = false;

  static loadConfigs(): void {
    if (this.loaded) return;

    try {
      const configPath = join(__dirname, 'minigames.json');
      const configData = readFileSync(configPath, 'utf-8');
      this.configs = JSON.parse(configData);
      this.loaded = true;
      console.log('Minigame configs loaded successfully');
    } catch (error) {
      console.error('Error loading minigame configs:', error);
      throw new Error('Failed to load minigame configurations');
    }
  }

  static getConfig(minigameName: string): MinigameConfig {
    if (!this.loaded) {
      this.loadConfigs();
    }

    const config = this.configs[minigameName];
    if (!config) {
      throw new Error(`Minigame config not found: ${minigameName}`);
    }

    return config;
  }

  static getAllMinigames(): string[] {
    if (!this.loaded) {
      this.loadConfigs();
    }

    return Object.keys(this.configs);
  }
}
