import React, { useState } from 'react';
import { GameState, StarSystem, SHIP_TYPES, UPGRADES, Player, NORMAL_RULES } from '../game/gameState';
import { TacticalReportsPanel } from './dashboard/TacticalReportsPanel';
import { CommandActionsPanel } from './dashboard/CommandActionsPanel';
import { DominionRegistryPanel } from './dashboard/DominionRegistryPanel';
import { ActiveSwarmsPanel } from './dashboard/ActiveSwarmsPanel';
import { TacticalQueuePanel } from './dashboard/TacticalQueuePanel';
import { SystemInspectorPanel } from './dashboard/SystemInspectorPanel';
import { FleetInspectorPanel } from './dashboard/FleetInspectorPanel';
import { FleetDispatchPanel } from './dashboard/FleetDispatchPanel';
import { HyperwavePresencePanel } from './dashboard/HyperwavePresencePanel';

interface DashboardProps {
  gameState: GameState;
  activePlayerId: number;
  selectedSystemId: number | null;
  selectedFleetId: string | null;
  setSelectedSystemId: (id: number | null) => void;
  setSelectedFleetId: (id: string | null) => void;
  onEndTurn: () => void;
  onReturnToMenu: () => void;
  onRenamePlayer: (playerId: number, newName: string) => void;
  onCancelEndTurn?: (playerId: number) => void;
  onQueueShip: (shipType: string) => void;
  onUpgradeSystem: (upgradeType: string, systemId?: number) => void;
  onDispatchFleet: (destSysId: number, ships: Record<string, number>) => void;
  onRecallFleet: (fleetId: string) => void;
  onCancelDispatch: (fleetId: string) => void;
  onCancelProduction: (systemId: number, jobIndex: number) => void;
  onCenterOnCoords: (x: number, y: number) => void;
  targetSystem: StarSystem | null;
  setTargetSystem: (sys: StarSystem | null) => void;
  currentUserEmail: string;
  gameOwnerEmail: string;
  connectedPlayers: string[];
  isPlayerLocalToClient: (player: Player) => boolean;
  onClaimFaction: (playerId: number) => void;
  onTogglePlayerLocal: (playerId: number) => void;
  onAssignPlayerEmail: (playerId: number, email: string) => void;
  gameName: string;
  onRenameGame: (newName: string) => void;
  soundMuted: boolean;
  onToggleSoundMuted: () => void;
  staticBg: boolean;
  onToggleStaticBg: () => void;
  compactMode: boolean;
  isMobile: boolean;
  activeMobileTab: 'map' | 'empire' | 'tactics';
  setActiveMobileTab: (tab: 'map' | 'empire' | 'tactics') => void;
  isSelectingTarget: boolean;
  setIsSelectingTarget: (v: boolean) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  gameState,
  activePlayerId,
  selectedSystemId,
  selectedFleetId,
  setSelectedSystemId,
  setSelectedFleetId,
  onEndTurn,
  onReturnToMenu,
  onRenamePlayer,
  onCancelEndTurn,
  onQueueShip,
  onUpgradeSystem,
  onDispatchFleet,
  onRecallFleet,
  onCancelDispatch,
  onCancelProduction,
  onCenterOnCoords,
  targetSystem,
  setTargetSystem,
  currentUserEmail,
  gameOwnerEmail,
  connectedPlayers,
  isPlayerLocalToClient,
  onClaimFaction,
  onTogglePlayerLocal,
  onAssignPlayerEmail,
  gameName,
  onRenameGame,
  soundMuted,
  onToggleSoundMuted,
  staticBg,
  onToggleStaticBg,
  compactMode,
  isMobile,
  activeMobileTab,
  setActiveMobileTab,
  isSelectingTarget,
  setIsSelectingTarget,
}) => {
  const activePlayer = gameState.playerState[activePlayerId];
  const selectedSystem = gameState.systems.find(s => s.id === selectedSystemId) || null;
  const selectedFleet = gameState.fleets.find(f => f.id === selectedFleetId) || null;
  const activeRules = gameState.rules || NORMAL_RULES;



  const activePlayerSlot = gameState.players.find(p => p.id === activePlayerId) || gameState.players[gameState.activePlayerIdx];
  const isMyTurn = activePlayerSlot && isPlayerLocalToClient(activePlayerSlot) && !activePlayerSlot.endedTurn;

  // State for dispatch quantities
  const [dispatchQty, setDispatchQty] = useState<Record<string, number>>({});

  // Reset dispatch quantities when selected system, target system, or active rules change
  React.useEffect(() => {
    const initialQty: Record<string, number> = {};
    const shipTypes = gameState.rules?.ships || SHIP_TYPES;
    Object.keys(shipTypes).forEach(type => {
      initialQty[type] = 0;
    });
    setDispatchQty(initialQty);
  }, [selectedSystemId, targetSystem?.id, gameState.rules?.id]);

  // State for editing the game name
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(gameName);

  // Sync editedName when gameName prop updates from server polling, but only when not actively editing
  React.useEffect(() => {
    if (!isEditingName) {
      setEditedName(gameName);
    }
  }, [gameName, isEditingName]);

  const handleSaveGameName = () => {
    if (editedName.trim() && editedName.trim() !== gameName) {
      onRenameGame(editedName.trim());
    }
    setIsEditingName(false);
  };

  const handleCancelGameName = () => {
    setEditedName(gameName);
    setIsEditingName(false);
  };

  // State for active combat log expanded index
  const [selectedBattleLogIndex, setSelectedBattleLogIndex] = useState<number | null>(null);
  const [logTab, setLogTab] = useState<'tactical' | 'actions'>('tactical');

  // Collapsible panels for Strategic Command
  const [showDominion, setShowDominion] = useState(true);
  const [showActiveSwarms, setShowActiveSwarms] = useState(true);
  const [showTacticalQueue, setShowTacticalQueue] = useState(true);

  const handleCenterOnHome = (playerId: number) => {
    let homeSystem = gameState.systems.find(s => s.owner === playerId && s.isHomePlanet);
    if (!homeSystem) {
      homeSystem = gameState.systems.find(s => s.owner === playerId);
    }
    if (homeSystem) {
      setSelectedSystemId(homeSystem.id);
      onCenterOnCoords(homeSystem.x, homeSystem.y);
    }
  };

  if (!activePlayer) return null;

  const isMySystem = selectedSystem?.owner === activePlayerId;
  const isMyFleet = selectedFleet?.owner === activePlayerId;



  const executeDispatch = () => {
    if (!targetSystem) return;
    onDispatchFleet(targetSystem.id, dispatchQty);
    const resetQty: Record<string, number> = {};
    const shipTypes = gameState.rules?.ships || SHIP_TYPES;
    Object.keys(shipTypes).forEach(type => {
      resetQty[type] = 0;
    });
    setDispatchQty(resetQty);
    setTargetSystem(null);
  };

  // Get Upgrade Resource Cost calculation
  const getUpgradeCost = (type: string, sys?: StarSystem) => {
    const activeRules = gameState.rules || NORMAL_RULES;
    const upgrades = activeRules.upgrades || UPGRADES;
    const def = upgrades[type];
    if (!def) return 0;
    if (type === 'Hyperdrive') {
      const hyperLvl = activePlayer.tech.Hyperdrive || 0;
      return Math.round(def.baseCost * (def.multiplier ** hyperLvl));
    }
    if (!sys) return 0;
    let lvl = 1;
    if (type === 'Shipyard') lvl = sys.shipyardLvl;
    if (type === 'Sensors') lvl = sys.sensorLvl;
    if (type === 'Shields') lvl = sys.shieldsLvl;
    return Math.round(def.baseCost * (def.multiplier ** (lvl - (type === 'Shields' ? 0 : 1))));
  };



  const ownedSystems = gameState.systems.filter(s => s.owner === activePlayerId);
  const ownedFleets = gameState.fleets.filter(f => f.owner === activePlayerId);
  const cancelableFleets = gameState.fleets.filter(f => f.owner === activePlayerId && f.turnsRemaining === f.totalTurns && !f.isRecalling);
  
  const cancelableBuilds: { systemId: number; systemName: string; job: any; jobIndex: number }[] = [];
  ownedSystems.forEach(sys => {
    if (sys.buildQueue) {
      sys.buildQueue.forEach((job, idx) => {
        cancelableBuilds.push({
          systemId: sys.id,
          systemName: sys.name,
          job,
          jobIndex: idx
        });
      });
    }
  });
  return (
    <div style={{
      width: '100%',
      height: '100%',
      pointerEvents: (isMobile && activeMobileTab !== 'map') ? 'auto' : 'none',
      position: 'absolute',
      top: 0,
      left: 0,
      zIndex: 10
    }}>
      {/* 1. TOP BAR */}
      <div style={isMobile ? {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: window.innerHeight <= 480 ? '4px 10px' : '8px 12px',
        pointerEvents: 'auto',
        borderRadius: 0,
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        height: window.innerHeight <= 480 ? '38px' : '50px'
      } : {
        position: 'absolute',
        top: '20px',
        left: '20px',
        right: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 20px',
        pointerEvents: 'auto'
      }} className="glass-panel glass-panel-neon-cyan">
        {isMobile ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: window.innerHeight <= 480 ? '5px' : '8px' }}>
              <span style={{ fontSize: window.innerHeight <= 480 ? '10px' : '11px', color: 'var(--text-primary)', fontWeight: 'bold' }}>T#{gameState.turnNumber}</span>
              <span 
                onClick={() => handleCenterOnHome(activePlayer.id)}
                title={`Center on ${activePlayer.name}'s Home Planet`}
                style={{
                  width: window.innerHeight <= 480 ? '8px' : '10px',
                  height: window.innerHeight <= 480 ? '8px' : '10px',
                  borderRadius: '50%',
                  background: activePlayer.color || '#ffffff',
                  display: 'inline-block',
                  boxShadow: `0 0 6px ${activePlayer.color || '#ffffff'}`,
                  cursor: 'pointer'
                }}
              />
              <span style={{ fontSize: window.innerHeight <= 480 ? '11px' : '12px', color: isMyTurn ? 'var(--accent-green)' : 'var(--text-secondary)', maxWidth: window.innerHeight <= 480 ? '70px' : '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activePlayer.name}
              </span>
              {activeRules.enableCredits && isMyTurn && (
                <span style={{ fontSize: window.innerHeight <= 480 ? '10px' : '11px', color: 'var(--accent-cyan)', fontFamily: 'Share Tech Mono' }}>
                  {gameState.playerState[activePlayerId]?.resources} CR
                </span>
              )}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: window.innerHeight <= 480 ? '4px' : '6px' }}>
              <button 
                className="btn-sci-fi" 
                onClick={onToggleSoundMuted} 
                style={{ padding: window.innerHeight <= 480 ? '3px 6px' : '6px 8px', fontSize: window.innerHeight <= 480 ? '10px' : '11px' }}
                title={soundMuted ? "Unmute Sound" : "Mute Sound"}
              >
                {soundMuted ? '🔇' : '🔊'}
              </button>
              <button 
                className="btn-sci-fi" 
                onClick={onToggleStaticBg} 
                style={{ padding: window.innerHeight <= 480 ? '3px 6px' : '6px 8px', fontSize: window.innerHeight <= 480 ? '10px' : '11px' }}
                title={staticBg ? "Animate Background" : "Freeze Background (Save CPU)"}
              >
                {staticBg ? '🖼️' : '🌀'}
              </button>
              <button className="btn-sci-fi btn-danger" onClick={onReturnToMenu} style={{ padding: window.innerHeight <= 480 ? '3px 8px' : '6px 10px', fontSize: window.innerHeight <= 480 ? '10px' : '11px', fontWeight: 'bold' }}>
                HOME
              </button>
              <button
                className={`btn-sci-fi ${isMyTurn && !(activePlayerSlot && activePlayerSlot.endedTurn) ? 'pulse-light' : ''}`}
                onClick={onEndTurn}
                style={{ padding: window.innerHeight <= 480 ? '3px 10px' : '6px 12px', fontSize: window.innerHeight <= 480 ? '10px' : '11px', fontWeight: 'bold' }}
                disabled={!isMyTurn || !!(activePlayerSlot && activePlayerSlot.endedTurn)}
              >
                END
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              {/* MY FACTION IDENTITY — always shows who THIS logged-in user is */}
              {(() => {
                // Check if active player is local first (e.g. local hotseat/sequential turn), then try email match, then fall back to host's local flag
                const myPlayer = (activePlayerSlot && isPlayerLocalToClient(activePlayerSlot))
                  ? activePlayerSlot
                  : (gameState.players.find(p => p.assignedEmail === currentUserEmail)
                     || (gameOwnerEmail === currentUserEmail ? gameState.players.find(p => p.isLocal) : undefined));
                const myState = myPlayer ? gameState.playerState[myPlayer.id] : null;
                const dotColor = myPlayer?.color || myState?.color || '#888';
                return (
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '2px' }}>
                      COMMANDER
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {myPlayer ? (
                        <>
                          <span 
                            onClick={() => handleCenterOnHome(myPlayer.id)}
                            title="Center on Home Planet"
                            style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              background: dotColor,
                              display: 'inline-block',
                              boxShadow: `0 0 8px ${dotColor}`,
                              cursor: 'pointer',
                              transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.transform = 'scale(1.3)';
                              e.currentTarget.style.boxShadow = `0 0 12px 3px ${dotColor}`;
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.boxShadow = `0 0 8px ${dotColor}`;
                            }}
                          />
                          <span style={{ color: 'white' }}>{myPlayer.name}</span>
                          {myState && !myState.lost && activeRules.enableCredits && (
                            <span style={{ fontSize: '12px', color: 'var(--accent-cyan)', fontFamily: 'Share Tech Mono', marginLeft: '4px' }}>
                              {myState.resources} CR
                            </span>
                          )}
                          {myState?.lost && (
                            <span style={{ fontSize: '10px', color: 'var(--accent-magenta)', fontFamily: 'Share Tech Mono' }}>[ELIMINATED]</span>
                          )}
                        </>
                      ) : (
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Observer</span>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.15)' }} />

              {/* ACTIVE FACTION — whose turn it currently is */}
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '2px' }}>
                  {isMyTurn ? '▶ YOUR TURN' : 'ACTIVE FACTION'}
                </div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span 
                    onClick={() => handleCenterOnHome(activePlayer.id)}
                    title={`Center on ${activePlayer.name}'s Home Planet`}
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: activePlayer.color || '#ffffff',
                      display: 'inline-block',
                      boxShadow: `0 0 8px ${activePlayer.color || '#ffffff'}`,
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'scale(1.3)';
                      e.currentTarget.style.boxShadow = `0 0 12px 3px ${activePlayer.color || '#ffffff'}`;
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = `0 0 8px ${activePlayer.color || '#ffffff'}`;
                    }}
                  />
                  <span style={{ color: isMyTurn ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                    {activePlayer.name}
                  </span>
                </div>
              </div>
              
              {activeRules.enableUpgrades && isMyTurn && (
                <>
                  <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.1)' }} />
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>HYPERDRIVE GLOBAL TECH</div>
                    <div className="telemetry" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      LVL {activePlayer.tech.Hyperdrive || 0}
                      <button
                        className="btn-sci-fi"
                        style={{ padding: '2px 8px', fontSize: '10px' }}
                        onClick={() => onUpgradeSystem('Hyperdrive')}
                        disabled={activeRules.enableCredits && activePlayer.resources < getUpgradeCost('Hyperdrive')}
                      >
                        UPGRADE {activeRules.enableCredits ? `(${getUpgradeCost('Hyperdrive')} CR)` : ''}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* GAME NAME INTERACTIVE SUB-PANEL */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 12px',
              borderRadius: '4px',
              background: isEditingName ? 'rgba(0, 0, 0, 0.4)' : 'transparent',
              border: isEditingName ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid transparent',
              boxShadow: isEditingName ? '0 0 10px rgba(0, 240, 255, 0.1)' : 'none',
              transition: 'all 0.2s ease',
              pointerEvents: 'auto',
              margin: '0 20px',
              flex: '1',
              justifyContent: 'center',
              minWidth: 0
            }}>
              {isEditingName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveGameName();
                      if (e.key === 'Escape') handleCancelGameName();
                    }}
                    autoFocus
                    style={{
                      background: 'rgba(5, 3, 13, 0.85)',
                      border: '1px solid var(--accent-cyan)',
                      color: 'white',
                      fontFamily: 'Share Tech Mono, monospace',
                      fontSize: '14px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      outline: 'none',
                      boxShadow: '0 0 8px rgba(0, 240, 255, 0.2)',
                      minWidth: '150px',
                      maxWidth: '280px'
                    }}
                  />
                  <button
                    onClick={handleSaveGameName}
                    title="Save Name"
                    style={{
                      background: 'rgba(0, 240, 255, 0.15)',
                      border: '1px solid var(--accent-cyan)',
                      color: 'var(--accent-cyan)',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s'
                    }}
                  >
                    ✓
                  </button>
                  <button
                    onClick={handleCancelGameName}
                    title="Cancel"
                    style={{
                      background: 'rgba(255, 0, 127, 0.15)',
                      border: '1px solid var(--accent-magenta)',
                      color: 'var(--accent-magenta)',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div 
                    onClick={() => setIsEditingName(true)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      cursor: 'pointer',
                      userSelect: 'none',
                      minWidth: 0
                    }}
                    title="Click to rename game"
                  >
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 'bold',
                      fontFamily: 'Orbitron, sans-serif',
                      letterSpacing: '1px',
                      color: 'white',
                      textShadow: '0 0 6px rgba(255, 255, 255, 0.15)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '300px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.color = 'var(--accent-cyan)';
                      e.currentTarget.style.textShadow = '0 0 8px rgba(0, 240, 255, 0.4)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.color = 'white';
                      e.currentTarget.style.textShadow = '0 0 6px rgba(255, 255, 255, 0.15)';
                    }}
                    >
                      {gameName || 'UNNAMED SIMULATION'}
                    </span>
                    <span 
                      style={{ 
                        fontSize: '11px', 
                        opacity: 0.5,
                        transition: 'opacity 0.2s',
                      }}
                    >
                      ✏️
                    </span>
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', marginTop: '2px' }}>
                    RULES: {gameState.rules?.name || 'CUSTOM'} · SEED: {gameState.seed || 'NONE'} · SIGHT: {gameState.rules?.starSightRange ?? 6.0} LY
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>GALACTIC TURN</div>
                <div className="telemetry" style={{ fontSize: '16px', fontWeight: 'bold' }}>#{gameState.turnNumber}</div>
              </div>
              <button
                className="btn-sci-fi"
                onClick={onToggleSoundMuted}
                style={{ 
                  padding: '12px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '45px',
                  height: '45px',
                  minWidth: '45px'
                }}
                title={soundMuted ? "Unmute Sound Effects" : "Mute Sound Effects"}
              >
                {soundMuted ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <line x1="23" y1="9" x2="17" y2="15"></line>
                    <line x1="17" y1="9" x2="23" y2="15"></line>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                  </svg>
                )}
              </button>
              <button
                className="btn-sci-fi"
                onClick={onToggleStaticBg}
                style={{ 
                  padding: '12px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '45px',
                  height: '45px',
                  minWidth: '45px'
                }}
                title={staticBg ? "Enable Animated Background" : "Freeze Background (Save CPU)"}
              >
                {staticBg ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                    <line x1="7" y1="2" x2="7" y2="22"></line>
                    <line x1="17" y1="2" x2="17" y2="22"></line>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <line x1="2" y1="7" x2="7" y2="7"></line>
                    <line x1="2" y1="17" x2="7" y2="17"></line>
                    <line x1="17" y1="17" x2="22" y2="17"></line>
                    <line x1="17" y1="7" x2="22" y2="7"></line>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                )}
              </button>
              <button className="btn-sci-fi btn-danger" onClick={onReturnToMenu} style={{ padding: '12px 18px', fontWeight: 'bold' }}>
                HOME
              </button>
              <button
                className={`btn-sci-fi ${isMyTurn && !(activePlayerSlot && activePlayerSlot.endedTurn) ? 'pulse-light' : ''}`}
                onClick={onEndTurn}
                style={{ padding: '12px 24px', fontWeight: 'bold' }}
                disabled={!isMyTurn || !!(activePlayerSlot && activePlayerSlot.endedTurn)}
              >
                END TURN
              </button>
            </div>
          </>
        )}
      </div>

      {/* 2. LEFT SIDE PANEL - SYSTEM OR FLEET MANAGEMENT */}
      <div style={isMobile ? {
        position: 'absolute',
        top: window.innerHeight <= 480 ? '38px' : '50px',
        left: 0,
        right: 0,
        bottom: window.innerHeight <= 480 ? '40px' : '55px',
        display: activeMobileTab === 'empire' ? 'flex' : 'none',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'auto',
        background: 'var(--bg-panel-light)',
        borderRadius: 0,
        border: 'none',
        padding: window.innerHeight <= 480 ? '6px 12px' : '12px',
        overflowY: 'auto'
      } : {
        position: 'absolute',
        top: '90px',
        left: '20px',
        bottom: '20px',
        width: '380px',
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        pointerEvents: 'auto'
      }}>
        {/* star system inspector */}
        {selectedSystem && (
          <SystemInspectorPanel
            selectedSystem={selectedSystem}
            gameState={gameState}
            activePlayerId={activePlayerId}
            setSelectedSystemId={setSelectedSystemId}
            onQueueShip={onQueueShip}
            onUpgradeSystem={onUpgradeSystem}
            onCancelProduction={onCancelProduction}
            getUpgradeCost={getUpgradeCost}
            isMySystem={isMySystem}
            compactMode={compactMode}
          />
        )}

        {/* fleet inspector */}
        {selectedFleet && (
          <FleetInspectorPanel
            selectedFleet={selectedFleet}
            gameState={gameState}
            setSelectedFleetId={setSelectedFleetId}
            onRecallFleet={onRecallFleet}
            isMyFleet={isMyFleet}
          />
        )}

        {/* STRATEGIC CONSOLE (always shown, fills remaining space) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', overflow: 'hidden' }} className="glass-panel">
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>STRATEGIC COMMAND</span>
          <h2 className="text-neon-cyan" style={{ fontSize: '16px', margin: '4px 0 12px' }}>CONCOURSE LOGISTICS</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
            
            {/* DOMINION REGISTRY ACCORDION */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                onClick={() => setShowDominion(!showDominion)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  fontFamily: 'Orbitron',
                  letterSpacing: '1px',
                  color: 'white',
                  userSelect: 'none'
                }}
              >
                <span>🌌 DOMINION REGISTRY <span style={{ color: 'var(--text-muted)' }}>({ownedSystems.length})</span></span>
                <span style={{ transform: showDominion ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▶</span>
              </div>
              
              {showDominion && (
                <DominionRegistryPanel
                  ownedSystems={ownedSystems}
                  selectedSystemId={selectedSystemId}
                  setSelectedSystemId={setSelectedSystemId}
                  setSelectedFleetId={setSelectedFleetId}
                  onCenterOnCoords={onCenterOnCoords}
                  enableCredits={activeRules.enableCredits}
                />
              )}
            </div>

            {/* ACTIVE SWARMS ACCORDION */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                onClick={() => setShowActiveSwarms(!showActiveSwarms)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  fontFamily: 'Orbitron',
                  letterSpacing: '1px',
                  color: 'white',
                  userSelect: 'none'
                }}
              >
                <span>🛸 ACTIVE SWARMS <span style={{ color: 'var(--text-muted)' }}>({ownedFleets.length})</span></span>
                <span style={{ transform: showActiveSwarms ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▶</span>
              </div>
              
              {showActiveSwarms && (
                <ActiveSwarmsPanel
                  ownedFleets={ownedFleets}
                  selectedFleetId={selectedFleetId}
                  setSelectedFleetId={setSelectedFleetId}
                  setSelectedSystemId={setSelectedSystemId}
                  onCenterOnCoords={onCenterOnCoords}
                />
              )}
            </div>

            {/* TACTICAL QUEUE ACCORDION */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                onClick={() => setShowTacticalQueue(!showTacticalQueue)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  fontFamily: 'Orbitron',
                  letterSpacing: '1px',
                  color: 'white',
                  userSelect: 'none'
                }}
              >
                <span>📋 TACTICAL QUEUE <span style={{ color: 'var(--text-muted)' }}>({cancelableFleets.length + cancelableBuilds.length})</span></span>
                <span style={{ transform: showTacticalQueue ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▶</span>
              </div>
              
              {showTacticalQueue && (
                <TacticalQueuePanel
                  cancelableFleets={cancelableFleets}
                  cancelableBuilds={cancelableBuilds}
                  onCancelDispatch={onCancelDispatch}
                  onCancelProduction={onCancelProduction}
                />
              )}
            </div>

          </div>
        </div>
      </div>

      {/* 3. RIGHT SIDE PANEL - FLEET DISPATCH OR COMBAT LOG */}
      <div style={isMobile ? {
        position: 'absolute',
        top: window.innerHeight <= 480 ? '38px' : '50px',
        left: 0,
        right: 0,
        bottom: window.innerHeight <= 480 ? '40px' : '55px',
        display: activeMobileTab === 'tactics' ? 'flex' : 'none',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'auto',
        background: 'var(--bg-panel-light)',
        borderRadius: 0,
        border: 'none',
        padding: window.innerHeight <= 480 ? '6px 12px' : '12px',
        overflowY: 'auto'
      } : {
        position: 'absolute',
        top: '90px',
        right: '20px',
        bottom: '20px',
        width: '380px',
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        pointerEvents: 'auto'
      }}>
        {/* FLEET DISPATCH FORM */}
        {selectedSystem && isMySystem && (
          <FleetDispatchPanel
            selectedSystem={selectedSystem}
            targetSystem={targetSystem}
            setTargetSystem={setTargetSystem}
            dispatchQty={dispatchQty}
            setDispatchQty={setDispatchQty}
            executeDispatch={executeDispatch}
            activeRules={activeRules}
            isMobile={isMobile}
            compactMode={compactMode}
            isSelectingTarget={isSelectingTarget}
            setIsSelectingTarget={setIsSelectingTarget}
            setActiveMobileTab={setActiveMobileTab}
          />
        )}

        {/* HYPERWAVE COMS PRESENCE */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '16px', background: 'rgba(0, 240, 255, 0.03)', border: '1px solid rgba(0, 240, 255, 0.15)' }} className="glass-panel">
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>COMS STATION ACTIVE</span>
          <h2 className="text-neon-cyan" style={{ fontSize: '15px', margin: '4px 0 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📡 HYPERWAVE PRESENCE</span>
          </h2>
          
          <HyperwavePresencePanel
            gameState={gameState}
            connectedPlayers={connectedPlayers}
            gameOwnerEmail={gameOwnerEmail}
            currentUserEmail={currentUserEmail}
            isPlayerLocalToClient={isPlayerLocalToClient}
            onRenamePlayer={onRenamePlayer}
            onTogglePlayerLocal={onTogglePlayerLocal}
            onClaimFaction={onClaimFaction}
            onAssignPlayerEmail={onAssignPlayerEmail}
            onCenterOnCoords={onCenterOnCoords}
            setSelectedSystemId={setSelectedSystemId}
          />
        </div>

        {/* COMBAT AND INTELLIGENCE EVENTS LOG */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', minHeight: 0 }} className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>TACTICAL REPORT LOGS</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn-sci-fi"
                style={{ 
                  padding: '2px 8px', 
                  fontSize: '9px', 
                  background: logTab === 'tactical' ? 'rgba(255, 0, 127, 0.25)' : 'transparent',
                  borderColor: logTab === 'tactical' ? 'var(--accent-magenta)' : 'rgba(255, 255, 255, 0.15)',
                  color: logTab === 'tactical' ? 'white' : 'var(--text-secondary)'
                }}
                onClick={() => setLogTab('tactical')}
              >
                TACTICAL
              </button>
              <button 
                className="btn-sci-fi"
                style={{ 
                  padding: '2px 8px', 
                  fontSize: '9px', 
                  background: logTab === 'actions' ? 'rgba(0, 240, 255, 0.25)' : 'transparent',
                  borderColor: logTab === 'actions' ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.15)',
                  color: logTab === 'actions' ? 'white' : 'var(--text-secondary)'
                }}
                onClick={() => setLogTab('actions')}
              >
                ACTIONS
              </button>
            </div>
          </div>
          <h2 className="text-neon-magenta" style={{ fontSize: '18px', margin: '0 0 10px 0' }}>GALACTIC TELEMETRY</h2>
          {logTab === 'tactical' ? (
            <TacticalReportsPanel
              gameState={gameState}
              activePlayerId={activePlayerId}
              selectedBattleLogIndex={selectedBattleLogIndex}
              setSelectedBattleLogIndex={setSelectedBattleLogIndex}
            />
          ) : (
            <CommandActionsPanel
              gameState={gameState}
            />
          )}
        </div>
      </div>

      {/* WAITING FOR REMOTE PLAYER OVERLAY */}
      {!isMyTurn && activePlayerSlot && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(5, 10, 20, 0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'auto',
          color: 'white',
          fontFamily: 'Orbitron'
        }}>
          <div style={{
            width: '500px',
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            textAlign: 'center'
          }} className="glass-panel glass-panel-neon-magenta pulse-light">
            <div style={{ fontSize: '48px' }}>📡</div>
            <h2 style={{ fontSize: '24px', color: 'var(--accent-magenta)', letterSpacing: '2px', margin: 0 }}>
              HYPERWAVE SYNC ACTIVE
            </h2>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              We are currently awaiting tactical data submissions from:
              {gameState.turnStyle === 'sequential' ? (
                <>
                  <div style={{
                    fontSize: '22px',
                    fontWeight: 'bold',
                    color: activePlayerSlot.color || 'white',
                    marginTop: '10px',
                    textShadow: `0 0 10px ${activePlayerSlot.color || '#fff'}`
                  }}>
                    {activePlayerSlot.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    ({activePlayerSlot.assignedEmail || 'Unassigned Link'})
                  </div>
                </>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  marginTop: '10px',
                  alignItems: 'center'
                }}>
                  {gameState.players
                    .filter(p => p.type === 'human' && !gameState.playerState[p.id]?.lost && !p.endedTurn)
                    .map(p => (
                      <div key={p.id} style={{
                        fontSize: '20px',
                        fontWeight: 'bold',
                        color: p.color || 'white',
                        textShadow: `0 0 10px ${p.color || '#fff'}`
                      }}>
                        {p.name} {p.assignedEmail ? `(${p.assignedEmail})` : '(Local)'}
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.08)' }} />

            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                COMMAND STATUS ARRAY
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {gameState.players.map(p => {
                  if (p.type !== 'human') return null;
                  const pState = gameState.playerState[p.id];
                  if (pState?.lost) return null;
                  
                  const isOnline = (p.assignedEmail && connectedPlayers.includes(p.assignedEmail)) || (p.id === 1 && connectedPlayers.includes(gameOwnerEmail));
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: p.color || 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span 
                          onClick={() => handleCenterOnHome(p.id)}
                          title={`Center on ${p.name}'s Home Planet`}
                          style={{ 
                            width: '8px', 
                            height: '8px', 
                            borderRadius: '50%', 
                            background: p.color,
                            cursor: 'pointer',
                            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                            display: 'inline-block',
                            boxShadow: `0 0 4px ${p.color}`
                          }} 
                          onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'scale(1.4)';
                            e.currentTarget.style.boxShadow = `0 0 8px 2px ${p.color}`;
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = `0 0 4px ${p.color}`;
                          }}
                        />
                        {p.name}
                      </span>
                      <span className="telemetry" style={{ color: p.endedTurn ? 'var(--accent-green)' : 'var(--accent-yellow)' }}>
                        {p.endedTurn ? '✓ SUBMITTED' : (isOnline ? '⚡ TRANSMITTING...' : '🔴 OFFLINE')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cancel Turn End Button */}
            {(() => {
              const myPlayer = (activePlayerSlot && isPlayerLocalToClient(activePlayerSlot))
                ? activePlayerSlot
                : (gameState.players.find(p => p.assignedEmail === currentUserEmail)
                   || (gameOwnerEmail === currentUserEmail ? gameState.players.find(p => p.isLocal) : undefined));
              const activeHumans = gameState.players.filter(p => p.type === 'human' && !gameState.playerState[p.id]?.lost);
              const othersPending = activeHumans.some(p => p.id !== myPlayer?.id && !p.endedTurn);
              if (myPlayer && myPlayer.endedTurn && othersPending && onCancelEndTurn && gameState.turnStyle !== 'sequential') {
                return (
                  <div style={{ width: '100%' }}>
                    <button
                      className="btn-sci-fi btn-danger animate-pulse"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => onCancelEndTurn(myPlayer.id)}
                    >
                      CANCEL END TURN (RESUME TACTICAL ORDERS)
                    </button>
                    <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.08)', margin: '15px 0' }} />
                  </div>
                );
              }
              return null;
            })()}

            {/* Owner action: can force player to local to take turn for them */}
            {gameOwnerEmail === currentUserEmail && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.08)', marginBottom: '15px' }} />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  GAME OWNER DIRECTIVES
                </div>
                <button
                  className="btn-sci-fi"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => onTogglePlayerLocal(activePlayerSlot.id)}
                >
                  FORCE LOCAL CONTROL (TAKE OVER TURN)
                </button>
              </div>
            )}
            
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }} className="telemetry animate-pulse">
              [COMM CODES SYNCING IN BACKGROUND...]
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION TAB BAR */}
      {isMobile && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: window.innerHeight <= 480 ? '40px' : '55px',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          background: 'rgba(10, 7, 24, 0.95)',
          borderTop: '1px solid rgba(0, 240, 255, 0.25)',
          boxShadow: '0 -4px 15px rgba(0, 240, 255, 0.1)',
          pointerEvents: 'auto',
          zIndex: 100
        }}>
          <button 
            onClick={() => setActiveMobileTab('map')}
            style={{
              flex: 1,
              height: '100%',
              background: 'transparent',
              border: 'none',
              color: activeMobileTab === 'map' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: window.innerHeight <= 480 ? '2px' : '4px',
              fontFamily: 'Share Tech Mono',
              fontSize: window.innerHeight <= 480 ? '9px' : '11px',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontSize: window.innerHeight <= 480 ? '14px' : '18px' }}>🗺️</span>
            <span>MAP</span>
          </button>
          
          <button 
            onClick={() => setActiveMobileTab('empire')}
            style={{
              flex: 1,
              height: '100%',
              background: 'transparent',
              border: 'none',
              color: activeMobileTab === 'empire' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: window.innerHeight <= 480 ? '2px' : '4px',
              fontFamily: 'Share Tech Mono',
              fontSize: window.innerHeight <= 480 ? '9px' : '11px',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontSize: window.innerHeight <= 480 ? '14px' : '18px' }}>🌌</span>
            <span>EMPIRE</span>
          </button>
          
          <button 
            onClick={() => setActiveMobileTab('tactics')}
            style={{
              flex: 1,
              height: '100%',
              background: 'transparent',
              border: 'none',
              color: activeMobileTab === 'tactics' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: window.innerHeight <= 480 ? '2px' : '4px',
              fontFamily: 'Share Tech Mono',
              fontSize: window.innerHeight <= 480 ? '9px' : '11px',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontSize: window.innerHeight <= 480 ? '14px' : '18px' }}>📋</span>
            <span>TACTICS</span>
          </button>
        </div>
      )}
    </div>
  );
};
