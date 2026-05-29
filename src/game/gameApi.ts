// Star-Swarm Game Database API Client (TypeScript)
import { GameState } from './gameState';
import { getCookie } from './auth';

function getHeaders(): Record<string, string> {
  const csrfToken = getCookie('csrf_token') || '';
  return {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  };
}

export interface GameMetadata {
  id: string;
  name: string;
  game_state?: any;
  created_at: string;
  updated_at: string;
}

export interface GameDetails {
  id: string;
  ownerEmail: string;
  name: string;
  gameState: GameState;
  createdAt: string;
  updatedAt: string;
}

/**
 * Updates user settings (e.g. global display name) on the database.
 */
export async function updateSettings(displayName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ displayName })
    });
    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Failed to update settings.' };
  } catch (e) {
    return { success: false, error: 'Server connection failed.' };
  }
}

/**
 * Lists all game simulations owned by the active logged in commander.
 */
export async function listGames(): Promise<{ success: boolean; games?: GameMetadata[]; error?: string }> {
  try {
    const response = await fetch('/api/games', {
      headers: getHeaders()
    });
    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true, games: data.games };
    }
    return { success: false, error: data.error || 'Failed to list saved games.' };
  } catch (e) {
    return { success: false, error: 'Server connection failed.' };
  }
}

/**
 * Registers a new game state on the database.
 */
export async function createGame(name: string, gameState: GameState): Promise<{ success: boolean; gameId?: string; name?: string; error?: string }> {
  try {
    const response = await fetch('/api/games', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, game_state: gameState })
    });
    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true, gameId: data.gameId, name: data.name };
    }
    return { success: false, error: data.error || 'Failed to create game session.' };
  } catch (e) {
    return { success: false, error: 'Server connection failed.' };
  }
}

/**
 * Retrieves a specific game simulation and its full state.
 */
export async function getGame(id: string): Promise<{ success: boolean; game?: GameDetails; connectedPlayers?: string[]; error?: string }> {
  try {
    const response = await fetch(`/api/games/${id}`, {
      headers: getHeaders()
    });
    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true, game: data.game, connectedPlayers: data.connectedPlayers };
    }
    return { success: false, error: data.error || 'Failed to load game session.' };
  } catch (e) {
    return { success: false, error: 'Server connection failed.' };
  }
}

/**
 * Sends a presence heartbeat to the server and returns active commanders.
 */
export async function sendHeartbeat(id: string): Promise<{ success: boolean; connectedPlayers?: string[]; error?: string }> {
  try {
    const response = await fetch(`/api/games/${id}/presence`, {
      method: 'POST',
      headers: getHeaders()
    });
    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true, connectedPlayers: data.connectedPlayers };
    }
    return { success: false, error: data.error || 'Heartbeat update failed.' };
  } catch (e) {
    return { success: false, error: 'Server connection failed.' };
  }
}

/**
 * Syncs the active game state to the database.
 */
export async function updateGame(id: string, gameState: GameState): Promise<{ success: boolean; connectedPlayers?: string[]; error?: string }> {
  try {
    const response = await fetch(`/api/games/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ game_state: gameState })
    });
    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true, connectedPlayers: data.connectedPlayers };
    }
    return { success: false, error: data.error || 'Failed to save game state.' };
  } catch (e) {
    return { success: false, error: 'Server connection failed.' };
  }
}

/**
 * Decommissions (deletes) a game simulation from the database.
 */
export async function deleteGame(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/games/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Failed to decommission game.' };
  } catch (e) {
    return { success: false, error: 'Server connection failed.' };
  }
}
