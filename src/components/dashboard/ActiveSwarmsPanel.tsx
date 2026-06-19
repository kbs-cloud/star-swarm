import React from 'react';
import { Fleet } from '../../game/gameState';

interface ActiveSwarmsPanelProps {
  ownedFleets: Fleet[];
  selectedFleetId: string | null;
  setSelectedFleetId: (id: string | null) => void;
  setSelectedSystemId: (id: number | null) => void;
  onCenterOnCoords: (x: number, y: number) => void;
}

export const ActiveSwarmsPanel: React.FC<ActiveSwarmsPanelProps> = ({
  ownedFleets,
  selectedFleetId,
  setSelectedFleetId,
  setSelectedSystemId,
  onCenterOnCoords
}) => {
  if (ownedFleets.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', padding: '4px' }}>No active fleets.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '4px' }}>
      {ownedFleets.map(fleet => (
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
      ))}
    </div>
  );
};
