// Star-Swarm Game Database API Client (TypeScript)
import { GameState } from './gameState';
import { gameService } from './services';

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

export interface GameListParams {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  turns?: string;
  limit: number;
  offset: number;
  ids?: string;
}

export interface JoinRequest {
  id: number;
  email: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

/**
 * Updates user settings (e.g. global display name) on the database.
 */
export async function updateSettings(displayName: string): Promise<{ success: boolean; error?: string }> {
  return gameService.updateSettings(displayName);
}

/**
 * Securely updates user password on the database.
 */
export async function updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
  return gameService.updatePassword(newPassword);
}

/**
 * Lists all game simulations owned by or participating the active logged in commander.
 */
export async function listGames(params?: GameListParams): Promise<{ success: boolean; games?: GameMetadata[]; totalCount?: number; error?: string }> {
  return gameService.listGames(params);
}

/**
 * Registers a new game state on the database.
 */
export async function createGame(
  name: string,
  gameState?: GameState | null,
  setupOptions?: any
): Promise<{ success: boolean; gameId?: string; inviteCode?: string; name?: string; error?: string }> {
  return gameService.createGame(name, gameState, setupOptions);
}

/**
 * Retrieves a specific game simulation and its full state.
 */
export async function getGame(id: string): Promise<{ success: boolean; game?: GameDetails; connectedPlayers?: string[]; error?: string }> {
  return gameService.getGame(id);
}

/**
 * Sends a presence heartbeat to the server and returns active commanders.
 */
export async function sendHeartbeat(id: string): Promise<{ success: boolean; connectedPlayers?: string[]; error?: string }> {
  return gameService.sendHeartbeat(id);
}

/**
 * Syncs the active game state to the database.
 */
export async function updateGame(id: string, gameState: GameState): Promise<{ success: boolean; connectedPlayers?: string[]; error?: string }> {
  return gameService.updateGame(id, gameState);
}

/**
 * Updates the game name in the database.
 */
export async function updateGameName(id: string, name: string): Promise<{ success: boolean; error?: string }> {
  return gameService.updateGameName(id, name);
}

/**
 * Decommissions (deletes) a game simulation from the database.
 */
export async function deleteGame(id: string): Promise<{ success: boolean; error?: string }> {
  return gameService.deleteGame(id);
}

export async function assignPlayerSlot(
  gameId: string,
  playerId: number,
  email: string,
  joinRequestId?: number
): Promise<{ success: boolean; error?: string }> {
  return gameService.assignPlayerSlot(gameId, playerId, email, joinRequestId);
}

/**
 * Player submits a request to join a game they don't own.
 */
export async function requestToJoin(gameId: string, email?: string): Promise<{ success: boolean; joinId?: number; token?: string; error?: string }> {
  return gameService.requestToJoin(gameId, email);
}

/**
 * Host fetches all pending join requests for their game.
 */
export async function fetchPendingJoins(gameId: string): Promise<{ success: boolean; requests?: JoinRequest[]; error?: string }> {
  return gameService.fetchPendingJoins(gameId);
}

/**
 * Player polls this to find out if their join request was accepted or rejected.
 */
export async function checkMyJoinStatus(gameId: string, email?: string): Promise<{ success: boolean; status?: 'pending' | 'accepted' | 'rejected' | null; joinId?: number; error?: string }> {
  return gameService.checkMyJoinStatus(gameId, email);
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
  return gameService.assignPlayerSlot(gameId, playerId, email, joinRequestId);
}

/**
 * Host rejects a pending join request.
 */
export async function rejectJoinRequest(gameId: string, joinRequestId: number): Promise<{ success: boolean; error?: string }> {
  return gameService.rejectJoinRequest(gameId, joinRequestId);
}

export async function performGameAction(
  gameId: string,
  action: string,
  playerId: number,
  params: any = {}
): Promise<{ success: boolean; gameState?: GameState; error?: string }> {
  return gameService.performGameAction(gameId, action, playerId, params);
}

export async function syncGames(localGames: any[]): Promise<{ success: boolean; localUpdates?: any[]; error?: string }> {
  return gameService.syncGames(localGames);
}
