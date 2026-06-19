import React from 'react';
import { StarSystem, GameRules } from '../../game/gameState';

interface FleetDispatchPanelProps {
  selectedSystem: StarSystem;
  targetSystem: StarSystem | null;
  setTargetSystem: (sys: StarSystem | null) => void;
  dispatchQty: Record<string, number>;
  setDispatchQty: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  executeDispatch: () => void;
  activeRules: GameRules;
  isMobile: boolean;
  compactMode: boolean;
  isSelectingTarget: boolean;
  setIsSelectingTarget: (v: boolean) => void;
  setActiveMobileTab: (tab: 'map' | 'empire' | 'tactics') => void;
}

export const FleetDispatchPanel: React.FC<FleetDispatchPanelProps> = ({
  selectedSystem,
  targetSystem,
  setTargetSystem,
  dispatchQty,
  setDispatchQty,
  executeDispatch,
  activeRules,
  isMobile,
  compactMode,
  isSelectingTarget,
  setIsSelectingTarget,
  setActiveMobileTab
}) => {
  const handleSetMaxDispatch = (shipType: string) => {
    const maxQty = selectedSystem.ships[shipType] || 0;
    setDispatchQty(prev => ({ ...prev, [shipType]: maxQty }));
  };

  const handleDispatchQtyChange = (shipType: string, val: number) => {
    const maxQty = selectedSystem.ships[shipType] || 0;
    const qty = Math.max(0, Math.min(maxQty, val));
    setDispatchQty(prev => ({ ...prev, [shipType]: qty }));
  };

  return (
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
          padding: '16px',
          borderRadius: '8px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          alignItems: 'center'
        }}>
          <div>
            To deploy a traveling swarm, select a base you own, then Ctrl + left-click on any other star system on the map to set it as destination.
          </div>
          {(isMobile || compactMode) && (
            <button
              className={`btn-sci-fi ${isSelectingTarget ? 'btn-danger' : ''}`}
              onClick={() => {
                setIsSelectingTarget(!isSelectingTarget);
                if (isMobile) {
                  // Switch to map tab so player can choose the target
                  setActiveMobileTab('map');
                }
              }}
              style={{ padding: '8px 16px', fontSize: '11px', width: '100%', justifyContent: 'center' }}
            >
              {isSelectingTarget ? '🚫 CANCEL TARGETING' : '🎯 SET SWARM DESTINATION'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
