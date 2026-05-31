import React from 'react';

interface AlertHudProps {
  message: string | null;
}

export const AlertHud: React.FC<AlertHudProps> = ({ message }) => {
  if (!message) return null;
  return (
    <div style={{
      position: 'absolute',
      top: '90px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(255, 0, 127, 0.95)',
      border: '2px solid var(--accent-magenta)',
      boxShadow: '0 0 20px rgba(255,0,127,0.5)',
      color: 'white',
      padding: '10px 24px',
      borderRadius: '6px',
      zIndex: 100,
      fontWeight: 'bold',
      fontFamily: 'Share Tech Mono',
      letterSpacing: '1px',
      pointerEvents: 'none'
    }} className="pulse-light">
      {message}
    </div>
  );
};
