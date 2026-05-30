import React, { useState } from 'react';
import { GameState, StarSystem, SHIP_TYPES, UPGRADES, Player, NORMAL_RULES } from '../game/gameState';

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

  // Max build capacity
  const maxBuildCapacity = selectedSystem ? selectedSystem.shipyardLvl + 1 : 0;

  // Handle setting maximum quantity of ships to dispatch
  const handleSetMaxDispatch = (shipType: string) => {
    if (!selectedSystem) return;
    const maxQty = selectedSystem.ships[shipType] || 0;
    setDispatchQty(prev => ({ ...prev, [shipType]: maxQty }));
  };

  // Handle input adjustment
  const handleDispatchQtyChange = (shipType: string, val: number) => {
    if (!selectedSystem) return;
    const maxQty = selectedSystem.ships[shipType] || 0;
    const qty = Math.max(0, Math.min(maxQty, val));
    setDispatchQty(prev => ({ ...prev, [shipType]: qty }));
  };

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

  const renderCombatLog = () => {
    const myTeam = activePlayerId ? gameState.playerState[activePlayerId]?.team : null;
    const visibleLogs = gameState.combatLog.filter(log => {
      if (log.type === 'battle') {
        const attackerTeam = log.attacker ? gameState.playerState[log.attacker]?.team : null;
        const defenderTeam = (log.defender && log.defender !== 0) ? gameState.playerState[log.defender]?.team : null;
        return (
          log.attacker === activePlayerId ||
          (attackerTeam !== null && attackerTeam === myTeam) ||
          log.defender === activePlayerId ||
          (defenderTeam !== null && defenderTeam === myTeam)
        );
      }
      if (log.type === 'merge') {
        const mergePlayerTeam = log.playerId ? gameState.playerState[log.playerId]?.team : null;
        return (
          log.playerId === activePlayerId ||
          (mergePlayerTeam !== null && mergePlayerTeam === myTeam)
        );
      }
      if (log.type === 'elimination') {
        return true;
      }
      return false;
    });

    if (visibleLogs.length === 0) {
      return <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No tactical reports recorded.</div>;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
        {visibleLogs.map((log, idx) => {
          if (log.type === 'battle' && log.results) {
            const r = log.results;
            const attackerColor = gameState.playerState[r.attackerId]?.color || '#ffffff';
            const defenderColor = gameState.playerState[r.defenderId]?.color || '#ffffff';
            const isWinnerAttacker = r.winner === r.attackerId;
            const systemName = log.systemName;

            return (
              <div key={idx} style={{
                background: 'rgba(255, 0, 127, 0.05)',
                border: '1px solid rgba(255, 0, 127, 0.15)',
                borderRadius: '6px',
                padding: '8px',
                fontSize: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    BATTLE: <strong style={{ color: attackerColor }}>F{r.attackerId}</strong> vs{' '}
                    <strong style={{ color: defenderColor }}>F{r.defenderId}</strong> at {systemName}
                  </span>
                  <button
                    className="btn-sci-fi"
                    style={{ padding: '2px 6px', fontSize: '9px' }}
                    onClick={() => setSelectedBattleLogIndex(selectedBattleLogIndex === idx ? null : idx)}
                  >
                    {selectedBattleLogIndex === idx ? 'HIDE' : 'LOGS'}
                  </button>
                </div>
                <div style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
                  Winner: <strong style={{ color: isWinnerAttacker ? attackerColor : defenderColor }}>
                    {isWinnerAttacker ? 'Attacker' : 'Defender'}
                  </strong>
                </div>

                {selectedBattleLogIndex === idx && (
                  <div style={{
                    marginTop: '8px',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    borderTop: '1px solid rgba(255, 0, 127, 0.2)',
                    paddingTop: '6px',
                    fontFamily: 'Share Tech Mono',
                    fontSize: '11px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div>ATTACKER INVENTORY: {Object.entries(r.startAttacker).map(([t, q]) => `${t}:${q}`).join(', ')}</div>
                    <div>DEFENDER INVENTORY: {Object.entries(r.startDefender).map(([t, q]) => `${t}:${q}`).join(', ')}</div>
                    {r.log.map((round, rIdx) => (
                      <div key={rIdx} style={{ color: 'var(--accent-yellow)' }}>
                        Round {round.round}: Hits A:{round.attackerHits} / D:{round.defenderHits}
                      </div>
                    ))}
                    <div style={{ color: 'var(--accent-green)' }}>
                      Surviving Attacker: {Object.entries(r.endAttacker).map(([t, q]) => `${t}:${q}`).join(', ')}
                    </div>
                    <div style={{ color: 'var(--accent-cyan)' }}>
                      Surviving Defender: {Object.entries(r.endDefender).map(([t, q]) => `${t}:${q}`).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          if (log.type === 'merge') {
            const faction = gameState.playerState[log.playerId || 0] || { name: 'Neutral / Independent', color: '#8ba2b5' };
            return (
              <div key={idx} style={{
                background: 'rgba(0, 240, 255, 0.03)',
                border: '1px solid rgba(0, 240, 255, 0.08)',
                borderRadius: '6px',
                padding: '6px 8px',
                fontSize: '12px',
                color: 'var(--text-secondary)'
              }}>
                Fleet reinforcement arrived at <strong style={{ color: faction?.color }}>{log.systemName}</strong>
              </div>
            );
          }

          if (log.type === 'elimination') {
            const eliminatedPlayer = gameState.playerState[log.playerId || 0];
            return (
              <div key={idx} style={{
                background: 'rgba(255, 0, 0, 0.1)',
                border: '1px solid rgba(255, 0, 0, 0.3)',
                borderRadius: '6px',
                padding: '6px 8px',
                fontSize: '12px',
                color: 'var(--accent-magenta)',
                fontWeight: 'bold',
                textAlign: 'center'
              }}>
                [DESTRUCTION ALERT] {eliminatedPlayer?.name} has been completely eliminated!
              </div>
            );
          }

          return null;
        })}
      </div>
    );
  };

  const renderActionLog = () => {
    const actionLog = gameState.actionLog || [];
    if (actionLog.length === 0) {
      return <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No command actions logged.</div>;
    }

    const sortedLog = [...actionLog].reverse();

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
        {sortedLog.map((log, idx) => {
          const timestampStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const playerColor = gameState.playerState[log.playerId]?.color || '#ffffff';
          
          return (
            <div key={idx} style={{
              background: 'rgba(0, 240, 255, 0.03)',
              border: '1px solid rgba(0, 240, 255, 0.1)',
              borderRadius: '6px',
              padding: '6px 8px',
              fontSize: '11px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="telemetry" style={{ color: 'var(--text-muted)', fontSize: '9px' }}>
                  TURN {log.turnNumber} · {timestampStr}
                </span>
                <span style={{ color: playerColor, fontWeight: 'bold' }}>
                  {log.playerName}
                </span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono' }}>
                {log.details}
              </div>
            </div>
          );
        })}
      </div>
    );
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
    <div style={{ width: '100%', height: '100%', pointerEvents: 'none', position: 'absolute', top: 0, left: 0, zIndex: 10 }}>
      {/* 1. TOP BAR */}
      <div style={{
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* MY FACTION IDENTITY — always shows who THIS logged-in user is */}
          {(() => {
            // First try exact email match, then fall back to isLocal flag for host
            const myPlayer = gameState.players.find(p => p.assignedEmail === currentUserEmail)
              || (gameOwnerEmail === currentUserEmail ? gameState.players.find(p => p.isLocal) : undefined);
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
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>GALACTIC TURN</div>
            <div className="telemetry" style={{ fontSize: '16px', fontWeight: 'bold' }}>#{gameState.turnNumber}</div>
          </div>
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
      </div>

      {/* 2. LEFT SIDE PANEL - SYSTEM OR FLEET MANAGEMENT */}
      <div style={{
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
          <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', padding: '16px', overflowY: 'auto' }} className="glass-panel">
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>STAR CLUSTER TELEMETRY</span>
                <h2 className="text-neon-cyan" style={{ fontSize: '22px', margin: '4px 0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedSystem.isHomePlanet && <span title="Capital Planet" style={{ fontSize: '18px' }}>👑</span>}
                  {selectedSystem.name}
                  {selectedSystem.isHomePlanet && (
                    <span style={{
                      fontSize: '10px',
                      background: 'rgba(0, 240, 255, 0.15)',
                      color: 'var(--accent-cyan)',
                      border: '1px solid rgba(0, 240, 255, 0.3)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontFamily: 'Share Tech Mono',
                      letterSpacing: '1px'
                    }}>
                      CAPITAL
                    </span>
                  )}
                </h2>
              </div>
              <button
                className="btn-sci-fi btn-danger"
                style={{ padding: '4px 8px', fontSize: '10px' }}
                onClick={() => setSelectedSystemId(null)}
              >
                ✕
              </button>
            </div>
            
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Coordinates: <span className="telemetry">{selectedSystem.x} LY, {selectedSystem.y} LY</span>
            </div>
            <div style={{ fontSize: '13px', color: selectedSystem.owner === 0 ? '#8ba2b5' : (gameState.playerState[selectedSystem.owner]?.color || '#ffffff'), marginBottom: '4px' }}>
              Owner: <strong>{selectedSystem.owner === 0 ? 'Neutral / Independent' : (gameState.playerState[selectedSystem.owner]?.name || 'Unknown')}</strong>
            </div>
            {activeRules.enableCredits && selectedSystem.owner !== 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Generates +{selectedSystem.resourcesPerTurn} resources/turn
              </div>
            )}

            <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.08)', margin: '10px 0' }} />

            {/* Check vision for detailed stats */}
            {gameState.systems.find(s => s.id === selectedSystemId) && (
              <>
                {/* Systems values */}
                {selectedSystem.owner !== 0 && gameState.playerState[activePlayerId]?.team !== gameState.playerState[selectedSystem.owner]?.team ? (
                  /* Enemy System - FOG OF WAR DETAILS HIDE */
                  <div style={{
                    padding: '12px',
                    background: 'rgba(255, 0, 127, 0.05)',
                    border: '1px solid rgba(255, 0, 127, 0.2)',
                    borderRadius: '6px',
                    color: 'var(--accent-magenta)',
                    fontSize: '13px',
                    textAlign: 'center',
                    marginBottom: '10px'
                  }}>
                    [WARNING] SCANS BLOCKED by enemy Deflector Shields. Stationed ship counts and build queue sizes are hidden!
                  </div>
                ) : (
                  /* Friendly/Allied system or neutral system details */
                  <div>
                    <h3 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)' }}>STATIONED FLEETS</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                      {Object.entries(selectedSystem.ships).map(([shipType, qty]) => (
                        <div key={shipType} style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '6px',
                          padding: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{shipType}</span>
                          <span className="telemetry" style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--accent-cyan)' }}>{qty}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* If is my system, show Upgrades & Production */}
                {isMySystem && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {/* PRODUCTION QUEUE */}
                    {!activeRules.nodeProduction?.enabled && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                          <span>Shipyard Queue</span>
                          <span className="telemetry" style={{ color: 'var(--accent-green)' }}>{selectedSystem.buildQueue.length} / {maxBuildCapacity}</span>
                        </div>
                        
                        {selectedSystem.buildQueue.length > 0 ? (
                          <div style={{
                            background: 'rgba(57, 255, 20, 0.05)',
                            border: '1px solid rgba(57, 255, 20, 0.2)',
                            padding: '10px',
                            borderRadius: '6px',
                            marginBottom: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}>
                            {selectedSystem.buildQueue.map((job, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                                <span>{idx === 0 ? '[CURRENT] ' : ''}{job.shipType}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className="telemetry" style={{ color: 'var(--accent-green)' }}>
                                    {job.turnsRemaining} {job.turnsRemaining === 1 ? 'Turn' : 'Turns'} left
                                  </span>
                                  <button
                                    className="btn-sci-fi btn-danger"
                                    style={{ padding: '0 4px', fontSize: '8px' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCancelProduction(selectedSystem.id, idx);
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic', marginBottom: '10px' }}>
                            Production yards idle.
                          </div>
                        )}

                        {/* Add Ship buttons */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          {Object.entries(activeRules.ships).map(([type, def]) => (
                            <button
                              key={type}
                              className="btn-sci-fi"
                              style={{ padding: '6px 8px', fontSize: '11px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                              onClick={() => onQueueShip(type)}
                              disabled={(activeRules.enableCredits && activePlayer.resources < def.cost) || selectedSystem.buildQueue.length >= maxBuildCapacity}
                            >
                              <span style={{ fontWeight: 'bold' }}>+ {type}</span>
                              {activeRules.enableCredits && (
                                <span className="telemetry" style={{ fontSize: '10px', opacity: 0.8 }}>({def.cost} CR)</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* UPGRADE INFRASTRUCTURE */}
                    {activeRules.enableUpgrades && (
                      <div>
                        <h3 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)' }}>UPGRADE SYSTEMS</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {/* SHIPYARD */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div>
                              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Shipyard (LVL {selectedSystem.shipyardLvl})</span>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Expand build limit & reduce times</div>
                            </div>
                            <button
                              className="btn-sci-fi"
                              style={{ padding: '4px 10px', fontSize: '11px' }}
                              onClick={() => onUpgradeSystem('Shipyard', selectedSystem.id)}
                              disabled={activeRules.enableCredits && activePlayer.resources < getUpgradeCost('Shipyard', selectedSystem)}
                            >
                              {getUpgradeCost('Shipyard', selectedSystem)}{activeRules.enableCredits ? ' CR' : ''}
                            </button>
                          </div>

                          {/* SENSORS */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div>
                              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Sensors (LVL {selectedSystem.sensorLvl})</span>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Expand map scanner range</div>
                            </div>
                            <button
                              className="btn-sci-fi"
                              style={{ padding: '4px 10px', fontSize: '11px' }}
                              onClick={() => onUpgradeSystem('Sensors', selectedSystem.id)}
                              disabled={activeRules.enableCredits && activePlayer.resources < getUpgradeCost('Sensors', selectedSystem)}
                            >
                              {getUpgradeCost('Sensors', selectedSystem)}{activeRules.enableCredits ? ' CR' : ''}
                            </button>
                          </div>

                          {/* SHIELDS */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div>
                              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Shields (LVL {selectedSystem.shieldsLvl})</span>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Absorbs combat damage</div>
                            </div>
                            <button
                              className="btn-sci-fi"
                              style={{ padding: '4px 10px', fontSize: '11px' }}
                              onClick={() => onUpgradeSystem('Shields', selectedSystem.id)}
                              disabled={activeRules.enableCredits && activePlayer.resources < getUpgradeCost('Shields', selectedSystem)}
                            >
                              {getUpgradeCost('Shields', selectedSystem)}{activeRules.enableCredits ? ' CR' : ''}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* fleet inspector */}
        {selectedFleet && (
          <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', padding: '16px', overflowY: 'auto' }} className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>FLEET SCANNERS ACTIVE</span>
                <h2 className="text-neon-yellow" style={{ fontSize: '20px', margin: '4px 0' }}>Swarms Sector {Math.round(selectedFleet.currentPos.x)}, {Math.round(selectedFleet.currentPos.y)}</h2>
              </div>
              <button
                className="btn-sci-fi btn-danger"
                style={{ padding: '4px 8px', fontSize: '10px' }}
                onClick={() => setSelectedFleetId(null)}
              >
                ✕
              </button>
            </div>
            
            <div style={{ fontSize: '13px', marginBottom: '6px' }}>
              Owner: <strong style={{ color: gameState.playerState[selectedFleet.owner]?.color || '#ffffff' }}>{gameState.playerState[selectedFleet.owner]?.name || 'Unknown'}</strong>
            </div>

            <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.08)', margin: '10px 0' }} />

            <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>SHIPS IN FLEET</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '15px' }}>
              {Object.entries(selectedFleet.ships).map(([shipType, qty]) => (
                <div key={shipType} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '6px',
                  padding: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{shipType}</span>
                  <span className="telemetry" style={{ fontWeight: 'bold', color: 'var(--accent-yellow)', fontSize: '14px' }}>{qty}</span>
                </div>
              ))}
            </div>

            <div style={{
              background: 'rgba(0, 240, 255, 0.02)',
              border: '1px solid rgba(0, 240, 255, 0.08)',
              borderRadius: '6px',
              padding: '10px',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              marginBottom: '15px'
            }}>
              <div>Origin Point: <strong>{selectedFleet.source.name}</strong></div>
              <div>Destination Point: <strong>{selectedFleet.destination.name}</strong></div>
              <div>Speed: <strong className="telemetry">{selectedFleet.speed.toFixed(1)} LY/turn</strong></div>
              <div>Turns Remaining: <strong className="telemetry" style={{ color: 'var(--accent-green)' }}>{selectedFleet.turnsRemaining} turns</strong></div>
              {selectedFleet.isRecalling && (
                <div style={{ color: 'var(--accent-magenta)', fontWeight: 'bold' }}>RECALL SUBROUTINE ACTIVE: Returning to source base.</div>
              )}
            </div>

            {isMyFleet && !selectedFleet.isRecalling && (
              <button className="btn-sci-fi btn-danger" onClick={() => onRecallFleet(selectedFleet.id)}>
                CANCEL TRAVEL & RECALL FLEET
              </button>
            )}
          </div>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '4px' }}>
                  {ownedSystems.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', padding: '4px' }}>No stars claimed.</div>
                  ) : (
                    ownedSystems.map(sys => (
                      <div
                        key={sys.id}
                        onClick={() => {
                          setSelectedSystemId(sys.id);
                          setSelectedFleetId(null);
                          onCenterOnCoords(sys.x, sys.y);
                        }}
                        style={{
                          background: selectedSystemId === sys.id ? 'rgba(0, 240, 255, 0.08)' : 'rgba(0, 240, 255, 0.02)',
                          border: selectedSystemId === sys.id ? '1px solid var(--accent-cyan)' : '1px solid rgba(0, 240, 255, 0.1)',
                          padding: '8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <strong style={{ color: 'var(--accent-cyan)' }}>{sys.name}</strong>
                          <span className="telemetry" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{sys.x}, {sys.y} LY</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <span>Defense: {Object.entries(sys.ships).map(([t, q]) => q > 0 ? `${t.substring(0,2)}:${q}` : '').filter(Boolean).join(', ') || 'None'}</span>
                          {activeRules.enableCredits && (
                            <span className="telemetry" style={{ color: 'var(--accent-green)' }}>+{sys.resourcesPerTurn} CR</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '4px' }}>
                  {ownedFleets.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', padding: '4px' }}>No active fleets.</div>
                  ) : (
                    ownedFleets.map(fleet => (
                      <div
                        key={fleet.id}
                        onClick={() => {
                          setSelectedFleetId(fleet.id);
                          setSelectedSystemId(null);
                          onCenterOnCoords(fleet.currentPos.x, fleet.currentPos.y);
                        }}
                        style={{
                          background: selectedFleetId === fleet.id ? 'rgba(255, 170, 0, 0.08)' : 'rgba(255, 170, 0, 0.02)',
                          border: selectedFleetId === fleet.id ? '1px solid var(--accent-yellow)' : '1px solid rgba(255, 170, 0, 0.1)',
                          padding: '8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <strong style={{ color: 'var(--accent-yellow)' }}>
                            {fleet.source.name} → {fleet.destination.name}
                          </strong>
                          <span className="telemetry" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                            {fleet.turnsRemaining}t left {fleet.isRecalling ? '(REC)' : ''}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Swarm: {Object.entries(fleet.ships).map(([t, q]) => q > 0 ? `${t}:${q}` : '').filter(Boolean).join(', ')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '4px' }}>
                  {cancelableFleets.length === 0 && cancelableBuilds.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', padding: '4px' }}>No pending orders this turn.</div>
                  ) : (
                    <>
                      {/* Fleet dispatches */}
                      {cancelableFleets.map(f => (
                        <div
                          key={f.id}
                          style={{
                            background: 'rgba(255, 0, 127, 0.03)',
                            border: '1px solid rgba(255, 0, 127, 0.1)',
                            padding: '8px',
                            borderRadius: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--accent-magenta)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              Launch: {f.source.name} → {f.destination.name}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {Object.entries(f.ships).map(([t, q]) => q > 0 ? `${t}:${q}` : '').filter(Boolean).join(', ')}
                            </div>
                          </div>
                          <button
                            className="btn-sci-fi btn-danger"
                            style={{ padding: '2px 8px', fontSize: '9px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onCancelDispatch(f.id);
                            }}
                          >
                            CANCEL
                          </button>
                        </div>
                      ))}
                      
                      {/* Production jobs */}
                      {cancelableBuilds.map((b, bIdx) => (
                        <div
                          key={`${b.systemId}-${b.jobIndex}-${bIdx}`}
                          style={{
                            background: 'rgba(57, 255, 20, 0.03)',
                            border: '1px solid rgba(57, 255, 20, 0.1)',
                            padding: '8px',
                            borderRadius: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--accent-green)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              Build: {b.job.shipType} @ {b.systemName}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              Queue Position: #{b.jobIndex + 1} ({b.job.turnsRemaining}t left)
                            </div>
                          </div>
                          <button
                            className="btn-sci-fi btn-danger"
                            style={{ padding: '2px 8px', fontSize: '9px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onCancelProduction(b.systemId, b.jobIndex);
                            }}
                          >
                            CANCEL
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* 3. RIGHT SIDE PANEL - FLEET DISPATCH OR COMBAT LOG */}
      <div style={{
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
          <div style={{ display: 'flex', flexDirection: 'column', padding: '16px' }} className="glass-panel">
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>SWARM LAUNCH CONTROLLER</span>
            <h2 className="text-neon-green" style={{ fontSize: '18px', margin: '4px 0 10px' }}>DISPATCH SWARM</h2>

            {targetSystem ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  padding: '10px',
                  background: 'rgba(57, 255, 20, 0.05)',
                  border: '1px solid rgba(57, 255, 20, 0.15)',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}>
                  Target System: <strong>{targetSystem.name} ({targetSystem.x}, {targetSystem.y})</strong>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Distance: <span className="telemetry">{(Math.sqrt((targetSystem.x - selectedSystem.x) ** 2 + (targetSystem.y - selectedSystem.y) ** 2)).toFixed(1)} LY</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.keys(activeRules.ships).map(shipType => {
                    const availableQty = selectedSystem.ships[shipType] || 0;
                    return (
                      <div key={shipType} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span>{shipType} (Available: {availableQty})</span>
                          <button
                            className="btn-sci-fi"
                            style={{ padding: '0 6px', fontSize: '9px' }}
                            onClick={() => handleSetMaxDispatch(shipType)}
                          >
                            MAX
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <input
                            type="range"
                            min="0"
                            max={availableQty}
                            value={dispatchQty[shipType] || 0}
                            onChange={(e) => handleDispatchQtyChange(shipType, parseInt(e.target.value))}
                            style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
                          />
                          <input
                            type="number"
                            min="0"
                            max={availableQty}
                            value={dispatchQty[shipType] || 0}
                            onChange={(e) => handleDispatchQtyChange(shipType, parseInt(e.target.value) || 0)}
                            style={{
                              width: '50px',
                              background: 'rgba(0,0,0,0.5)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              color: 'white',
                              borderRadius: '4px',
                              padding: '2px 4px',
                              fontSize: '12px',
                              textAlign: 'center',
                              fontFamily: 'Share Tech Mono'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button className="btn-sci-fi" onClick={executeDispatch} style={{ flex: 1 }}>
                    LAUNCH SHIPS
                  </button>
                  <button className="btn-sci-fi btn-danger" onClick={() => setTargetSystem(null)}>
                    CANCEL
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                border: '1px dashed rgba(0, 240, 255, 0.2)',
                background: 'rgba(0, 240, 255, 0.02)',
                padding: '20px',
                borderRadius: '8px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '12px'
              }}>
                To deploy a traveling swarm, select a base you own, then Ctrl + left-click on any other star system on the map to set it as destination.
              </div>
            )}
          </div>
        )}

        {/* HYPERWAVE COMS PRESENCE */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '16px', background: 'rgba(0, 240, 255, 0.03)', border: '1px solid rgba(0, 240, 255, 0.15)' }} className="glass-panel">
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>COMS STATION ACTIVE</span>
          <h2 className="text-neon-cyan" style={{ fontSize: '15px', margin: '4px 0 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📡 HYPERWAVE PRESENCE</span>
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '180px' }}>
            {gameState.players.map((player) => {
              const isOnline = player.type === 'ai' || (player.assignedEmail && connectedPlayers.includes(player.assignedEmail)) || (player.id === 1 && connectedPlayers.includes(gameOwnerEmail));
              const playerStateInfo = gameState.playerState[player.id];
              const isOwner = gameOwnerEmail === currentUserEmail;
              const isMe = player.assignedEmail === currentUserEmail;

              return (
                <div key={player.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <div 
                      onClick={() => handleCenterOnHome(player.id)}
                      title={`Center on ${player.name}'s Home Planet`}
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: player.color || '#ffffff',
                        boxShadow: `0 0 6px ${player.color}`,
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      }} 
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'scale(1.4)';
                        e.currentTarget.style.boxShadow = `0 0 10px 2.5px ${player.color}`;
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = `0 0 6px ${player.color}`;
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {isPlayerLocalToClient(player) ? (
                          <input
                            type="text"
                            value={player.name}
                            onChange={(e) => {
                              onRenamePlayer(player.id, e.target.value);
                            }}
                            style={{
                              background: 'rgba(0, 0, 0, 0.4)',
                              border: '1px solid rgba(0, 240, 255, 0.3)',
                              color: 'white',
                              fontSize: '11px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              width: '100px',
                              fontFamily: 'Share Tech Mono'
                            }}
                          />
                        ) : (
                          <span>{player.name}</span>
                        )}
                        {player.type === 'ai' && <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>[AI]</span>}
                        {isMe && <span style={{ fontSize: '9px', color: 'var(--accent-cyan)' }}>[YOU]</span>}
                      </div>
                      {player.type === 'human' && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {player.assignedEmail || 'Unassigned Link'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Connection status */}
                    <span style={{
                      fontSize: '10px',
                      color: isOnline ? 'var(--accent-green)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: isOnline ? 'var(--accent-green)' : '#888'
                      }} />
                      {player.type === 'ai' ? 'AUTO' : (isOnline ? 'ONLN' : 'OFFL')}
                    </span>

                    {/* Turn Status */}
                    {player.type === 'human' && !playerStateInfo?.lost && (
                      <span style={{
                        fontSize: '10px',
                        color: player.endedTurn ? 'var(--accent-green)' : 'var(--accent-yellow)',
                        fontFamily: 'Share Tech Mono'
                      }}>
                        {player.endedTurn ? 'READY' : 'WAIT'}
                      </span>
                    )}

                    {/* Local Toggle Checkbox */}
                    {player.type === 'human' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <input
                          type="checkbox"
                          checked={!!player.isLocal}
                          disabled={!isOwner && !isMe}
                          onChange={() => onTogglePlayerLocal(player.id)}
                          style={{ accentColor: 'var(--accent-cyan)', margin: 0 }}
                        />
                        <span>LCL</span>
                      </label>
                    )}

                    {/* Claim Button */}
                    {player.type === 'human' && !player.assignedEmail && !isMe && (
                      <button
                        className="btn-sci-fi"
                        style={{ padding: '2px 6px', fontSize: '9px', textTransform: 'uppercase' }}
                        onClick={() => onClaimFaction(player.id)}
                      >
                        CLAIM
                      </button>
                    )}

                    {/* Owner Assign Option: Clear or Assign if Owner */}
                    {isOwner && player.type === 'human' && player.assignedEmail && player.id !== 1 && (
                      <button
                        className="btn-sci-fi btn-danger"
                        style={{ padding: '2px 4px', fontSize: '9px' }}
                        onClick={() => onAssignPlayerEmail(player.id, '')}
                      >
                        RESET
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
          {logTab === 'tactical' ? renderCombatLog() : renderActionLog()}
        </div>
      </div>

      {/* WAITING FOR REMOTE PLAYER OVERLAY */}
      {!isMyTurn && activePlayerSlot && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(5, 10, 20, 0.92)',
          backdropFilter: 'blur(12px)',
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
              const myPlayer = gameState.players.find(p => p.assignedEmail === currentUserEmail || (p.id === 1 && isPlayerLocalToClient(p)));
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
    </div>
  );
};
