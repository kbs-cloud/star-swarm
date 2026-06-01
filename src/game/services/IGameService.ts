import { GameState } from '../gameState';
import { GameMetadata, GameDetails, GameListParams, JoinRequest } from '../gameApi';

export interface IGameService {
  updateSettings(displayName: string): Promise<{ success: boolean; error?: string }>;
  updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }>;
  listGames(params?: GameListParams): Promise<{ success: boolean; games?: GameMetadata[]; totalCount?: number; error?: string }>;
  createGame(name: string, gameState?: GameState | null, setupOptions?: any): Promise<{ success: boolean; gameId?: string; inviteCode?: string; name?: string; error?: string }>;
  getGame(id: string): Promise<{ success: boolean; game?: GameDetails; connectedPlayers?: string[]; error?: string }>;
  sendHeartbeat(id: string): Promise<{ success: boolean; connectedPlayers?: string[]; error?: string }>;
  updateGame(id: string, gameState: GameState): Promise<{ success: boolean; connectedPlayers?: string[]; error?: string }>;
  updateGameName(id: string, name: string): Promise<{ success: boolean; error?: string }>;
  deleteGame(id: string): Promise<{ success: boolean; error?: string }>;
  assignPlayerSlot(gameId: string, playerId: number, email: string, joinRequestId?: number): Promise<{ success: boolean; error?: string }>;
  requestToJoin(gameId: string, email?: string): Promise<{ success: boolean; joinId?: number; token?: string; error?: string }>;
  fetchPendingJoins(gameId: string): Promise<{ success: boolean; requests?: JoinRequest[]; error?: string }>;
  checkMyJoinStatus(gameId: string, email?: string): Promise<{ success: boolean; status?: 'pending' | 'accepted' | 'rejected' | null; joinId?: number; error?: string }>;
  rejectJoinRequest(gameId: string, joinRequestId: number): Promise<{ success: boolean; error?: string }>;
  performGameAction(gameId: string, action: string, playerId: number, params?: any): Promise<{ success: boolean; gameState?: GameState; error?: string }>;
  syncGames(localGames: any[]): Promise<{ success: boolean; localUpdates?: any[]; error?: string }>;
}
