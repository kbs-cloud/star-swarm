import React, { useState } from 'react';
import {
  GameState,
  StarSystem,
  FACTION_INFO,
  Player,
  GameRules,
  NORMAL_RULES,
  SIMPLE_RULES
} from './game/gameState';
import { StarMap } from './components/StarMap';
import { Dashboard } from './components/Dashboard';
import {
  getCurrentUser,
  registerUser,
  loginUser,
  loginWithGoogle,
  logoutUser,
  UserAccount,
  recordGameStats,
  initCSRF,
  checkSession
} from './game/auth';
import {
  listGames,
  createGame,
  getGame,
  updateGame,
  updateGameName,
  deleteGame,
  GameMetadata,
  updateSettings,
  updatePassword,
  requestToJoin,
  fetchPendingJoins,
  checkMyJoinStatus,
  acceptJoinRequest,
  rejectJoinRequest,
  JoinRequest,
  performGameAction
} from './game/gameApi';

type Screen = 'menu' | 'lobby' | 'game' | 'pass-turn' | 'game-over' | 'settings';

interface PlayerSetup {
  id: number;
  name: string;
  type: 'human' | 'ai';
  team: number;
  color?: string;
  isLocal?: boolean;
  assignedEmail?: string | null;
  endedTurn?: boolean;
}

const copyToClipboard = (text: string): Promise<boolean> => {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(text)
      .then(() => true)
      .catch(() => false);
  }
  
  // Fallback for insecure contexts
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return Promise.resolve(successful);
  } catch (err) {
    console.error('Fallback clipboard copy failed:', err);
    return Promise.resolve(false);
  }
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameMode, setGameMode] = useState<'skirmish' | 'hotseat'>('skirmish');
  const [gridSize, setGridSize] = useState<number>(60);
  const [systemCount, setSystemCount] = useState<number>(18);
  const [turnStyle, setTurnStyle] = useState<'simultaneous' | 'sequential'>('simultaneous');
  const [gameSeed, setGameSeed] = useState<string>(() => String(Math.floor(Math.random() * 900000) + 100000));
  const [overrideSightRange, setOverrideSightRange] = useState<boolean>(false);
  const [customSightRange, setCustomSightRange] = useState<number>(6.0);
  
  const [soundMuted, setSoundMuted] = useState<boolean>(() => {
    return localStorage.getItem('starswarm_sound_muted') === 'true';
  });

  const toggleSoundMuted = () => {
    setSoundMuted(prev => {
      const next = !prev;
      localStorage.setItem('starswarm_sound_muted', String(next));
      return next;
    });
  };

  const soundMutedRef = React.useRef(soundMuted);
  React.useEffect(() => {
    soundMutedRef.current = soundMuted;
  }, [soundMuted]);

  const lastHoveredButtonRef = React.useRef<Element | null>(null);

  React.useEffect(() => {
    const handleMouseEnter = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== 'function') return;
      
      const button = target.closest('button, .btn-sci-fi, [role="button"]');
      if (button) {
        if (button === lastHoveredButtonRef.current) {
          return;
        }
        lastHoveredButtonRef.current = button;
        
        if (button.hasAttribute('disabled') || button.classList.contains('disabled')) return;
        
        if (!soundMutedRef.current) {
          try {
            const audio = new Audio('/button-hover.mp3');
            audio.volume = 0.85;
            audio.play().catch(err => {
              if (err.name !== 'AbortError') {
                console.warn('Hover audio playback failed:', err);
              }
            });
          } catch (err) {
            console.warn('Hover audio context initialization failed:', err);
          }
        }
      } else {
        lastHoveredButtonRef.current = null;
      }
    };

    document.addEventListener('mouseenter', handleMouseEnter, true);
    return () => {
      document.removeEventListener('mouseenter', handleMouseEnter, true);
    };
  }, []);
  
  // Persistent Database Game States
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [activeGameName, setActiveGameName] = useState<string>('');
  const [savedGames, setSavedGames] = useState<GameMetadata[]>([]);
  const [isLoadingGame, setIsLoadingGame] = useState(false);
  const isCancelledRef = React.useRef(false);
  const [gameToDelete, setGameToDelete] = useState<GameMetadata | null>(null);

  // Connected Players & Game Owner Email
  const [connectedPlayers, setConnectedPlayers] = useState<string[]>([]);
  const [gameOwnerEmail, setGameOwnerEmail] = useState<string | null>(null);

  // Players configuration setup
  const [playersSetup, setPlayersSetup] = useState<PlayerSetup[]>([
    { id: 1, name: 'Vanguard (You)', type: 'human', team: 1, color: '#00f0ff', isLocal: true, assignedEmail: null, endedTurn: false },
    { id: 2, name: 'Nebula AI', type: 'ai', team: 2, color: '#ff007f', isLocal: false, assignedEmail: null, endedTurn: false },
    { id: 3, name: 'Solar AI', type: 'ai', team: 3, color: '#ffaa00', isLocal: false, assignedEmail: null, endedTurn: false },
    { id: 4, name: 'Void AI', type: 'ai', team: 4, color: '#39ff14', isLocal: false, assignedEmail: null, endedTurn: false }
  ]);

  const [gameState, setGameState] = useState<GameState | null>(null);
  
  // Selection states
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null);
  const [selectedFleetId, setSelectedFleetId] = useState<string | null>(null);
  const [targetSystem, setTargetSystem] = useState<StarSystem | null>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [centerOnCoords, setCenterOnCoords] = useState<{ x: number; y: number; trigger: number } | null>(null);

  // Clear target system if selection is cleared or if target system itself is selected
  React.useEffect(() => {
    if (selectedSystemId === null) {
      if (targetSystem !== null) {
        setTargetSystem(null);
      }
    } else if (targetSystem !== null && targetSystem.id === selectedSystemId) {
      setTargetSystem(null);
    }
  }, [selectedSystemId, targetSystem]);

  // Transition tracking
  const [nextHumanPlayer, setNextHumanPlayer] = useState<PlayerSetup | null>(null);

  // Game Modes State
  const [gameModes, setGameModes] = useState<GameRules[]>([]);
  const [selectedModeId, setSelectedModeId] = useState<string>('normal');

  React.useEffect(() => {
    const mode = gameModes.find(m => m.id === selectedModeId);
    if (mode) {
      setCustomSightRange(mode.starSightRange ?? 6.0);
    }
  }, [selectedModeId, gameModes]);

  const [isRulesEditorOpen, setIsRulesEditorOpen] = useState(false);
  const [editingRules, setEditingRules] = useState<GameRules | null>(null);
  const [newShipTypeKey, setNewShipTypeKey] = useState('');

  // Import/Export Rules State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importString, setImportString] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importRulesPreview, setImportRulesPreview] = useState<GameRules | null>(null);
  const [importOriginalVersion, setImportOriginalVersion] = useState<number | null>(null);
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [importPreviewErrors, setImportPreviewErrors] = useState<string[]>([]);
  const [newImportShipTypeKey, setNewImportShipTypeKey] = useState('');

  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'signin' | 'register'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Google OAuth State
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');

  const [settingsDisplayName, setSettingsDisplayName] = useState<string>('');
  const [settingsNewPassword, setSettingsNewPassword] = useState<string>('');
  const [settingsConfirmPassword, setSettingsConfirmPassword] = useState<string>('');
  const [passwordStatusMessage, setPasswordStatusMessage] = useState<string | null>(null);
  const [passwordStatusType, setPasswordStatusType] = useState<'success' | 'error' | null>(null);

  React.useEffect(() => {
    if (currentUser) {
      setSettingsDisplayName(currentUser.displayName || localStorage.getItem('starswarm_display_name') || '');
    } else {
      setSettingsDisplayName(localStorage.getItem('starswarm_display_name') || '');
    }
    setSettingsNewPassword('');
    setSettingsConfirmPassword('');
    setPasswordStatusMessage(null);
    setPasswordStatusType(null);
  }, [currentUser, screen]);

  React.useEffect(() => {
    const localName = currentUser?.displayName || localStorage.getItem('starswarm_display_name') || 'Vanguard (You)';
    setPlayersSetup(prev => {
      const copy = [...prev];
      if (copy[0]) {
        copy[0].name = localName;
      }
      return copy;
    });
  }, [currentUser]);

  // Map settings notice
  const [recNotice, setRecNotice] = useState<string | null>(null);

  // Toast notification (success/info style, distinct from error alertMsg)
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'warning'>('info');

  const showToast = (msg: string, type: 'success' | 'info' | 'warning' = 'info', durationMs = 5000) => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(null), durationMs);
  };

  // Turn-start & production notifications
  interface GameNotification {
    id: string;
    message: string;
    type: 'turn_start' | 'production' | 'info' | 'success' | 'warning';
    systemId?: number;
    createdAt: number;
  }
  const [notifications, setNotifications] = useState<GameNotification[]>([]);
  const prevGameStateRef = React.useRef<GameState | null>(null);
  const prevGameIdRef = React.useRef<string | null>(null);
  const lastTurnKeyRef = React.useRef<string | null>(null);
  const lastLoadedGameIdRef = React.useRef<string | null>(null);

  const dismissNotification = (id: string, systemId?: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (systemId !== undefined && gameState) {
      const sys = gameState.systems.find(s => s.id === systemId);
      if (sys) {
        setSelectedSystemId(systemId);
        setCenterOnCoords({ x: sys.x, y: sys.y, trigger: Date.now() });
      }
    }
  };


  // Guest Name State
  const [guestName, setGuestName] = useState<string>(() => localStorage.getItem('starswarm_guest_name') || '');
  const updateGuestName = (val: string) => {
    setGuestName(val);
    localStorage.setItem('starswarm_guest_name', val);
  };

  // Join request state (for players waiting to join a game)
  const [pendingJoinGameId, setPendingJoinGameId] = useState<string | null>(null);
  const [myJoinStatus, setMyJoinStatus] = useState<'pending' | 'accepted' | 'rejected' | null>(null);

  // Pending join requests (for the host, per game on home screen)
  // Map from gameId -> JoinRequest[]
  const [homePendingRequests, setHomePendingRequests] = useState<Record<string, JoinRequest[]>>({});
  // Which game card has the join-request panel expanded
  const [joinPanelGameId, setJoinPanelGameId] = useState<string | null>(null);
  // Which slot the host wants to assign for a given request (joinRequestId -> playerId)
  const [joinAssignSlot, setJoinAssignSlot] = useState<Record<number, number>>({});


  // Games list filters and pagination states
  const [gameSearchQuery, setGameSearchQuery] = useState('');
  const [gameSearchStatus, setGameSearchStatus] = useState('all');
  const [gameStartDate, setGameStartDate] = useState('');
  const [gameEndDate, setGameEndDate] = useState('');
  const [gameTurnsFilter, setGameTurnsFilter] = useState('');
  const [gameListOffset, setGameListOffset] = useState(0);
  const [totalGamesCount, setTotalGamesCount] = useState(0);
  const [isInfiniteLoading, setIsInfiniteLoading] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Helper: Load saved games list from database
  const loadGamesList = async (resetList = true) => {
    const newOffset = resetList ? 0 : gameListOffset;

    let idsParam: string | undefined = undefined;
    if (!currentUser) {
      // Fetch list of guest owned games from localStorage
      const ownedGames = JSON.parse(localStorage.getItem('starswarm_owned_games') || '[]');
      if (ownedGames.length === 0) {
        setSavedGames([]);
        setGameListOffset(0);
        setTotalGamesCount(0);
        return;
      }
      idsParam = ownedGames.join(',');
    }

    setIsInfiniteLoading(true);
    const res = await listGames({
      search: gameSearchQuery,
      status: gameSearchStatus,
      startDate: gameStartDate,
      endDate: gameEndDate,
      turns: gameTurnsFilter,
      limit: 10,
      offset: newOffset,
      ids: idsParam
    });
    setIsInfiniteLoading(false);
    if (res.success && res.games && res.totalCount !== undefined) {
      if (resetList) {
        setSavedGames(res.games);
        setGameListOffset(res.games.length);
      } else {
        // Append games, avoiding duplicates
        setSavedGames(prev => {
          const existingIds = new Set(prev.map(g => g.id));
          const uniqueNewGames = res.games!.filter(g => !existingIds.has(g.id));
          return [...prev, ...uniqueNewGames];
        });
        setGameListOffset(prev => prev + res.games!.length);
      }
      setTotalGamesCount(res.totalCount);
    }
  };

  React.useEffect(() => {
    if (screen === 'menu') {
      const timer = setTimeout(() => {
        loadGamesList(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameSearchQuery, gameSearchStatus, gameStartDate, gameEndDate, gameTurnsFilter, currentUser, screen]);

  // Helper to determine if a player is local to this client session
  const isPlayerLocalToClient = (player: PlayerSetup | Player): boolean => {
    const userEmail = currentUser?.email || localStorage.getItem('starswarm_guest_name');
    if (userEmail && player.assignedEmail?.trim().toLowerCase() === userEmail.trim().toLowerCase()) {
      return true;
    }
    const ownedGames = JSON.parse(localStorage.getItem('starswarm_owned_games') || '[]');
    const isLocalOwner = activeGameId ? ownedGames.includes(activeGameId) : false;
    const isOwner = gameOwnerEmail ? (gameOwnerEmail === userEmail) : (isLocalOwner || !userEmail);
    if (player.isLocal && isOwner) {
      return true;
    }
    return false;
  };

  // Helper: Fetch and load game by ID
  // userOverride: pass the resolved user directly to avoid stale React state closures
  const loadGameFromId = async (id: string, userOverride?: UserAccount | null) => {
    const effectiveUser = userOverride !== undefined ? userOverride : currentUser;
    
    // Optimistically transition to game screen with skeleton grid
    const skeletonState: GameState = {
      gridWidth: gridSize || 60,
      gridHeight: gridSize || 60,
      systems: [],
      fleets: [],
      players: playersSetup,
      playerState: {},
      turnNumber: 1,
      activePlayerIdx: 0,
      combatLog: [],
      rules: NORMAL_RULES,
      turnStyle: turnStyle,
    };
    setGameState(skeletonState);
    setScreen('game');
    setIsLoadingGame(true);
    isCancelledRef.current = false;

    const res = await getGame(id);
    
    if (isCancelledRef.current) return;
    setIsLoadingGame(false);

    if (res.success && res.game) {
      const gameData = res.game;
      const userEmail = effectiveUser?.email || localStorage.getItem('starswarm_guest_name') || null;
      const ownedGames = JSON.parse(localStorage.getItem('starswarm_owned_games') || '[]');
      const isLocalOwner = ownedGames.includes(gameData.id);
      const isOwner = gameData.ownerEmail ? (gameData.ownerEmail === userEmail) : isLocalOwner;
      const hasSlot = gameData.gameState.players.some(
        p => (userEmail && userEmail.trim().length > 0 && p.assignedEmail?.trim().toLowerCase() === userEmail.trim().toLowerCase()) || (p.isLocal && isOwner)
      );

      // If user has no slot and is not the host, show the join request flow
      if (!isOwner && !hasSlot) {
        setScreen('menu');
        setGameState(null);
        setActiveGameId(gameData.id);
        setPendingJoinGameId(gameData.id);
        window.history.pushState(null, '', `?gameId=${gameData.inviteCode || gameData.id}`);
        // Check if there's already a pending request for this user
        const statusRes = await checkMyJoinStatus(gameData.id, userEmail || undefined);
        if (isCancelledRef.current) return;
        setMyJoinStatus(statusRes.success ? (statusRes.status ?? null) : null);
        return;
      }

      setGameState(gameData.gameState);
      setActiveGameId(gameData.id);
      setActiveGameName(gameData.name || '');
      setGameOwnerEmail(gameData.ownerEmail);
      setConnectedPlayers(res.connectedPlayers || []);
      
      // Determine gameMode (skirmish vs hotseat) from players
      const hasMultipleHumans = gameData.gameState.players.filter(p => p.type === 'human').length > 1;
      setGameMode(hasMultipleHumans ? 'hotseat' : 'skirmish');
      setTurnStyle(gameData.gameState.turnStyle || 'simultaneous');
      
      // Update players setup to match
      const setup = gameData.gameState.players.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        team: p.team,
        color: p.color,
        isLocal: p.isLocal,
        assignedEmail: p.assignedEmail,
        endedTurn: p.endedTurn
      }));
      setPlayersSetup(setup);
      window.history.pushState(null, '', `?gameId=${gameData.inviteCode || gameData.id}`);
    } else {
      setScreen('menu');
      setGameState(null);
      showError(res.error || 'Failed to load the specified game simulation.');
      clearUrlQuery();
    }
  };

  // Helper: Clear query parameters from address bar
  const clearUrlQuery = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('gameId');
    window.history.pushState(null, '', url.pathname + url.search);
    setActiveGameId(null);
  };

  // Helper: Sync active game state back to SQLite database
  const syncGameState = async (newState: GameState) => {
    if (activeGameId) {
      const res = await updateGame(activeGameId, newState);
      if (!res.success) {
        console.warn('Game state synchronization failed:', res.error);
      }
    }
  };

  // Helper: Return to menu safely, clearing active game query
  const handleReturnToMenu = () => {
    clearUrlQuery();
    setGameState(null);
    setScreen('menu');
    loadGamesList();
  };

  const handleCancelLoading = () => {
    isCancelledRef.current = true;
    setIsLoadingGame(false);
    setGameState(null);
    setScreen('menu');
    setActiveGameId(null);
    clearUrlQuery();
  };

  // Helper: Save display name settings globally
  const handleSaveSettings = async () => {
    localStorage.setItem('starswarm_display_name', settingsDisplayName);
    if (currentUser) {
      const res = await updateSettings(settingsDisplayName);
      if (res.success) {
        const updatedUser = await checkSession();
        if (updatedUser) {
          setCurrentUser(updatedUser);
        }
      } else {
        showError(res.error || 'Failed to update settings on server.');
        return;
      }
    }
    setScreen('menu');
  };

  // Helper: Securely change password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatusMessage(null);
    setPasswordStatusType(null);

    if (!currentUser) {
      setPasswordStatusMessage('You must be logged in to change your password.');
      setPasswordStatusType('error');
      return;
    }

    if (!settingsNewPassword || settingsNewPassword.length < 8) {
      setPasswordStatusMessage('New password must be at least 8 characters long.');
      setPasswordStatusType('error');
      return;
    }

    if (settingsNewPassword !== settingsConfirmPassword) {
      setPasswordStatusMessage('New passwords do not match.');
      setPasswordStatusType('error');
      return;
    }

    const res = await updatePassword(settingsNewPassword);
    if (res.success) {
      setPasswordStatusMessage('Password updated successfully. You will be logged out...');
      setPasswordStatusType('success');
      showToast('Password updated successfully. Re-authenticating...', 'success');

      // Clear password fields
      setSettingsNewPassword('');
      setSettingsConfirmPassword('');

      // Invalidate active session and log out
      setTimeout(() => {
        setCurrentUser(null);
        setScreen('menu');
        window.location.reload();
      }, 2000);
    } else {
      setPasswordStatusMessage(res.error || 'Failed to change password.');
      setPasswordStatusType('error');
    }
  };

  // Helper: Rename player in game
  const handleRenamePlayer = (playerId: number, newName: string) => {
    if (!gameState) return;
    const stateCopy = { ...gameState };
    const player = stateCopy.players.find(p => p.id === playerId);
    if (player) {
      player.name = newName;
    }
    const pState = stateCopy.playerState[playerId];
    if (pState) {
      pState.name = newName;
    }
    setGameState(stateCopy);
    syncGameState(stateCopy);
  };

  // Helper: Rename game manually
  const handleRenameGame = async (newName: string) => {
    if (!activeGameId) return;
    const res = await updateGameName(activeGameId, newName);
    if (res.success) {
      setActiveGameName(newName);
      showToast('🚀 Game renamed successfully!', 'success');
    } else {
      showError(res.error || 'Failed to rename game.');
    }
  };

  // Helper: Cancel end turn inside the active game
  const handleCancelEndTurn = async (playerId: number) => {
    if (!gameState || !activeGameId) return;
    const res = await performGameAction(activeGameId, 'cancel_end_turn', playerId);
    if (res.success && res.gameState) {
      setGameState(res.gameState);
      setScreen('game');
    } else {
      showError(res.error || 'Failed to cancel end turn.');
    }
  };

  // Helper: Cancel end turn directly from game card on home screen
  const handleCancelEndTurnForGame = async (gameId: string, playerId: number) => {
    const res = await performGameAction(gameId, 'cancel_end_turn', playerId);
    if (res.success && res.gameState) {
      const gamesRes = await listGames();
      if (gamesRes.success && gamesRes.games) {
        setSavedGames(gamesRes.games);
      }
    } else {
      showError(res.error || 'Failed to cancel end turn.');
    }
  };

  // Helper: Get Game Turn Status for home page saved games
  const getGameTurnStatus = (game: GameMetadata, currentUserEmail: string | null) => {
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
    const userPlayer = activeHumans.find(p => p.assignedEmail === currentUserEmail || (p.id === 1 && p.isLocal));

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

  // Helper: Check if end turn can be cancelled from the home screen
  const canCancelEndTurnInGame = (game: GameMetadata): boolean => {
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
    const userPlayer = activeHumans.find(p => p.assignedEmail === currentUser.email || (p.id === 1 && p.isLocal));

    if (!userPlayer || !userPlayer.endedTurn) return false;

    const othersPending = activeHumans.some(p => p.id !== userPlayer.id && !p.endedTurn);
    return othersPending;
  };

  // Initialize CSRF and restore session cookie on mount
  React.useEffect(() => {
    const bootstrap = async () => {
      await initCSRF();
      const user = await checkSession();
      if (user) {
        setCurrentUser(user);
      }
      
      // Check query parameter for gameId
      const params = new URLSearchParams(window.location.search);
      const urlGameId = params.get('gameId');
      if (urlGameId) {
        // Pass user directly (which might be null)
        loadGameFromId(urlGameId, user);
      }
    };
    bootstrap();
  }, []);

  // When user logs in after a URL with gameId was already set (e.g. auth modal appeared),
  // reload the game now that we have an identity to check slots against.
  // We track the pendingJoinGameId rather than activeGameId to avoid re-triggering on normal navigation.
  React.useEffect(() => {
    if (currentUser && pendingJoinGameId) {
      loadGameFromId(pendingJoinGameId, currentUser);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Load custom game modes when current user changes
  React.useEffect(() => {
    const email = currentUser?.email;
    const key = email ? `starswarm_custom_rules_${email}` : 'starswarm_custom_rules_guest';
    let stored = localStorage.getItem(key);
    if (!stored && !email) {
      stored = localStorage.getItem('starswarm_custom_rules');
    }
    try {
      const parsedStored: GameRules[] = stored ? JSON.parse(stored) : [];
      setGameModes([NORMAL_RULES, SIMPLE_RULES, ...parsedStored]);
    } catch (e) {
      console.error('Failed to parse custom rules', e);
      setGameModes([NORMAL_RULES, SIMPLE_RULES]);
    }
  }, [currentUser?.email]);

  // Periodic polling loop for game state & presence updates
  React.useEffect(() => {
    if (!activeGameId || screen !== 'game') return;

    let isSubscribed = true;
    const poll = async () => {
      const res = await getGame(activeGameId);
      if (!isSubscribed) return;

      if (res.success && res.game) {
        setConnectedPlayers(res.connectedPlayers || []);
        if (res.game.name) {
          setActiveGameName(res.game.name);
        }
        
        const serverState = res.game.gameState;
        setGameState(prev => {
          if (!prev) return serverState;

          const isTurnChanged = serverState.turnNumber !== prev.turnNumber || serverState.activePlayerIdx !== prev.activePlayerIdx;
          const activePlayerOnServer = serverState.players[serverState.activePlayerIdx];
          const isRemoteActive = activePlayerOnServer && !isPlayerLocalToClient(activePlayerOnServer);
          
          const isStateDifferent = JSON.stringify(serverState.fleets) !== JSON.stringify(prev.fleets) ||
                                  JSON.stringify(serverState.playerState) !== JSON.stringify(prev.playerState) ||
                                  JSON.stringify(serverState.systems.map(s => ({ owner: s.owner, ships: s.ships, queue: s.buildQueue }))) !== 
                                  JSON.stringify(prev.systems.map(s => ({ owner: s.owner, ships: s.ships, queue: s.buildQueue }))) ||
                                  JSON.stringify(serverState.players) !== JSON.stringify(prev.players);

          if (isTurnChanged || isRemoteActive || isStateDifferent) {
            return serverState;
          }
          return prev;
        });
      }
    };

    poll();
    const interval = setInterval(poll, 3000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [activeGameId, screen, currentUser, gameOwnerEmail]);

  // Monitor turn transitions and planet production completions
  React.useEffect(() => {
    if (!gameState || !activeGameId) {
      prevGameStateRef.current = null;
      prevGameIdRef.current = null;
      return;
    }

    if (prevGameIdRef.current !== activeGameId) {
      prevGameStateRef.current = gameState;
      prevGameIdRef.current = activeGameId;
      return;
    }

    // Only process notifications when actually viewing the game screen.
    // In Hotseat mode, screen changes to 'pass-turn' temporarily, but we do not
    // clear prevGameStateRef.current. When the next player clicks "Start Turn"
    // and screen goes back to 'game', we will check transitions relative to the
    // last game state we saw.
    if (screen !== 'game') {
      return;
    }

    const prev = prevGameStateRef.current;
    if (prev) {
      const isTurnChanged = gameState.turnNumber > prev.turnNumber;
      const isActivePlayerChanged = gameState.activePlayerIdx !== prev.activePlayerIdx;

      if (isTurnChanged || isActivePlayerChanged) {
        const isSequential = gameState.turnStyle === 'sequential';
        const activePlayerSlot = gameState.players[gameState.activePlayerIdx];

        // Local players who just became active (i.e. it's their turn now)
        const newlyActiveLocalPlayers = gameState.players.filter(p => {
          if (!isPlayerLocalToClient(p) || gameState.playerState[p.id]?.lost) return false;

          if (isSequential) {
            const wasActive = prev.players[prev.activePlayerIdx]?.id === p.id && !isTurnChanged;
            return p.id === activePlayerSlot?.id && !wasActive;
          } else {
            return isTurnChanged;
          }
        });

        if (newlyActiveLocalPlayers.length > 0) {
          const newNotifications: GameNotification[] = [];

          newlyActiveLocalPlayers.forEach(p => {
            newNotifications.push({
              id: `turn-start-${gameState.turnNumber}-${p.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              message: `🚀 Turn ${gameState.turnNumber} Started for ${p.name}!`,
              type: 'turn_start',
              createdAt: Date.now()
            });
          });

          // Play turn-start sound effect if not muted
          if (!soundMutedRef.current) {
            try {
              const audio = new Audio('/turn-start.mp3');
              audio.volume = 0.45;
              audio.play().catch(err => {
                console.warn('Audio playback failed:', err);
              });
            } catch (err) {
              console.warn('Audio context initialization failed:', err);
            }
          }

          if (isTurnChanged) {
            gameState.systems.forEach(newSys => {
              const ownerPlayer = newlyActiveLocalPlayers.find(p => p.id === newSys.owner);
              if (ownerPlayer) {
                const oldSys = prev.systems.find(s => s.id === newSys.id);
                if (oldSys && oldSys.buildQueue && oldSys.buildQueue.length > 0) {
                  const firstJob = oldSys.buildQueue[0];
                  if (firstJob.turnsRemaining === 1) {
                    newNotifications.push({
                      id: `prod-${newSys.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                      message: `🛠️ ${newSys.name} finished producing ${firstJob.shipType}!`,
                      type: 'production',
                      systemId: newSys.id,
                      createdAt: Date.now()
                    });
                  }
                }
              }
            });
          }

          if (newNotifications.length > 0) {
            setNotifications(prevNotifs => [...prevNotifs, ...newNotifications]);
            
            // Setup auto-dismiss for each new notification after 6 seconds
            newNotifications.forEach(notif => {
              setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== notif.id));
              }, 6000);
            });
          }
        }
      }
    }

    prevGameStateRef.current = gameState;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, activeGameId, screen]);


  // When on the game screen, if we are the host, poll for pending join requests every 5 s
  React.useEffect(() => {
    const userEmail = currentUser?.email || guestName;
    const ownedGames = JSON.parse(localStorage.getItem('starswarm_owned_games') || '[]');
    const isLocalOwner = activeGameId ? ownedGames.includes(activeGameId) : false;
    const isOwner = gameOwnerEmail ? (gameOwnerEmail === userEmail) : (isLocalOwner || !userEmail);

    if (!activeGameId || screen !== 'game' || !isOwner) return;

    let isSubscribed = true;
    const pollJoins = async () => {
      const res = await fetchPendingJoins(activeGameId);
      if (!isSubscribed) return;
      if (res.success && res.requests) {
        const prev = homePendingRequests[activeGameId] || [];
        const prevCount = prev.length;
        const newCount = res.requests.length;
        if (newCount > prevCount) {
          showToast(`📡 ${newCount - prevCount} new join request${newCount - prevCount > 1 ? 's' : ''} received!`, 'info');
        }
        setHomePendingRequests(h => ({ ...h, [activeGameId]: res.requests || [] }));
      }
    };
    pollJoins();
    const interval = setInterval(pollJoins, 5000);
    return () => { isSubscribed = false; clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGameId, screen, currentUser, gameOwnerEmail, guestName]);

  // Poll home screen pending join requests for each owned saved game every 8 s
  React.useEffect(() => {
    if (screen !== 'menu' || !currentUser) return;
    let isSubscribed = true;

    const pollAllGames = async () => {
      for (const game of savedGames) {
        const res = await fetchPendingJoins(game.id);
        if (!isSubscribed) break;
        if (res.success && res.requests) {
          setHomePendingRequests(h => {
            const prev = h[game.id] || [];
            const prevCount = prev.length;
            const newCount = res.requests!.length;
            if (newCount > prevCount) {
              showToast(`📡 ${newCount - prevCount} new join request${newCount - prevCount > 1 ? 's' : ''} for "${game.name}"`, 'info');
            }
            return { ...h, [game.id]: res.requests! };
          });
        }
      }
    };

    pollAllGames();
    const interval = setInterval(pollAllGames, 8000);
    return () => { isSubscribed = false; clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, currentUser, savedGames.length]);

  // If the player has a pending join request, poll their status every 3 s
  React.useEffect(() => {
    const userEmail = currentUser?.email || guestName;
    if (!pendingJoinGameId || !userEmail) return;
    let isSubscribed = true;

    const pollStatus = async () => {
      const res = await checkMyJoinStatus(pendingJoinGameId, userEmail);
      if (!isSubscribed) return;
      if (res.success) {
        if (res.status === 'accepted') {
          setMyJoinStatus('accepted');
          showToast('✅ Join request accepted! Loading game...', 'success');
          setPendingJoinGameId(null);
          // Load the game now that we have a slot
          setTimeout(() => loadGameFromId(pendingJoinGameId), 1000);
        } else if (res.status === 'rejected') {
          setMyJoinStatus('rejected');
          showToast('❌ Join request was declined by the host.', 'warning', 6000);
          setPendingJoinGameId(null);
        }
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 3000);
    return () => { isSubscribed = false; clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingJoinGameId, currentUser, guestName]);


  // Recommendations mapping
  const getRecommendationsForPlayerCount = (count: number) => {
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

  const applyRecommendations = (playerCount: number) => {
    const recs = getRecommendationsForPlayerCount(playerCount);
    setGridSize(recs.size);
    setSystemCount(recs.clusters);
    setRecNotice(`Recommended map parameters applied for ${playerCount} factions.`);
    setTimeout(() => setRecNotice(null), 4000);
  };

  // Add a new faction in the lobby
  const handleAddPlayer = () => {
    if (playersSetup.length >= 8) return;
    const nextId = playersSetup.length + 1;
    const factionDefaults = FACTION_INFO[nextId] || { name: `Faction ${nextId}`, color: '#ffffff', team: ((nextId - 1) % 4) + 1 };
    
    const newPlayer: PlayerSetup = {
      id: nextId,
      name: `Admiral ${String.fromCharCode(64 + nextId)}`,
      type: 'human',
      team: factionDefaults.team,
      color: factionDefaults.color,
      isLocal: true,
      assignedEmail: '',
      endedTurn: false
    };
    
    const newSetup = [...playersSetup, newPlayer];
    setPlayersSetup(newSetup);
    applyRecommendations(newSetup.length);
  };

  // Remove a faction in the lobby
  const handleRemovePlayer = (idToRemove: number) => {
    if (playersSetup.length <= 2) return;
    const filtered = playersSetup.filter(p => p.id !== idToRemove);
    const reindexed = filtered.map((p, index) => {
      const newId = index + 1;
      const factionDefaults = FACTION_INFO[newId] || { name: `Faction ${newId}`, color: '#ffffff' };
      return {
        ...p,
        id: newId,
        name: p.name.startsWith('Admiral ') || p.name.includes(' AI') || p.name.includes('You')
          ? (newId === 1 
              ? 'Vanguard (You)' 
              : (p.type === 'ai' ? `${factionDefaults.name.split(' ')[0]} AI` : `Admiral ${String.fromCharCode(64 + newId)}`))
          : p.name,
        color: factionDefaults.color
      };
    });
    setPlayersSetup(reindexed);
    applyRecommendations(reindexed.length);
  };

  const [editorErrors, setEditorErrors] = useState<string[]>([]);

  const saveCustomModes = (customs: GameRules[]) => {
    const email = currentUser?.email;
    const key = email ? `starswarm_custom_rules_${email}` : 'starswarm_custom_rules_guest';
    localStorage.setItem(key, JSON.stringify(customs));
    setGameModes([NORMAL_RULES, SIMPLE_RULES, ...customs]);
  };

  const handleSaveRules = () => {
    if (!editingRules) return;
    
    // Validation
    const errors: string[] = [];
    if (!editingRules.name.trim()) errors.push('Ruleset name cannot be empty.');
    if (Object.keys(editingRules.ships).length === 0) errors.push('At least one ship type must be defined.');
    
    // Check hit chances are valid decimals
    Object.entries(editingRules.ships).forEach(([type, def]) => {
      if (def.hitChance < 0 || def.hitChance > 1) {
        errors.push(`Hit chance for ${type} must be between 0.0 and 1.0.`);
      }
      if (def.speed <= 0) {
        errors.push(`Speed for ${type} must be greater than 0.`);
      }
      if (def.hp <= 0) {
        errors.push(`Structural HP for ${type} must be greater than 0.`);
      }
    });

    if (errors.length > 0) {
      setEditorErrors(errors);
      return;
    }

    setEditorErrors([]);
    
    // Find all custom rules, replace the edited one, or add if new
    const customs = gameModes.filter(m => !m.isDefault && m.id !== editingRules.id);
    const updatedCustoms = [...customs, editingRules];
    saveCustomModes(updatedCustoms);
    setSelectedModeId(editingRules.id);
    setIsRulesEditorOpen(false);
    setEditingRules(null);
  };

  const handleExportRules = () => {
    const currentMode = gameModes.find(m => m.id === selectedModeId);
    if (!currentMode) return;
    try {
      const rulesCopy = { ...currentMode };
      rulesCopy.version = rulesCopy.version || 1;
      rulesCopy.isDefault = false;

      const jsonStr = JSON.stringify(rulesCopy);
      const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
      const exportStr = `SS-RULES-V${rulesCopy.version || 1}-${b64}`;
      
      navigator.clipboard.writeText(exportStr).then(() => {
        setAlertMsg('RULESET PROTOCOL EXPORTED TO CLIPBOARD');
        setTimeout(() => setAlertMsg(null), 3000);
      }).catch(err => {
        console.error('Clipboard export failed', err);
        alert(`Export String:\n\n${exportStr}`);
      });
    } catch (e) {
      console.error('Ruleset export serialization failed', e);
      showError('Failed to serialize ruleset for export.');
    }
  };

  const handleProcessImport = () => {
    setImportError(null);
    setImportPreviewErrors([]);
    const input = importString.trim();
    if (!input) {
      setImportError('Please enter a ruleset configuration string.');
      return;
    }

    try {
      let parsedRules: GameRules | null = null;
      let importedVersion = 1;

      if (input.startsWith('SS-RULES-')) {
        const parts = input.split('-');
        if (parts.length >= 4) {
          const verStr = parts[2];
          importedVersion = parseInt(verStr.replace('V', '')) || 1;
          const b64 = parts.slice(3).join('-');
          const decodedJson = decodeURIComponent(escape(atob(b64)));
          parsedRules = JSON.parse(decodedJson);
        } else {
          throw new Error('Invalid prefix format.');
        }
      } else {
        try {
          const decodedJson = decodeURIComponent(escape(atob(input)));
          parsedRules = JSON.parse(decodedJson);
          importedVersion = parsedRules?.version || 1;
        } catch {
          parsedRules = JSON.parse(input);
          importedVersion = parsedRules?.version || 1;
        }
      }

      if (!parsedRules || typeof parsedRules !== 'object') {
        throw new Error('Invalid ruleset object.');
      }

      if (!parsedRules.name || !parsedRules.ships) {
        throw new Error('Missing name or ships attributes.');
      }

      const CURRENT_RULES_VERSION = 1;
      const migratedRules: GameRules = {
        ...parsedRules,
        version: CURRENT_RULES_VERSION,
        isDefault: false,
      };

      migratedRules.id = 'custom_' + Date.now();

      if (migratedRules.enableCredits === undefined) migratedRules.enableCredits = true;
      if (migratedRules.enableUpgrades === undefined) migratedRules.enableUpgrades = true;
      if (migratedRules.captureRequiresColonyShip === undefined) migratedRules.captureRequiresColonyShip = true;
      if (migratedRules.startingResources === undefined) migratedRules.startingResources = 60;
      if (migratedRules.starSightRange === undefined) migratedRules.starSightRange = 6.0;
      
      if (!migratedRules.resourcesPerTurn) {
        migratedRules.resourcesPerTurn = { base: 15, randomAdd: 10 };
      }
      if (!migratedRules.startingShips) {
        migratedRules.startingShips = { Fighter: 5 };
      }
      if (!migratedRules.neutralStartingShipsRange) {
        migratedRules.neutralStartingShipsRange = { min: 1, max: 4, type: 'Fighter' };
      }
      if (!migratedRules.nodeProduction) {
        migratedRules.nodeProduction = { enabled: false, shipsPerTurn: 0, shipType: '' };
      }

      Object.keys(migratedRules.ships).forEach(shipType => {
        const ship = migratedRules.ships[shipType];
        if (ship.cost === undefined) ship.cost = 10;
        if (ship.speed === undefined) ship.speed = 3.0;
        if (ship.hp === undefined) ship.hp = 1;
        if (ship.attack === undefined) ship.attack = 1;
        if (ship.hitChance === undefined) ship.hitChance = 0.5;
        if (ship.description === undefined) ship.description = 'Imported combat hull.';
      });

      setImportOriginalVersion(importedVersion);
      setImportRulesPreview(migratedRules);
      setIsImportModalOpen(false);
      setIsImportPreviewOpen(true);
    } catch (e) {
      console.error('Import parse error', e);
      setImportError('Failed to parse the ruleset string. Please verify it is a valid export string.');
    }
  };

  const handleConfirmImport = () => {
    if (!importRulesPreview) return;

    const errors: string[] = [];
    if (!importRulesPreview.name.trim()) errors.push('Ruleset name cannot be empty.');
    if (Object.keys(importRulesPreview.ships).length === 0) errors.push('At least one ship type must be defined.');
    
    Object.entries(importRulesPreview.ships).forEach(([type, def]) => {
      if (def.hitChance < 0 || def.hitChance > 1) {
        errors.push(`Hit chance for ${type} must be between 0.0 and 1.0.`);
      }
      if (def.speed <= 0) {
        errors.push(`Speed for ${type} must be greater than 0.`);
      }
      if (def.hp < 1) {
        errors.push(`HP for ${type} must be at least 1.`);
      }
    });

    if (errors.length > 0) {
      setImportPreviewErrors(errors);
      return;
    }

    const customs = gameModes.filter(m => !m.isDefault);
    let finalName = importRulesPreview.name.trim();
    const nameExists = gameModes.some(m => m.name.toLowerCase() === finalName.toLowerCase());
    if (nameExists) {
      finalName = `${finalName} (Imported)`;
    }

    const finalRules: GameRules = {
      ...importRulesPreview,
      name: finalName
    };

    const newCustoms = [...customs, finalRules];
    saveCustomModes(newCustoms);
    setSelectedModeId(finalRules.id);
    
    setIsImportPreviewOpen(false);
    setImportRulesPreview(null);
    setImportOriginalVersion(null);
  };

  const handleStartGame = async () => {
    if (systemCount < playersSetup.length) {
      showError(`Insufficient clusters! Must have at least ${playersSetup.length} systems for this faction count.`);
      return;
    }

    const guestNameVal = localStorage.getItem('starswarm_guest_name') || '';
    const updatedSetup = [...playersSetup];
    if (updatedSetup[0]) {
      updatedSetup[0].assignedEmail = currentUser ? currentUser.email : guestNameVal;
      updatedSetup[0].isLocal = true;
    }

    const activeRules = gameModes.find(m => m.id === selectedModeId) || NORMAL_RULES;
    const finalRules = {
      ...activeRules,
      starSightRange: overrideSightRange ? customSightRange : (activeRules.starSightRange ?? 6.0)
    };
    const setupOptions = {
      gridWidth: gridSize,
      gridHeight: gridSize,
      numSystems: systemCount,
      players: updatedSetup,
      rules: finalRules,
      turnStyle: turnStyle,
      seed: gameSeed
    };

    // Transition to game screen with just the grid, no nodes
    const skeletonState: GameState = {
      gridWidth: gridSize,
      gridHeight: gridSize,
      systems: [],
      fleets: [],
      players: updatedSetup,
      playerState: {},
      turnNumber: 1,
      activePlayerIdx: 0,
      combatLog: [],
      rules: finalRules,
      turnStyle: turnStyle,
    };
    setGameState(skeletonState);
    setSelectedSystemId(null);
    setSelectedFleetId(null);
    setTargetSystem(null);
    setScreen('game');
    setIsLoadingGame(true);
    isCancelledRef.current = false;

    const gameName = `Skirmish Match (${new Date().toLocaleDateString()})`;
    const res = await createGame(gameName, null, setupOptions);
    
    if (isCancelledRef.current) return;

    if (res.success && res.gameId) {
      // Fetch the actual initialized game state from the server
      const getRes = await getGame(res.gameId);
      
      if (isCancelledRef.current) return;

      if (getRes.success && getRes.game) {
        const gameData = getRes.game;
        setActiveGameId(gameData.id);
        setGameOwnerEmail(gameData.ownerEmail);
        if (!currentUser) {
          const owned = JSON.parse(localStorage.getItem('starswarm_owned_games') || '[]');
          owned.push(gameData.id);
          localStorage.setItem('starswarm_owned_games', JSON.stringify(owned));
        }
        window.history.pushState(null, '', `?gameId=${gameData.inviteCode || gameData.id}`);
        setGameState(gameData.gameState);
        setConnectedPlayers(getRes.connectedPlayers || []);
        
        const hasMultipleHumans = gameData.gameState.players.filter(p => p.type === 'human').length > 1;
        setGameMode(hasMultipleHumans ? 'hotseat' : 'skirmish');
        setTurnStyle(gameData.gameState.turnStyle || 'simultaneous');

        loadGamesList();
      } else {
        showError(getRes.error || 'Failed to fetch the initialized game state.');
        setGameState(null);
        setScreen('menu');
      }
    } else {
      showError(res.error || 'Failed to save new game simulation to database.');
      setGameState(null);
      setScreen('menu');
    }
    setIsLoadingGame(false);
  };

  // Initialize unified Skirmish Match Lobby
  const handleStartSkirmishLobby = () => {
    const ownerEmail = currentUser?.email || '';
    const localName = currentUser?.displayName || localStorage.getItem('starswarm_display_name') || 'Vanguard (You)';
    const newSetup: PlayerSetup[] = [
      { id: 1, name: localName, type: 'human', team: 1, color: '#00f0ff', isLocal: true, assignedEmail: ownerEmail, endedTurn: false },
      { id: 2, name: 'Nebula AI', type: 'ai', team: 2, color: '#ff007f', isLocal: false, assignedEmail: null, endedTurn: false },
      { id: 3, name: 'Solar AI', type: 'ai', team: 3, color: '#ffaa00', isLocal: false, assignedEmail: null, endedTurn: false },
      { id: 4, name: 'Void AI', type: 'ai', team: 4, color: '#39ff14', isLocal: false, assignedEmail: null, endedTurn: false }
    ];
    setPlayersSetup(newSetup);
    setGameMode('skirmish');
    setGameOwnerEmail(ownerEmail);
    applyRecommendations(newSetup.length);
    setScreen('lobby');
  };

  // Adjust player setup
  const updatePlayerSetup = (index: number, key: keyof PlayerSetup, value: any) => {
    setPlayersSetup(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  };

  // Auth Operations
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    if (!authEmail || !authPassword) {
      setAuthError('Please fill in all fields.');
      return;
    }
    const res = await registerUser(authEmail, authPassword);
    if (res.success) {
      setAuthSuccess('Account created successfully! You can now sign in.');
      setAuthTab('signin');
      setAuthPassword('');
    } else {
      setAuthError(res.message);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    if (!authEmail || !authPassword) {
      setAuthError('Please fill in all fields.');
      return;
    }
    const res = await loginUser(authEmail, authPassword);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      setIsAuthModalOpen(false);
      clearAuthInputs();
      
      const params = new URLSearchParams(window.location.search);
      const urlGameId = params.get('gameId');
      if (urlGameId) {
        loadGameFromId(urlGameId, res.user);
      } else if (pendingJoinGameId) {
        loadGameFromId(pendingJoinGameId, res.user);
      }
    } else {
      setAuthError(res.message);
    }
  };

  const handleGoogleLogin = async (email: string) => {
    setAuthError(null);
    setAuthSuccess(null);
    const res = await loginWithGoogle(email);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      setIsGoogleModalOpen(false);
      setIsAuthModalOpen(false);
      clearAuthInputs();
      
      const params = new URLSearchParams(window.location.search);
      const urlGameId = params.get('gameId');
      if (urlGameId) {
        loadGameFromId(urlGameId, res.user);
      } else if (pendingJoinGameId) {
        loadGameFromId(pendingJoinGameId, res.user);
      }
    } else {
      setAuthError(res.message);
    }
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setSavedGames([]);
    clearUrlQuery();
  };

  const clearAuthInputs = () => {
    setAuthEmail('');
    setAuthPassword('');
    setAuthError(null);
    setAuthSuccess(null);
    setCustomGoogleEmail('');
  };

  // Records user statistics on victory/defeat
  const recordStats = (state: GameState) => {
    const activeSession = getCurrentUser();
    if (!activeSession) return;
    
    const activeFactions = state.players.filter(p => !state.playerState[p.id].lost);
    if (activeFactions.length === 0) {
      recordGameStats(activeSession.email, false);
      setCurrentUser(getCurrentUser());
      return;
    }
    
    const winningTeam = activeFactions[0].team;
    let didUserWin = false;
    
    if (gameMode === 'skirmish') {
      const humanPlayer = state.players.find(p => p.id === 1);
      if (humanPlayer && humanPlayer.team === winningTeam && !state.playerState[1].lost) {
        didUserWin = true;
      }
    } else {
      const winningHumans = state.players.filter(
        p => p.type === 'human' && p.team === winningTeam && !state.playerState[p.id].lost
      );
      if (winningHumans.length > 0) {
        didUserWin = true;
      }
    }
    
    recordGameStats(activeSession.email, didUserWin);
    setCurrentUser(getCurrentUser());
  };

  // Helper to determine the active player for the client rendering context
  const getClientActivePlayer = (state: GameState | null): Player | null => {
    if (!state) return null;
    
    // In sequential mode, always follow the global active player
    if (state.turnStyle === 'sequential') {
      return state.players[state.activePlayerIdx] || null;
    }
    
    // In simultaneous mode, find a local human player who hasn't ended their turn yet
    const localPending = state.players.filter(p => 
      p.type === 'human' && 
      !state.playerState[p.id]?.lost && 
      !p.endedTurn && 
      isPlayerLocalToClient(p)
    );
    
    if (localPending.length > 0) {
      return localPending[0];
    }
    
    // If all local human players have ended their turn, fall back to the first local human player (even if ended)
    const localAll = state.players.filter(p => 
      p.type === 'human' && 
      isPlayerLocalToClient(p)
    );
    if (localAll.length > 0) {
      return localAll[0];
    }
    
    // Fallback to the global active player
    return state.players[state.activePlayerIdx] || null;
  };

  const activePlayer = getClientActivePlayer(gameState);

  // Center/select home planet at turn start if an unowned planet is selected
  React.useEffect(() => {
    if (screen === 'game' && gameState && activePlayer && activeGameId) {
      const currentTurnKey = `${activeGameId}-${activePlayer.id}-${gameState.turnNumber}`;
      if (currentTurnKey !== lastTurnKeyRef.current) {
        lastTurnKeyRef.current = currentTurnKey;

        if (selectedSystemId !== null) {
          const selectedSystem = gameState.systems.find(s => s.id === selectedSystemId);
          if (selectedSystem && selectedSystem.owner !== activePlayer.id) {
            const homePlanet = gameState.systems.find(s => s.owner === activePlayer.id && s.isHomePlanet);
            if (homePlanet) {
              setSelectedSystemId(homePlanet.id);
              setCenterOnCoords({ x: homePlanet.x, y: homePlanet.y, trigger: Date.now() });
            }
          }
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, gameState, activePlayer, activeGameId, selectedSystemId]);

  // Center on home planet when a game loads in
  React.useEffect(() => {
    if (screen === 'game' && gameState && activePlayer && activeGameId) {
      if (activeGameId !== lastLoadedGameIdRef.current) {
        lastLoadedGameIdRef.current = activeGameId;
        const homePlanet = gameState.systems.find(s => s.owner === activePlayer.id && s.isHomePlanet);
        if (homePlanet) {
          setCenterOnCoords({ x: homePlanet.x, y: homePlanet.y, trigger: Date.now() });
        }
      }
    } else if (screen !== 'game') {
      lastLoadedGameIdRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, gameState, activePlayer, activeGameId]);

  if (!gameState && screen === 'game') return null;

  // Handle ship scheduling / queuing
  const handleQueueShip = async (shipType: string) => {
    if (!gameState || !activePlayer || selectedSystemId === null) return;
    const res = await performGameAction(activeGameId!, 'queue_production', activePlayer.id, {
      systemId: selectedSystemId,
      shipType
    });
    if (res.success && res.gameState) {
      setGameState(res.gameState);
    } else {
      showError(res.error || 'Failed to queue ship production.');
    }
  };

  // Handle upgrade trigger
  const handleUpgradeSystem = async (upgradeType: string, systemId?: number) => {
    if (!gameState || !activePlayer) return;
    const res = await performGameAction(activeGameId!, 'upgrade_system', activePlayer.id, {
      systemId: systemId || 0,
      upgradeType
    });
    if (res.success && res.gameState) {
      setGameState(res.gameState);
    } else {
      showError(res.error || 'Failed to apply upgrade.');
    }
  };

  // Handle fleet dispatch
  const handleDispatchFleet = async (destSysId: number, ships: Record<string, number>) => {
    if (!gameState || !activePlayer || selectedSystemId === null) return;
    const res = await performGameAction(activeGameId!, 'dispatch_fleet', activePlayer.id, {
      sourceSysId: selectedSystemId,
      destSysId,
      shipQuantities: ships
    });
    if (res.success && res.gameState) {
      setGameState(res.gameState);
      setSelectedSystemId(null);
    } else {
      showError(res.error || 'Failed to dispatch fleet.');
    }
  };

  // Handle fleet recall
  const handleRecallFleet = async (fleetId: string) => {
    if (!gameState || !activePlayer) return;
    const res = await performGameAction(activeGameId!, 'recall_fleet', activePlayer.id, { fleetId });
    if (res.success && res.gameState) {
      setGameState(res.gameState);
      setSelectedFleetId(null);
    } else {
      showError(res.error || 'Failed to cancel fleet travel.');
    }
  };

  // Handle cancel dispatch
  const handleCancelDispatch = async (fleetId: string) => {
    if (!gameState || !activePlayer) return;
    const res = await performGameAction(activeGameId!, 'cancel_dispatch', activePlayer.id, { fleetId });
    if (res.success && res.gameState) {
      setGameState(res.gameState);
      if (selectedFleetId === fleetId) {
        setSelectedFleetId(null);
      }
    } else {
      showError(res.error || 'Failed to cancel dispatch.');
    }
  };

  // Handle cancel production
  const handleCancelProduction = async (systemId: number, jobIndex: number) => {
    if (!gameState || !activePlayer) return;
    const res = await performGameAction(activeGameId!, 'cancel_production', activePlayer.id, { systemId, jobIndex });
    if (res.success && res.gameState) {
      setGameState(res.gameState);
    } else {
      showError(res.error || 'Failed to cancel production.');
    }
  };

  // Select target system for dispatch vectoring
  const handleSelectTargetSystem = (sys: StarSystem) => {
    if (!gameState || !activePlayer || selectedSystemId === null) return;
    const source = gameState.systems.find(s => s.id === selectedSystemId);
    if (source && source.owner === activePlayer.id) {
      setTargetSystem(sys);
    }
  };

  // Helper for displaying temporary HUD warnings
  const showError = (msg: string) => {
    setAlertMsg(msg);
    setTimeout(() => {
      setAlertMsg(null);
    }, 4000);
  };

  // Check Game Over Conditions
  const checkGameOver = (state: GameState): boolean => {
    // Find all active teams that still own a system or have a fleet
    const activeTeams = new Set<number>();

    state.players.forEach(p => {
      const pState = state.playerState[p.id];
      if (!pState.lost) {
        activeTeams.add(p.team);
      }
    });

    // If only 1 team (or 0) remains, game is over!
    if (activeTeams.size <= 1) {
      return true;
    }
    return false;
  };



  // Cycle Turn to next Player
  const handleEndTurn = async () => {
    if (!gameState || !activePlayer || !activeGameId) return;
    
    // Clear selection UI (only in hotseat mode with multiple local human players to prevent screen-peeping)
    const localHumansCount = gameState.players.filter(
      p => p.type === 'human' && !gameState.playerState[p.id]?.lost && isPlayerLocalToClient(p)
    ).length;
    if (localHumansCount > 1) {
      setSelectedSystemId(null);
      setSelectedFleetId(null);
      setTargetSystem(null);
    }

    // Play end-turn sound effect if not muted
    if (!soundMutedRef.current) {
      try {
        const audio = new Audio('/end-turn.mp3');
        audio.volume = 0.45;
        audio.play().catch(err => {
          console.warn('Audio playback failed:', err);
        });
      } catch (err) {
        console.warn('Audio context initialization failed:', err);
      }
    }

    const res = await performGameAction(activeGameId, 'end_turn', activePlayer.id);
    if (res.success && res.gameState) {
      const stateCopy = res.gameState;
      if (checkGameOver(stateCopy)) {
        setGameState(stateCopy);
        setScreen('game-over');
        recordStats(stateCopy);
        return;
      }

      // Check if we should display the pass-turn secrecy overlay
      const nextPlayer = stateCopy.players[stateCopy.activePlayerIdx];
      const isNextLocal = isPlayerLocalToClient(nextPlayer);
      const localHumansCount = stateCopy.players.filter(
        p => p.type === 'human' && !stateCopy.playerState[p.id].lost && isPlayerLocalToClient(p)
      ).length;

      if (isNextLocal && localHumansCount > 1) {
        setGameState(stateCopy);
        setNextHumanPlayer(nextPlayer);
        setScreen('pass-turn');
        return;
      }

      setGameState(stateCopy);
    } else {
      showError(res.error || 'Failed to end turn.');
    }
  };

  // Faction control operations
  const handleClaimFaction = async (playerId: number) => {
    if (!gameState || !activeGameId) return;
    const res = await performGameAction(activeGameId, 'claim_faction', playerId);
    if (res.success && res.gameState) {
      setGameState(res.gameState);
    } else {
      showError(res.error || 'Failed to claim faction.');
    }
  };

  const handleTogglePlayerLocal = async (playerId: number) => {
    if (!gameState || !activeGameId) return;
    const res = await performGameAction(activeGameId, 'toggle_player_local', playerId);
    if (res.success && res.gameState) {
      setGameState(res.gameState);
    } else {
      showError(res.error || 'Failed to toggle local status.');
    }
  };

  const handleAssignPlayerEmail = async (playerId: number, email: string) => {
    if (!gameState || !activeGameId) return;
    const res = await performGameAction(activeGameId, 'assign_player_email', playerId, { email });
    if (res.success && res.gameState) {
      setGameState(res.gameState);
    } else {
      showError(res.error || 'Failed to assign player email.');
    }
  };

  // Get winning team details
  const getWinnerInfo = () => {
    if (!gameState) return '';
    const activeFactions = gameState.players.filter(p => !gameState.playerState[p.id].lost);
    if (activeFactions.length === 0) return 'No factions survived. Total Annihilation.';
    const winningTeam = activeFactions[0].team;
    const winners = gameState.players.filter(p => p.team === winningTeam).map(p => p.name).join(' & ');
    return `Team ${winningTeam} Victory! [Conquerors: ${winners}]`;
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div className="space-bg" />

      {/* ERROR HUD ALERTS */}
      {alertMsg && (
        <div style={{
          position: 'absolute',
          top: '90px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255, 0, 127, 0.95)',
          border: '2px solid var(--accent-magenta)',
          boxShadow: '0 0 20px rgba(255,0,127,0.5)',
          color: 'white',
          padding: '10px 24px',
          borderRadius: '6px',
          zIndex: 100,
          fontWeight: 'bold',
          fontFamily: 'Share Tech Mono',
          letterSpacing: '1px',
          pointerEvents: 'none'
        }} className="pulse-light">
          {alertMsg}
        </div>
      )}

      {/* IN-GAME NOTIFICATIONS STACK */}
      {screen === 'game' && notifications.length > 0 && (
        <div style={{
          position: 'fixed',
          top: '95px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10002,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          width: '380px',
          maxWidth: '90vw',
          pointerEvents: 'none'
        }}>
          {notifications.map(notif => {
            const isProd = notif.type === 'production';
            const borderColors = {
              turn_start: 'rgba(0, 240, 255, 0.4)',
              production: 'rgba(57, 255, 20, 0.4)',
              info: 'rgba(0, 240, 255, 0.3)',
              success: 'rgba(57, 255, 20, 0.3)',
              warning: 'rgba(255, 170, 0, 0.3)'
            };
            const glowColors = {
              turn_start: 'rgba(0, 240, 255, 0.15)',
              production: 'rgba(57, 255, 20, 0.15)',
              info: 'rgba(0, 240, 255, 0.1)',
              success: 'rgba(57, 255, 20, 0.1)',
              warning: 'rgba(255, 170, 0, 0.1)'
            };
            const bgGradient = isProd
              ? 'linear-gradient(135deg, rgba(13, 29, 15, 0.9) 0%, rgba(5, 13, 6, 0.95) 100%)'
              : 'linear-gradient(135deg, rgba(10, 15, 29, 0.9) 0%, rgba(5, 7, 13, 0.95) 100%)';
            const borderColor = borderColors[notif.type] || borderColors.info;
            const glowColor = glowColors[notif.type] || glowColors.info;

            return (
              <div
                key={notif.id}
                onClick={() => dismissNotification(notif.id, notif.systemId)}
                style={{
                  background: bgGradient,
                  backdropFilter: 'blur(12px)',
                  border: `1px solid ${borderColor}`,
                  boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.6), inset 0 0 15px ${glowColor}`,
                  borderRadius: '8px',
                  padding: '12px 16px',
                  color: 'white',
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  fontFamily: 'Outfit, sans-serif',
                  transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                  userSelect: 'none',
                  animation: 'slideDownFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                }}
                className="notification-card"
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                  e.currentTarget.style.borderColor = isProd ? 'var(--accent-green)' : 'var(--accent-cyan)';
                  e.currentTarget.style.boxShadow = `0 12px 40px 0 rgba(0, 0, 0, 0.7), 0 0 15px ${isProd ? 'rgba(57,255,20,0.3)' : 'rgba(0,240,255,0.3)'}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.borderColor = borderColor;
                  e.currentTarget.style.boxShadow = `0 8px 32px 0 rgba(0, 0, 0, 0.6), inset 0 0 15px ${glowColor}`;
                }}
                title={notif.systemId !== undefined ? "Left-click to center on planet & dismiss" : "Left-click to dismiss"}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '13px', lineHeight: '1.4', flex: 1, minWidth: 0, textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {/* TODO(security): React's native string interpolation automatically escapes notif.message, preventing XSS. */}
                    {notif.message}
                  </span>
                  {notif.systemId !== undefined && (
                    <span 
                      style={{ 
                        fontSize: '11px', 
                        color: 'var(--accent-cyan)', 
                        background: 'rgba(0, 240, 255, 0.1)', 
                        padding: '2px 6px', 
                        borderRadius: '4px',
                        fontFamily: 'Share Tech Mono',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      LOCATE 📍
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissNotification(notif.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '4px 6px',
                    lineHeight: '1',
                    transition: 'color 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                  title="Dismiss only"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* TOAST NOTIFICATIONS (success / info / warning) */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: toastType === 'success'
            ? 'rgba(0, 180, 90, 0.96)'
            : toastType === 'warning'
              ? 'rgba(200, 120, 0, 0.96)'
              : 'rgba(0, 140, 200, 0.96)',
          border: `2px solid ${toastType === 'success' ? '#39ff14' : toastType === 'warning' ? '#ffaa00' : '#00f0ff'}`,
          boxShadow: `0 4px 24px ${toastType === 'success' ? 'rgba(57,255,20,0.35)' : toastType === 'warning' ? 'rgba(255,170,0,0.35)' : 'rgba(0,240,255,0.35)'}`,
          color: 'white',
          padding: '12px 28px',
          borderRadius: '8px',
          zIndex: 10001,
          fontWeight: 'bold',
          fontFamily: 'Share Tech Mono',
          letterSpacing: '0.5px',
          fontSize: '14px',
          pointerEvents: 'none',
          whiteSpace: 'nowrap'
        }} className="pulse-light">
          {toastMsg}
        </div>
      )}

      {/* AUTHENTICATION HUD OVERLAY (Only visible in menus/lobby) */}
      {(screen === 'menu' || screen === 'lobby' || screen === 'game-over' || screen === 'settings') && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 100,
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          background: 'var(--bg-panel)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(0, 240, 255, 0.2)',
          boxShadow: '0 0 15px rgba(0, 240, 255, 0.1)',
          borderRadius: '8px',
          padding: '8px 16px'
        }}>
          {/* MUTE TOGGLE */}
          <button
            className="btn-sci-fi"
            onClick={toggleSoundMuted}
            style={{ 
              padding: '6px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              minWidth: '32px',
              borderRadius: '6px'
            }}
            title={soundMuted ? "Unmute Sound Effects" : "Mute Sound Effects"}
          >
            {soundMuted ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <line x1="23" y1="9" x2="17" y2="15"></line>
                <line x1="17" y1="9" x2="23" y2="15"></line>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            )}
          </button>

          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px' }}>COMMAND CODES ACTIVE</div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
                  {currentUser.displayName || currentUser.email}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }} className="telemetry">
                  RECORD: {currentUser.stats.gamesWon}W - {currentUser.stats.gamesPlayed - currentUser.stats.gamesWon}L
                </div>
              </div>
              <button className="btn-sci-fi" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => setScreen('settings')}>
                SETTINGS
              </button>
              <button className="btn-sci-fi btn-danger" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={handleLogout}>
                LOG OUT
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button className="btn-sci-fi" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => setScreen('settings')}>
                SETTINGS
              </button>
              <button className="btn-sci-fi" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => { clearAuthInputs(); setIsAuthModalOpen(true); }}>
                ESTABLISH COMMAND LINK
              </button>
            </div>
          )}
        </div>
      )}

      {/* JOIN REQUEST WAITING OVERLAY */}
      {pendingJoinGameId && !gameState && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(5, 10, 20, 0.93)',
          backdropFilter: 'blur(14px)',
          zIndex: 9000,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          fontFamily: 'Orbitron'
        }}>
          <div style={{
            width: '480px',
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            textAlign: 'center'
          }} className="glass-panel glass-panel-neon-cyan pulse-light">
            <div style={{ fontSize: '52px' }}>📡</div>
            <h2 style={{ fontSize: '22px', color: 'var(--accent-cyan)', letterSpacing: '2px', margin: 0 }}>
              {myJoinStatus === 'rejected' ? 'REQUEST DECLINED' : 'AWAITING HOST CLEARANCE'}
            </h2>
            {myJoinStatus === 'rejected' ? (
              <div style={{ fontSize: '14px', color: 'var(--accent-magenta)', lineHeight: '1.6' }}>
                The host has declined your join request.
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {myJoinStatus === 'pending'
                  ? 'Your join request has been sent. Waiting for the host to assign you a faction slot…'
                  : 'No free faction slots were available in this simulation. Click below to request a slot from the host.'}
              </div>
            )}

            {!currentUser && myJoinStatus !== 'pending' && myJoinStatus !== 'rejected' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left', width: '100%', marginBottom: '15px' }}>
                <label style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontFamily: 'Orbitron' }}>ENTER DISPLAY NAME TO JOIN:</label>
                <input
                  type="text"
                  placeholder="e.g. Admiral Alice"
                  value={guestName}
                  onChange={(e) => updateGuestName(e.target.value)}
                  className="input-sci-fi"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(0, 240, 255, 0.3)',
                    borderRadius: '4px',
                    padding: '8px 12px',
                    color: 'white',
                    fontSize: '13px',
                    fontFamily: 'Share Tech Mono',
                    outline: 'none'
                  }}
                />
              </div>
            )}

            {myJoinStatus !== 'pending' && myJoinStatus !== 'rejected' && (
              <button
                className="btn-sci-fi pulse-light"
                style={{ justifyContent: 'center', fontSize: '13px' }}
                onClick={async () => {
                  if (!pendingJoinGameId) return;
                  if (!currentUser && (!guestName || guestName.trim().length === 0)) {
                    showError('Please enter a display name.');
                    return;
                  }
                  const emailParam = currentUser ? undefined : guestName;
                  const res = await requestToJoin(pendingJoinGameId, emailParam);
                  if (res.success) {
                    setMyJoinStatus('pending');
                    showToast('📡 Join request sent! Waiting for host approval…', 'info');
                  } else {
                    showError(res.error || 'Failed to send join request.');
                  }
                }}
              >
                REQUEST TO JOIN SIMULATION
              </button>
            )}

            {myJoinStatus === 'pending' && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }} className="animate-pulse">
                [POLLING HOST RESPONSE…]
              </div>
            )}

            <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.08)' }} />

            <button
              className="btn-sci-fi btn-danger"
              style={{ justifyContent: 'center', fontSize: '12px' }}
              onClick={() => {
                setPendingJoinGameId(null);
                setMyJoinStatus(null);
                setActiveGameId(null);
                clearUrlQuery();
              }}
            >
              CANCEL & RETURN TO MENU
            </button>
          </div>
        </div>
      )}

      {/* MENU SCREEN */}
      {screen === 'menu' && (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '24px',
          zIndex: 1,
          position: 'relative',
          padding: '20px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{
              fontFamily: 'Orbitron',
              fontSize: '72px',
              fontWeight: 800,
              letterSpacing: '6px',
              background: 'linear-gradient(135deg, #00f0ff, #ff007f)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 30px rgba(0, 240, 255, 0.2)',
              margin: '10px 0'
            }}>STAR-SWARM</h1>
            <p style={{
              fontSize: '18px',
              color: 'var(--text-secondary)',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              fontFamily: 'Share Tech Mono'
            }}>Tactical Grid Space Conquest</p>
          </div>

          <div style={{
            display: 'flex',
            gap: '24px',
            alignItems: (currentUser || savedGames.length > 0) ? 'stretch' : 'center',
            flexDirection: (currentUser || savedGames.length > 0) ? 'row' : 'column',
            justifyContent: 'center',
            maxWidth: '1100px',
            width: '100%'
          }}>
            {/* Initialize boot panel */}
            <div style={{
              width: '450px',
              padding: '30px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }} className="glass-panel glass-panel-neon-cyan">
              <h2 style={{ fontSize: '18px', textAlign: 'center', color: 'var(--accent-cyan)' }}>INITIALIZE SYSTEM BOOT</h2>
              
              <button className="btn-sci-fi" style={{ justifyContent: 'center' }} onClick={handleStartSkirmishLobby}>
                SKIRMISH MATCH
              </button>
              
              <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                <strong>RULES OF ENGAGEMENT:</strong>
                <ul style={{ paddingLeft: '20px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li>Fog of war covers grid sectors outside sensor range.</li>
                  <li>Sensor vision is shared across teams.</li>
                  <li>Enemy ship inventories are concealed behind deflector shields.</li>
                  <li>Recall dispatched fleets mid-flight. They take the same duration to return.</li>
                </ul>
              </div>
            </div>

            {/* Saved games panel */}
            {(currentUser || savedGames.length > 0) && (
              <div style={{
                flex: '1 1 500px',
                maxWidth: '600px',
                padding: '30px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }} className="glass-panel glass-panel-neon-magenta">
                <h2 style={{ fontSize: '18px', textAlign: 'center', color: 'var(--accent-magenta)', fontFamily: 'Orbitron' }}>
                  ACTIVE SAVED SIMULATIONS
                </h2>

                {/* Search & Filters */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="SEARCH BY GAME, PLAYER OR EMAIL..."
                      value={gameSearchQuery}
                      onChange={(e) => setGameSearchQuery(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 0, 127, 0.3)',
                        borderRadius: '4px',
                        padding: '8px 12px',
                        color: 'white',
                        fontSize: '11px',
                        fontFamily: 'Share Tech Mono',
                        outline: 'none'
                      }}
                    />
                    <button
                      className="btn-sci-fi"
                      style={{ padding: '8px 12px', fontSize: '11px' }}
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    >
                      {showAdvancedFilters ? '⚙️ HIDE FILTERS' : '⚙️ FILTERS'}
                    </button>
                  </div>

                  {showAdvancedFilters && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '10px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      padding: '12px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 0, 127, 0.15)'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>TURN STATUS</label>
                        <select
                          value={gameSearchStatus}
                          onChange={(e) => setGameSearchStatus(e.target.value)}
                          style={{
                            background: '#090514',
                            border: '1px solid rgba(255, 0, 127, 0.25)',
                            borderRadius: '4px',
                            padding: '6px',
                            color: 'white',
                            fontSize: '11px',
                            fontFamily: 'Share Tech Mono',
                            outline: 'none'
                          }}
                        >
                          <option value="all">ALL SIMULATIONS</option>
                          <option value="your_turn">YOUR TURN</option>
                          <option value="waiting">WAITING ON OTHERS</option>
                          <option value="game_over">GAME OVER</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>TURN NUMBER</label>
                        <input
                          type="number"
                          placeholder="EXACT TURN..."
                          value={gameTurnsFilter}
                          onChange={(e) => setGameTurnsFilter(e.target.value)}
                          style={{
                            background: '#090514',
                            border: '1px solid rgba(255, 0, 127, 0.25)',
                            borderRadius: '4px',
                            padding: '6px',
                            color: 'white',
                            fontSize: '11px',
                            fontFamily: 'Share Tech Mono',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>START DATE</label>
                        <input
                          type="date"
                          value={gameStartDate}
                          onChange={(e) => setGameStartDate(e.target.value)}
                          style={{
                            background: '#090514',
                            border: '1px solid rgba(255, 0, 127, 0.25)',
                            borderRadius: '4px',
                            padding: '6px',
                            color: 'white',
                            fontSize: '11px',
                            fontFamily: 'Share Tech Mono',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>END DATE</label>
                        <input
                          type="date"
                          value={gameEndDate}
                          onChange={(e) => setGameEndDate(e.target.value)}
                          style={{
                            background: '#090514',
                            border: '1px solid rgba(255, 0, 127, 0.25)',
                            borderRadius: '4px',
                            padding: '6px',
                            color: 'white',
                            fontSize: '11px',
                            fontFamily: 'Share Tech Mono',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                        <button
                          className="btn-sci-fi btn-danger"
                          style={{ padding: '4px 8px', fontSize: '9px' }}
                          onClick={() => {
                            setGameSearchQuery('');
                            setGameSearchStatus('all');
                            setGameStartDate('');
                            setGameEndDate('');
                            setGameTurnsFilter('');
                          }}
                        >
                          RESET FILTERS
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div 
                  onScroll={(e) => {
                    const target = e.currentTarget;
                    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 25;
                    if (isNearBottom && !isInfiniteLoading && savedGames.length < totalGamesCount) {
                      loadGamesList(false);
                    }
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    paddingRight: '6px'
                  }}
                >
                  {savedGames.map((game) => {
                    const pendingReqs = homePendingRequests[game.id] || [];
                    const isPanelOpen = joinPanelGameId === game.id;
                    
                    let gameStateObj: GameState | null = null;
                    try {
                      gameStateObj = typeof game.game_state === 'string' ? JSON.parse(game.game_state) : game.game_state;
                    } catch (e) {
                      // ignore
                    }

                    const guestNameVal = localStorage.getItem('starswarm_guest_name') || '';
                    const userEmail = currentUser?.email || guestNameVal;
                    const ownedGames = JSON.parse(localStorage.getItem('starswarm_owned_games') || '[]');
                    const isLocalOwner = ownedGames.includes(game.id);
                    const isOwner = game.owner_email 
                      ? (userEmail && game.owner_email.trim().toLowerCase() === userEmail.trim().toLowerCase())
                      : (isLocalOwner || !userEmail);

                    // Get free human slots for this game
                    const freeSlots: { id: number; name: string }[] = (() => {
                      if (!gameStateObj) return [];
                      return (gameStateObj.players || []).filter((p: any) => p.type === 'human' && !p.assignedEmail).map((p: any) => ({ id: p.id, name: p.name }));
                    })();

                    const turnNumber = gameStateObj?.turnNumber || 1;
                    const totalPlayers = gameStateObj?.players?.length || 0;
                    const activePlayersCount = gameStateObj ? gameStateObj.players.filter(p => !gameStateObj.playerState[p.id]?.lost).length : 0;

                    return (
                      <div key={game.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: 'rgba(255, 255, 255, 0.02)',
                          padding: '12px 14px',
                          borderRadius: '6px',
                          border: isPanelOpen ? '1px solid rgba(0,240,255,0.35)' : '1px solid rgba(255, 0, 127, 0.15)',
                          transition: 'border-color 0.2s',
                        }} className="saved-game-row">
                          <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <div style={{
                                fontSize: '13px',
                                fontWeight: 'bold',
                                color: 'white',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {game.name}
                              </div>
                              {/* Pending join requests badge */}
                              {pendingReqs.length > 0 && (
                                <span
                                  style={{
                                    background: 'var(--accent-cyan)',
                                    color: '#000',
                                    borderRadius: '10px',
                                    padding: '1px 7px',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    fontFamily: 'Share Tech Mono',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0
                                  }}
                                  onClick={(e) => { e.stopPropagation(); setJoinPanelGameId(isPanelOpen ? null : game.id); }}
                                  title="Click to manage join requests"
                                >
                                  📡 {pendingReqs.length} JOIN{pendingReqs.length > 1 ? 'S' : ''}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }} className="telemetry">
                              UPDATED: {new Date(game.updated_at).toLocaleString()}
                            </div>

                            {/* Host and Game details info */}
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', fontFamily: 'Share Tech Mono' }}>
                              HOST: <span style={{ color: 'white' }}>{isOwner ? 'You' : (game.owner_email || 'Unknown')}</span>
                            </div>

                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'Share Tech Mono' }}>
                              TURN: <span style={{ color: 'white' }}>{turnNumber}</span> · FACTIONS: <span style={{ color: 'white' }}>{activePlayersCount}/{totalPlayers} Active</span>
                            </div>

                            {/* Factions Inline list */}
                            {gameStateObj && gameStateObj.players && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                                {gameStateObj.players.map(p => {
                                  const isPlayerLost = gameStateObj?.playerState[p.id]?.lost;
                                  const isPlayerMe = userEmail && p.assignedEmail?.trim().toLowerCase() === userEmail.trim().toLowerCase();
                                  return (
                                    <div
                                      key={p.id}
                                      style={{
                                        fontSize: '9px',
                                        padding: '1px 5px',
                                        borderRadius: '3px',
                                        background: isPlayerLost ? 'rgba(255,255,255,0.02)' : `${p.color}10`,
                                        border: `1px solid ${isPlayerLost ? 'rgba(255,255,255,0.08)' : p.color}25`,
                                        color: isPlayerLost ? 'var(--text-muted)' : (isPlayerMe ? 'white' : 'var(--text-secondary)'),
                                        textDecoration: isPlayerLost ? 'line-through' : 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }}
                                      title={`${p.name} ${p.assignedEmail ? `(${p.assignedEmail})` : '(Local)'}${isPlayerLost ? ' - DEFEATED' : ''}`}
                                    >
                                      <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: isPlayerLost ? '#555' : p.color }} />
                                      {p.name.split(' ')[0]} {isPlayerMe && '(You)'}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div style={{
                              fontSize: '11px',
                              color: 'var(--text-secondary)',
                              marginTop: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>STATUS:</span>
                              <span style={{
                                color: getGameTurnStatus(game, userEmail || null) === 'YOUR TURN' ? 'var(--accent-green)' : 'var(--accent-yellow)',
                                fontWeight: 'bold',
                                fontFamily: 'Share Tech Mono'
                              }}>
                                {getGameTurnStatus(game, userEmail || null)}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', minWidth: '90px' }}>
                            {/* Invite link copy button */}
                            <button
                              className="btn-sci-fi"
                              style={{ padding: '4px 8px', fontSize: '9px' }}
                              title="Copy invite link"
                              onClick={(e) => {
                                e.stopPropagation();
                                const inviteUrl = `${window.location.origin}${window.location.pathname}?gameId=${game.invite_code || game.id}`;
                                copyToClipboard(inviteUrl).then((success) => {
                                  if (success) {
                                    showToast('🔗 Invite link copied to clipboard!', 'success', 3000);
                                  } else {
                                    window.prompt('Copy invite link manually:', inviteUrl);
                                  }
                                }).catch(() => {
                                  window.prompt('Copy invite link manually:', inviteUrl);
                                });
                              }}
                            >
                              🔗 INVITE
                            </button>
                            {canCancelEndTurnInGame(game) && (
                              <button
                                className="btn-sci-fi btn-danger animate-pulse"
                                style={{ padding: '6px 10px', fontSize: '10px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  let stateObj: GameState;
                                  try {
                                    stateObj = typeof game.game_state === 'string' ? JSON.parse(game.game_state) : game.game_state;
                                    const userPlayer = stateObj.players.find(p => (userEmail && p.assignedEmail?.trim().toLowerCase() === userEmail.trim().toLowerCase()) || (p.id === 1 && p.isLocal));
                                    if (userPlayer) {
                                      handleCancelEndTurnForGame(game.id, userPlayer.id);
                                    }
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }}
                              >
                                UNDO END
                              </button>
                            )}
                            <button
                              className="btn-sci-fi"
                              style={{ padding: '6px 10px', fontSize: '10px' }}
                              onClick={() => {
                                loadGameFromId(game.id);
                                window.history.pushState(null, '', `?gameId=${game.id}`);
                              }}
                            >
                              RESUME
                            </button>
                            {isOwner && (
                              <button
                                className="btn-sci-fi btn-danger"
                                style={{ padding: '6px 8px', fontSize: '10px', justifyContent: 'center' }}
                                onClick={() => setGameToDelete(game)}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        {/* JOIN REQUESTS EXPAND PANEL */}
                        {isPanelOpen && pendingReqs.length > 0 && (
                          <div style={{
                            background: 'rgba(0,240,255,0.04)',
                            border: '1px solid rgba(0,240,255,0.2)',
                            borderRadius: '6px',
                            padding: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontFamily: 'Orbitron', letterSpacing: '1px', marginBottom: '2px' }}>
                              📡 INCOMING JOIN REQUESTS
                            </div>
                            {pendingReqs.map(req => (
                              <div key={req.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '4px',
                                padding: '8px 10px',
                                flexWrap: 'wrap'
                              }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '11px', color: 'white', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {req.email}
                                  </div>
                                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>
                                    Req #{req.id} · {new Date(req.created_at).toLocaleTimeString()}
                                  </div>
                                </div>
                                {freeSlots.length > 0 ? (
                                  <>
                                    <select
                                      value={joinAssignSlot[req.id] || freeSlots[0].id}
                                      onChange={e => setJoinAssignSlot(prev => ({ ...prev, [req.id]: parseInt(e.target.value) }))}
                                      style={{
                                        background: 'rgba(0,0,0,0.7)',
                                        border: '1px solid rgba(0,240,255,0.3)',
                                        color: 'white',
                                        borderRadius: '4px',
                                        padding: '3px 6px',
                                        fontSize: '10px',
                                        fontFamily: 'Share Tech Mono',
                                        maxWidth: '120px'
                                      }}
                                    >
                                      {freeSlots.map(slot => (
                                        <option key={slot.id} value={slot.id}>Slot {slot.id}: {slot.name}</option>
                                      ))}
                                    </select>
                                    <button
                                      className="btn-sci-fi"
                                      style={{ padding: '3px 8px', fontSize: '9px' }}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const slotId = joinAssignSlot[req.id] || freeSlots[0].id;
                                        const res = await acceptJoinRequest(game.id, req.id, slotId, req.email);
                                        if (res.success) {
                                          showToast(`✅ ${req.email} assigned to slot ${slotId}!`, 'success');
                                          setHomePendingRequests(h => ({
                                            ...h,
                                            [game.id]: (h[game.id] || []).filter(r => r.id !== req.id)
                                          }));
                                          if ((homePendingRequests[game.id] || []).length <= 1) {
                                            setJoinPanelGameId(null);
                                          }
                                        } else {
                                          showError(res.error || 'Failed to assign slot.');
                                        }
                                      }}
                                    >
                                      ACCEPT
                                    </button>
                                  </>
                                ) : (
                                  <span style={{ fontSize: '9px', color: 'var(--accent-yellow)', fontFamily: 'Share Tech Mono' }}>No free slots</span>
                                )}
                                <button
                                  className="btn-sci-fi btn-danger"
                                  style={{ padding: '3px 8px', fontSize: '9px' }}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const res = await rejectJoinRequest(game.id, req.id);
                                    if (res.success) {
                                      showToast(`❌ Rejected join request from ${req.email}.`, 'warning', 3000);
                                      setHomePendingRequests(h => ({
                                        ...h,
                                        [game.id]: (h[game.id] || []).filter(r => r.id !== req.id)
                                      }));
                                      if ((homePendingRequests[game.id] || []).length <= 1) {
                                        setJoinPanelGameId(null);
                                      }
                                    } else {
                                      showError(res.error || 'Failed to reject request.');
                                    }
                                  }}
                                >
                                  REJECT
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {isInfiniteLoading && (
                    <div style={{ textAlign: 'center', color: 'var(--accent-cyan)', fontFamily: 'Share Tech Mono', fontSize: '11px', padding: '10px' }} className="animate-pulse">
                      📡 DOWNLOADING SIMULATION TELEMETRY...
                    </div>
                  )}

                  {savedGames.length === 0 && !isInfiniteLoading && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', fontSize: '13px', padding: '30px 10px' }}>
                      NO MATCHING COMMAND SIMULATIONS FOUND
                    </div>
                  )}

                  {savedGames.length < totalGamesCount && !isInfiniteLoading && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', fontSize: '11px', padding: '8px' }}>
                      SCROLL TO LOAD MORE SIMULATIONS ({savedGames.length} OF {totalGamesCount})
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LOBBY SETUP SCREEN */}
      {screen === 'lobby' && (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1,
          position: 'relative',
          padding: '20px'
        }}>
          <div style={{
            width: '650px',
            padding: '30px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }} className="glass-panel glass-panel-neon-cyan">
            <h2 style={{ fontSize: '24px', color: 'var(--accent-cyan)', textAlign: 'center', fontFamily: 'Orbitron' }}>
              TACTICAL SETUP LOBBY
            </h2>

            {/* MAP CONFIG */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>GALAXY MAP SIZE (LIGHTYEARS)</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px' }}>
                  <input
                    type="range"
                    min="35"
                    max="90"
                    value={gridSize}
                    onChange={(e) => setGridSize(parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
                  />
                  <span className="telemetry" style={{ width: '60px', textAlign: 'right' }}>{gridSize}x{gridSize}</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>STAR CLUSTERS</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px' }}>
                  <input
                    type="range"
                    min={playersSetup.length}
                    max="40"
                    value={systemCount}
                    onChange={(e) => setSystemCount(parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
                  />
                  <span className="telemetry" style={{ width: '60px', textAlign: 'right' }}>{systemCount} bases</span>
                </div>
              </div>
            </div>

            {/* SEED & VISION CONFIG */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>GALAXY GENERATION SEED</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                  <input
                    type="text"
                    value={gameSeed}
                    onChange={(e) => setGameSeed(e.target.value)}
                    placeholder="Enter custom seed"
                    style={{
                      flex: 1,
                      background: 'rgba(0,0,0,0.5)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: 'white',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      fontSize: '13px',
                      fontFamily: 'Share Tech Mono'
                    }}
                  />
                  <button
                    className="btn-sci-fi"
                    onClick={() => setGameSeed(String(Math.floor(Math.random() * 900000) + 100000))}
                    style={{ padding: '6px 12px', fontSize: '11px' }}
                  >
                    RANDOM
                  </button>
                </div>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={overrideSightRange}
                    onChange={(e) => setOverrideSightRange(e.target.checked)}
                    style={{ accentColor: 'var(--accent-cyan)' }}
                  />
                  <span>OVERRIDE STAR SIGHT RANGE</span>
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px' }}>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    disabled={!overrideSightRange}
                    value={customSightRange}
                    onChange={(e) => setCustomSightRange(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent-cyan)', opacity: overrideSightRange ? 1 : 0.4 }}
                  />
                  <span className="telemetry" style={{ width: '60px', textAlign: 'right', opacity: overrideSightRange ? 1 : 0.4 }}>
                    {customSightRange} LY
                  </span>
                </div>
              </div>
            </div>

            {/* GAME RULES CONFIG */}
            <div style={{ background: 'rgba(255,255,255,0.01)', padding: '15px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
                Galaxy Ruleset / Game Mode
              </label>
              
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select
                  value={selectedModeId}
                  onChange={(e) => setSelectedModeId(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.8)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontFamily: 'Orbitron'
                  }}
                >
                  {gameModes.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.isDefault ? '[DEFAULT]' : '[CUSTOM]'}
                    </option>
                  ))}
                </select>

                <button
                  className="btn-sci-fi"
                  onClick={() => {
                    const currentMode = gameModes.find(m => m.id === selectedModeId);
                    if (currentMode) {
                      setEditingRules(JSON.parse(JSON.stringify(currentMode)));
                      setIsRulesEditorOpen(true);
                    }
                  }}
                  style={{ padding: '8px 10px', fontSize: '11px' }}
                >
                  {gameModes.find(m => m.id === selectedModeId)?.isDefault ? 'VIEW' : 'EDIT'}
                </button>

                <button
                  className="btn-sci-fi"
                  onClick={() => {
                    const currentMode = gameModes.find(m => m.id === selectedModeId);
                    if (currentMode) {
                      const copiedRules: GameRules = JSON.parse(JSON.stringify(currentMode));
                      copiedRules.id = 'custom_' + Date.now();
                      copiedRules.name = 'Copy of ' + copiedRules.name;
                      copiedRules.isDefault = false;
                      
                      const customs = gameModes.filter(m => !m.isDefault);
                      const newCustoms = [...customs, copiedRules];
                      saveCustomModes(newCustoms);
                      setSelectedModeId(copiedRules.id);
                    }
                  }}
                  style={{ padding: '8px 10px', fontSize: '11px' }}
                >
                  COPY
                </button>

                <button
                  className="btn-sci-fi"
                  onClick={handleExportRules}
                  style={{ padding: '8px 10px', fontSize: '11px' }}
                >
                  EXPORT
                </button>

                <button
                  className="btn-sci-fi"
                  onClick={() => {
                    setImportString('');
                    setImportError(null);
                    setIsImportModalOpen(true);
                  }}
                  style={{ padding: '8px 10px', fontSize: '11px' }}
                >
                  IMPORT
                </button>

                {!gameModes.find(m => m.id === selectedModeId)?.isDefault && (
                  <button
                    className="btn-sci-fi btn-danger"
                    onClick={() => {
                      if (confirm('Decommission this custom ruleset?')) {
                        const customs = gameModes.filter(m => !m.isDefault && m.id !== selectedModeId);
                        saveCustomModes(customs);
                        setSelectedModeId('normal');
                      }
                    }}
                    style={{ padding: '8px 10px', fontSize: '11px' }}
                  >
                    DELETE
                  </button>
                )}
              </div>

              {/* Mode overview metrics */}
              {(() => {
                const currentMode = gameModes.find(m => m.id === selectedModeId);
                if (!currentMode) return null;
                return (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div style={{ fontStyle: 'italic', marginBottom: '6px' }}>{currentMode.description}</div>
                    <div style={{ display: 'flex', gap: '15px', fontFamily: 'Share Tech Mono', color: 'var(--accent-cyan)' }}>
                      <span>💳 CREDITS: {currentMode.enableCredits ? 'ENABLED' : 'DISABLED'}</span>
                      <span>🔧 UPGRADES: {currentMode.enableUpgrades ? 'ENABLED' : 'DISABLED'}</span>
                      <span>🛰️ AUTO-PROD: {currentMode.nodeProduction.enabled ? `YES (+${currentMode.nodeProduction.shipsPerTurn} ${currentMode.nodeProduction.shipType}/turn)` : 'NO'}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* TURN RESOLUTION STYLE CONFIG */}
            <div style={{ background: 'rgba(255,255,255,0.01)', padding: '15px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>TURN RESOLUTION STYLE</label>
              <select
                id="turn-style-select"
                value={turnStyle}
                onChange={(e) => setTurnStyle(e.target.value as 'simultaneous' | 'sequential')}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'white',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontFamily: 'Orbitron',
                  marginTop: '6px'
                }}
              >
                <option value="simultaneous">SIMULTANEOUS — All human players play concurrently; AIs play and rounds resolve at turn end.</option>
                <option value="sequential">SEQUENTIAL — Factions take turns in order. AIs take their turns instantly in their galactic sequence.</option>
              </select>
            </div>

            {/* RECOMMENDED NOTICE */}
            {recNotice && (
              <div style={{
                color: 'var(--accent-green)',
                fontSize: '11px',
                textAlign: 'center',
                fontFamily: 'Share Tech Mono',
                marginTop: '-10px'
              }} className="pulse-light">
                [RECOMMENDATION ARRAY] {recNotice}
              </div>
            )}

            <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.08)' }} />

            {/* PLAYERS LIST CONFIG */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '14px', color: 'var(--text-primary)' }}>FACTIONS & TEAM MAPPING</h3>
                <span className="telemetry" style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>
                  FACTIONS IN SYSTEM: {playersSetup.length} / 8
                </span>
              </div>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                {playersSetup.map((player, idx) => {
                  const factionColor = player.color || FACTION_INFO[player.id]?.color || '#ffffff';
                  return (
                    <div key={player.id} style={{
                      display: 'grid',
                      gridTemplateColumns: '24px 1.5fr 1fr 1fr 90px 2fr 32px',
                      gap: '8px',
                      alignItems: 'center',
                      background: 'rgba(255,255,255,0.02)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      {/* Color indicator */}
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: factionColor,
                        boxShadow: `0 0 8px ${factionColor}`,
                        justifySelf: 'center'
                      }} />
                      
                      {/* Name input */}
                      <input
                        type="text"
                        value={player.name}
                        onChange={(e) => updatePlayerSetup(idx, 'name', e.target.value)}
                        style={{
                          background: 'rgba(0,0,0,0.5)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'white',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          fontSize: '13px'
                        }}
                      />
                      
                      {/* Controller selector */}
                      <select
                        value={player.type}
                        onChange={(e) => {
                          const val = e.target.value as 'human' | 'ai';
                          setPlayersSetup(prev => {
                            const copy = [...prev];
                            copy[idx] = {
                              ...copy[idx],
                              type: val,
                              isLocal: val === 'human',
                              assignedEmail: val === 'human' ? '' : null
                            };
                            return copy;
                          });
                        }}
                        style={{
                          background: 'rgba(0,0,0,0.8)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'white',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          fontSize: '13px'
                        }}
                        disabled={idx === 0}
                      >
                        <option value="human">🌐 HUMAN</option>
                        <option value="ai">🤖 AI</option>
                      </select>
 
                      {/* Team Selector */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select
                          value={player.team}
                          onChange={(e) => updatePlayerSetup(idx, 'team', parseInt(e.target.value))}
                          style={{
                            background: 'rgba(0,0,0,0.8)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'white',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            width: '100%'
                          }}
                        >
                          <option value={1}>Team 1</option>
                          <option value={2}>Team 2</option>
                          <option value={3}>Team 3</option>
                          <option value={4}>Team 4</option>
                        </select>
                      </div>

                      {/* Local Playable Checkbox */}
                      {player.type === 'human' ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <input
                            type="checkbox"
                            checked={!!player.isLocal}
                            disabled={idx === 0}
                            onChange={(e) => updatePlayerSetup(idx, 'isLocal', e.target.checked)}
                            style={{ accentColor: 'var(--accent-cyan)' }}
                          />
                          <span>LOCAL</span>
                        </label>
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center' }}>-</div>
                      )}

                      {/* Assigned Email */}
                      {player.type === 'human' ? (
                        <input
                          type="text"
                          placeholder={idx === 0 ? (currentUser?.email || 'Owner') : 'Remote commander email'}
                          value={idx === 0 ? (currentUser?.email || '') : (player.assignedEmail || '')}
                          disabled={idx === 0}
                          onChange={(e) => updatePlayerSetup(idx, 'assignedEmail', e.target.value)}
                          style={{
                            background: 'rgba(0,0,0,0.5)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'white',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                        />
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', fontFamily: 'Share Tech Mono' }}>[AI SYSTEM]</div>
                      )}
 
                      {/* Remove Button */}
                      {idx > 0 && playersSetup.length > 2 ? (
                        <button
                          className="btn-sci-fi btn-danger"
                          style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            justifyContent: 'center'
                          }}
                          onClick={() => handleRemovePlayer(player.id)}
                        >
                          ✕
                        </button>
                      ) : (
                        <div />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Faction Button */}
              {playersSetup.length < 8 && (
                <button 
                  className="btn-sci-fi" 
                  style={{ width: '100%', justifyContent: 'center', fontSize: '13px', borderStyle: 'dashed' }}
                  onClick={handleAddPlayer}
                >
                  + RECRUIT NEW GALAXY FACTION
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
              <button className="btn-sci-fi" onClick={handleStartGame} style={{ flex: 1, justifyContent: 'center' }}>
                LAUNCH GALAXY SIMULATION
              </button>
              <button className="btn-sci-fi btn-danger" onClick={handleReturnToMenu}>
                RETURN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAMEPLAY HUD */}
      {screen === 'game' && gameState && (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
          <StarMap
            gameState={gameState}
            activePlayerId={activePlayer?.id || 1}
            selectedSystemId={selectedSystemId}
            setSelectedSystemId={setSelectedSystemId}
            selectedFleetId={selectedFleetId}
            setSelectedFleetId={setSelectedFleetId}
            onSelectTargetSystem={handleSelectTargetSystem}
            centerOnCoords={centerOnCoords}
            targetSystemId={targetSystem?.id || null}
          />
          {!isLoadingGame ? (
            <>
              <Dashboard
                gameState={gameState}
                activePlayerId={activePlayer?.id || 1}
                selectedSystemId={selectedSystemId}
                selectedFleetId={selectedFleetId}
                setSelectedSystemId={setSelectedSystemId}
                setSelectedFleetId={setSelectedFleetId}
                onEndTurn={handleEndTurn}
                onReturnToMenu={handleReturnToMenu}
                onRenamePlayer={handleRenamePlayer}
                onCancelEndTurn={handleCancelEndTurn}
                gameName={activeGameName}
                onRenameGame={handleRenameGame}
                onQueueShip={handleQueueShip}
                onUpgradeSystem={handleUpgradeSystem}
                onDispatchFleet={handleDispatchFleet}
                onRecallFleet={handleRecallFleet}
                onCancelDispatch={handleCancelDispatch}
                onCancelProduction={handleCancelProduction}
                onCenterOnCoords={(x, y) => setCenterOnCoords({ x, y, trigger: Date.now() })}
                targetSystem={targetSystem}
                setTargetSystem={setTargetSystem}
                currentUserEmail={currentUser?.email || localStorage.getItem('starswarm_guest_name') || ""}
                gameOwnerEmail={(() => {
                  const userEmail = currentUser?.email || localStorage.getItem('starswarm_guest_name');
                  const ownedGames = JSON.parse(localStorage.getItem('starswarm_owned_games') || '[]');
                  const isLocalOwner = activeGameId ? ownedGames.includes(activeGameId) : false;
                  if (gameOwnerEmail) return gameOwnerEmail;
                  if (isLocalOwner && userEmail) return userEmail;
                  return "";
                })()}
                connectedPlayers={connectedPlayers}
                isPlayerLocalToClient={isPlayerLocalToClient}
                onClaimFaction={handleClaimFaction}
                onTogglePlayerLocal={handleTogglePlayerLocal}
                onAssignPlayerEmail={handleAssignPlayerEmail}
                soundMuted={soundMuted}
                onToggleSoundMuted={toggleSoundMuted}
              />

              {/* IN-GAME JOIN REQUEST PANEL (host only) */}
              {(() => {
                const userEmail = currentUser?.email || localStorage.getItem('starswarm_guest_name');
                const ownedGames = JSON.parse(localStorage.getItem('starswarm_owned_games') || '[]');
                const isLocalOwner = activeGameId ? ownedGames.includes(activeGameId) : false;
                const isOwner = gameOwnerEmail ? (gameOwnerEmail === userEmail) : (isLocalOwner || !userEmail);
                return isOwner;
              })() && activeGameId && (homePendingRequests[activeGameId] || []).length > 0 && (() => {
                const reqs = homePendingRequests[activeGameId] || [];
                const isPanelOpen = joinPanelGameId === activeGameId;
                const freeSlots = gameState.players.filter(p => p.type === 'human' && !p.assignedEmail).map(p => ({ id: p.id, name: p.name }));
                return (
                  <div style={{
                    position: 'absolute',
                    top: '90px',
                    right: '420px',
                    zIndex: 50,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    pointerEvents: 'auto',
                    maxWidth: '300px'
                  }}>
                    <div
                      style={{
                        background: 'rgba(0, 240, 255, 0.12)',
                        border: '1px solid var(--accent-cyan)',
                        borderRadius: '8px',
                        padding: '8px 14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        boxShadow: '0 0 15px rgba(0,240,255,0.2)'
                      }}
                      onClick={() => setJoinPanelGameId(isPanelOpen ? null : activeGameId)}
                    >
                      <span style={{ fontSize: '16px' }}>📡</span>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--accent-cyan)', fontFamily: 'Orbitron', letterSpacing: '1px' }}>
                        {reqs.length} JOIN REQUEST{reqs.length > 1 ? 'S' : ''}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)', transform: isPanelOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
                    </div>

                    {isPanelOpen && (
                      <div style={{
                        background: 'rgba(5, 15, 30, 0.96)',
                        border: '1px solid rgba(0,240,255,0.25)',
                        borderRadius: '8px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                      }}>
                        {reqs.map(req => (
                          <div key={req.id} style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}>
                            <div style={{ fontSize: '11px', color: 'white', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {req.email}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                              {freeSlots.length > 0 ? (
                                <>
                                  <select
                                    value={joinAssignSlot[req.id] || freeSlots[0].id}
                                    onChange={e => setJoinAssignSlot(prev => ({ ...prev, [req.id]: parseInt(e.target.value) }))}
                                    style={{
                                      flex: 1,
                                      background: 'rgba(0,0,0,0.7)',
                                      border: '1px solid rgba(0,240,255,0.3)',
                                      color: 'white',
                                      borderRadius: '4px',
                                      padding: '3px 6px',
                                      fontSize: '10px',
                                      fontFamily: 'Share Tech Mono'
                                    }}
                                  >
                                    {freeSlots.map(slot => (
                                      <option key={slot.id} value={slot.id}>{slot.name}</option>
                                    ))}
                                  </select>
                                  <button
                                    className="btn-sci-fi"
                                    style={{ padding: '3px 8px', fontSize: '9px' }}
                                    onClick={async () => {
                                      const slotId = joinAssignSlot[req.id] || freeSlots[0].id;
                                      const res = await acceptJoinRequest(activeGameId, req.id, slotId, req.email);
                                      if (res.success) {
                                        showToast(`✅ ${req.email} assigned!`, 'success');
                                        setHomePendingRequests(h => ({ ...h, [activeGameId]: (h[activeGameId] || []).filter(r => r.id !== req.id) }));
                                        // Refresh game state so slot assignment is visible
                                        loadGameFromId(activeGameId);
                                      } else {
                                        showError(res.error || 'Failed to assign slot.');
                                      }
                                    }}
                                  >
                                    ACCEPT
                                  </button>
                                </>
                              ) : (
                                <span style={{ fontSize: '9px', color: 'var(--accent-yellow)', fontFamily: 'Share Tech Mono' }}>No free slots</span>
                              )}
                              <button
                                className="btn-sci-fi btn-danger"
                                style={{ padding: '3px 8px', fontSize: '9px' }}
                                onClick={async () => {
                                  const res = await rejectJoinRequest(activeGameId, req.id);
                                  if (res.success) {
                                    showToast(`❌ Rejected ${req.email}`, 'warning', 3000);
                                    setHomePendingRequests(h => ({ ...h, [activeGameId]: (h[activeGameId] || []).filter(r => r.id !== req.id) }));
                                  } else {
                                    showError(res.error || 'Failed to reject.');
                                  }
                                }}
                              >
                                REJECT
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          ) : (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(5, 3, 13, 0.45)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              color: 'var(--text-primary)',
              fontFamily: '"Share Tech Mono", monospace'
            }}>
              {/* Sci-fi Loading Card */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px',
                padding: '40px 50px',
                borderRadius: '16px',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                background: 'rgba(10, 7, 24, 0.85)',
                boxShadow: '0 0 40px rgba(0, 240, 255, 0.15), inset 0 0 20px rgba(0, 240, 255, 0.05)',
                maxWidth: '480px',
                width: '90%',
                textAlign: 'center'
              }}>
                <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto' }}>
                  {/* Glowing, rotating outer ring */}
                  <div className="spin-loader" style={{
                    width: '100%',
                    height: '100%',
                    border: '3px solid transparent',
                    borderTopColor: 'var(--accent-cyan)',
                    borderBottomColor: 'var(--accent-cyan)',
                    borderRadius: '50%'
                  }} />
                  {/* Inner pulsing star core */}
                  <div style={{
                    position: 'absolute',
                    top: '25%',
                    left: '25%',
                    width: '50%',
                    height: '50%',
                    backgroundColor: 'var(--accent-magenta)',
                    borderRadius: '50%',
                    boxShadow: '0 0 15px var(--accent-magenta)',
                    animation: 'pulse 1.2s ease-in-out infinite alternate'
                  }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h2 style={{
                    letterSpacing: '3px',
                    color: 'var(--accent-cyan)',
                    textShadow: '0 0 10px rgba(0, 240, 255, 0.6)',
                    margin: 0,
                    fontSize: '20px',
                    fontWeight: 700
                  }}>
                    INITIALIZING SIMULATION
                  </h2>
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                  }} className="pulse-light">
                    Synchronizing quantum grid nodes...
                  </div>
                </div>

                {/* Subtext info */}
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingTop: '16px',
                  width: '100%',
                  lineHeight: '1.6'
                }}>
                  Connecting to Star-Swarm core server. Constructing visual grid matrix. Please stand by, Admiral.
                </div>

                <button 
                  className="btn-sci-fi btn-danger" 
                  onClick={handleCancelLoading} 
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    justifyContent: 'center',
                    fontWeight: 600,
                    letterSpacing: '1.5px',
                    fontSize: '12px'
                  }}
                >
                  ABORT SIMULATION
                </button>
              </div>
            </div>
          )}
        </div>
      )}


      {/* PASS TURN OVERLAY SCREEN (HOTSEAT CONFIDENTIALITY) */}
      {screen === 'pass-turn' && nextHumanPlayer && (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99,
          position: 'relative'
        }}>
          <div style={{
            width: '450px',
            padding: '40px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }} className="glass-panel glass-panel-neon-magenta pulse-light">
            <h2 style={{ fontSize: '28px', color: 'var(--accent-magenta)', fontFamily: 'Orbitron', letterSpacing: '2px' }}>
              HUD SECURE LOCKDOWN
            </h2>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Sensors and starmaps have been shrouded. Please pass the controller console to:
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', marginTop: '12px', textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>
                {nextHumanPlayer.name}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
              <button className="btn-sci-fi" style={{ justifyContent: 'center' }} onClick={() => setScreen('game')}>
                INITIALIZE COMMAND HUD
              </button>
              {(() => {
                const activeHumans = gameState?.players.filter(p => p.type === 'human' && !gameState?.playerState[p.id]?.lost) || [];
                const endedPlayer = activeHumans.find(p => p.endedTurn);
                if (endedPlayer) {
                  return (
                    <button
                      className="btn-sci-fi btn-danger"
                      style={{ justifyContent: 'center' }}
                      onClick={() => handleCancelEndTurn(endedPlayer.id)}
                    >
                      CANCEL END TURN & RETURN TO {endedPlayer.name.toUpperCase()}
                    </button>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER SCREEN */}
      {screen === 'game-over' && (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 100,
          position: 'relative'
        }}>
          <div style={{
            width: '500px',
            padding: '40px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }} className="glass-panel glass-panel-neon-cyan">
            <h2 style={{ fontSize: '36px', color: 'var(--accent-cyan)', fontFamily: 'Orbitron', letterSpacing: '4px' }}>
              SIMULATION CONCLUDED
            </h2>
            
            <div style={{ fontSize: '18px', color: 'white', fontWeight: 'bold', textShadow: '0 0 10px rgba(0, 240, 255, 0.4)' }}>
              {getWinnerInfo()}
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              The galaxy has stabilized under team authority. All hostile shipyards and fleet registries have been decommissioned or annexed.
            </p>

            <button className="btn-sci-fi" style={{ justifyContent: 'center' }} onClick={handleReturnToMenu}>
              RETURN TO COMMAND CENTER
            </button>
          </div>
        </div>
      )}

      {/* SETTINGS SCREEN */}
      {screen === 'settings' && (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1,
          position: 'relative',
          padding: '20px'
        }}>
          <div style={{
            width: '450px',
            padding: '30px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }} className="glass-panel glass-panel-neon-cyan">
            <h2 style={{ fontSize: '24px', color: 'var(--accent-cyan)', textAlign: 'center', fontFamily: 'Orbitron' }}>
              COMMANDER SETTINGS
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'Share Tech Mono' }}>
                Global Display Name
              </label>
              <input
                type="text"
                value={settingsDisplayName}
                onChange={(e) => setSettingsDisplayName(e.target.value)}
                placeholder="Enter display name..."
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white',
                  padding: '10px 14px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'Share Tech Mono'
                }}
              />
            </div>

            {/* Security Section (Change Password) */}
            {currentUser && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '15px' }}>
                <h3 style={{ fontSize: '14px', color: 'var(--accent-cyan)', fontFamily: 'Orbitron', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Set / Change Password
                </h3>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', lineHeight: '1.4' }}>
                  {currentUser.hasPassword 
                    ? "Update your account password. This will log you out of all devices/sessions." 
                    : "Create a password to allow standard email & password login alongside Google Sign-In."}
                </div>

                <form onSubmit={handleSavePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {passwordStatusMessage && (
                    <div style={{
                      background: passwordStatusType === 'success' ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255, 0, 127, 0.1)',
                      border: passwordStatusType === 'success' ? '1px solid var(--accent-green)' : '1px solid var(--accent-magenta)',
                      padding: '8px 10px',
                      borderRadius: '4px',
                      color: passwordStatusType === 'success' ? 'var(--accent-green)' : 'var(--accent-magenta)',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      fontFamily: 'Share Tech Mono'
                    }}>
                      [{passwordStatusType === 'success' ? 'SUCCESS' : 'ERROR'}] {passwordStatusMessage}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'Share Tech Mono' }}>
                      New Password (Min 8 chars)
                    </label>
                    <input
                      type="password"
                      value={settingsNewPassword}
                      onChange={(e) => setSettingsNewPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontFamily: 'Share Tech Mono'
                      }}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'Share Tech Mono' }}>
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={settingsConfirmPassword}
                      onChange={(e) => setSettingsConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontFamily: 'Share Tech Mono'
                      }}
                      required
                    />
                  </div>

                  <button className="btn-sci-fi" type="submit" style={{ justifyContent: 'center', marginTop: '5px', fontSize: '12px', padding: '8px 16px' }}>
                    SET NEW PASSWORD
                  </button>
                </form>
              </div>
            )}

            <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
              <button className="btn-sci-fi" onClick={handleSaveSettings} style={{ flex: 1, justifyContent: 'center' }}>
                SAVE CHANGES
              </button>
              <button className="btn-sci-fi btn-danger" onClick={() => setScreen('menu')}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTHENTICATION INPUT MODAL OVERLAY */}
      {isAuthModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(5, 3, 13, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            width: '420px',
            padding: '30px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }} className="glass-panel glass-panel-neon-cyan">
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '18px', color: 'var(--accent-cyan)', fontFamily: 'Orbitron', letterSpacing: '1px' }}>
                {authTab === 'signin' ? 'ESTABLISH COMMAND LINK' : 'CREATE COMMAND PROTOCOL'}
              </h2>
              <button 
                className="btn-sci-fi btn-danger" 
                style={{ padding: '4px 8px', fontSize: '10px' }} 
                onClick={() => setIsAuthModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <button 
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  borderBottom: authTab === 'signin' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                  color: authTab === 'signin' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  padding: '10px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontFamily: 'Outfit'
                }}
                onClick={() => { setAuthTab('signin'); setAuthError(null); setAuthSuccess(null); }}
              >
                SIGN IN
              </button>
              <button 
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  borderBottom: authTab === 'register' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                  color: authTab === 'register' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  padding: '10px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontFamily: 'Outfit'
                }}
                onClick={() => { setAuthTab('register'); setAuthError(null); setAuthSuccess(null); }}
              >
                REGISTER
              </button>
            </div>

            {/* Notification messages */}
            {authError && (
              <div style={{
                background: 'rgba(255, 0, 127, 0.1)',
                border: '1px solid var(--accent-magenta)',
                padding: '10px',
                borderRadius: '6px',
                color: 'var(--accent-magenta)',
                fontSize: '12px',
                fontWeight: 'bold',
                fontFamily: 'Share Tech Mono'
              }}>
                [ERROR] {authError}
              </div>
            )}
            {authSuccess && (
              <div style={{
                background: 'rgba(57, 255, 20, 0.1)',
                border: '1px solid var(--accent-green)',
                padding: '10px',
                borderRadius: '6px',
                color: 'var(--accent-green)',
                fontSize: '12px',
                fontWeight: 'bold',
                fontFamily: 'Share Tech Mono'
              }}>
                [SUCCESS] {authSuccess}
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={authTab === 'signin' ? handleLogin : handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>COMMANDER EMAIL</label>
                <input 
                  type="email" 
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white',
                    padding: '10px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'Outfit'
                  }}
                  placeholder="name@domain.com"
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>ACCESS PASSWORD (MIN 8 CHARS)</label>
                <input 
                  type="password" 
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white',
                    padding: '10px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'Outfit'
                  }}
                  placeholder="••••••••"
                  required
                />
              </div>

              <button className="btn-sci-fi" type="submit" style={{ justifyContent: 'center', marginTop: '5px' }}>
                {authTab === 'signin' ? 'INITIATE CONNECTION' : 'CREATE PROTOCOL'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '5px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
            </div>

            {/* Google OAuth Simulation button */}
            <button 
              className="btn-sci-fi" 
              type="button"
              style={{ 
                justifyContent: 'center', 
                background: 'rgba(255, 255, 255, 0.05)', 
                borderColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white'
              }}
              onClick={() => { setIsGoogleModalOpen(true); }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: '8px' }}>
                <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7v2.24h2.9c1.69-1.55 2.69-3.85 2.69-6.57z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.23l-2.9-2.24c-.8.54-1.84.87-3.06.87-2.35 0-4.34-1.58-5.05-3.72H.95v2.3C2.43 15.89 5.5 18 9 18z"/>
                <path fill="#FBBC05" d="M3.95 10.68c-.18-.54-.28-1.12-.28-1.68s.1-1.14.28-1.68V5.02H.95C.34 6.22 0 7.57 0 9s.34 2.78.95 3.98l3-2.3z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.47.89 11.43 0 9 0 5.5 0 2.43 2.11.95 5.02l3 2.3c.71-2.14 2.7-3.72 5.05-3.72z"/>
              </svg>
              SIGN IN WITH GOOGLE
            </button>
          </div>
        </div>
      )}

      {/* SIMULATED GOOGLE OAUTH SELECTOR DIALOG */}
      {isGoogleModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(5, 3, 13, 0.9)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1100
        }}>
          <div style={{
            width: '380px',
            background: 'white',
            borderRadius: '8px',
            padding: '30px',
            color: '#202124',
            fontFamily: 'Roboto, Arial, sans-serif',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
          }}>
            {/* Google Identity Header */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <div style={{ fontSize: '18px', fontWeight: 500, color: '#202124' }}>Sign in with Google</div>
              <div style={{ fontSize: '13px', color: '#5f6368' }}>to continue to Star-Swarm Command</div>
            </div>

            <div style={{ fontSize: '14px', fontWeight: 500, color: '#3c4043', borderBottom: '1px solid #dadce0', paddingBottom: '8px' }}>
              Choose an account
            </div>

            {/* Google Accounts List Simulation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {[
                { name: 'Swarm Commander', email: 'commander@gmail.com' },
                { name: 'Alliance Admiral', email: 'alliance.admiral@gmail.com' },
                { name: 'Xeno Scout', email: 'xeno.scout@gmail.com' }
              ].map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '10px 12px',
                    background: 'none',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  onClick={() => handleGoogleLogin(acc.email)}
                >
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#3c4043' }}>{acc.name}</div>
                  <div style={{ fontSize: '11px', color: '#5f6368' }}>{acc.email}</div>
                </button>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #dadce0', paddingTop: '10px', marginTop: '5px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#5f6368', display: 'block', marginBottom: '4px' }}>
                OR USE ANOTHER GOOGLE ACCOUNT
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="email" 
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #dadce0',
                    borderRadius: '4px',
                    fontSize: '13px',
                    color: '#202124',
                    background: '#f8f9fa'
                  }}
                />
                <button 
                  type="button"
                  style={{
                    background: '#1a73e8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    if (customGoogleEmail && customGoogleEmail.includes('@')) {
                      handleGoogleLogin(customGoogleEmail);
                    }
                  }}
                >
                  Next
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button 
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1a73e8',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '8px'
                }}
                onClick={() => setIsGoogleModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DECOMMISSION CONFIRMATION MODAL */}
      {gameToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(5, 3, 13, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1001
        }}>
          <div style={{
            width: '400px',
            padding: '30px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }} className="glass-panel glass-panel-neon-magenta">
            <h2 style={{ fontSize: '18px', color: 'var(--accent-magenta)', fontFamily: 'Orbitron', letterSpacing: '1px', textAlign: 'center' }}>
              DECOMMISSION SIMULATION?
            </h2>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.5' }}>
              Are you sure you want to delete the simulation record for:
              <div style={{ color: 'white', fontWeight: 'bold', margin: '10px 0', fontSize: '14px' }}>
                {gameToDelete.name}
              </div>
              This action is irreversible. All ship registries, star grid data, and fleets will be decommissioned.
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button 
                className="btn-sci-fi btn-danger" 
                style={{ flex: 1, justifyContent: 'center' }} 
                onClick={async () => {
                  const delRes = await deleteGame(gameToDelete.id);
                  if (delRes.success) {
                    const ownedGames = JSON.parse(localStorage.getItem('starswarm_owned_games') || '[]');
                    const updatedOwned = ownedGames.filter((id: string) => id !== gameToDelete.id);
                    localStorage.setItem('starswarm_owned_games', JSON.stringify(updatedOwned));
                    loadGamesList();
                  } else {
                    showError(delRes.error || 'Failed to delete game.');
                  }
                  setGameToDelete(null);
                }}
              >
                DECOMMISSION
              </button>
              <button 
                className="btn-sci-fi" 
                style={{ flex: 1, justifyContent: 'center', background: 'rgba(255,255,255,0.05)' }} 
                onClick={() => setGameToDelete(null)}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {isRulesEditorOpen && editingRules && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(5, 10, 20, 0.95)',
          backdropFilter: 'blur(10px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'auto',
          color: 'white',
          fontFamily: 'Share Tech Mono'
        }}>
          <div style={{
            width: '800px',
            padding: '30px',
            maxHeight: '90vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }} className="glass-panel glass-panel-neon-cyan">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'Orbitron', color: 'var(--accent-cyan)', margin: 0 }}>
                {editingRules.isDefault ? 'GALACTIC RULESET PROTOCOLS (READ-ONLY)' : 'CUSTOM RULESET DESIGNER'}
              </h2>
              <button className="btn-sci-fi btn-danger" onClick={() => { setIsRulesEditorOpen(false); setEditingRules(null); }}>✕</button>
            </div>

            {editingRules.isDefault && (
              <div style={{ padding: '8px 12px', background: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.2)', color: 'var(--accent-cyan)', borderRadius: '4px', fontSize: '12px' }}>
                [NOTICE] Default rulesets cannot be modified. To customize these rules, return to the lobby and click &quot;COPY MODE&quot; to create a custom template.
              </div>
            )}

            {editorErrors.length > 0 && (
              <div style={{ padding: '10px', background: 'rgba(255, 0, 127, 0.1)', border: '1px solid rgba(255, 0, 127, 0.3)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {editorErrors.map((err, idx) => (
                  <div key={idx} style={{ color: 'var(--accent-magenta)', fontSize: '12px', fontWeight: 'bold' }}>• {err}</div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Left Column - Meta & Toggles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>RULESET NAME</label>
                  <input
                    type="text"
                    disabled={editingRules.isDefault}
                    value={editingRules.name}
                    onChange={(e) => setEditingRules({ ...editingRules, name: e.target.value })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '6px 10px', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>DESCRIPTION</label>
                  <textarea
                    disabled={editingRules.isDefault}
                    value={editingRules.description}
                    onChange={(e) => setEditingRules({ ...editingRules, description: e.target.value })}
                    style={{ width: '100%', height: '50px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', resize: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      disabled={editingRules.isDefault}
                      checked={editingRules.enableCredits}
                      onChange={(e) => setEditingRules({ ...editingRules, enableCredits: e.target.checked })}
                      style={{ accentColor: 'var(--accent-cyan)' }}
                    />
                    <span>ENABLE CREDITS / ECONOMY</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      disabled={editingRules.isDefault}
                      checked={editingRules.enableUpgrades}
                      onChange={(e) => setEditingRules({ ...editingRules, enableUpgrades: e.target.checked })}
                      style={{ accentColor: 'var(--accent-cyan)' }}
                    />
                    <span>ENABLE BASE & TECH UPGRADES</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      disabled={editingRules.isDefault}
                      checked={editingRules.captureRequiresColonyShip}
                      onChange={(e) => setEditingRules({ ...editingRules, captureRequiresColonyShip: e.target.checked })}
                      style={{ accentColor: 'var(--accent-cyan)' }}
                    />
                    <span>ANNEXING NEUTRALS REQUIRES COLONY SHIP</span>
                  </label>
                </div>

                {/* Economic / Turn settings */}
                {editingRules.enableCredits && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', background: 'rgba(0, 240, 255, 0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(0, 240, 255, 0.08)' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>START CREDITS</label>
                      <input
                        type="number"
                        disabled={editingRules.isDefault}
                        value={editingRules.startingResources}
                        onChange={(e) => setEditingRules({ ...editingRules, startingResources: parseInt(e.target.value) || 0 })}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>BASE INCOME</label>
                      <input
                        type="number"
                        disabled={editingRules.isDefault}
                        value={editingRules.resourcesPerTurn.base}
                        onChange={(e) => setEditingRules({
                          ...editingRules,
                          resourcesPerTurn: { ...editingRules.resourcesPerTurn, base: parseInt(e.target.value) || 0 }
                        })}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>RAND INCOME</label>
                      <input
                        type="number"
                        disabled={editingRules.isDefault}
                        value={editingRules.resourcesPerTurn.randomAdd}
                        onChange={(e) => setEditingRules({
                          ...editingRules,
                          resourcesPerTurn: { ...editingRules.resourcesPerTurn, randomAdd: parseInt(e.target.value) || 0 }
                        })}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Map/Production settings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(57, 255, 20, 0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(57, 255, 20, 0.08)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      disabled={editingRules.isDefault}
                      checked={editingRules.nodeProduction.enabled}
                      onChange={(e) => setEditingRules({
                        ...editingRules,
                        nodeProduction: { ...editingRules.nodeProduction, enabled: e.target.checked }
                      })}
                      style={{ accentColor: 'var(--accent-green)' }}
                    />
                    <span>ENABLE AUTOMATED NODE PRODUCTION</span>
                  </label>

                  {editingRules.nodeProduction.enabled && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SHIPS PER TURN</label>
                        <input
                          type="number"
                          disabled={editingRules.isDefault}
                          value={editingRules.nodeProduction.shipsPerTurn}
                          onChange={(e) => setEditingRules({
                            ...editingRules,
                            nodeProduction: { ...editingRules.nodeProduction, shipsPerTurn: parseInt(e.target.value) || 0 }
                          })}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SHIP TYPE</label>
                        <select
                          disabled={editingRules.isDefault}
                          value={editingRules.nodeProduction.shipType}
                          onChange={(e) => setEditingRules({
                            ...editingRules,
                            nodeProduction: { ...editingRules.nodeProduction, shipType: e.target.value }
                          })}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                        >
                          {Object.keys(editingRules.ships).map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-primary)' }}>BASE STAR SIGHT RANGE</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      step="0.5"
                      disabled={editingRules.isDefault}
                      value={editingRules.starSightRange ?? 6.0}
                      onChange={(e) => setEditingRules({ ...editingRules, starSightRange: parseFloat(e.target.value) || 6.0 })}
                      style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
                    />
                    <span className="telemetry" style={{ width: '50px', textAlign: 'right', fontSize: '12px' }}>{editingRules.starSightRange ?? 6.0} LY</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-primary)' }}>NEUTRAL DEFENSE COMPOSITION</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>MIN SHIPS</label>
                      <input
                        type="number"
                        disabled={editingRules.isDefault}
                        value={editingRules.neutralStartingShipsRange.min}
                        onChange={(e) => setEditingRules({
                          ...editingRules,
                          neutralStartingShipsRange: { ...editingRules.neutralStartingShipsRange, min: parseInt(e.target.value) || 0 }
                        })}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>MAX SHIPS</label>
                      <input
                        type="number"
                        disabled={editingRules.isDefault}
                        value={editingRules.neutralStartingShipsRange.max}
                        onChange={(e) => setEditingRules({
                          ...editingRules,
                          neutralStartingShipsRange: { ...editingRules.neutralStartingShipsRange, max: parseInt(e.target.value) || 0 }
                        })}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>SHIP TYPE</label>
                      <select
                        disabled={editingRules.isDefault}
                        value={editingRules.neutralStartingShipsRange.type}
                        onChange={(e) => setEditingRules({
                          ...editingRules,
                          neutralStartingShipsRange: { ...editingRules.neutralStartingShipsRange, type: e.target.value }
                        })}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                      >
                        {Object.keys(editingRules.ships).map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-primary)' }}>FACTION STARTING FLEETS</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {Object.keys(editingRules.ships).map(type => (
                      <div key={type}>
                        <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{type.toUpperCase()}</label>
                        <input
                          type="number"
                          disabled={editingRules.isDefault}
                          value={editingRules.startingShips[type] || 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setEditingRules({
                              ...editingRules,
                              startingShips: { ...editingRules.startingShips, [type]: val }
                            });
                          }}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Ship Types Manager Section */}
            <div style={{ background: 'rgba(255,255,255,0.01)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '14px', color: 'var(--accent-cyan)', margin: 0 }}>SHIP TYPES SCHEMA</h3>
                {!editingRules.isDefault && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="e.g. Destroyer"
                      value={newShipTypeKey}
                      onChange={(e) => setNewShipTypeKey(e.target.value)}
                      style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}
                    />
                    <button
                      className="btn-sci-fi"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                      onClick={() => {
                        const key = newShipTypeKey.trim();
                        if (key && !editingRules.ships[key]) {
                          const updatedShips = {
                            ...editingRules.ships,
                            [key]: {
                              name: key,
                              cost: 10,
                              speed: 3.0,
                              hp: 1,
                              attack: 1,
                              hitChance: 0.5,
                              description: 'Custom combat hull.'
                            }
                          };
                          setEditingRules({
                            ...editingRules,
                            ships: updatedShips,
                            startingShips: { ...editingRules.startingShips, [key]: 0 }
                          });
                          setNewShipTypeKey('');
                        }
                      }}
                    >
                      ADD HULL TYPE
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                {Object.entries(editingRules.ships).map(([type, shipDef]) => (
                  <div key={type} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '10px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: 'white', fontSize: '13px' }}>Hull Protocol: {type}</strong>
                      {!editingRules.isDefault && Object.keys(editingRules.ships).length > 1 && (
                        <button
                          className="btn-sci-fi btn-danger"
                          style={{ padding: '2px 6px', fontSize: '10px' }}
                          onClick={() => {
                            const newShips = { ...editingRules.ships };
                            delete newShips[type];
                            const newStarting = { ...editingRules.startingShips };
                            delete newStarting[type];
                            
                            // Adjust production or neutral type if they were set to deleted ship
                            let newProdType = editingRules.nodeProduction.shipType;
                            if (newProdType === type) {
                              newProdType = Object.keys(newShips)[0] || '';
                            }
                            let newNeutralType = editingRules.neutralStartingShipsRange.type;
                            if (newNeutralType === type) {
                              newNeutralType = Object.keys(newShips)[0] || '';
                            }

                            setEditingRules({
                              ...editingRules,
                              ships: newShips,
                              startingShips: newStarting,
                              nodeProduction: { ...editingRules.nodeProduction, shipType: newProdType },
                              neutralStartingShipsRange: { ...editingRules.neutralStartingShipsRange, type: newNeutralType }
                            });
                          }}
                        >
                          REMOVE
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                      {editingRules.enableCredits && (
                        <div>
                          <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>BUILD COST</label>
                          <input
                            type="number"
                            disabled={editingRules.isDefault}
                            value={shipDef.cost}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setEditingRules({
                                ...editingRules,
                                ships: {
                                  ...editingRules.ships,
                                  [type]: { ...shipDef, cost: val }
                                }
                              });
                            }}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                          />
                        </div>
                      )}
                      <div>
                        <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>SPEED (LY/T)</label>
                        <input
                          type="number"
                          step="0.1"
                          disabled={editingRules.isDefault}
                          value={shipDef.speed}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0.1;
                            setEditingRules({
                              ...editingRules,
                              ships: {
                                ...editingRules.ships,
                                  [type]: { ...shipDef, speed: val }
                              }
                            });
                          }}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>STRUCTURAL HP</label>
                        <input
                          type="number"
                          disabled={editingRules.isDefault}
                          value={shipDef.hp}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setEditingRules({
                              ...editingRules,
                              ships: {
                                ...editingRules.ships,
                                  [type]: { ...shipDef, hp: val }
                              }
                            });
                          }}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>WEAPON DAMAGE</label>
                        <input
                          type="number"
                          disabled={editingRules.isDefault}
                          value={shipDef.attack}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setEditingRules({
                              ...editingRules,
                              ships: {
                                ...editingRules.ships,
                                  [type]: { ...shipDef, attack: val }
                              }
                            });
                          }}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>HIT CHANCE (0-1)</label>
                        <input
                          type="number"
                          step="0.05"
                          disabled={editingRules.isDefault}
                          value={shipDef.hitChance}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0.0;
                            setEditingRules({
                              ...editingRules,
                              ships: {
                                ...editingRules.ships,
                                  [type]: { ...shipDef, hitChance: val }
                              }
                            });
                          }}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
              {!editingRules.isDefault && (
                <button className="btn-sci-fi" onClick={handleSaveRules} style={{ flex: 1, justifyContent: 'center' }}>
                  SAVE PROTOCOLS
                </button>
              )}
              <button className="btn-sci-fi btn-danger" onClick={() => { setIsRulesEditorOpen(false); setEditingRules(null); }} style={{ flex: editingRules.isDefault ? 1 : 0, justifyContent: 'center' }}>
                CLOSE
              </button>
            </div>

          </div>
        </div>
      )}

      {/* IMPORT CODE STRING ENTRY MODAL */}
      {isImportModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(5, 10, 20, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'auto',
          color: 'white',
          fontFamily: 'Share Tech Mono'
        }}>
          <div style={{
            width: '500px',
            padding: '30px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }} className="glass-panel glass-panel-neon-cyan">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'Orbitron', color: 'var(--accent-cyan)', margin: 0, fontSize: '18px' }}>
                IMPORT RULESET PROTOCOL
              </h2>
              <button className="btn-sci-fi btn-danger" onClick={() => setIsImportModalOpen(false)}>✕</button>
            </div>

            {importError && (
              <div style={{ padding: '10px', background: 'rgba(255, 0, 127, 0.1)', border: '1px solid rgba(255, 0, 127, 0.3)', borderRadius: '4px', color: 'var(--accent-magenta)', fontSize: '12px', fontWeight: 'bold' }}>
                {importError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PASTE CONFIGURATION STRING</label>
              <textarea
                value={importString}
                onChange={(e) => setImportString(e.target.value)}
                placeholder="Paste SS-RULES-V1-... string here"
                style={{
                  width: '100%',
                  height: '150px',
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white',
                  padding: '10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box',
                  resize: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button className="btn-sci-fi" onClick={handleProcessImport} style={{ flex: 1, justifyContent: 'center' }}>
                DECRYPT & PREVIEW
              </button>
              <button className="btn-sci-fi btn-danger" onClick={() => setIsImportModalOpen(false)}>
                CANCEL
              </button>
            </div>

          </div>
        </div>
      )}

      {/* IMPORT & MIGRATION PREVIEW MODAL */}
      {isImportPreviewOpen && importRulesPreview && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(5, 10, 20, 0.95)',
          backdropFilter: 'blur(10px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'auto',
          color: 'white',
          fontFamily: 'Share Tech Mono'
        }}>
          <div style={{
            width: '800px',
            padding: '30px',
            maxHeight: '90vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }} className="glass-panel glass-panel-neon-magenta">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'Orbitron', color: 'var(--accent-magenta)', margin: 0 }}>
                RULESET IMPORT PREVIEW & MIGRATION
              </h2>
              <button className="btn-sci-fi btn-danger" onClick={() => { setIsImportPreviewOpen(false); setImportRulesPreview(null); }}>✕</button>
            </div>

            {importOriginalVersion !== null && importOriginalVersion !== 1 ? (
              <div style={{
                padding: '12px',
                background: 'rgba(255, 170, 0, 0.1)',
                border: '1px solid rgba(255, 170, 0, 0.3)',
                color: '#ffaa00',
                borderRadius: '6px',
                fontSize: '12px',
                lineHeight: '1.5'
              }}>
                <strong>⚠️ SCHEMA MIGRATION DETECTED:</strong> This ruleset is version <strong>V{importOriginalVersion}</strong>, but the current options configuration is <strong>V1</strong>. Missing or deprecated properties have been automatically migrated to default values. Please review the settings below before importing.
              </div>
            ) : (
              <div style={{
                padding: '8px 12px',
                background: 'rgba(0, 240, 255, 0.05)',
                border: '1px solid rgba(0, 240, 255, 0.2)',
                color: 'var(--accent-cyan)',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                ✓ Version Check OK (Ruleset Version V1 verified). Ready to import.
              </div>
            )}

            {importPreviewErrors.length > 0 && (
              <div style={{ padding: '10px', background: 'rgba(255, 0, 127, 0.1)', border: '1px solid rgba(255, 0, 127, 0.3)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {importPreviewErrors.map((err, idx) => (
                  <div key={idx} style={{ color: 'var(--accent-magenta)', fontSize: '12px', fontWeight: 'bold' }}>• {err}</div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>RULESET NAME</label>
                  <input
                    type="text"
                    value={importRulesPreview.name}
                    onChange={(e) => setImportRulesPreview({ ...importRulesPreview, name: e.target.value })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '6px 10px', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>DESCRIPTION</label>
                  <textarea
                    value={importRulesPreview.description}
                    onChange={(e) => setImportRulesPreview({ ...importRulesPreview, description: e.target.value })}
                    style={{ width: '100%', height: '50px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', resize: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={importRulesPreview.enableCredits}
                      onChange={(e) => setImportRulesPreview({ ...importRulesPreview, enableCredits: e.target.checked })}
                      style={{ accentColor: 'var(--accent-cyan)' }}
                    />
                    <span>ENABLE CREDITS / ECONOMY</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={importRulesPreview.enableUpgrades}
                      onChange={(e) => setImportRulesPreview({ ...importRulesPreview, enableUpgrades: e.target.checked })}
                      style={{ accentColor: 'var(--accent-cyan)' }}
                    />
                    <span>ENABLE BASE & TECH UPGRADES</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={importRulesPreview.captureRequiresColonyShip}
                      onChange={(e) => setImportRulesPreview({ ...importRulesPreview, captureRequiresColonyShip: e.target.checked })}
                      style={{ accentColor: 'var(--accent-cyan)' }}
                    />
                    <span>ANNEXING NEUTRALS REQUIRES COLONY SHIP</span>
                  </label>
                </div>

                {importRulesPreview.enableCredits && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', background: 'rgba(0, 240, 255, 0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(0, 240, 255, 0.08)' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>START CREDITS</label>
                      <input
                        type="number"
                        value={importRulesPreview.startingResources}
                        onChange={(e) => setImportRulesPreview({ ...importRulesPreview, startingResources: parseInt(e.target.value) || 0 })}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>BASE INCOME</label>
                      <input
                        type="number"
                        value={importRulesPreview.resourcesPerTurn.base}
                        onChange={(e) => setImportRulesPreview({
                          ...importRulesPreview,
                          resourcesPerTurn: { ...importRulesPreview.resourcesPerTurn, base: parseInt(e.target.value) || 0 }
                        })}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>RAND INCOME</label>
                      <input
                        type="number"
                        value={importRulesPreview.resourcesPerTurn.randomAdd}
                        onChange={(e) => setImportRulesPreview({
                          ...importRulesPreview,
                          resourcesPerTurn: { ...importRulesPreview.resourcesPerTurn, randomAdd: parseInt(e.target.value) || 0 }
                        })}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(57, 255, 20, 0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(57, 255, 20, 0.08)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={importRulesPreview.nodeProduction.enabled}
                      onChange={(e) => setImportRulesPreview({
                        ...importRulesPreview,
                        nodeProduction: { ...importRulesPreview.nodeProduction, enabled: e.target.checked }
                      })}
                      style={{ accentColor: 'var(--accent-green)' }}
                    />
                    <span>ENABLE AUTOMATED NODE PRODUCTION</span>
                  </label>

                  {importRulesPreview.nodeProduction.enabled && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SHIPS PER TURN</label>
                        <input
                          type="number"
                          value={importRulesPreview.nodeProduction.shipsPerTurn}
                          onChange={(e) => setImportRulesPreview({
                            ...importRulesPreview,
                            nodeProduction: { ...importRulesPreview.nodeProduction, shipsPerTurn: parseInt(e.target.value) || 0 }
                          })}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SHIP TYPE</label>
                        <select
                          value={importRulesPreview.nodeProduction.shipType}
                          onChange={(e) => setImportRulesPreview({
                            ...importRulesPreview,
                            nodeProduction: { ...importRulesPreview.nodeProduction, shipType: e.target.value }
                          })}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                        >
                          {Object.keys(importRulesPreview.ships).map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-primary)' }}>BASE STAR SIGHT RANGE</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      step="0.5"
                      value={importRulesPreview.starSightRange ?? 6.0}
                      onChange={(e) => setImportRulesPreview({ ...importRulesPreview, starSightRange: parseFloat(e.target.value) || 6.0 })}
                      style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
                    />
                    <span className="telemetry" style={{ width: '50px', textAlign: 'right', fontSize: '12px' }}>{importRulesPreview.starSightRange ?? 6.0} LY</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-primary)' }}>NEUTRAL DEFENSE COMPOSITION</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>MIN SHIPS</label>
                      <input
                        type="number"
                        value={importRulesPreview.neutralStartingShipsRange.min}
                        onChange={(e) => setImportRulesPreview({
                          ...importRulesPreview,
                          neutralStartingShipsRange: { ...importRulesPreview.neutralStartingShipsRange, min: parseInt(e.target.value) || 0 }
                        })}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>MAX SHIPS</label>
                      <input
                        type="number"
                        value={importRulesPreview.neutralStartingShipsRange.max}
                        onChange={(e) => setImportRulesPreview({
                          ...importRulesPreview,
                          neutralStartingShipsRange: { ...importRulesPreview.neutralStartingShipsRange, max: parseInt(e.target.value) || 0 }
                        })}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>SHIP TYPE</label>
                      <select
                        value={importRulesPreview.neutralStartingShipsRange.type}
                        onChange={(e) => setImportRulesPreview({
                          ...importRulesPreview,
                          neutralStartingShipsRange: { ...importRulesPreview.neutralStartingShipsRange, type: e.target.value }
                        })}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                      >
                        {Object.keys(importRulesPreview.ships).map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-primary)' }}>FACTION STARTING FLEETS</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {Object.keys(importRulesPreview.ships).map(type => (
                      <div key={type}>
                        <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{type.toUpperCase()}</label>
                        <input
                          type="number"
                          value={importRulesPreview.startingShips[type] || 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setImportRulesPreview({
                              ...importRulesPreview,
                              startingShips: { ...importRulesPreview.startingShips, [type]: val }
                            });
                          }}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Ship Types Manager Section for Import Preview */}
            <div style={{ background: 'rgba(255,255,255,0.01)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '14px', color: 'var(--accent-magenta)', margin: 0 }}>SHIP TYPES SCHEMA</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="e.g. Destroyer"
                    value={newImportShipTypeKey}
                    onChange={(e) => setNewImportShipTypeKey(e.target.value)}
                    style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}
                  />
                  <button
                    className="btn-sci-fi"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                    onClick={() => {
                      const key = newImportShipTypeKey.trim();
                      if (key && !importRulesPreview.ships[key]) {
                        const updatedShips = {
                          ...importRulesPreview.ships,
                          [key]: {
                            name: key,
                            cost: 10,
                            speed: 3.0,
                            hp: 1,
                            attack: 1,
                            hitChance: 0.5,
                            description: 'Custom combat hull.'
                          }
                        };
                        setImportRulesPreview({
                          ...importRulesPreview,
                          ships: updatedShips,
                          startingShips: { ...importRulesPreview.startingShips, [key]: 0 }
                        });
                        setNewImportShipTypeKey('');
                      }
                    }}
                  >
                    ADD HULL TYPE
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                {Object.entries(importRulesPreview.ships).map(([type, shipDef]) => (
                  <div key={type} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '10px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: 'white', fontSize: '13px' }}>Hull Protocol: {type}</strong>
                      {Object.keys(importRulesPreview.ships).length > 1 && (
                        <button
                          className="btn-sci-fi btn-danger"
                          style={{ padding: '2px 6px', fontSize: '10px' }}
                          onClick={() => {
                            const newShips = { ...importRulesPreview.ships };
                            delete newShips[type];
                            const newStarting = { ...importRulesPreview.startingShips };
                            delete newStarting[type];
                            
                            let newProdType = importRulesPreview.nodeProduction.shipType;
                            if (newProdType === type) {
                              newProdType = Object.keys(newShips)[0] || '';
                            }
                            let newNeutralType = importRulesPreview.neutralStartingShipsRange.type;
                            if (newNeutralType === type) {
                              newNeutralType = Object.keys(newShips)[0] || '';
                            }

                            setImportRulesPreview({
                              ...importRulesPreview,
                              ships: newShips,
                              startingShips: newStarting,
                              nodeProduction: { ...importRulesPreview.nodeProduction, shipType: newProdType },
                              neutralStartingShipsRange: { ...importRulesPreview.neutralStartingShipsRange, type: newNeutralType }
                            });
                          }}
                        >
                          REMOVE
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                      {importRulesPreview.enableCredits && (
                        <div>
                          <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>BUILD COST</label>
                          <input
                            type="number"
                            value={shipDef.cost}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setImportRulesPreview({
                                ...importRulesPreview,
                                ships: {
                                  ...importRulesPreview.ships,
                                  [type]: { ...shipDef, cost: val }
                                }
                              });
                            }}
                            style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                          />
                        </div>
                      )}
                      <div>
                        <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>SPEED (LY/T)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={shipDef.speed}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0.1;
                            setImportRulesPreview({
                              ...importRulesPreview,
                              ships: {
                                ...importRulesPreview.ships,
                                [type]: { ...shipDef, speed: val }
                              }
                            });
                          }}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>STRUCTURAL HP</label>
                        <input
                          type="number"
                          value={shipDef.hp}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setImportRulesPreview({
                              ...importRulesPreview,
                              ships: {
                                ...importRulesPreview.ships,
                                [type]: { ...shipDef, hp: val }
                              }
                            });
                          }}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>WEAPON DAMAGE</label>
                        <input
                          type="number"
                          value={shipDef.attack}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setImportRulesPreview({
                              ...importRulesPreview,
                              ships: {
                                ...importRulesPreview.ships,
                                [type]: { ...shipDef, attack: val }
                              }
                            });
                          }}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>HIT CHANCE (0-1)</label>
                        <input
                          type="number"
                          step="0.05"
                          value={shipDef.hitChance}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0.0;
                            setImportRulesPreview({
                              ...importRulesPreview,
                              ships: {
                                ...importRulesPreview.ships,
                                [type]: { ...shipDef, hitChance: val }
                              }
                            });
                          }}
                          style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
              <button className="btn-sci-fi" onClick={handleConfirmImport} style={{ flex: 1, justifyContent: 'center' }}>
                CONFIRM IMPORT PROTOCOL
              </button>
              <button className="btn-sci-fi btn-danger" onClick={() => { setIsImportPreviewOpen(false); setImportRulesPreview(null); }}>
                CANCEL
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
