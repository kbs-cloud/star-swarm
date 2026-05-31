import React from 'react';
import { GameRules } from '../../game/gameState';

interface RulesEditorModalProps {
  isOpen: boolean;
  editingRules: GameRules | null;
  editorErrors: string[];
  newShipTypeKey: string;
  onSetEditingRules: (rules: GameRules | null) => void;
  onSetNewShipTypeKey: (key: string) => void;
  onSaveRules: () => void;
  onClose: () => void;
}

export const RulesEditorModal: React.FC<RulesEditorModalProps> = ({
  isOpen,
  editingRules,
  editorErrors,
  newShipTypeKey,
  onSetEditingRules,
  onSetNewShipTypeKey,
  onSaveRules,
  onClose
}) => {
  if (!isOpen || !editingRules) return null;

  const setEditingRules = (rules: GameRules) => onSetEditingRules(rules);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(5, 10, 20, 0.95)',
      backdropFilter: 'blur(10px)',
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
      }} className="glass-panel glass-panel-neon-cyan">

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'Orbitron', color: 'var(--accent-cyan)', margin: 0 }}>
            {editingRules.isDefault ? 'GALACTIC RULESET PROTOCOLS (READ-ONLY)' : 'CUSTOM RULESET DESIGNER'}
          </h2>
          <button className="btn-sci-fi btn-danger" onClick={onClose}>✕</button>
        </div>

        {editingRules.isDefault && (
          <div style={{ padding: '8px 12px', background: 'rgba(0, 240, 255, 0.05)', border: '1px solid rgba(0, 240, 255, 0.2)', color: 'var(--accent-cyan)', borderRadius: '4px', fontSize: '12px' }}>
            [NOTICE] Default rulesets cannot be modified. To customize these rules, return to the lobby and click &quot;COPY MODE&quot; to create a custom template.
          </div>
        )}

        {editorErrors.length > 0 && (
          <div style={{ padding: '10px', background: 'rgba(255, 0, 127, 0.1)', border: '1px solid rgba(255, 0, 127, 0.3)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {editorErrors.map((err, idx) => (
              <div key={idx} style={{ color: 'var(--accent-magenta)', fontSize: '12px', fontWeight: 'bold' }}>• {err}</div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Left Column - Meta & Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>RULESET NAME</label>
              <input
                type="text"
                disabled={editingRules.isDefault}
                value={editingRules.name}
                onChange={(e) => setEditingRules({ ...editingRules, name: e.target.value })}
                style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '6px 10px', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>DESCRIPTION</label>
              <textarea
                disabled={editingRules.isDefault}
                value={editingRules.description}
                onChange={(e) => setEditingRules({ ...editingRules, description: e.target.value })}
                style={{ width: '100%', height: '50px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', resize: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  disabled={editingRules.isDefault}
                  checked={editingRules.enableCredits}
                  onChange={(e) => setEditingRules({ ...editingRules, enableCredits: e.target.checked })}
                  style={{ accentColor: 'var(--accent-cyan)' }}
                />
                <span>ENABLE CREDITS / ECONOMY</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  disabled={editingRules.isDefault}
                  checked={editingRules.enableUpgrades}
                  onChange={(e) => setEditingRules({ ...editingRules, enableUpgrades: e.target.checked })}
                  style={{ accentColor: 'var(--accent-cyan)' }}
                />
                <span>ENABLE BASE & TECH UPGRADES</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  disabled={editingRules.isDefault}
                  checked={editingRules.captureRequiresColonyShip}
                  onChange={(e) => setEditingRules({ ...editingRules, captureRequiresColonyShip: e.target.checked })}
                  style={{ accentColor: 'var(--accent-cyan)' }}
                />
                <span>ANNEXING NEUTRALS REQUIRES COLONY SHIP</span>
              </label>
            </div>

            {editingRules.enableCredits && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', background: 'rgba(0, 240, 255, 0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(0, 240, 255, 0.08)' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>START CREDITS</label>
                  <input
                    type="number"
                    disabled={editingRules.isDefault}
                    value={editingRules.startingResources}
                    onChange={(e) => setEditingRules({ ...editingRules, startingResources: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>BASE INCOME</label>
                  <input
                    type="number"
                    disabled={editingRules.isDefault}
                    value={editingRules.resourcesPerTurn.base}
                    onChange={(e) => setEditingRules({
                      ...editingRules,
                      resourcesPerTurn: { ...editingRules.resourcesPerTurn, base: parseInt(e.target.value) || 0 }
                    })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>RAND INCOME</label>
                  <input
                    type="number"
                    disabled={editingRules.isDefault}
                    value={editingRules.resourcesPerTurn.randomAdd}
                    onChange={(e) => setEditingRules({
                      ...editingRules,
                      resourcesPerTurn: { ...editingRules.resourcesPerTurn, randomAdd: parseInt(e.target.value) || 0 }
                    })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Map/Production settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(57, 255, 20, 0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(57, 255, 20, 0.08)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  disabled={editingRules.isDefault}
                  checked={editingRules.nodeProduction.enabled}
                  onChange={(e) => setEditingRules({
                    ...editingRules,
                    nodeProduction: { ...editingRules.nodeProduction, enabled: e.target.checked }
                  })}
                  style={{ accentColor: 'var(--accent-green)' }}
                />
                <span>ENABLE AUTOMATED NODE PRODUCTION</span>
              </label>

              {editingRules.nodeProduction.enabled && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SHIPS PER TURN</label>
                    <input
                      type="number"
                      disabled={editingRules.isDefault}
                      value={editingRules.nodeProduction.shipsPerTurn}
                      onChange={(e) => setEditingRules({
                        ...editingRules,
                        nodeProduction: { ...editingRules.nodeProduction, shipsPerTurn: parseInt(e.target.value) || 0 }
                      })}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SHIP TYPE</label>
                    <select
                      disabled={editingRules.isDefault}
                      value={editingRules.nodeProduction.shipType}
                      onChange={(e) => setEditingRules({
                        ...editingRules,
                        nodeProduction: { ...editingRules.nodeProduction, shipType: e.target.value }
                      })}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                    >
                      {Object.keys(editingRules.ships).map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-primary)' }}>BASE STAR SIGHT RANGE</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  disabled={editingRules.isDefault}
                  value={editingRules.starSightRange ?? 6.0}
                  onChange={(e) => setEditingRules({ ...editingRules, starSightRange: parseFloat(e.target.value) || 6.0 })}
                  style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
                />
                <span className="telemetry" style={{ width: '50px', textAlign: 'right', fontSize: '12px' }}>{editingRules.starSightRange ?? 6.0} LY</span>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-primary)' }}>NEUTRAL DEFENSE COMPOSITION</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>MIN SHIPS</label>
                  <input
                    type="number"
                    disabled={editingRules.isDefault}
                    value={editingRules.neutralStartingShipsRange.min}
                    onChange={(e) => setEditingRules({
                      ...editingRules,
                      neutralStartingShipsRange: { ...editingRules.neutralStartingShipsRange, min: parseInt(e.target.value) || 0 }
                    })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>MAX SHIPS</label>
                  <input
                    type="number"
                    disabled={editingRules.isDefault}
                    value={editingRules.neutralStartingShipsRange.max}
                    onChange={(e) => setEditingRules({
                      ...editingRules,
                      neutralStartingShipsRange: { ...editingRules.neutralStartingShipsRange, max: parseInt(e.target.value) || 0 }
                    })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>SHIP TYPE</label>
                  <select
                    disabled={editingRules.isDefault}
                    value={editingRules.neutralStartingShipsRange.type}
                    onChange={(e) => setEditingRules({
                      ...editingRules,
                      neutralStartingShipsRange: { ...editingRules.neutralStartingShipsRange, type: e.target.value }
                    })}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                  >
                    {Object.keys(editingRules.ships).map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-primary)' }}>FACTION STARTING FLEETS</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {Object.keys(editingRules.ships).map(type => (
                  <div key={type}>
                    <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{type.toUpperCase()}</label>
                    <input
                      type="number"
                      disabled={editingRules.isDefault}
                      value={editingRules.startingShips[type] || 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setEditingRules({
                          ...editingRules,
                          startingShips: { ...editingRules.startingShips, [type]: val }
                        });
                      }}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Ship Types Manager Section */}
        <div style={{ background: 'rgba(255,255,255,0.01)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '14px', color: 'var(--accent-cyan)', margin: 0 }}>SHIP TYPES SCHEMA</h3>
            {!editingRules.isDefault && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. Destroyer"
                  value={newShipTypeKey}
                  onChange={(e) => onSetNewShipTypeKey(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}
                />
                <button
                  className="btn-sci-fi"
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                  onClick={() => {
                    const key = newShipTypeKey.trim();
                    if (key && !editingRules.ships[key]) {
                      const updatedShips = {
                        ...editingRules.ships,
                        [key]: {
                          name: key,
                          cost: 10,
                          speed: 3.0,
                          hp: 1,
                          attack: 1,
                          hitChance: 0.5,
                          description: 'Custom combat hull.'
                        }
                      };
                      setEditingRules({
                        ...editingRules,
                        ships: updatedShips,
                        startingShips: { ...editingRules.startingShips, [key]: 0 }
                      });
                      onSetNewShipTypeKey('');
                    }
                  }}
                >
                  ADD HULL TYPE
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
            {Object.entries(editingRules.ships).map(([type, shipDef]) => (
              <div key={type} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '10px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: 'white', fontSize: '13px' }}>Hull Protocol: {type}</strong>
                  {!editingRules.isDefault && Object.keys(editingRules.ships).length > 1 && (
                    <button
                      className="btn-sci-fi btn-danger"
                      style={{ padding: '2px 6px', fontSize: '10px' }}
                      onClick={() => {
                        const newShips = { ...editingRules.ships };
                        delete newShips[type];
                        const newStarting = { ...editingRules.startingShips };
                        delete newStarting[type];
                        let newProdType = editingRules.nodeProduction.shipType;
                        if (newProdType === type) newProdType = Object.keys(newShips)[0] || '';
                        let newNeutralType = editingRules.neutralStartingShipsRange.type;
                        if (newNeutralType === type) newNeutralType = Object.keys(newShips)[0] || '';
                        setEditingRules({
                          ...editingRules,
                          ships: newShips,
                          startingShips: newStarting,
                          nodeProduction: { ...editingRules.nodeProduction, shipType: newProdType },
                          neutralStartingShipsRange: { ...editingRules.neutralStartingShipsRange, type: newNeutralType }
                        });
                      }}
                    >
                      REMOVE
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                  {editingRules.enableCredits && (
                    <div>
                      <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>BUILD COST</label>
                      <input
                        type="number"
                        disabled={editingRules.isDefault}
                        value={shipDef.cost}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setEditingRules({ ...editingRules, ships: { ...editingRules.ships, [type]: { ...shipDef, cost: val } } });
                        }}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>SPEED (LY/T)</label>
                    <input
                      type="number" step="0.1"
                      disabled={editingRules.isDefault}
                      value={shipDef.speed}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0.1;
                        setEditingRules({ ...editingRules, ships: { ...editingRules.ships, [type]: { ...shipDef, speed: val } } });
                      }}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>STRUCTURAL HP</label>
                    <input
                      type="number"
                      disabled={editingRules.isDefault}
                      value={shipDef.hp}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setEditingRules({ ...editingRules, ships: { ...editingRules.ships, [type]: { ...shipDef, hp: val } } });
                      }}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>WEAPON DAMAGE</label>
                    <input
                      type="number"
                      disabled={editingRules.isDefault}
                      value={shipDef.attack}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setEditingRules({ ...editingRules, ships: { ...editingRules.ships, [type]: { ...shipDef, attack: val } } });
                      }}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>HIT CHANCE (0-1)</label>
                    <input
                      type="number" step="0.05"
                      disabled={editingRules.isDefault}
                      value={shipDef.hitChance}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0.0;
                        setEditingRules({ ...editingRules, ships: { ...editingRules.ships, [type]: { ...shipDef, hitChance: val } } });
                      }}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
          {!editingRules.isDefault && (
            <button className="btn-sci-fi" onClick={onSaveRules} style={{ flex: 1, justifyContent: 'center' }}>
              SAVE PROTOCOLS
            </button>
          )}
          <button className="btn-sci-fi btn-danger" onClick={onClose} style={{ flex: editingRules.isDefault ? 1 : 0, justifyContent: 'center' }}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
