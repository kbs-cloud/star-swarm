import React from 'react';

interface GameOverScreenProps {
  winnerInfo: string;
  onReturnToMenu: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ winnerInfo, onReturnToMenu }) => {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100,
      position: 'relative'
    }}>
      <div style={{
        width: '500px',
        padding: '40px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }} className="glass-panel glass-panel-neon-cyan">
        <h2 style={{ fontSize: '36px', color: 'var(--accent-cyan)', fontFamily: 'Orbitron', letterSpacing: '4px' }}>
          SIMULATION CONCLUDED
        </h2>

        <div style={{ fontSize: '18px', color: 'white', fontWeight: 'bold', textShadow: '0 0 10px rgba(0, 240, 255, 0.4)' }}>
          {winnerInfo}
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
          The galaxy has stabilized under team authority. All hostile shipyards and fleet registries have been decommissioned or annexed.
        </p>

        <button className="btn-sci-fi" style={{ justifyContent: 'center' }} onClick={onReturnToMenu}>
          RETURN TO COMMAND CENTER
        </button>
      </div>
    </div>
  );
};
