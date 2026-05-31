import React from 'react';

interface ImportRulesModalProps {
  isOpen: boolean;
  importString: string;
  importError: string | null;
  onSetImportString: (v: string) => void;
  onProcessImport: () => void;
  onClose: () => void;
}

export const ImportRulesModal: React.FC<ImportRulesModalProps> = ({
  isOpen,
  importString,
  importError,
  onSetImportString,
  onProcessImport,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(5, 10, 20, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      pointerEvents: 'auto',
      color: 'white',
      fontFamily: 'Share Tech Mono'
    }}>
      <div style={{
        width: '500px',
        padding: '30px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }} className="glass-panel glass-panel-neon-cyan">

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'Orbitron', color: 'var(--accent-cyan)', margin: 0, fontSize: '18px' }}>
            IMPORT RULESET PROTOCOL
          </h2>
          <button className="btn-sci-fi btn-danger" onClick={onClose}>✕</button>
        </div>

        {importError && (
          <div style={{
            padding: '10px',
            background: 'rgba(255, 0, 127, 0.1)',
            border: '1px solid rgba(255, 0, 127, 0.3)',
            borderRadius: '4px',
            color: 'var(--accent-magenta)',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            {importError}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PASTE CONFIGURATION STRING</label>
          <textarea
            value={importString}
            onChange={(e) => onSetImportString(e.target.value)}
            placeholder="Paste SS-RULES-V1-... string here"
            style={{
              width: '100%',
              height: '150px',
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              padding: '10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'monospace',
              boxSizing: 'border-box',
              resize: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '15px' }}>
          <button className="btn-sci-fi" onClick={onProcessImport} style={{ flex: 1, justifyContent: 'center' }}>
            DECRYPT & PREVIEW
          </button>
          <button className="btn-sci-fi btn-danger" onClick={onClose}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
};
