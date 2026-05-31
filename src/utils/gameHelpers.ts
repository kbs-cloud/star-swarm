import { GameState } from '../game/gameState';
import { GameMetadata } from '../game/gameApi';
import { UserAccount } from '../game/auth';

/**
 * Returns a human-readable turn status string for a saved game card on the home screen.
 */
export const getGameTurnStatus = (
  game: GameMetadata,
  currentUserEmail: string | null
): string => {
  let state: GameState;
  try {
    state = typeof game.game_state === 'string' ? JSON.parse(game.game_state) : game.game_state;
  } catch (e) {
    return 'UNKNOWN';
  }
  if (!state || !state.players || !state.playerState) return 'UNKNOWN';

  const activeTeams = new Set<number>();
  state.players.forEach(p => {
    const pState = state.playerState[p.id];
    if (pState && !pState.lost) {
      activeTeams.add(p.team);
    }
  });
  if (activeTeams.size <= 1) {
    return 'GAME OVER';
  }

  const activeHumans = state.players.filter(p => p.type === 'human' && !state.playerState[p.id]?.lost);
  const userPlayer = activeHumans.find(
    p => p.assignedEmail === currentUserEmail || (p.id === 1 && p.isLocal)
  );

  if (state.turnStyle === 'sequential') {
    const activePlayer = state.players[state.activePlayerIdx];
    if (userPlayer && activePlayer && activePlayer.id === userPlayer.id) {
      return 'YOUR TURN';
    }
    if (activePlayer) {
      return `WAITING ON: ${activePlayer.name.toUpperCase()}`;
    }
    return 'PROCESSING TURN...';
  }

  if (userPlayer && !userPlayer.endedTurn) {
    return 'YOUR TURN';
  }

  const pendingPlayers = activeHumans.filter(p => !p.endedTurn);
  if (pendingPlayers.length === 1) {
    return `WAITING ON: ${pendingPlayers[0].name.toUpperCase()}`;
  } else if (pendingPlayers.length > 1) {
    return 'WAITING ON OTHER PLAYERS';
  }

  return 'PROCESSING TURN...';
};

/**
 * Returns true if the current user can cancel their end-turn for a saved game from the home screen.
 */
export const canCancelEndTurnInGame = (
  game: GameMetadata,
  currentUser: UserAccount | null
): boolean => {
  if (!currentUser) return false;
  let state: GameState;
  try {
    state = typeof game.game_state === 'string' ? JSON.parse(game.game_state) : game.game_state;
  } catch (e) {
    return false;
  }
  if (!state || !state.players || !state.playerState) return false;

  if (state.turnStyle === 'sequential') return false;

  const activeTeams = new Set<number>();
  state.players.forEach(p => {
    const pState = state.playerState[p.id];
    if (pState && !pState.lost) {
      activeTeams.add(p.team);
    }
  });
  if (activeTeams.size <= 1) return false;

  const activeHumans = state.players.filter(p => p.type === 'human' && !state.playerState[p.id]?.lost);
  const userPlayer = activeHumans.find(
    p => p.assignedEmail === currentUser.email || (p.id === 1 && p.isLocal)
  );

  if (!userPlayer || !userPlayer.endedTurn) return false;

  const othersPending = activeHumans.some(p => p.id !== userPlayer.id && !p.endedTurn);
  return othersPending;
};

/**
 * Returns recommended map settings for a given player count.
 */
export const getRecommendationsForPlayerCount = (count: number): { size: number; clusters: number } => {
  switch (count) {
    case 2: return { size: 40, clusters: 10 };
    case 3: return { size: 50, clusters: 14 };
    case 4: return { size: 60, clusters: 18 };
    case 5: return { size: 70, clusters: 22 };
    case 6: return { size: 80, clusters: 26 };
    case 7: return { size: 85, clusters: 30 };
    case 8: return { size: 90, clusters: 34 };
    default: return { size: 60, clusters: 18 };
  }
};
