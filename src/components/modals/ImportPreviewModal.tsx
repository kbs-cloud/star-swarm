import React from 'react';
import { GameRules } from '../../game/gameState';

interface ImportPreviewModalProps {
  isOpen: boolean;
  importRulesPreview: GameRules | null;
  importOriginalVersion: number | null;
  importPreviewErrors: string[];
  newImportShipTypeKey: string;
  onSetImportRulesPreview: (rules: GameRules | null) => void;
  onSetNewImportShipTypeKey: (key: string) => void;
  onConfirmImport: () => void;
  onClose: () => void;
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
  isOpen,
  importRulesPreview,
  importOriginalVersion,
  importPreviewErrors,
  newImportShipTypeKey,
  onSetImportRulesPreview,
  onSetNewImportShipTypeKey,
  onConfirmImport,
  onClose
}) => {
  if (!isOpen || !importRulesPreview) return null;

  const setPreview = (rules: GameRules) => onSetImportRulesPreview(rules);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100dvh',
      background: 'rgba(5, 10, 20, 0.95)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      pointerEvents: 'auto',
      color: 'white',
      fontFamily: 'Share Tech Mono'
    }}>
      <div style={{
        width: '800px',
        padding: '30px',
        maxHeight: '90vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }} className="glass-panel glass-panel-neon-magenta">

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'Orbitron', color: 'var(--accent-magenta)', margin: 0 }}>
            RULESET IMPORT PREVIEW & MIGRATION
          </h2>
          <button className="btn-sci-fi btn-danger" onClick={onClose}>✕</button>
        </div>

        {importOriginalVersion !== null && importOriginalVersion !== 1 ? (
          <div style={{
            padding: '12px',
            background: 'rgba(255, 170, 0, 0.1)',
            border: '1px solid rgba(255, 170, 0, 0.3)',
            color: '#ffaa00',
            borderRadius: '6px',
            fontSize: '12px',
            lineHeight: '1.5'
          }}>
            <strong>⚠️ SCHEMA MIGRATION DETECTED:</strong> This ruleset is version <strong>V{importOriginalVersion}</strong>, but the current options configuration is <strong>V1</strong>. Missing or deprecated properties have been automatically migrated to default values. Please review the settings below before importing.
          </div>
        ) : (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(0, 240, 255, 0.05)',
            border: '1px solid rgba(0, 240, 255, 0.2)',
            color: 'var(--accent-cyan)',
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            ✓ Version Check OK (Ruleset Version V1 verified). Ready to import.
          </div>
        )}

        {importPreviewErrors.length > 0 && (
          <div style={{ padding: '10px', background: 'rgba(255, 0, 127, 0.1)', border: '1px solid rgba(255, 0, 127, 0.3)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {importPreviewErrors.map((err, idx) => (
              <div key={idx} style={{ color: 'var(--accent-magenta)', fontSize: '12px', fontWeight: 'bold' }}>• {err}</div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>RULESET NAME</label>
              <input
                type="text"
                value={importRulesPreview.name}
                onChange={(e) => setPreview({ ...importRulesPreview, name: e.target.value })}
                style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '6px 10px', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>DESCRIPTION</label>
              <textarea
                value={importRulesPreview.description}
                onChange={(e) => setPreview({ ...importRulesPreview, description: e.target.value })}
                style={{ width: '100%', height: '50px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', resize: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={importRulesPreview.enableCredits}
                  onChange={(e) => setPreview({ ...importRulesPreview, enableCredits: e.target.checked })}
                  style={{ accentColor: 'var(--accent-cyan)' }} />
                <span>ENABLE CREDITS / ECONOMY</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={importRulesPreview.enableUpgrades}
                  onChange={(e) => setPreview({ ...importRulesPreview, enableUpgrades: e.target.checked })}
                  style={{ accentColor: 'var(--accent-cyan)' }} />
                <span>ENABLE BASE & TECH UPGRADES</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={importRulesPreview.captureRequiresColonyShip}
                  onChange={(e) => setPreview({ ...importRulesPreview, captureRequiresColonyShip: e.target.checked })}
                  style={{ accentColor: 'var(--accent-cyan)' }} />
                <span>ANNEXING NEUTRALS REQUIRES COLONY SHIP</span>
              </label>
            </div>

            {importRulesPreview.enableCredits && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', background: 'rgba(0, 240, 255, 0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(0, 240, 255, 0.08)' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>START CREDITS</label>
                  <input type="number" value={importRulesPreview.startingResources}
                    onChange={(e) => setPreview({ ...importRulesPreview, startingResources: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>BASE INCOME</label>
                  <input type="number" value={importRulesPreview.resourcesPerTurn.base}
                    onChange={(e) => setPreview({ ...importRulesPreview, resourcesPerTurn: { ...importRulesPreview.resourcesPerTurn, base: parseInt(e.target.value) || 0 } })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>RAND INCOME</label>
                  <input type="number" value={importRulesPreview.resourcesPerTurn.randomAdd}
                    onChange={(e) => setPreview({ ...importRulesPreview, resourcesPerTurn: { ...importRulesPreview.resourcesPerTurn, randomAdd: parseInt(e.target.value) || 0 } })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(57, 255, 20, 0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(57, 255, 20, 0.08)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={importRulesPreview.nodeProduction.enabled}
                  onChange={(e) => setPreview({ ...importRulesPreview, nodeProduction: { ...importRulesPreview.nodeProduction, enabled: e.target.checked } })}
                  style={{ accentColor: 'var(--accent-green)' }} />
                <span>ENABLE AUTOMATED NODE PRODUCTION</span>
              </label>
              {importRulesPreview.nodeProduction.enabled && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SHIPS PER TURN</label>
                    <input type="number" value={importRulesPreview.nodeProduction.shipsPerTurn}
                      onChange={(e) => setPreview({ ...importRulesPreview, nodeProduction: { ...importRulesPreview.nodeProduction, shipsPerTurn: parseInt(e.target.value) || 0 } })}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SHIP TYPE</label>
                    <select value={importRulesPreview.nodeProduction.shipType}
                      onChange={(e) => setPreview({ ...importRulesPreview, nodeProduction: { ...importRulesPreview.nodeProduction, shipType: e.target.value } })}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}>
                      {Object.keys(importRulesPreview.ships).map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-primary)' }}>BASE STAR SIGHT RANGE</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input type="range" min="1" max="20" step="0.5" value={importRulesPreview.starSightRange ?? 6.0}
                  onChange={(e) => setPreview({ ...importRulesPreview, starSightRange: parseFloat(e.target.value) || 6.0 })}
                  style={{ flex: 1, accentColor: 'var(--accent-cyan)' }} />
                <span className="telemetry" style={{ width: '50px', textAlign: 'right', fontSize: '12px' }}>{importRulesPreview.starSightRange ?? 6.0} LY</span>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-primary)' }}>NEUTRAL DEFENSE COMPOSITION</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>MIN SHIPS</label>
                  <input type="number" value={importRulesPreview.neutralStartingShipsRange.min}
                    onChange={(e) => setPreview({ ...importRulesPreview, neutralStartingShipsRange: { ...importRulesPreview.neutralStartingShipsRange, min: parseInt(e.target.value) || 0 } })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>MAX SHIPS</label>
                  <input type="number" value={importRulesPreview.neutralStartingShipsRange.max}
                    onChange={(e) => setPreview({ ...importRulesPreview, neutralStartingShipsRange: { ...importRulesPreview.neutralStartingShipsRange, max: parseInt(e.target.value) || 0 } })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>SHIP TYPE</label>
                  <select value={importRulesPreview.neutralStartingShipsRange.type}
                    onChange={(e) => setPreview({ ...importRulesPreview, neutralStartingShipsRange: { ...importRulesPreview.neutralStartingShipsRange, type: e.target.value } })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}>
                    {Object.keys(importRulesPreview.ships).map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-primary)' }}>FACTION STARTING FLEETS</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {Object.keys(importRulesPreview.ships).map(type => (
                  <div key={type}>
                    <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{type.toUpperCase()}</label>
                    <input type="number" value={importRulesPreview.startingShips[type] || 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setPreview({ ...importRulesPreview, startingShips: { ...importRulesPreview.startingShips, [type]: val } });
                      }}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Ship Types Manager */}
        <div style={{ background: 'rgba(255,255,255,0.01)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '14px', color: 'var(--accent-magenta)', margin: 0 }}>SHIP TYPES SCHEMA</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" placeholder="e.g. Destroyer" value={newImportShipTypeKey}
                onChange={(e) => onSetNewImportShipTypeKey(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }} />
              <button className="btn-sci-fi" style={{ padding: '4px 10px', fontSize: '11px' }}
                onClick={() => {
                  const key = newImportShipTypeKey.trim();
                  if (key && !importRulesPreview.ships[key]) {
                    const updatedShips = { ...importRulesPreview.ships, [key]: { name: key, cost: 10, speed: 3.0, hp: 1, attack: 1, hitChance: 0.5, description: 'Custom combat hull.' } };
                    setPreview({ ...importRulesPreview, ships: updatedShips, startingShips: { ...importRulesPreview.startingShips, [key]: 0 } });
                    onSetNewImportShipTypeKey('');
                  }
                }}>ADD HULL TYPE</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
            {Object.entries(importRulesPreview.ships).map(([type, shipDef]) => (
              <div key={type} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '10px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: 'white', fontSize: '13px' }}>Hull Protocol: {type}</strong>
                  {Object.keys(importRulesPreview.ships).length > 1 && (
                    <button className="btn-sci-fi btn-danger" style={{ padding: '2px 6px', fontSize: '10px' }}
                      onClick={() => {
                        const newShips = { ...importRulesPreview.ships }; delete newShips[type];
                        const newStarting = { ...importRulesPreview.startingShips }; delete newStarting[type];
                        let newProdType = importRulesPreview.nodeProduction.shipType;
                        if (newProdType === type) newProdType = Object.keys(newShips)[0] || '';
                        let newNeutralType = importRulesPreview.neutralStartingShipsRange.type;
                        if (newNeutralType === type) newNeutralType = Object.keys(newShips)[0] || '';
                        setPreview({ ...importRulesPreview, ships: newShips, startingShips: newStarting, nodeProduction: { ...importRulesPreview.nodeProduction, shipType: newProdType }, neutralStartingShipsRange: { ...importRulesPreview.neutralStartingShipsRange, type: newNeutralType } });
                      }}>REMOVE</button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                  {importRulesPreview.enableCredits && (
                    <div><label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>BUILD COST</label>
                      <input type="number" value={shipDef.cost} onChange={(e) => { const val = parseInt(e.target.value)||0; setPreview({ ...importRulesPreview, ships: { ...importRulesPreview.ships, [type]: { ...shipDef, cost: val } } }); }} style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }} /></div>
                  )}
                  <div><label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>SPEED (LY/T)</label>
                    <input type="number" step="0.1" value={shipDef.speed} onChange={(e) => { const val = parseFloat(e.target.value)||0.1; setPreview({ ...importRulesPreview, ships: { ...importRulesPreview.ships, [type]: { ...shipDef, speed: val } } }); }} style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }} /></div>
                  <div><label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>STRUCTURAL HP</label>
                    <input type="number" value={shipDef.hp} onChange={(e) => { const val = parseInt(e.target.value)||1; setPreview({ ...importRulesPreview, ships: { ...importRulesPreview.ships, [type]: { ...shipDef, hp: val } } }); }} style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }} /></div>
                  <div><label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>WEAPON DAMAGE</label>
                    <input type="number" value={shipDef.attack} onChange={(e) => { const val = parseInt(e.target.value)||0; setPreview({ ...importRulesPreview, ships: { ...importRulesPreview.ships, [type]: { ...shipDef, attack: val } } }); }} style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }} /></div>
                  <div><label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>HIT CHANCE (0-1)</label>
                    <input type="number" step="0.05" value={shipDef.hitChance} onChange={(e) => { const val = parseFloat(e.target.value)||0.0; setPreview({ ...importRulesPreview, ships: { ...importRulesPreview.ships, [type]: { ...shipDef, hitChance: val } } }); }} style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
          <button className="btn-sci-fi" onClick={onConfirmImport} style={{ flex: 1, justifyContent: 'center' }}>
            CONFIRM IMPORT PROTOCOL
          </button>
          <button className="btn-sci-fi btn-danger" onClick={onClose}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
};
