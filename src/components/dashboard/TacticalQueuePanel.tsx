import React from 'react';
import { Fleet } from '../../game/gameState';

interface TacticalQueuePanelProps {
  cancelableFleets: Fleet[];
  cancelableBuilds: { systemId: number; systemName: string; job: any; jobIndex: number }[];
  onCancelDispatch: (fleetId: string) => void;
  onCancelProduction: (systemId: number, jobIndex: number) => void;
}

export const TacticalQueuePanel: React.FC<TacticalQueuePanelProps> = ({
  cancelableFleets,
  cancelableBuilds,
  onCancelDispatch,
  onCancelProduction
}) => {
  if (cancelableFleets.length === 0 && cancelableBuilds.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', padding: '4px' }}>No pending orders this turn.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '4px' }}>
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
    </div>
  );
};
