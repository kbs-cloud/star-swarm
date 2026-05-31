import React, { useState, useRef, useEffect } from 'react';
import { UserAccount } from '../../game/auth';

interface AuthBarProps {
  currentUser: UserAccount | null;
  soundMuted: boolean;
  onToggleSoundMuted: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onNavigateSettings: () => void;
  compactMode?: boolean;
}

export const AuthBar: React.FC<AuthBarProps> = ({
  currentUser,
  soundMuted,
  onToggleSoundMuted,
  onOpenAuth,
  onLogout,
  onNavigateSettings,
  compactMode = false
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  if (compactMode) {
    return (
      <div
        ref={menuRef}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--bg-panel)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(0, 240, 255, 0.2)',
          boxShadow: '0 0 15px rgba(0, 240, 255, 0.1)',
          borderRadius: '8px',
          padding: '6px 12px'
        }}
      >
        {/* display name button / hyperlink */}
        {currentUser ? (
          <button
            onClick={onNavigateSettings}
            className="telemetry"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-cyan)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              padding: '2px 6px',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              transition: 'color 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Open Settings"
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent-cyan)')}
          >
            {currentUser.displayName || currentUser.email.split('@')[0]}
          </button>
        ) : (
          <button
            onClick={onOpenAuth}
            className="telemetry"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-cyan)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              padding: '2px 6px',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              transition: 'color 0.2s'
            }}
            title="Establish Command Link"
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--accent-cyan)')}
          >
            GUEST
          </button>
        )}

        {/* Slide-out Menu Toggle Icon */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="btn-sci-fi"
          style={{
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '4px'
          }}
          title="Account & Settings Menu"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        {/* Slide-out panel */}
        <div style={{
          position: 'absolute',
          top: '100%',
          right: '0',
          marginTop: '8px',
          width: '220px',
          background: 'var(--bg-panel-light)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(0, 240, 255, 0.3)',
          boxShadow: '0 0 25px rgba(0, 240, 255, 0.2)',
          borderRadius: '8px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          transform: isMenuOpen ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.95)',
          opacity: isMenuOpen ? 1 : 0,
          pointerEvents: isMenuOpen ? 'auto' : 'none',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 101,
        }}>
          {/* Header / Close */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0, 240, 255, 0.2)', paddingBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>COMMAND LINK</span>
            <button 
              onClick={() => setIsMenuOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* User Card */}
          {currentUser ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>
                {currentUser.displayName || currentUser.email}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }} className="telemetry">
                RECORD: {currentUser.stats.gamesWon}W - {currentUser.stats.gamesPlayed - currentUser.stats.gamesWon}L
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Status: Offline Guest
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            {/* MUTE TOGGLE */}
            <button
              className="btn-sci-fi"
              onClick={onToggleSoundMuted}
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                justifyContent: 'flex-start',
                width: '100%'
              }}
            >
              {soundMuted ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <line x1="23" y1="9" x2="17" y2="15"></line>
                    <line x1="17" y1="9" x2="23" y2="15"></line>
                  </svg>
                  <span>UNMUTE SOUND</span>
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                  </svg>
                  <span>MUTE SOUND</span>
                </>
              )}
            </button>

            {currentUser ? (
              <>
                <button 
                  className="btn-sci-fi" 
                  style={{ padding: '6px 12px', fontSize: '11px', justifyContent: 'flex-start', width: '100%' }} 
                  onClick={() => {
                    setIsMenuOpen(false);
                    onNavigateSettings();
                  }}
                >
                  SETTINGS
                </button>
                <button 
                  className="btn-sci-fi btn-danger" 
                  style={{ padding: '6px 12px', fontSize: '11px', justifyContent: 'flex-start', width: '100%' }} 
                  onClick={() => {
                    setIsMenuOpen(false);
                    onLogout();
                  }}
                >
                  LOG OUT
                </button>
              </>
            ) : (
              <>
                <button 
                  className="btn-sci-fi" 
                  style={{ padding: '6px 12px', fontSize: '11px', justifyContent: 'flex-start', width: '100%' }} 
                  onClick={() => {
                    setIsMenuOpen(false);
                    onNavigateSettings();
                  }}
                >
                  SETTINGS
                </button>
                <button 
                  className="btn-sci-fi" 
                  style={{ padding: '6px 12px', fontSize: '11px', justifyContent: 'flex-start', width: '100%' }} 
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenAuth();
                  }}
                >
                  ESTABLISH LINK
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Non-compact (original) layout
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
