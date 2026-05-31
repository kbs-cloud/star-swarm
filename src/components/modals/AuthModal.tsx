import React from 'react';


interface AuthModalProps {
  isOpen: boolean;
  authTab: 'signin' | 'register';
  authEmail: string;
  authPassword: string;
  authError: string | null;
  authSuccess: string | null;
  isGoogleAuthEnabled: boolean;
  onClose: () => void;
  onSetTab: (tab: 'signin' | 'register') => void;
  onSetEmail: (v: string) => void;
  onSetPassword: (v: string) => void;
  onLogin: (e: React.FormEvent) => void;
  onRegister: (e: React.FormEvent) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  authTab,
  authEmail,
  authPassword,
  authError,
  authSuccess,
  isGoogleAuthEnabled,
  onClose,
  onSetTab,
  onSetEmail,
  onSetPassword,
  onLogin,
  onRegister
}) => {
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
      zIndex: 1000
    }}>
      <div style={{
        width: '420px',
        padding: '30px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }} className="glass-panel glass-panel-neon-cyan">

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', color: 'var(--accent-cyan)', fontFamily: 'Orbitron', letterSpacing: '1px' }}>
            {authTab === 'signin' ? 'ESTABLISH COMMAND LINK' : 'CREATE COMMAND PROTOCOL'}
          </h2>
          <button
            className="btn-sci-fi btn-danger"
            style={{ padding: '4px 8px', fontSize: '10px' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              borderBottom: authTab === 'signin' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
              color: authTab === 'signin' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              padding: '10px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontFamily: 'Outfit'
            }}
            onClick={() => { onSetTab('signin'); }}
          >
            SIGN IN
          </button>
          <button
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              borderBottom: authTab === 'register' ? '2px solid var(--accent-cyan)' : '2px solid transparent',
              color: authTab === 'register' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              padding: '10px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontFamily: 'Outfit'
            }}
            onClick={() => { onSetTab('register'); }}
          >
            REGISTER
          </button>
        </div>

        {/* Notification messages */}
        {authError && (
          <div style={{
            background: 'rgba(255, 0, 127, 0.1)',
            border: '1px solid var(--accent-magenta)',
            padding: '10px',
            borderRadius: '6px',
            color: 'var(--accent-magenta)',
            fontSize: '12px',
            fontWeight: 'bold',
            fontFamily: 'Share Tech Mono'
          }}>
            [ERROR] {authError}
          </div>
        )}
        {authSuccess && (
          <div style={{
            background: 'rgba(57, 255, 20, 0.1)',
            border: '1px solid var(--accent-green)',
            padding: '10px',
            borderRadius: '6px',
            color: 'var(--accent-green)',
            fontSize: '12px',
            fontWeight: 'bold',
            fontFamily: 'Share Tech Mono'
          }}>
            [SUCCESS] {authSuccess}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={authTab === 'signin' ? onLogin : onRegister} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>COMMANDER EMAIL</label>
            <input
              type="email"
              value={authEmail}
              onChange={(e) => onSetEmail(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                padding: '10px',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'Outfit'
              }}
              placeholder="name@domain.com"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>ACCESS PASSWORD (MIN 8 CHARS)</label>
            <input
              type="password"
              value={authPassword}
              onChange={(e) => onSetPassword(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                padding: '10px',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'Outfit'
              }}
              placeholder="••••••••"
              required
            />
          </div>

          <button className="btn-sci-fi" type="submit" style={{ justifyContent: 'center', marginTop: '5px' }}>
            {authTab === 'signin' ? 'INITIATE CONNECTION' : 'CREATE PROTOCOL'}
          </button>
        </form>

        {isGoogleAuthEnabled && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '5px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
            </div>

            <button
              className="btn-sci-fi"
              type="button"
              style={{
                justifyContent: 'center',
                background: 'rgba(255, 255, 255, 0.05)',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                width: '100%',
                marginTop: '5px'
              }}
              onClick={() => {
                const stateParam = window.location.search;
                window.location.href = `/api/auth/google?state=${encodeURIComponent(stateParam)}`;
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: '8px' }}>
                <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7v2.24h2.9c1.69-1.55 2.69-3.85 2.69-6.57z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.23l-2.9-2.24c-.8.54-1.84.87-3.06.87-2.35 0-4.34-1.58-5.05-3.72H.95v2.3C2.43 15.89 5.5 18 9 18z"/>
                <path fill="#FBBC05" d="M3.95 10.68c-.18-.54-.28-1.12-.28-1.68s.1-1.14.28-1.68V5.02H.95C.34 6.22 0 7.57 0 9s.34 2.78.95 3.98l3-2.3z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.47.89 11.43 0 9 0 5.5 0 2.43 2.11.95 5.02l3 2.3c.71-2.14 2.7-3.72 5.05-3.72z"/>
              </svg>
              SIGN IN WITH GOOGLE
            </button>
          </>
        )}
      </div>
    </div>
  );
};
