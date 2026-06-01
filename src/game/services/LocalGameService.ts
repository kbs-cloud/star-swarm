import { IGameService } from './IGameService';
import {
  GameState,
  initializeGame,
  queueShipProduction,
  upgradeSystem,
  dispatchFleet,
  recallFleet,
  cancelDispatch,
  cancelProduction,
  processTurnEnd,
  logAction,
  advanceSequentialTurns
} from '../gameState';
import { runAITurn } from '../ai';
import { GameMetadata, GameDetails, GameListParams, JoinRequest } from '../gameApi';

// Helper to generate UUIDs locally
function generateUUID(): string {
  return 'local-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}

// Model structure for localStorage DB
interface StoredGame {
  id: string;
  invite_code: string;
  owner_email: string | null;
  name: string;
  game_state: string; // JSON string
  created_at: string;
  updated_at: string;
}

export class LocalGameService implements IGameService {
  private getStoredGames(): StoredGame[] {
    const stored = localStorage.getItem('starswarm_local_games');
    if (!stored) return [];
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse local games list:', e);
      return [];
    }
  }

  private saveStoredGames(games: StoredGame[]) {
    localStorage.setItem('starswarm_local_games', JSON.stringify(games));
  }

  public async updateSettings(displayName: string): Promise<{ success: boolean; error?: string }> {
    localStorage.setItem('starswarm_display_name', displayName);
    return { success: true };
  }

  public async updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  public async listGames(params?: GameListParams): Promise<{ success: boolean; games?: GameMetadata[]; totalCount?: number; error?: string }> {
    let list = this.getStoredGames();
    const search = params?.search?.toLowerCase();
    
    if (search) {
      list = list.filter(g => {
        let stateObj: any = {};
        try { stateObj = JSON.parse(g.game_state); } catch (e) { /* ignore */ }
        const matchesName = g.name.toLowerCase().includes(search);
        const matchesPlayers = stateObj.players?.some((p: any) => p.name.toLowerCase().includes(search));
        return matchesName || matchesPlayers;
      });
    }

    const games: GameMetadata[] = list.map(g => ({
      id: g.id,
      invite_code: g.invite_code,
      name: g.name,
      game_state: g.game_state,
      created_at: g.created_at,
      updated_at: g.updated_at,
      owner_email: g.owner_email || undefined
    }));

    const limit = params?.limit || 10;
    const offset = params?.offset || 0;
    const paginated = games.slice(offset, offset + limit);

    return {
      success: true,
      games: paginated,
      totalCount: games.length
    };
  }

  public async createGame(
    name: string,
    gameState?: GameState | null,
    setupOptions?: any
  ): Promise<{ success: boolean; gameId?: string; inviteCode?: string; name?: string; error?: string }> {
    let stateToSave: GameState;
    
    if (setupOptions) {
      try {
        stateToSave = initializeGame(setupOptions);
      } catch (e) {
        return { success: false, error: 'Failed to initialize game state.' };
      }
    } else if (gameState) {
      stateToSave = gameState;
    } else {
      return { success: false, error: 'Missing game state or setup options.' };
    }

    // Force all human players to be local in hotseat mode
    stateToSave.players = stateToSave.players.map(p => {
      if (p.type === 'human') {
        return { ...p, isLocal: true, assignedEmail: 'commander@local' };
      }
      return p;
    });

    const now = new Date().toISOString();
    const gameId = generateUUID();
    const inviteCode = 'LCL-' + Math.floor(1000 + Math.random() * 9000);
    const newGame: StoredGame = {
      id: gameId,
      invite_code: inviteCode,
      owner_email: 'commander@local',
      name: name.trim(),
      game_state: JSON.stringify(stateToSave),
      created_at: now,
      updated_at: now
    };

    const list = this.getStoredGames();
    list.unshift(newGame);
    this.saveStoredGames(list);

    // Store in user local owned games list
    const ownedGames = JSON.parse(localStorage.getItem('starswarm_owned_games') || '[]');
    ownedGames.push(gameId);
    localStorage.setItem('starswarm_owned_games', JSON.stringify(ownedGames));

    return {
      success: true,
      gameId,
      inviteCode,
      name: name.trim()
    };
  }

  public async getGame(id: string): Promise<{ success: boolean; game?: GameDetails; connectedPlayers?: string[]; error?: string }> {
    const list = this.getStoredGames();
    const game = list.find(g => g.id === id);
    if (!game) return { success: false, error: 'Game not found.' };

    let parsedState: GameState;
    try {
      parsedState = JSON.parse(game.game_state);
    } catch (e) {
      return { success: false, error: 'Game state corruption.' };
    }

    // In offline mode, the only connected player is the local commander
    const connectedPlayers = ['commander@local'];

    return {
      success: true,
      connectedPlayers,
      game: {
        id: game.id,
        inviteCode: game.invite_code,
        ownerEmail: game.owner_email || 'commander@local',
        name: game.name,
        gameState: parsedState,
        createdAt: game.created_at,
        updatedAt: game.updated_at
      }
    };
  }

  public async sendHeartbeat(id: string): Promise<{ success: boolean; connectedPlayers?: string[]; error?: string }> {
    return { success: true, connectedPlayers: ['commander@local'] };
  }

  public async updateGame(id: string, gameState: GameState): Promise<{ success: boolean; connectedPlayers?: string[]; error?: string }> {
    const list = this.getStoredGames();
    const index = list.findIndex(g => g.id === id);
    if (index === -1) return { success: false, error: 'Game not found.' };

    const now = new Date().toISOString();
    list[index].game_state = JSON.stringify(gameState);
    list[index].updated_at = now;
    this.saveStoredGames(list);

    return {
      success: true,
      connectedPlayers: ['commander@local']
    };
  }

  public async updateGameName(id: string, name: string): Promise<{ success: boolean; error?: string }> {
    const list = this.getStoredGames();
    const index = list.findIndex(g => g.id === id);
    if (index === -1) return { success: false, error: 'Game not found.' };

    list[index].name = name.trim();
    list[index].updated_at = new Date().toISOString();
    this.saveStoredGames(list);

    return { success: true };
  }

  public async deleteGame(id: string): Promise<{ success: boolean; error?: string }> {
    const list = this.getStoredGames();
    const filtered = list.filter(g => g.id !== id);
    this.saveStoredGames(filtered);

    const ownedGames = JSON.parse(localStorage.getItem('starswarm_owned_games') || '[]');
    const filteredOwned = ownedGames.filter((gId: string) => gId !== id);
    localStorage.setItem('starswarm_owned_games', JSON.stringify(filteredOwned));

    return { success: true };
  }

  public async assignPlayerSlot(gameId: string, playerId: number, email: string, joinRequestId?: number): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  public async requestToJoin(gameId: string, email?: string): Promise<{ success: boolean; joinId?: number; token?: string; error?: string }> {
    return { success: true, joinId: 1, token: 'mock' };
  }

  public async fetchPendingJoins(gameId: string): Promise<{ success: boolean; requests?: JoinRequest[]; error?: string }> {
    return { success: true, requests: [] };
  }

  public async checkMyJoinStatus(gameId: string, email?: string): Promise<{ success: boolean; status?: 'pending' | 'accepted' | 'rejected' | null; joinId?: number; error?: string }> {
    return { success: true, status: 'accepted', joinId: 1 };
  }

  public async rejectJoinRequest(gameId: string, joinRequestId: number): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  public async performGameAction(
    gameId: string,
    action: string,
    playerId: number,
    params: any = {}
  ): Promise<{ success: boolean; gameState?: GameState; error?: string }> {
    const list = this.getStoredGames();
    const index = list.findIndex(g => g.id === gameId);
    if (index === -1) return { success: false, error: 'Game not found.' };

    let gameState: GameState;
    try {
      gameState = JSON.parse(list[index].game_state);
    } catch (e) {
      return { success: false, error: 'Game state corruption.' };
    }

    const player = gameState.players.find(p => p.id === Number(playerId));
    if (!player) return { success: false, error: 'Player slot not found.' };

    let result: { success: boolean; reason?: string } = { success: false, reason: 'Unknown action' };

    if (action === 'claim_faction') {
      if (player.type === 'human') {
        player.assignedEmail = 'commander@local';
        player.isLocal = true;
        result = { success: true };
      } else {
        result = { success: false, reason: 'Cannot claim non-human slot.' };
      }
    } else if (action === 'toggle_player_local') {
      if (player.type === 'human') {
        player.isLocal = !player.isLocal;
        result = { success: true };
      } else {
        result = { success: false, reason: 'Slot is not a human player.' };
      }
    } else if (action === 'assign_player_email') {
      if (player.type === 'human') {
        player.assignedEmail = params && params.email ? params.email.trim().toLowerCase() : null;
        result = { success: true };
      } else {
        result = { success: false, reason: 'Slot is not a human player.' };
      }
    } else {
      // Gameplay actions
      switch (action) {
        case 'dispatch_fleet':
          result = dispatchFleet(gameState, player.id, params.sourceSysId, params.destSysId, params.shipQuantities);
          break;
        case 'recall_fleet':
          result = recallFleet(gameState, player.id, params.fleetId);
          break;
        case 'upgrade_system':
          result = upgradeSystem(gameState, player.id, params.systemId, params.upgradeType);
          break;
        case 'queue_production':
          result = queueShipProduction(gameState, player.id, params.systemId, params.shipType);
          break;
        case 'cancel_dispatch':
          result = cancelDispatch(gameState, player.id, params.fleetId);
          break;
        case 'cancel_production':
          result = cancelProduction(gameState, player.id, params.systemId, params.jobIndex);
          break;
        case 'end_turn':
          player.endedTurn = true;
          logAction(gameState, player.id, 'end_turn', 'Submitted orders / ended turn');

          if (gameState.turnStyle === 'sequential') {
            advanceSequentialTurns(gameState, runAITurn);
          } else {
            const activeHumans = gameState.players.filter(p => p.type === 'human' && !gameState.playerState[p.id].lost);
            const allEnded = activeHumans.every(p => p.endedTurn);

            if (allEnded) {
              processTurnEnd(gameState);
              gameState.players.forEach(p => {
                if (p.type === 'ai' && !gameState.playerState[p.id].lost) {
                  runAITurn(gameState, p.id);
                }
              });
              gameState.players.forEach(p => {
                p.endedTurn = false;
              });
              const firstActiveHuman = gameState.players.find(p => p.type === 'human' && !gameState.playerState[p.id].lost);
              if (firstActiveHuman) {
                gameState.activePlayerIdx = gameState.players.indexOf(firstActiveHuman);
              }
            } else {
              let nextIdx = gameState.activePlayerIdx;
              for (let i = 0; i < gameState.players.length; i++) {
                nextIdx = (nextIdx + 1) % gameState.players.length;
                const p = gameState.players[nextIdx];
                if (p.type === 'human' && !gameState.playerState[p.id].lost && !p.endedTurn) {
                  gameState.activePlayerIdx = nextIdx;
                  break;
                }
              }
            }
          }
          result = { success: true };
          break;
        case 'cancel_end_turn':
          player.endedTurn = false;
          logAction(gameState, player.id, 'cancel_end_turn', 'Resumed orders (cancelled end turn)');
          gameState.activePlayerIdx = gameState.players.indexOf(player);
          result = { success: true };
          break;
        default:
          return { success: false, error: `Unsupported action: ${action}` };
      }
    }

    if (result.success) {
      const now = new Date().toISOString();
      list[index].game_state = JSON.stringify(gameState);
      list[index].updated_at = now;
      this.saveStoredGames(list);
      return { success: true, gameState };
    } else {
      return { success: false, error: result.reason || 'Action failed.' };
    }
  }

  public async syncGames(localGames: any[]): Promise<{ success: boolean; localUpdates?: any[]; error?: string }> {
    return { success: false, error: 'Sync only available when connected to a server.' };
  }
}
