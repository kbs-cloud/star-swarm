import React from 'react';
import { UserAccount } from '../../game/auth';
import { requestToJoin } from '../../game/gameApi';

interface JoinRequestOverlayProps {
  pendingJoinGameId: string | null;
  myJoinStatus: 'pending' | 'accepted' | 'rejected' | null;
  currentUser: UserAccount | null;
  guestName: string;
  onUpdateGuestName: (val: string) => void;
  onCancel: () => void;
  onShowError: (msg: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warning') => void;
  onSetMyJoinStatus: (status: 'pending' | 'accepted' | 'rejected' | null) => void;
}

export const JoinRequestOverlay: React.FC<JoinRequestOverlayProps> = ({
  pendingJoinGameId,
  myJoinStatus,
  currentUser,
  guestName,
  onUpdateGuestName,
  onCancel,
  onShowError,
  onShowToast,
  onSetMyJoinStatus
}) => {
  if (!pendingJoinGameId) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, width: '100vw', height: '100dvh',
      background: 'rgba(5, 10, 20, 0.93)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      zIndex: 9000,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: 'Orbitron'
    }}>
      <div style={{
        width: '480px',
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        textAlign: 'center'
      }} className="glass-panel glass-panel-neon-cyan pulse-light">
        <div style={{ fontSize: '52px' }}>📡</div>
        <h2 style={{ fontSize: '22px', color: 'var(--accent-cyan)', letterSpacing: '2px', margin: 0 }}>
          {myJoinStatus === 'rejected' ? 'REQUEST DECLINED' : 'AWAITING HOST CLEARANCE'}
        </h2>
        {myJoinStatus === 'rejected' ? (
          <div style={{ fontSize: '14px', color: 'var(--accent-magenta)', lineHeight: '1.6' }}>
            The host has declined your join request.
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            {myJoinStatus === 'pending'
              ? 'Your join request has been sent. Waiting for the host to assign you a faction slot…'
              : 'No free faction slots were available in this simulation. Click below to request a slot from the host.'}
          </div>
        )}

        {!currentUser && myJoinStatus !== 'pending' && myJoinStatus !== 'rejected' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left', width: '100%', marginBottom: '15px' }}>
            <label style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontFamily: 'Orbitron' }}>ENTER DISPLAY NAME TO JOIN:</label>
            <input
              type="text"
              placeholder="e.g. Admiral Alice"
              value={guestName}
              onChange={(e) => onUpdateGuestName(e.target.value)}
              className="input-sci-fi"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                borderRadius: '4px',
                padding: '8px 12px',
                color: 'white',
                fontSize: '13px',
                fontFamily: 'Share Tech Mono',
                outline: 'none'
              }}
            />
          </div>
        )}

        {myJoinStatus !== 'pending' && myJoinStatus !== 'rejected' && (
          <button
            className="btn-sci-fi pulse-light"
            style={{ justifyContent: 'center', fontSize: '13px' }}
            onClick={async () => {
              if (!pendingJoinGameId) return;
              if (!currentUser && (!guestName || guestName.trim().length === 0)) {
                onShowError('Please enter a display name.');
                return;
              }
              const emailParam = currentUser ? undefined : guestName;
              const res = await requestToJoin(pendingJoinGameId, emailParam);
              if (res.success) {
                onSetMyJoinStatus('pending');
                onShowToast('📡 Join request sent! Waiting for host approval…', 'info');
              } else {
                onShowError(res.error || 'Failed to send join request.');
              }
            }}
          >
            REQUEST TO JOIN SIMULATION
          </button>
        )}

        {myJoinStatus === 'pending' && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }} className="animate-pulse">
            [POLLING HOST RESPONSE…]
          </div>
        )}

        <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.08)' }} />

        <button
          className="btn-sci-fi btn-danger"
          style={{ justifyContent: 'center', fontSize: '12px' }}
          onClick={onCancel}
        >
          CANCEL & RETURN TO MENU
        </button>
      </div>
    </div>
  );
};
