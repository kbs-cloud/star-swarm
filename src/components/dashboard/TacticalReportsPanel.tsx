import React from 'react';
import { GameState } from '../../game/gameState';

interface TacticalReportsPanelProps {
  gameState: GameState;
  activePlayerId: number;
  selectedBattleLogIndex: number | null;
  setSelectedBattleLogIndex: (index: number | null) => void;
}

export const TacticalReportsPanel: React.FC<TacticalReportsPanelProps> = ({
  gameState,
  activePlayerId,
  selectedBattleLogIndex,
  setSelectedBattleLogIndex
}) => {
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
