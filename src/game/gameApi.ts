// Star-Swarm Game Database API Client (TypeScript)
import { GameState } from './gameState';
import { getCookie } from './auth';

function getHeaders(): Record<string, string> {
  const csrfToken = getCookie('csrf_token') || '';
  const guestName = localStorage.getItem('starswarm_guest_name') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  };
  if (guestName) {
    headers['X-Guest-Name'] = guestName;
    headers['X-Guest-Email'] = guestName;
  }
  return headers;
}

export interface GameMetadata {
  id: string;
  invite_code?: string;
  name: string;
  game_state?: any;
  created_at: string;
  updated_at: string;
  owner_email?: string;
}

export interface GameDetails {
  id: string;
  inviteCode?: string;
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

export interface GameListParams {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  turns?: string;
  limit: number;
  offset: number;
}

/**
 * Lists all game simulations owned by or participating the active logged in commander.
 */
export async function listGames(params?: GameListParams): Promise<{ success: boolean; games?: GameMetadata[]; totalCount?: number; error?: string }> {
  try {
    let url = '/api/games';
    if (params) {
      const searchParams = new URLSearchParams();
      if (params.search) searchParams.append('search', params.search);
      if (params.status) searchParams.append('status', params.status);
      if (params.startDate) searchParams.append('startDate', params.startDate);
      if (params.endDate) searchParams.append('endDate', params.endDate);
      if (params.turns) searchParams.append('turns', params.turns);
      searchParams.append('limit', String(params.limit));
      searchParams.append('offset', String(params.offset));
      url += `?${searchParams.toString()}`;
    }

    const response = await fetch(url, {
      headers: getHeaders()
    });
    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true, games: data.games, totalCount: data.totalCount };
    }
    return { success: false, error: data.error || 'Failed to list saved games.' };
  } catch (e) {
    return { success: false, error: 'Server connection failed.' };
  }
}

/**
 * Registers a new game state on the database.
 */
export async function createGame(name: string, gameState: GameState): Promise<{ success: boolean; gameId?: string; inviteCode?: string; name?: string; error?: string }> {
  try {
    const response = await fetch('/api/games', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, game_state: gameState })
    });
    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true, gameId: data.gameId, inviteCode: data.inviteCode, name: data.name };
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
export async function assignPlayerSlot(
  gameId: string,
  playerId: number,
  email: string,
  joinRequestId?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/games/${gameId}/assign-slot`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ playerId, email, joinRequestId })
    });
    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Failed to assign player slot.' };
  } catch (e) {
    return { success: false, error: 'Server connection failed.' };
  }
}

export interface JoinRequest {
  id: number;
  email: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

/**
 * Player submits a request to join a game they don't own.
 * One pending request per player per game is enforced server-side.
 */
export async function requestToJoin(gameId: string, email?: string): Promise<{ success: boolean; joinId?: number; token?: string; error?: string }> {
  try {
    const response = await fetch(`/api/games/${gameId}/join`, {
      method: 'POST',
      headers: getHeaders(),
      body: email ? JSON.stringify({ email }) : undefined
    });
    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true, joinId: data.joinId, token: data.token };
    }
    return { success: false, error: data.error || 'Failed to submit join request.' };
  } catch (e) {
    return { success: false, error: 'Server connection failed.' };
  }
}

/**
 * Host fetches all pending join requests for their game.
 */
export async function fetchPendingJoins(gameId: string): Promise<{ success: boolean; requests?: JoinRequest[]; error?: string }> {
  try {
    const response = await fetch(`/api/games/${gameId}/join-requests`, {
      headers: getHeaders()
    });
    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true, requests: data.requests };
    }
    return { success: false, error: data.error || 'Failed to fetch join requests.' };
  } catch (e) {
    return { success: false, error: 'Server connection failed.' };
  }
}

/**
 * Player polls this to find out if their join request was accepted or rejected.
 */
export async function checkMyJoinStatus(gameId: string, email?: string): Promise<{ success: boolean; status?: 'pending' | 'accepted' | 'rejected' | null; joinId?: number; error?: string }> {
  try {
    let url = `/api/games/${gameId}/my-join-status`;
    if (email) {
      url += `?email=${encodeURIComponent(email)}`;
    }
    const response = await fetch(url, {
      headers: getHeaders()
    });
    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true, status: data.status, joinId: data.joinId };
    }
    return { success: false, error: data.error || 'Failed to check join status.' };
  } catch (e) {
    return { success: false, error: 'Server connection failed.' };
  }
}

/**
 * Host accepts a join request and assigns the player to a faction slot.
 */
export async function acceptJoinRequest(
  gameId: string,
  joinRequestId: number,
  playerId: number,
  email: string
): Promise<{ success: boolean; error?: string }> {
  return assignPlayerSlot(gameId, playerId, email, joinRequestId);
}

/**
 * Host rejects a pending join request.
 */
export async function rejectJoinRequest(gameId: string, joinRequestId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/games/${gameId}/reject-join`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ joinRequestId })
    });
    const data = await response.json();
    if (response.ok && data.success) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Failed to reject join request.' };
  } catch (e) {
    return { success: false, error: 'Server connection failed.' };
  }
}
