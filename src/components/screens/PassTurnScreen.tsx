import React from 'react';
import { GameState, Player } from '../../game/gameState';
import { PlayerSetup } from '../../types';

interface PassTurnScreenProps {
  nextHumanPlayer: PlayerSetup | null;
  gameState: GameState | null;
  onStartTurn: () => void;
  onCancelEndTurn: (playerId: number) => void;
}

export const PassTurnScreen: React.FC<PassTurnScreenProps> = ({
  nextHumanPlayer,
  gameState,
  onStartTurn,
  onCancelEndTurn
}) => {
  if (!nextHumanPlayer) return null;

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 99,
      position: 'relative'
    }}>
      <div style={{
        width: '450px',
        padding: '40px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }} className="glass-panel glass-panel-neon-magenta pulse-light">
        <h2 style={{ fontSize: '28px', color: 'var(--accent-magenta)', fontFamily: 'Orbitron', letterSpacing: '2px' }}>
          HUD SECURE LOCKDOWN
        </h2>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          Sensors and starmaps have been shrouded. Please pass the controller console to:
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', marginTop: '12px', textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>
            {nextHumanPlayer.name}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
          <button className="btn-sci-fi" style={{ justifyContent: 'center' }} onClick={onStartTurn}>
            INITIALIZE COMMAND HUD
          </button>
          {(() => {
            const activeHumans = gameState?.players.filter(
              (p: Player) => p.type === 'human' && !gameState?.playerState[p.id]?.lost
            ) || [];
            const endedPlayer = activeHumans.find((p: Player) => p.endedTurn);
            if (endedPlayer) {
              return (
                <button
                  className="btn-sci-fi btn-danger"
                  style={{ justifyContent: 'center' }}
                  onClick={() => onCancelEndTurn(endedPlayer.id)}
                >
                  CANCEL END TURN & RETURN TO {endedPlayer.name.toUpperCase()}
                </button>
              );
            }
            return null;
          })()}
        </div>
      </div>
    </div>
  );
};
