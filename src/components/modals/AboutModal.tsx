import React from 'react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(5, 3, 13, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1100
    }}>
      <div style={{
        width: '500px',
        maxWidth: '90%',
        padding: '30px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxSizing: 'border-box'
      }} className="glass-panel glass-panel-neon-cyan">
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontFamily: 'Orbitron',
            fontSize: '36px',
            fontWeight: 800,
            letterSpacing: '4px',
            background: 'linear-gradient(135deg, #00f0ff, #ff007f)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 20px rgba(0, 240, 255, 0.2)',
            margin: '10px 0 5px 0'
          }}>STAR-SWARM</h1>
          <p style={{
            fontSize: '13px',
            color: 'var(--accent-cyan)',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            fontFamily: 'Share Tech Mono',
            margin: 0
          }}>Tactical Grid Space Conquest</p>
        </div>

        <div style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          lineHeight: '1.6',
          fontFamily: 'Outfit, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <p>
            <strong>Star-Swarm</strong> is a modern, turn-based sci-fi tactical strategy game set in a deep star cluster. Command your ships, manage planetary production, upgrade space colonies, and navigate through the fog of war to outmaneuver opposing factions.
          </p>
          <p>
            Engage in local skirmishes against intelligent AI systems or start multi-agent network simulation environments to test tactical fleet deployments.
          </p>
          <div style={{
            background: 'rgba(0, 240, 255, 0.05)',
            border: '1px solid rgba(0, 240, 255, 0.15)',
            borderRadius: '6px',
            padding: '12px',
            fontSize: '11px',
            fontFamily: 'Share Tech Mono',
            color: 'var(--text-muted)'
          }}>
            <div style={{ color: 'white', fontWeight: 'bold', marginBottom: '4px' }}>SYSTEM SPECS & CREDITS:</div>
            <div>• Core Engine: React + TypeScript + Canvas</div>
            <div>• Background Visuals: Pablo Roman Andrioli (Star Nest)</div>
            <div>• Version: 1.2.0 (Tactical Swarm)</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
          <button
            className="btn-sci-fi"
            style={{ width: '150px', justifyContent: 'center' }}
            onClick={onClose}
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
