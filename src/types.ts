// Shared TypeScript types/interfaces for the Star-Swarm app

export type Screen = 'menu' | 'lobby' | 'game' | 'pass-turn' | 'game-over' | 'settings' | 'terms' | 'privacy';

export interface AIConfig {
  aggression: number;   // 0 - 100
  expansion: number;    // 0 - 100
  techFocus: number;    // 0 - 100
  economyBonus: number; // 0 - 30
}

export interface PlayerSetup {
  id: number;
  name: string;
  type: 'human' | 'ai';
  team: number;
  color?: string;
  isLocal?: boolean;
  assignedEmail?: string | null;
  endedTurn?: boolean;
  difficulty?: 'easy' | 'medium' | 'hard' | 'custom';
  aiConfig?: AIConfig;
}

export interface GameNotification {
  id: string;
  message: string;
  type: 'turn_start' | 'production' | 'info' | 'success' | 'warning';
  systemId?: number;
  createdAt: number;
}
