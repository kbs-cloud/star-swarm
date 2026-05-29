import React, { useState } from 'react';
import {
  initializeGame,
  processTurnEnd,
  dispatchFleet,
  recallFleet,
  upgradeSystem,
  queueShipProduction,
  GameState,
  StarSystem,
  FACTION_INFO
} from './game/gameState';
import { runAITurn } from './game/ai';
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

type Screen = 'menu' | 'lobby' | 'game' | 'pass-turn' | 'game-over';

interface PlayerSetup {
  id: number;
  name: string;
  type: 'human' | 'ai';
  team: number;
  color?: string;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameMode, setGameMode] = useState<'skirmish' | 'hotseat'>('skirmish');
  const [gridSize, setGridSize] = useState<number>(60);
  const [systemCount, setSystemCount] = useState<number>(18);
  
  // Players configuration setup
  const [playersSetup, setPlayersSetup] = useState<PlayerSetup[]>([
    { id: 1, name: 'Vanguard (You)', type: 'human', team: 1, color: '#00f0ff' },
    { id: 2, name: 'Nebula AI', type: 'ai', team: 2, color: '#ff007f' },
    { id: 3, name: 'Solar AI', type: 'ai', team: 3, color: '#ffaa00' },
    { id: 4, name: 'Void AI', type: 'ai', team: 4, color: '#39ff14' }
  ]);

  const [gameState, setGameState] = useState<GameState | null>(null);
  
  // Selection states
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null);
  const [selectedFleetId, setSelectedFleetId] = useState<string | null>(null);
  const [targetSystem, setTargetSystem] = useState<StarSystem | null>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  // Transition tracking
  const [nextHumanPlayer, setNextHumanPlayer] = useState<PlayerSetup | null>(null);

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

  // Map settings notice
  const [recNotice, setRecNotice] = useState<string | null>(null);

  // Initialize CSRF and restore session cookie on mount
  React.useEffect(() => {
    const bootstrap = async () => {
      await initCSRF();
      const user = await checkSession();
      if (user) {
        setCurrentUser(user);
      }
    };
    bootstrap();
  }, []);

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
      name: gameMode === 'skirmish' ? factionDefaults.name + ' AI' : `Admiral ${String.fromCharCode(64 + nextId)}`,
      type: gameMode === 'skirmish' ? 'ai' : 'human',
      team: factionDefaults.team,
      color: factionDefaults.color
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
          ? (gameMode === 'skirmish' 
              ? (newId === 1 ? 'Vanguard (You)' : `${factionDefaults.name.split(' ')[0]} AI`)
              : `Admiral ${String.fromCharCode(64 + newId)}`)
          : p.name,
        color: factionDefaults.color
      };
    });
    setPlayersSetup(reindexed);
    applyRecommendations(reindexed.length);
  };

  // Start new game
  const handleStartGame = () => {
    if (systemCount < playersSetup.length) {
      showError(`Insufficient clusters! Must have at least ${playersSetup.length} systems for this faction count.`);
      return;
    }
    const initialized = initializeGame({
      gridWidth: gridSize,
      gridHeight: gridSize,
      numSystems: systemCount,
      players: playersSetup
    });
    setGameState(initialized);
    setSelectedSystemId(null);
    setSelectedFleetId(null);
    setTargetSystem(null);
    setScreen('game');
  };

  // Configure setup based on skirmish or hotseat
  const handleModeChange = (mode: 'skirmish' | 'hotseat') => {
    setGameMode(mode);
    let newSetup: PlayerSetup[] = [];
    if (mode === 'skirmish') {
      newSetup = [
        { id: 1, name: 'Vanguard (You)', type: 'human', team: 1, color: '#00f0ff' },
        { id: 2, name: 'Nebula AI', type: 'ai', team: 2, color: '#ff007f' },
        { id: 3, name: 'Solar AI', type: 'ai', team: 3, color: '#ffaa00' },
        { id: 4, name: 'Void AI', type: 'ai', team: 4, color: '#39ff14' }
      ];
    } else {
      newSetup = [
        { id: 1, name: 'Admiral Alpha', type: 'human', team: 1, color: '#00f0ff' },
        { id: 2, name: 'Admiral Beta', type: 'human', team: 2, color: '#ff007f' },
        { id: 3, name: 'Nebula AI', type: 'ai', team: 3, color: '#ffaa00' },
        { id: 4, name: 'Void AI', type: 'ai', team: 4, color: '#39ff14' }
      ];
    }
    setPlayersSetup(newSetup);
    applyRecommendations(newSetup.length);
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
    } else {
      setAuthError(res.message);
    }
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
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

  if (!gameState && screen === 'game') return null;

  const activePlayer = gameState ? gameState.players[gameState.activePlayerIdx] : null;

  // Handle ship scheduling / queuing
  const handleQueueShip = (shipType: string) => {
    if (!gameState || !activePlayer || selectedSystemId === null) return;
    const stateCopy = { ...gameState };
    const res = queueShipProduction(stateCopy, activePlayer.id, selectedSystemId, shipType);
    if (res.success) {
      setGameState(stateCopy);
    } else {
      showError(res.reason || 'Failed to queue ship production.');
    }
  };

  // Handle upgrade trigger
  const handleUpgradeSystem = (upgradeType: string, systemId?: number) => {
    if (!gameState || !activePlayer) return;
    const stateCopy = { ...gameState };
    const res = upgradeSystem(stateCopy, activePlayer.id, systemId || 0, upgradeType);
    if (res.success) {
      setGameState(stateCopy);
    } else {
      showError(res.reason || 'Failed to apply upgrade.');
    }
  };

  // Handle fleet dispatch
  const handleDispatchFleet = (destSysId: number, ships: Record<string, number>) => {
    if (!gameState || !activePlayer || selectedSystemId === null) return;
    const stateCopy = { ...gameState };
    const res = dispatchFleet(stateCopy, activePlayer.id, selectedSystemId, destSysId, ships);
    if (res.success) {
      setGameState(stateCopy);
      setSelectedSystemId(null);
    } else {
      showError(res.reason || 'Failed to dispatch fleet.');
    }
  };

  // Handle fleet recall
  const handleRecallFleet = (fleetId: string) => {
    if (!gameState || !activePlayer) return;
    const stateCopy = { ...gameState };
    const res = recallFleet(stateCopy, activePlayer.id, fleetId);
    if (res.success) {
      setGameState(stateCopy);
      setSelectedFleetId(null);
    } else {
      showError(res.reason || 'Failed to cancel fleet travel.');
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
  const handleEndTurn = () => {
    if (!gameState) return;
    const stateCopy = { ...gameState };
    
    // Clear selection UI
    setSelectedSystemId(null);
    setSelectedFleetId(null);
    setTargetSystem(null);

    // Get next player
    let nextIdx = stateCopy.activePlayerIdx;
    let fullRoundCompleted = false;

    do {
      nextIdx = (nextIdx + 1) % stateCopy.players.length;
      if (nextIdx === 0) {
        fullRoundCompleted = true;
      }

      // If full round completed, run processTurnEnd (moves fleets, resolves battle, income)
      if (fullRoundCompleted) {
        processTurnEnd(stateCopy);
        fullRoundCompleted = false; // reset for multi-round AI skips
      }

      const nextPlayer = stateCopy.players[nextIdx];
      const pState = stateCopy.playerState[nextPlayer.id];

      // If player is not lost, check type
      if (!pState.lost) {
        if (nextPlayer.type === 'ai') {
          // Simulate AI Actions immediately
          runAITurn(stateCopy, nextPlayer.id);
        } else {
          // It's a Human Player's Turn!
          stateCopy.activePlayerIdx = nextIdx;
          
          if (checkGameOver(stateCopy)) {
            setGameState(stateCopy);
            setScreen('game-over');
            recordStats(stateCopy);
            return;
          }

          // If hotseat, show secrecy overlay
          if (gameMode === 'hotseat') {
            setGameState(stateCopy);
            setNextHumanPlayer(nextPlayer);
            setScreen('pass-turn');
            return;
          }

          // In single player/skirmish against AI, we just update state and continue
          setGameState(stateCopy);
          return;
        }
      }
    } while (nextIdx !== stateCopy.activePlayerIdx);

    // If we get here, only AI played or we circled back. Update state.
    if (checkGameOver(stateCopy)) {
      setGameState(stateCopy);
      setScreen('game-over');
      recordStats(stateCopy);
      return;
    }

    setGameState(stateCopy);
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

      {/* AUTHENTICATION HUD OVERLAY (Only visible in menus/lobby) */}
      {(screen === 'menu' || screen === 'lobby' || screen === 'game-over') && (
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
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px' }}>COMMAND CODES ACTIVE</div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
                  {currentUser.email}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }} className="telemetry">
                  RECORD: {currentUser.stats.gamesWon}W - {currentUser.stats.gamesPlayed - currentUser.stats.gamesWon}L
                </div>
              </div>
              <button className="btn-sci-fi btn-danger" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={handleLogout}>
                LOG OUT
              </button>
            </div>
          ) : (
            <button className="btn-sci-fi" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => { clearAuthInputs(); setIsAuthModalOpen(true); }}>
              ESTABLISH COMMAND LINK
            </button>
          )}
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
          position: 'relative'
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
            width: '450px',
            padding: '30px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }} className="glass-panel glass-panel-neon-cyan">
            <h2 style={{ fontSize: '18px', textAlign: 'center', color: 'var(--accent-cyan)' }}>INITIALIZE SYSTEM BOOT</h2>
            
            <button className="btn-sci-fi" style={{ justifyContent: 'center' }} onClick={() => { handleModeChange('skirmish'); setScreen('lobby'); }}>
              AI SKIRMISH MATCH
            </button>
            <button className="btn-sci-fi" style={{ justifyContent: 'center' }} onClick={() => { handleModeChange('hotseat'); setScreen('lobby'); }}>
              LOCAL MULTIPLAYER (HOTSEAT)
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
                      gridTemplateColumns: '30px 1.5fr 1fr 1fr 40px',
                      gap: '10px',
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
                        onChange={(e) => updatePlayerSetup(idx, 'type', e.target.value as 'human' | 'ai')}
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
              <button className="btn-sci-fi btn-danger" onClick={() => setScreen('menu')}>
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
          />
          <Dashboard
            gameState={gameState}
            activePlayerId={activePlayer?.id || 1}
            selectedSystemId={selectedSystemId}
            selectedFleetId={selectedFleetId}
            onEndTurn={handleEndTurn}
            onQueueShip={handleQueueShip}
            onUpgradeSystem={handleUpgradeSystem}
            onDispatchFleet={handleDispatchFleet}
            onRecallFleet={handleRecallFleet}
            targetSystem={targetSystem}
            setTargetSystem={setTargetSystem}
          />
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
            <button className="btn-sci-fi" style={{ justifyContent: 'center', margin: '10px auto 0' }} onClick={() => setScreen('game')}>
              INITIALIZE COMMAND HUD
            </button>
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

            <button className="btn-sci-fi" style={{ justifyContent: 'center' }} onClick={() => setScreen('menu')}>
              RETURN TO COMMAND CENTER
            </button>
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
    </div>
  );
}
