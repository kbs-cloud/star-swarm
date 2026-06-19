import React from 'react';
import { GameState, StarSystem, NORMAL_RULES } from '../../game/gameState';

interface SystemInspectorPanelProps {
  selectedSystem: StarSystem;
  gameState: GameState;
  activePlayerId: number;
  setSelectedSystemId: (id: number | null) => void;
  onQueueShip: (shipType: string) => void;
  onUpgradeSystem: (upgradeType: string, systemId?: number) => void;
  onCancelProduction: (systemId: number, jobIndex: number) => void;
  getUpgradeCost: (type: string, sys?: StarSystem) => number;
  isMySystem: boolean;
  compactMode: boolean;
}

export const SystemInspectorPanel: React.FC<SystemInspectorPanelProps> = ({
  selectedSystem,
  gameState,
  activePlayerId,
  setSelectedSystemId,
  onQueueShip,
  onUpgradeSystem,
  onCancelProduction,
  getUpgradeCost,
  isMySystem,
  compactMode
}) => {
  const activePlayer = gameState.playerState[activePlayerId];
  const activeRules = gameState.rules || NORMAL_RULES;
  const maxBuildCapacity = selectedSystem.shipyardLvl + 1;

  const getShipIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'scout': return '🛰️';
      case 'fighter': return '🛸';
      case 'corvette': return '🚀';
      case 'cruiser': return '🚢';
      case 'dreadnought': return '🔱';
      default: return '🛸';
    }
  };

  return (
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
      {gameState.systems.find(s => s.id === selectedSystem.id) && (
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
          {isMySystem && activePlayer && (
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
                        style={{ padding: '6px 4px', fontSize: '11px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}
                        onClick={() => onQueueShip(type)}
                        disabled={(activeRules.enableCredits && activePlayer.resources < def.cost) || selectedSystem.buildQueue.length >= maxBuildCapacity}
                        title={`${type} (${def.cost} CR)`}
                      >
                        {compactMode ? (
                          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{getShipIcon(type)} {type.substring(0, 3).toUpperCase()}</span>
                        ) : (
                          <span style={{ fontWeight: 'bold' }}>+ {type}</span>
                        )}
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
                  <h3 style={{ fontSize: '13px', marginBottom: '8px', color: 'var(--text-primary)' }}>UPGRADE SYSTEMS</h3>
                  <div style={compactMode ? { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' } : { display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* SHIPYARD */}
                    <div style={compactMode ? {
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(255,255,255,0.02)',
                      padding: '6px 4px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.05)'
                    } : { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={compactMode ? { textAlign: 'center' } : {}}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold' }}>🏗️ SYD ({selectedSystem.shipyardLvl})</span>
                        {!compactMode && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Expand build limit & reduce times</div>}
                      </div>
                      <button
                        className="btn-sci-fi"
                        style={{ padding: '4px 6px', fontSize: '10px', width: compactMode ? '100%' : 'auto', justifyContent: 'center' }}
                        onClick={() => onUpgradeSystem('Shipyard', selectedSystem.id)}
                        disabled={activeRules.enableCredits && activePlayer.resources < getUpgradeCost('Shipyard', selectedSystem)}
                      >
                        {getUpgradeCost('Shipyard', selectedSystem)}{activeRules.enableCredits ? ' CR' : ''}
                      </button>
                    </div>

                    {/* SENSORS */}
                    <div style={compactMode ? {
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(255,255,255,0.02)',
                      padding: '6px 4px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.05)'
                    } : { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={compactMode ? { textAlign: 'center' } : {}}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold' }}>📡 SNS ({selectedSystem.sensorLvl})</span>
                        {!compactMode && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Expand map scanner range</div>}
                      </div>
                      <button
                        className="btn-sci-fi"
                        style={{ padding: '4px 6px', fontSize: '10px', width: compactMode ? '100%' : 'auto', justifyContent: 'center' }}
                        onClick={() => onUpgradeSystem('Sensors', selectedSystem.id)}
                        disabled={activeRules.enableCredits && activePlayer.resources < getUpgradeCost('Sensors', selectedSystem)}
                      >
                        {getUpgradeCost('Sensors', selectedSystem)}{activeRules.enableCredits ? ' CR' : ''}
                      </button>
                    </div>

                    {/* SHIELDS */}
                    <div style={compactMode ? {
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(255,255,255,0.02)',
                      padding: '6px 4px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.05)'
                    } : { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={compactMode ? { textAlign: 'center' } : {}}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold' }}>🛡️ SHD ({selectedSystem.shieldsLvl})</span>
                        {!compactMode && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Absorbs combat damage</div>}
                      </div>
                      <button
                        className="btn-sci-fi"
                        style={{ padding: '4px 6px', fontSize: '10px', width: compactMode ? '100%' : 'auto', justifyContent: 'center' }}
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
  );
};
