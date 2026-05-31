import React from 'react';

interface ToastHudProps {
  message: string | null;
  type: 'success' | 'info' | 'warning';
}

export const ToastHud: React.FC<ToastHudProps> = ({ message, type }) => {
  if (!message) return null;

  const bgColor =
    type === 'success'
      ? 'rgba(0, 180, 90, 0.96)'
      : type === 'warning'
        ? 'rgba(200, 120, 0, 0.96)'
        : 'rgba(0, 140, 200, 0.96)';

  const borderColor =
    type === 'success' ? '#39ff14' : type === 'warning' ? '#ffaa00' : '#00f0ff';

  const boxShadow =
    type === 'success'
      ? 'rgba(57,255,20,0.35)'
      : type === 'warning'
        ? 'rgba(255,170,0,0.35)'
        : 'rgba(0,240,255,0.35)';

  return (
    <div style={{
      position: 'fixed',
      bottom: '30px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: bgColor,
      border: `2px solid ${borderColor}`,
      boxShadow: `0 4px 24px ${boxShadow}`,
      color: 'white',
      padding: '12px 28px',
      borderRadius: '8px',
      zIndex: 10001,
      fontWeight: 'bold',
      fontFamily: 'Share Tech Mono',
      letterSpacing: '0.5px',
      fontSize: '14px',
      pointerEvents: 'none',
      whiteSpace: 'nowrap'
    }} className="pulse-light">
      {message}
    </div>
  );
};
