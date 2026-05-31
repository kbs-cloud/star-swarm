import React from 'react';
import { GameNotification } from '../../types';

interface NotificationsStackProps {
  notifications: GameNotification[];
  onDismiss: (id: string, systemId?: number) => void;
}

export const NotificationsStack: React.FC<NotificationsStackProps> = ({
  notifications,
  onDismiss
}) => {
  if (notifications.length === 0) return null;

  const borderColors: Record<string, string> = {
    turn_start: 'rgba(0, 240, 255, 0.4)',
    production: 'rgba(57, 255, 20, 0.4)',
    info: 'rgba(0, 240, 255, 0.3)',
    success: 'rgba(57, 255, 20, 0.3)',
    warning: 'rgba(255, 170, 0, 0.3)'
  };
  const glowColors: Record<string, string> = {
    turn_start: 'rgba(0, 240, 255, 0.15)',
    production: 'rgba(57, 255, 20, 0.15)',
    info: 'rgba(0, 240, 255, 0.1)',
    success: 'rgba(57, 255, 20, 0.1)',
    warning: 'rgba(255, 170, 0, 0.1)'
  };

  return (
    <div style={{
      position: 'fixed',
      top: '95px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10002,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      width: '380px',
      maxWidth: '90vw',
      pointerEvents: 'none'
    }}>
      {notifications.map(notif => {
        const isProd = notif.type === 'production';
        const bgGradient = isProd
          ? 'linear-gradient(135deg, rgba(13, 29, 15, 0.9) 0%, rgba(5, 13, 6, 0.95) 100%)'
          : 'linear-gradient(135deg, rgba(10, 15, 29, 0.9) 0%, rgba(5, 7, 13, 0.95) 100%)';
        const borderColor = borderColors[notif.type] || borderColors.info;
        const glowColor = glowColors[notif.type] || glowColors.info;

        return (
          <div
            key={notif.id}
            onClick={() => onDismiss(notif.id, notif.systemId)}
            style={{
              background: bgGradient,
              backdropFilter: 'blur(12px)',
              border: `1px solid ${borderColor}`,
              boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.6), inset 0 0 15px ${glowColor}`,
              borderRadius: '8px',
              padding: '12px 16px',
              color: 'white',
              cursor: 'pointer',
              pointerEvents: 'auto',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              fontFamily: 'Outfit, sans-serif',
              transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
              userSelect: 'none',
              animation: 'slideDownFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
            className="notification-card"
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
              e.currentTarget.style.borderColor = isProd ? 'var(--accent-green)' : 'var(--accent-cyan)';
              e.currentTarget.style.boxShadow = `0 12px 40px 0 rgba(0, 0, 0, 0.7), 0 0 15px ${isProd ? 'rgba(57,255,20,0.3)' : 'rgba(0,240,255,0.3)'}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.borderColor = borderColor;
              e.currentTarget.style.boxShadow = `0 8px 32px 0 rgba(0, 0, 0, 0.6), inset 0 0 15px ${glowColor}`;
            }}
            title={notif.systemId !== undefined ? 'Left-click to center on planet & dismiss' : 'Left-click to dismiss'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '13px', lineHeight: '1.4', flex: 1, minWidth: 0, textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {notif.message}
              </span>
              {notif.systemId !== undefined && (
                <span style={{
                  fontSize: '11px',
                  color: 'var(--accent-cyan)',
                  background: 'rgba(0, 240, 255, 0.1)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontFamily: 'Share Tech Mono',
                  whiteSpace: 'nowrap'
                }}>
                  LOCATE 📍
                </span>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(notif.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '4px 6px',
                lineHeight: '1',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              title="Dismiss only"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
};
