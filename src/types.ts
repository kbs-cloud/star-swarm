// Shared TypeScript types/interfaces for the Star-Swarm app

export type Screen = 'menu' | 'lobby' | 'game' | 'pass-turn' | 'game-over' | 'settings' | 'terms' | 'privacy';

export interface PlayerSetup {
  id: number;
  name: string;
  type: 'human' | 'ai';
  team: number;
  color?: string;
  isLocal?: boolean;
  assignedEmail?: string | null;
  endedTurn?: boolean;
}

export interface GameNotification {
  id: string;
  message: string;
  type: 'turn_start' | 'production' | 'info' | 'success' | 'warning';
  systemId?: number;
  createdAt: number;
}
