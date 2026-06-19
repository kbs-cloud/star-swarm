import React from 'react';
import { StarSystem } from '../../game/gameState';

interface DominionRegistryPanelProps {
  ownedSystems: StarSystem[];
  selectedSystemId: number | null;
  setSelectedSystemId: (id: number | null) => void;
  setSelectedFleetId: (id: string | null) => void;
  onCenterOnCoords: (x: number, y: number) => void;
  enableCredits: boolean;
}

export const DominionRegistryPanel: React.FC<DominionRegistryPanelProps> = ({
  ownedSystems,
  selectedSystemId,
  setSelectedSystemId,
  setSelectedFleetId,
  onCenterOnCoords,
  enableCredits
}) => {
  if (ownedSystems.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', padding: '4px' }}>No stars claimed.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '4px' }}>
      {ownedSystems.map(sys => (
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
            <span>Defense: {Object.entries(sys.ships).map(([t, q]) => q > 0 ? `${t.substring(0, 2)}:${q}` : '').filter(Boolean).join(', ') || 'None'}</span>
            {enableCredits && (
              <span className="telemetry" style={{ color: 'var(--accent-green)' }}>+{sys.resourcesPerTurn} CR</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
