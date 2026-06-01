import React from 'react';
import { UserAccount } from '../../game/auth';
import { updatePassword } from '../../game/gameApi';
import { isElectronMode } from '../../utils/env';


interface SettingsScreenProps {
  currentUser: UserAccount | null;
  settingsDisplayName: string;
  setSettingsDisplayName: (v: string) => void;
  settingsNewPassword: string;
  setSettingsNewPassword: (v: string) => void;
  settingsConfirmPassword: string;
  setSettingsConfirmPassword: (v: string) => void;
  passwordStatusMessage: string | null;
  setPasswordStatusMessage: (v: string | null) => void;
  passwordStatusType: 'success' | 'error' | null;
  setPasswordStatusType: (v: 'success' | 'error' | null) => void;
  onSaveSettings: () => void;
  onCancel: () => void;
  onShowError: (msg: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
  onSetCurrentUser: (user: UserAccount | null) => void;
  onNavigateMenu: () => void;
  settingsCompactMode: boolean;
  setSettingsCompactMode: (v: boolean) => void;
  isMobile?: boolean;
  settingsPlayOnline: boolean;
  setSettingsPlayOnline: (v: boolean) => void;
  settingsServerUrl: string;
  setSettingsServerUrl: (v: string) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  currentUser,
  settingsDisplayName,
  setSettingsDisplayName,
  settingsNewPassword,
  setSettingsNewPassword,
  settingsConfirmPassword,
  setSettingsConfirmPassword,
  passwordStatusMessage,
  setPasswordStatusMessage,
  passwordStatusType,
  setPasswordStatusType,
  onSaveSettings,
  onCancel,
  onShowToast,
  onSetCurrentUser,
  onNavigateMenu,
  settingsCompactMode,
  setSettingsCompactMode,
  isMobile = false,
  settingsPlayOnline,
  setSettingsPlayOnline,
  settingsServerUrl,
  setSettingsServerUrl
}) => {
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatusMessage(null);
    setPasswordStatusType(null);

    if (!currentUser) {
      setPasswordStatusMessage('You must be logged in to change your password.');
      setPasswordStatusType('error');
      return;
    }

    if (!settingsNewPassword || settingsNewPassword.length < 8) {
      setPasswordStatusMessage('New password must be at least 8 characters long.');
      setPasswordStatusType('error');
      return;
    }

    if (settingsNewPassword !== settingsConfirmPassword) {
      setPasswordStatusMessage('New passwords do not match.');
      setPasswordStatusType('error');
      return;
    }

    const res = await updatePassword(settingsNewPassword);
    if (res.success) {
      setPasswordStatusMessage('Password updated successfully. You will be logged out...');
      setPasswordStatusType('success');
      onShowToast('Password updated successfully. Re-authenticating...', 'success');
      setSettingsNewPassword('');
      setSettingsConfirmPassword('');
      setTimeout(() => {
        onSetCurrentUser(null);
        onNavigateMenu();
        window.location.reload();
      }, 2000);
    } else {
      setPasswordStatusMessage(res.error || 'Failed to change password.');
      setPasswordStatusType('error');
    }
  };

  return (
    <div style={{
      height: 'calc(100vh - 40px)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
      position: 'relative',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        width: '450px',
        maxWidth: '100%',
        maxHeight: '100%',
        overflowY: 'auto',
        padding: '30px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxSizing: 'border-box'
      }} className="glass-panel glass-panel-neon-cyan">
        <h2 style={{ fontSize: '24px', color: 'var(--accent-cyan)', textAlign: 'center', fontFamily: 'Orbitron' }}>
          COMMANDER SETTINGS
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'Share Tech Mono' }}>
            Global Display Name
          </label>
          <input
            type="text"
            value={settingsDisplayName}
            onChange={(e) => setSettingsDisplayName(e.target.value)}
            placeholder="Enter display name..."
            style={{
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              padding: '10px 14px',
              borderRadius: '4px',
              fontSize: '14px',
              fontFamily: 'Share Tech Mono'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
          <input
            type="checkbox"
            id="compact-mode-checkbox"
            checked={settingsCompactMode || isMobile}
            disabled={isMobile}
            onChange={(e) => setSettingsCompactMode(e.target.checked)}
            style={{
              width: '18px',
              height: '18px',
              accentColor: 'var(--accent-cyan)',
              cursor: isMobile ? 'not-allowed' : 'pointer',
              opacity: isMobile ? 0.7 : 1
            }}
          />
          <label
            htmlFor="compact-mode-checkbox"
            style={{
              fontSize: '12px',
              color: isMobile ? 'var(--accent-cyan)' : 'var(--text-primary)',
              fontFamily: 'Share Tech Mono',
              cursor: isMobile ? 'default' : 'pointer',
              userSelect: 'none',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
          >
            Enable Compact Mode {isMobile ? '(Auto-Active on Mobile Viewport)' : '(Mobile Optimized)'}
          </label>
        </div>

        {/* Server Connection Options (Only in Electron Mode) */}
        {isElectronMode() && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '15px' }}>
            <h3 style={{ fontSize: '14px', color: 'var(--accent-cyan)', fontFamily: 'Orbitron', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Server Connection Setup
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                id="play-online-checkbox"
                checked={settingsPlayOnline}
                onChange={(e) => setSettingsPlayOnline(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: 'var(--accent-cyan)',
                  cursor: 'pointer'
                }}
              />
              <label
                htmlFor="play-online-checkbox"
                style={{
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'Share Tech Mono',
                  cursor: 'pointer',
                  userSelect: 'none',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}
              >
                Play via Server (Online Mode)
              </label>
            </div>

            {settingsPlayOnline && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'Share Tech Mono' }}>
                  Server Connection URL
                </label>
                <input
                  type="text"
                  value={settingsServerUrl}
                  onChange={(e) => setSettingsServerUrl(e.target.value)}
                  placeholder="http://localhost:3001"
                  style={{
                    background: 'rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontFamily: 'Share Tech Mono'
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Security Section (Change Password) */}
        {currentUser && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '15px' }}>
            <h3 style={{ fontSize: '14px', color: 'var(--accent-cyan)', fontFamily: 'Orbitron', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Set / Change Password
            </h3>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', lineHeight: '1.4' }}>
              {currentUser.hasPassword
                ? 'Update your account password. This will log you out of all devices/sessions.'
                : 'Create a password to allow standard email & password login alongside Google Sign-In.'}
            </div>

            <form onSubmit={handleSavePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {passwordStatusMessage && (
                <div style={{
                  background: passwordStatusType === 'success' ? 'rgba(57, 255, 20, 0.1)' : 'rgba(255, 0, 127, 0.1)',
                  border: passwordStatusType === 'success' ? '1px solid var(--accent-green)' : '1px solid var(--accent-magenta)',
                  padding: '8px 10px',
                  borderRadius: '4px',
                  color: passwordStatusType === 'success' ? 'var(--accent-green)' : 'var(--accent-magenta)',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  fontFamily: 'Share Tech Mono'
                }}>
                  [{passwordStatusType === 'success' ? 'SUCCESS' : 'ERROR'}] {passwordStatusMessage}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'Share Tech Mono' }}>
                  New Password (Min 8 chars)
                </label>
                <input
                  type="password"
                  value={settingsNewPassword}
                  onChange={(e) => setSettingsNewPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    background: 'rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontFamily: 'Share Tech Mono'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'Share Tech Mono' }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={settingsConfirmPassword}
                  onChange={(e) => setSettingsConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    background: 'rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontFamily: 'Share Tech Mono'
                  }}
                  required
                />
              </div>

              <button className="btn-sci-fi" type="submit" style={{ justifyContent: 'center', marginTop: '5px', fontSize: '12px', padding: '8px 16px' }}>
                SET NEW PASSWORD
              </button>
            </form>
          </div>
        )}

        <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
          <button className="btn-sci-fi" onClick={onSaveSettings} style={{ flex: 1, justifyContent: 'center' }}>
            SAVE CHANGES
          </button>
          <button className="btn-sci-fi btn-danger" onClick={onCancel}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
};
