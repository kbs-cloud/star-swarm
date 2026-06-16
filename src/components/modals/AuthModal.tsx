import React from 'react';
import { SSOLoginPanel } from '../../shared/auth/SSOLoginPanel';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  authError: string | null;
  isGooglePolling?: boolean;
  onCancelGooglePoll?: () => void;
  playOnline: boolean;
  onPlayOnlineChange: (playOnline: boolean) => void;
  onLoginClick: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  authError,
  isGooglePolling = false,
  onCancelGooglePoll = () => {},
  playOnline,
  onPlayOnlineChange,
  onLoginClick
}) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100dvh',
      background: 'rgba(5, 3, 13, 0.85)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(0, 255, 255, 0.1)',
          border: '1px solid rgba(0, 255, 255, 0.4)',
          color: '#00f0ff',
          padding: '8px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
          zIndex: 1010,
          fontFamily: "'Orbitron', sans-serif",
          fontSize: '12px',
          letterSpacing: '1px'
        }}
      >
        ✕ CLOSE
      </button>

      <SSOLoginPanel
        title="STAR-SWARM"
        subtitle="Commander Terminal Link"
        authError={authError || undefined}
        buttonText="ESTABLISH COMMAND LINK"
        isGooglePolling={isGooglePolling}
        playOnline={playOnline}
        onPlayOnlineChange={onPlayOnlineChange}
        onLoginClick={onLoginClick}
        onCancelGooglePoll={onCancelGooglePoll}
        themeColor="#00f0ff"
        icon={
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
        }
        containerClassName=""
        cardClassName="glass-panel glass-panel-neon-cyan"
        buttonClassName="btn-sci-fi"
      />
    </div>
  );
};
