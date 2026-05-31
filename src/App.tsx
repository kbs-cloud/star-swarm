import { PlayerSetup } from './types';
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


import { Footer } from './components/Footer';
import { TermsOfService } from './components/TermsOfService';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import {
  getCurrentUser,
  registerUser,
  loginUser,
  checkGoogleOAuthConfig,
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
  GameMetadata,
  updateGameName,

  updateSettings,


  fetchPendingJoins,
  checkMyJoinStatus,
  acceptJoinRequest,
  rejectJoinRequest,
  JoinRequest,
  performGameAction
} from './game/gameApi';





// HUD Components
import { AlertHud } from './components/hud/AlertHud';
import { ToastHud } from './components/hud/ToastHud';
import { NotificationsStack } from './components/hud/NotificationsStack';
import { AuthBar } from './components/hud/AuthBar';
import { JoinRequestOverlay } from './components/hud/JoinRequestOverlay';

// Screen Components
import { GameOverScreen } from './components/screens/GameOverScreen';
import { PassTurnScreen } from './components/screens/PassTurnScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { GameScreen } from './components/screens/GameScreen';
import { LobbyScreen } from './components/screens/LobbyScreen';
import { MenuScreen } from './components/screens/MenuScreen';

// Modal Components
import { AuthModal } from './components/modals/AuthModal';
import { DeleteGameModal } from './components/modals/DeleteGameModal';
import { ImportRulesModal } from './components/modals/ImportRulesModal';
import { RulesEditorModal } from './components/modals/RulesEditorModal';
import { ImportPreviewModal } from './components/modals/ImportPreviewModal';

type Screen = 'menu' | 'lobby' | 'game' | 'pass-turn' | 'game-over' | 'settings' | 'terms' | 'privacy';


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
  const [isGoogleAuthEnabled, setIsGoogleAuthEnabled] = useState(false);

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
  const [toastType, setToastType] = useState<'success' | 'info' | 'warning' | null>('info');

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



  // Initialize CSRF and restore session cookie on mount
  React.useEffect(() => {
    const bootstrap = async () => {
      await initCSRF();
      const user = await checkSession();
      if (user) {
        setCurrentUser(user);
      }

      // Check Google OAuth config
      const config = await checkGoogleOAuthConfig();
      setIsGoogleAuthEnabled(config.enabled);
      
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
      <AlertHud message={alertMsg} />

      {/* SUCCESS / INFO / WARNING TOAST */}
      <ToastHud message={toastMsg} type={toastType || 'info'} />


      {/* IN-GAME NOTIFICATIONS STACK */}
      {screen === 'game' && (
        <NotificationsStack
          notifications={notifications}
          onDismiss={dismissNotification}
        />
      )}

      {/* AUTHENTICATION HUD OVERLAY (Only visible in menus/lobby) */}
      {(screen === 'menu' || screen === 'lobby' || screen === 'game-over' || screen === 'settings' || screen === 'terms' || screen === 'privacy') && (
        <AuthBar
          currentUser={currentUser}
          soundMuted={soundMuted}
          onToggleSoundMuted={toggleSoundMuted}
          onOpenAuth={() => {
            clearAuthInputs();
            setIsAuthModalOpen(true);
          }}
          onLogout={handleLogout}
          onNavigateSettings={() => setScreen('settings')}
        />
      )}

      {/* JOIN REQUEST OVERLAY FOR REQUESTOR */}
      <JoinRequestOverlay
        pendingJoinGameId={pendingJoinGameId}
        myJoinStatus={myJoinStatus}
        currentUser={currentUser}
        guestName={guestName}
        onUpdateGuestName={updateGuestName}
        onCancel={() => {
          setPendingJoinGameId(null);
          setMyJoinStatus(null);
          setActiveGameId(null);
          clearUrlQuery();
        }}
        onShowError={(msg) => {
          setAlertMsg(msg);
          setTimeout(() => setAlertMsg(null), 5000);
        }}
        onShowToast={(msg, type) => {
          setToastMsg(msg);
          setToastType(type || 'info');
          setTimeout(() => {
            setToastMsg(null);
            setToastType(null);
          }, 4000);
        }}
        onSetMyJoinStatus={setMyJoinStatus}
      />

      {/* MENU SCREEN */}
      {screen === 'menu' && (
        <MenuScreen
          currentUser={currentUser}
          savedGames={savedGames}
          totalGamesCount={totalGamesCount}
          gameSearchQuery={gameSearchQuery}
          setGameSearchQuery={setGameSearchQuery}
          showAdvancedFilters={showAdvancedFilters}
          setShowAdvancedFilters={setShowAdvancedFilters}
          gameSearchStatus={gameSearchStatus}
          setGameSearchStatus={setGameSearchStatus}
          gameTurnsFilter={gameTurnsFilter}
          setGameTurnsFilter={setGameTurnsFilter}
          gameStartDate={gameStartDate}
          setGameStartDate={setGameStartDate}
          gameEndDate={gameEndDate}
          setGameEndDate={setGameEndDate}
          loadGamesList={loadGamesList}
          isInfiniteLoading={isInfiniteLoading}
          homePendingRequests={homePendingRequests}
          setHomePendingRequests={setHomePendingRequests}
          joinPanelGameId={joinPanelGameId}
          setJoinPanelGameId={setJoinPanelGameId}
          joinAssignSlot={joinAssignSlot}
          setJoinAssignSlot={setJoinAssignSlot}
          handleStartSkirmishLobby={handleStartSkirmishLobby}
          handleCancelEndTurnForGame={handleCancelEndTurnForGame}
          loadGameFromId={loadGameFromId}
          setGameToDelete={setGameToDelete}
          acceptJoinRequest={acceptJoinRequest}
          rejectJoinRequest={rejectJoinRequest}
          showToast={showToast}
          showError={(msg) => {
            setAlertMsg(msg);
            setTimeout(() => setAlertMsg(null), 5000);
          }}
        />
      )}

      {/* LOBBY SCREEN */}
      {screen === 'lobby' && (
        <LobbyScreen
          gridSize={gridSize}
          setGridSize={setGridSize}
          systemCount={systemCount}
          setSystemCount={setSystemCount}
          gameSeed={gameSeed}
          setGameSeed={setGameSeed}
          overrideSightRange={overrideSightRange}
          setOverrideSightRange={setOverrideSightRange}
          customSightRange={customSightRange}
          setCustomSightRange={setCustomSightRange}
          selectedModeId={selectedModeId}
          setSelectedModeId={setSelectedModeId}
          gameModes={gameModes}
          setEditingRules={setEditingRules}
          setIsRulesEditorOpen={setIsRulesEditorOpen}
          saveCustomModes={saveCustomModes}
          handleExportRules={handleExportRules}
          setImportString={setImportString}
          setImportError={setImportError}
          setIsImportModalOpen={setIsImportModalOpen}
          turnStyle={turnStyle}
          setTurnStyle={setTurnStyle}
          recNotice={recNotice}
          playersSetup={playersSetup}
          setPlayersSetup={setPlayersSetup}
          updatePlayerSetup={updatePlayerSetup}
          handleRemovePlayer={handleRemovePlayer}
          handleAddPlayer={handleAddPlayer}
          handleStartGame={handleStartGame}
          handleReturnToMenu={handleReturnToMenu}
          currentUser={currentUser}
        />
      )}

      {/* GAME SCREEN */}
      {screen === 'game' && gameState && (
        <GameScreen
          gameState={gameState}
          activePlayer={activePlayer}
          selectedSystemId={selectedSystemId}
          setSelectedSystemId={setSelectedSystemId}
          selectedFleetId={selectedFleetId}
          setSelectedFleetId={setSelectedFleetId}
          onSelectTargetSystem={handleSelectTargetSystem}
          centerOnCoords={centerOnCoords}
          setCenterOnCoords={setCenterOnCoords}
          targetSystem={targetSystem}
          setTargetSystem={setTargetSystem}
          isLoadingGame={isLoadingGame}
          onCancelLoading={handleCancelLoading}
          onEndTurn={handleEndTurn}
          onReturnToMenu={handleReturnToMenu}
          onRenamePlayer={handleRenamePlayer}
          onCancelEndTurn={handleCancelEndTurn}
          activeGameName={activeGameName}
          onRenameGame={handleRenameGame}
          onQueueShip={handleQueueShip}
          onUpgradeSystem={handleUpgradeSystem}
          onDispatchFleet={handleDispatchFleet}
          onRecallFleet={handleRecallFleet}
          onCancelDispatch={handleCancelDispatch}
          onCancelProduction={handleCancelProduction}
          currentUser={currentUser}
          activeGameId={activeGameId}
          gameOwnerEmail={gameOwnerEmail || ''}
          connectedPlayers={connectedPlayers}
          isPlayerLocalToClient={isPlayerLocalToClient}
          onClaimFaction={handleClaimFaction}
          onTogglePlayerLocal={handleTogglePlayerLocal}
          onAssignPlayerEmail={handleAssignPlayerEmail}
          soundMuted={soundMuted}
          onToggleSoundMuted={toggleSoundMuted}
          homePendingRequests={homePendingRequests}
          setHomePendingRequests={setHomePendingRequests}
          joinPanelGameId={joinPanelGameId}
          setJoinPanelGameId={setJoinPanelGameId}
          joinAssignSlot={joinAssignSlot}
          setJoinAssignSlot={setJoinAssignSlot}
          acceptJoinRequest={acceptJoinRequest}
          rejectJoinRequest={rejectJoinRequest}
          loadGameFromId={loadGameFromId}
          showToast={showToast}
          showError={(msg) => {
            setAlertMsg(msg);
            setTimeout(() => setAlertMsg(null), 5000);
          }}
        />
      )}

      {/* PASS TURN SCREEN */}
      {screen === 'pass-turn' && (
        <PassTurnScreen
          nextHumanPlayer={nextHumanPlayer}
          gameState={gameState}
          onStartTurn={() => setScreen('game')}
          onCancelEndTurn={handleCancelEndTurn}
        />
      )}

      {/* GAME OVER SCREEN */}
      {screen === 'game-over' && (
        <GameOverScreen
          winnerInfo={getWinnerInfo()}
          onReturnToMenu={handleReturnToMenu}
        />
      )}

      {/* SETTINGS SCREEN */}
      {screen === 'settings' && (
        <SettingsScreen
          currentUser={currentUser}
          settingsDisplayName={settingsDisplayName}
          setSettingsDisplayName={setSettingsDisplayName}
          settingsNewPassword={settingsNewPassword}
          setSettingsNewPassword={setSettingsNewPassword}
          settingsConfirmPassword={settingsConfirmPassword}
          setSettingsConfirmPassword={setSettingsConfirmPassword}
          passwordStatusMessage={passwordStatusMessage}
          setPasswordStatusMessage={setPasswordStatusMessage}
          passwordStatusType={passwordStatusType}
          setPasswordStatusType={setPasswordStatusType}
          onSaveSettings={handleSaveSettings}
          onCancel={() => {
            setPasswordStatusMessage(null);
            setPasswordStatusType(null);
            setSettingsNewPassword('');
            setSettingsConfirmPassword('');
            setScreen('menu');
          }}
          onShowError={(msg) => {
            setAlertMsg(msg);
            setTimeout(() => setAlertMsg(null), 5000);
          }}
          onShowToast={showToast}
          onSetCurrentUser={setCurrentUser}
          onNavigateMenu={() => setScreen('menu')}
        />
      )}

      {/* TERMS OF SERVICE SCREEN */}
      {screen === 'terms' && (
        <>
          <div className="space-bg" />
          <TermsOfService onBack={() => setScreen('menu')} />
        </>
      )}

      {/* PRIVACY POLICY SCREEN */}
      {screen === 'privacy' && (
        <>
          <div className="space-bg" />
          <PrivacyPolicy onBack={() => setScreen('menu')} />
        </>
      )}

      {/* FOOTER */}
      {(screen === 'menu' || screen === 'lobby' || screen === 'game-over' || screen === 'settings' || screen === 'terms' || screen === 'privacy') && (
        <Footer onNavigate={(target) => setScreen(target as any)} />
      )}

      {/* AUTH MODAL */}
      <AuthModal
        isOpen={isAuthModalOpen}
        authTab={authTab}
        authEmail={authEmail}
        authPassword={authPassword}
        authError={authError}
        authSuccess={authSuccess}
        isGoogleAuthEnabled={isGoogleAuthEnabled}
        onClose={() => setIsAuthModalOpen(false)}
        onSetTab={setAuthTab}
        onSetEmail={setAuthEmail}
        onSetPassword={setAuthPassword}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />

      {/* DELETE GAME MODAL */}
      <DeleteGameModal
        gameToDelete={gameToDelete}
        onClose={() => setGameToDelete(null)}
        onDeleted={() => loadGamesList(true)}
        onShowError={(msg) => {
          setAlertMsg(msg);
          setTimeout(() => setAlertMsg(null), 5000);
        }}
      />

      {/* RULES EDITOR MODAL */}
      <RulesEditorModal
        isOpen={isRulesEditorOpen}
        editingRules={editingRules}
        editorErrors={editorErrors}
        newShipTypeKey={newShipTypeKey}
        onSetEditingRules={setEditingRules}
        onSetNewShipTypeKey={setNewShipTypeKey}
        onSaveRules={handleSaveRules}
        onClose={() => {
          setIsRulesEditorOpen(false);
          setEditingRules(null);
        }}
      />

      {/* IMPORT RULES MODAL */}
      <ImportRulesModal
        isOpen={isImportModalOpen}
        importString={importString}
        importError={importError}
        onSetImportString={setImportString}
        onProcessImport={handleProcessImport}
        onClose={() => setIsImportModalOpen(false)}
      />

      {/* IMPORT PREVIEW MODAL */}
      <ImportPreviewModal
        isOpen={isImportPreviewOpen}
        importRulesPreview={importRulesPreview}
        importOriginalVersion={importOriginalVersion}
        importPreviewErrors={importPreviewErrors}
        newImportShipTypeKey={newImportShipTypeKey}
        onSetImportRulesPreview={setImportRulesPreview}
        onSetNewImportShipTypeKey={setNewImportShipTypeKey}
        onConfirmImport={handleConfirmImport}
        onClose={() => {
          setIsImportPreviewOpen(false);
          setImportRulesPreview(null);
        }}
      />
    </div>
  );
}
