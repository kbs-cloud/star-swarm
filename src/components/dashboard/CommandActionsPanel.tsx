import React from 'react';
import { GameState } from '../../game/gameState';

interface CommandActionsPanelProps {
  gameState: GameState;
}

export const CommandActionsPanel: React.FC<CommandActionsPanelProps> = ({ gameState }) => {
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
