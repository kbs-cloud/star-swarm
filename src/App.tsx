import React, { useState } from 'react';
import {
  initializeGame,
  processTurnEnd,
  dispatchFleet,
  recallFleet,
  upgradeSystem,
  queueShipProduction,
  GameState,
  StarSystem
} from './game/gameState';
import { runAITurn } from './game/ai';
import { StarMap } from './components/StarMap';
import { Dashboard } from './components/Dashboard';

type Screen = 'menu' | 'lobby' | 'game' | 'pass-turn' | 'game-over';

interface PlayerSetup {
  id: number;
  name: string;
  type: 'human' | 'ai';
  team: number;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameMode, setGameMode] = useState<'skirmish' | 'hotseat'>('skirmish');
  const [gridSize, setGridSize] = useState<number>(60);
  const [systemCount, setSystemCount] = useState<number>(18);
  
  // Players configuration setup
  const [playersSetup, setPlayersSetup] = useState<PlayerSetup[]>([
    { id: 1, name: 'Vanguard (You)', type: 'human', team: 1 },
    { id: 2, name: 'Nebula AI', type: 'ai', team: 2 },
    { id: 3, name: 'Solar AI', type: 'ai', team: 3 },
    { id: 4, name: 'Void AI', type: 'ai', team: 4 }
  ]);

  const [gameState, setGameState] = useState<GameState | null>(null);
  
  // Selection states
  const [selectedSystemId, setSelectedSystemId] = useState<number | null>(null);
  const [selectedFleetId, setSelectedFleetId] = useState<string | null>(null);
  const [targetSystem, setTargetSystem] = useState<StarSystem | null>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  // Transition tracking
  const [nextHumanPlayer, setNextHumanPlayer] = useState<PlayerSetup | null>(null);

  // Start new game
  const handleStartGame = () => {
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
    if (mode === 'skirmish') {
      setPlayersSetup([
        { id: 1, name: 'Vanguard (You)', type: 'human', team: 1 },
        { id: 2, name: 'Nebula AI', type: 'ai', team: 2 },
        { id: 3, name: 'Solar AI', type: 'ai', team: 3 },
        { id: 4, name: 'Void AI', type: 'ai', team: 4 }
      ]);
    } else {
      setPlayersSetup([
        { id: 1, name: 'Admiral Alpha', type: 'human', team: 1 },
        { id: 2, name: 'Admiral Beta', type: 'human', team: 2 },
        { id: 3, name: 'Nebula AI', type: 'ai', team: 3 },
        { id: 4, name: 'Void AI', type: 'ai', team: 4 }
      ]);
    }
  };

  // Adjust player setup
  const updatePlayerSetup = (index: number, key: keyof PlayerSetup, value: any) => {
    setPlayersSetup(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
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
                    min="8"
                    max="25"
                    value={systemCount}
                    onChange={(e) => setSystemCount(parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
                  />
                  <span className="telemetry" style={{ width: '60px', textAlign: 'right' }}>{systemCount} bases</span>
                </div>
              </div>
            </div>

            <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.08)' }} />

            {/* PLAYERS LIST CONFIG */}
            <div>
              <h3 style={{ fontSize: '14px', marginBottom: '10px', color: 'var(--text-primary)' }}>FACTIONS & TEAM MAPPING</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {playersSetup.map((player, idx) => (
                  <div key={player.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 1fr 1fr',
                    gap: '10px',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.02)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}>
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
                      disabled={player.type === 'ai'}
                    />
                    
                    {/* Faction Controller Type */}
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      {player.type === 'human' ? '🌐 HUMAN PLAYER' : '🤖 AI FACTION'}
                    </div>

                    {/* Team Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>TEAM:</span>
                      <select
                        value={player.team}
                        onChange={(e) => updatePlayerSetup(idx, 'team', parseInt(e.target.value))}
                        style={{
                          background: 'rgba(0,0,0,0.8)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      >
                        <option value={1}>Team 1</option>
                        <option value={2}>Team 2</option>
                        <option value={3}>Team 3</option>
                        <option value={4}>Team 4</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
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
    </div>
  );
}
