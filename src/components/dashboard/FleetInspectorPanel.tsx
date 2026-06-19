import React from 'react';
import { GameState, Fleet } from '../../game/gameState';

interface FleetInspectorPanelProps {
  selectedFleet: Fleet;
  gameState: GameState;
  setSelectedFleetId: (id: string | null) => void;
  onRecallFleet: (fleetId: string) => void;
  isMyFleet: boolean;
}

export const FleetInspectorPanel: React.FC<FleetInspectorPanelProps> = ({
  selectedFleet,
  gameState,
  setSelectedFleetId,
  onRecallFleet,
  isMyFleet
}) => {
  return (
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
  );
};
