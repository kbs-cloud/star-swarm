import React from 'react';
import { UserAccount } from '../../game/auth';

interface AuthBarProps {
  currentUser: UserAccount | null;
  soundMuted: boolean;
  onToggleSoundMuted: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onNavigateSettings: () => void;
}

export const AuthBar: React.FC<AuthBarProps> = ({
  currentUser,
  soundMuted,
  onToggleSoundMuted,
  onOpenAuth,
  onLogout,
  onNavigateSettings
}) => {
  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      right: '20px',
      zIndex: 100,
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      background: 'var(--bg-panel)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(0, 240, 255, 0.2)',
      boxShadow: '0 0 15px rgba(0, 240, 255, 0.1)',
      borderRadius: '8px',
      padding: '8px 16px'
    }}>
      {/* MUTE TOGGLE */}
      <button
        className="btn-sci-fi"
        onClick={onToggleSoundMuted}
        style={{
          padding: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          minWidth: '32px',
          borderRadius: '6px'
        }}
        title={soundMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
      >
        {soundMuted ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <line x1="23" y1="9" x2="17" y2="15"></line>
            <line x1="17" y1="9" x2="23" y2="15"></line>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
        )}
      </button>

      {currentUser ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px' }}>COMMAND CODES ACTIVE</div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
              {currentUser.displayName || currentUser.email}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }} className="telemetry">
              RECORD: {currentUser.stats.gamesWon}W - {currentUser.stats.gamesPlayed - currentUser.stats.gamesWon}L
            </div>
          </div>
          <button className="btn-sci-fi" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={onNavigateSettings}>
            SETTINGS
          </button>
          <button className="btn-sci-fi btn-danger" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={onLogout}>
            LOG OUT
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="btn-sci-fi" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={onNavigateSettings}>
            SETTINGS
          </button>
          <button className="btn-sci-fi" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={onOpenAuth}>
            ESTABLISH COMMAND LINK
          </button>
        </div>
      )}
    </div>
  );
};
