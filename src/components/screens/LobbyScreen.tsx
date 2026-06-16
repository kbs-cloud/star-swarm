import React from 'react';
import { GameRules, FACTION_INFO } from '../../game/gameState';
import { PlayerSetup } from '../../types';
import { isPackagedMode } from '../../utils/env';

interface LobbyScreenProps {
  gridSize: number;
  setGridSize: (size: number) => void;
  systemCount: number;
  setSystemCount: (count: number) => void;
  gameSeed: string;
  setGameSeed: (seed: string) => void;
  overrideSightRange: boolean;
  setOverrideSightRange: (override: boolean) => void;
  customSightRange: number;
  setCustomSightRange: (range: number) => void;
  selectedModeId: string;
  setSelectedModeId: (id: string) => void;
  gameModes: GameRules[];
  setEditingRules: (rules: GameRules | null) => void;
  setIsRulesEditorOpen: (open: boolean) => void;
  saveCustomModes: (customs: GameRules[]) => void;
  handleExportRules: () => void;
  setImportString: (str: string) => void;
  setImportError: (err: string | null) => void;
  setIsImportModalOpen: (open: boolean) => void;
  turnStyle: 'simultaneous' | 'sequential';
  setTurnStyle: (style: 'simultaneous' | 'sequential') => void;
  recNotice: string | null;
  playersSetup: PlayerSetup[];
  setPlayersSetup: React.Dispatch<React.SetStateAction<PlayerSetup[]>>;
  updatePlayerSetup: (idx: number, key: keyof PlayerSetup, value: any) => void;
  handleRemovePlayer: (id: number) => void;
  handleAddPlayer: () => void;
  handleStartGame: () => void;
  handleReturnToMenu: () => void;
  currentUser: { email: string } | null;
  playOnline?: boolean;
  isMobile?: boolean;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  gridSize,
  setGridSize,
  systemCount,
  setSystemCount,
  gameSeed,
  setGameSeed,
  overrideSightRange,
  setOverrideSightRange,
  customSightRange,
  setCustomSightRange,
  selectedModeId,
  setSelectedModeId,
  gameModes,
  setEditingRules,
  setIsRulesEditorOpen,
  saveCustomModes,
  handleExportRules,
  setImportString,
  setImportError,
  setIsImportModalOpen,
  turnStyle,
  setTurnStyle,
  recNotice,
  playersSetup,
  setPlayersSetup,
  updatePlayerSetup,
  handleRemovePlayer,
  handleAddPlayer,
  handleStartGame,
  handleReturnToMenu,
  currentUser,
  playOnline = false,
  isMobile = false
}) => {
  return (
    <div style={{
      height: 'calc(100dvh - 40px)',
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
        width: '650px',
        maxWidth: '100%',
        padding: '30px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        maxHeight: '100%',
        overflowY: 'auto',
        boxSizing: 'border-box'
      }} className="glass-panel glass-panel-neon-cyan">
        <h2 style={{ fontSize: '24px', color: 'var(--accent-cyan)', textAlign: 'center', fontFamily: 'Orbitron' }}>
          TACTICAL SETUP LOBBY
        </h2>

        {/* MAP CONFIG */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>GALAXY MAP SIZE (LIGHTYEARS)</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px' }}>
              <input
                type="range"
                min="35"
                max="90"
                value={gridSize}
                onChange={(e) => setGridSize(parseInt(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
              />
              <span className="telemetry" style={{ width: '60px', textAlign: 'right' }}>{gridSize}x{gridSize}</span>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>STAR CLUSTERS</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px' }}>
              <input
                type="range"
                min={playersSetup.length}
                max="40"
                value={systemCount}
                onChange={(e) => setSystemCount(parseInt(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
              />
              <span className="telemetry" style={{ width: '60px', textAlign: 'right' }}>{systemCount} bases</span>
            </div>
          </div>
        </div>

        {/* SEED & VISION CONFIG */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>GALAXY GENERATION SEED</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
              <input
                type="text"
                value={gameSeed}
                onChange={(e) => setGameSeed(e.target.value)}
                placeholder="Enter custom seed"
                style={{
                  flex: 1,
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'white',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontFamily: 'Share Tech Mono'
                }}
              />
              <button
                className="btn-sci-fi"
                onClick={() => setGameSeed(String(Math.floor(Math.random() * 900000) + 100000))}
                style={{ padding: '6px 12px', fontSize: '11px' }}
              >
                RANDOM
              </button>
            </div>
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={overrideSightRange}
                onChange={(e) => setOverrideSightRange(e.target.checked)}
                style={{ accentColor: 'var(--accent-cyan)' }}
              />
              <span>OVERRIDE STAR SIGHT RANGE</span>
            </label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px' }}>
              <input
                type="range"
                min="1"
                max="20"
                step="0.5"
                disabled={!overrideSightRange}
                value={customSightRange}
                onChange={(e) => setCustomSightRange(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent-cyan)', opacity: overrideSightRange ? 1 : 0.4 }}
              />
              <span className="telemetry" style={{ width: '60px', textAlign: 'right', opacity: overrideSightRange ? 1 : 0.4 }}>
                {customSightRange} LY
              </span>
            </div>
          </div>
        </div>

        {/* GAME RULES CONFIG */}
        <div style={{ background: 'rgba(255,255,255,0.01)', padding: '15px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>
            Galaxy Ruleset / Game Mode
          </label>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              value={selectedModeId}
              onChange={(e) => setSelectedModeId(e.target.value)}
              style={{
                flex: 1,
                background: 'rgba(0,0,0,0.8)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'Orbitron'
              }}
            >
              {gameModes.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.isDefault ? '[DEFAULT]' : '[CUSTOM]'}
                </option>
              ))}
            </select>

            <button
              className="btn-sci-fi"
              onClick={() => {
                const currentMode = gameModes.find(m => m.id === selectedModeId);
                if (currentMode) {
                  setEditingRules(JSON.parse(JSON.stringify(currentMode)));
                  setIsRulesEditorOpen(true);
                }
              }}
              style={{ padding: '8px 10px', fontSize: '11px' }}
            >
              {gameModes.find(m => m.id === selectedModeId)?.isDefault ? 'VIEW' : 'EDIT'}
            </button>

            <button
              className="btn-sci-fi"
              onClick={() => {
                const currentMode = gameModes.find(m => m.id === selectedModeId);
                if (currentMode) {
                  const copiedRules: GameRules = JSON.parse(JSON.stringify(currentMode));
                  copiedRules.id = 'custom_' + Date.now();
                  copiedRules.name = 'Copy of ' + copiedRules.name;
                  copiedRules.isDefault = false;
                  
                  const customs = gameModes.filter(m => !m.isDefault);
                  const newCustoms = [...customs, copiedRules];
                  saveCustomModes(newCustoms);
                  setSelectedModeId(copiedRules.id);
                }
              }}
              style={{ padding: '8px 10px', fontSize: '11px' }}
            >
              COPY
            </button>

            <button
              className="btn-sci-fi"
              onClick={handleExportRules}
              style={{ padding: '8px 10px', fontSize: '11px' }}
            >
              EXPORT
            </button>

            <button
              className="btn-sci-fi"
              onClick={() => {
                setImportString('');
                setImportError(null);
                setIsImportModalOpen(true);
              }}
              style={{ padding: '8px 10px', fontSize: '11px' }}
            >
              IMPORT
            </button>

            {!gameModes.find(m => m.id === selectedModeId)?.isDefault && (
              <button
                className="btn-sci-fi btn-danger"
                onClick={() => {
                  if (confirm('Decommission this custom ruleset?')) {
                    const customs = gameModes.filter(m => !m.isDefault && m.id !== selectedModeId);
                    saveCustomModes(customs);
                    setSelectedModeId('normal');
                  }
                }}
                style={{ padding: '8px 10px', fontSize: '11px' }}
              >
                DELETE
              </button>
            )}
          </div>

          {/* Mode overview metrics */}
          {(() => {
            const currentMode = gameModes.find(m => m.id === selectedModeId);
            if (!currentMode) return null;
            return (
              <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <div style={{ fontStyle: 'italic', marginBottom: '6px' }}>{currentMode.description}</div>
                <div style={{ display: 'flex', gap: '15px', fontFamily: 'Share Tech Mono', color: 'var(--accent-cyan)' }}>
                  <span>💳 CREDITS: {currentMode.enableCredits ? 'ENABLED' : 'DISABLED'}</span>
                  <span>🔧 UPGRADES: {currentMode.enableUpgrades ? 'ENABLED' : 'DISABLED'}</span>
                  <span>🛰️ AUTO-PROD: {currentMode.nodeProduction.enabled ? `YES (+${currentMode.nodeProduction.shipsPerTurn} ${currentMode.nodeProduction.shipType}/turn)` : 'NO'}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* TURN RESOLUTION STYLE CONFIG */}
        <div style={{ background: 'rgba(255,255,255,0.01)', padding: '15px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>TURN RESOLUTION STYLE</label>
          <select
            id="turn-style-select"
            value={turnStyle}
            onChange={(e) => setTurnStyle(e.target.value as 'simultaneous' | 'sequential')}
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.8)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '13px',
              fontFamily: 'Orbitron',
              marginTop: '6px'
            }}
          >
            <option value="simultaneous">SIMULTANEOUS — All human players play concurrently; AIs play and rounds resolve at turn end.</option>
            <option value="sequential">SEQUENTIAL — Factions take turns in order. AIs take their turns instantly in their galactic sequence.</option>
          </select>
        </div>

        {/* RECOMMENDED NOTICE */}
        {recNotice && (
          <div style={{
            color: 'var(--accent-green)',
            fontSize: '11px',
            textAlign: 'center',
            fontFamily: 'Share Tech Mono',
            marginTop: '-10px'
          }} className="pulse-light">
            [RECOMMENDATION ARRAY] {recNotice}
          </div>
        )}

        <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.08)' }} />

        {/* PLAYERS LIST CONFIG */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '14px', color: 'var(--text-primary)' }}>FACTIONS & TEAM MAPPING</h3>
            <span className="telemetry" style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>
              FACTIONS IN SYSTEM: {playersSetup.length} / 8
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
            {playersSetup.map((player, idx) => {
              const factionColor = player.color || FACTION_INFO[player.id]?.color || '#ffffff';
              const isOfflineElectron = isPackagedMode() && !playOnline;
              return (
                 <div key={player.id} style={isMobile ? {
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  background: 'rgba(255,255,255,0.02)',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.05)'
                } : {
                  display: 'grid',
                  gridTemplateColumns: isOfflineElectron ? '24px 1.5fr 1fr 1fr 1.2fr 32px' : '24px 1.5fr 1fr 1fr 90px 2fr 32px',
                  gap: '8px',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.02)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  {/* Group A: Color, Name, Delete button on mobile */}
                  <div style={isMobile ? { display: 'flex', alignItems: 'center', gap: '8px', width: '100%' } : { display: 'contents' }}>
                    {/* Color indicator */}
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: factionColor,
                      boxShadow: `0 0 8px ${factionColor}`,
                      justifySelf: 'center',
                      flexShrink: 0
                    }} />
                    
                    {/* Name input */}
                    <input
                      type="text"
                      value={player.name}
                      onChange={(e) => updatePlayerSetup(idx, 'name', e.target.value)}
                      style={{
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        fontSize: '13px',
                        flex: 1,
                        minWidth: 0
                      }}
                    />

                    {isMobile && idx > 0 && playersSetup.length > 2 && (
                      <button
                        className="btn-sci-fi btn-danger"
                        style={{
                          padding: '6px 10px',
                          fontSize: '12px',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                        onClick={() => handleRemovePlayer(player.id)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  
                  {/* Group B: Controller and Team Selectors */}
                  <div style={isMobile ? { display: 'flex', gap: '8px', width: '100%' } : { display: 'contents' }}>
                    {/* Controller selector */}
                    <select
                      value={player.type}
                      onChange={(e) => {
                        const val = e.target.value as 'human' | 'ai';
                        setPlayersSetup(prev => {
                          const copy = [...prev];
                          copy[idx] = {
                            ...copy[idx],
                            type: val,
                            isLocal: val === 'human',
                            assignedEmail: val === 'human' ? '' : null,
                            difficulty: val === 'ai' ? 'medium' : undefined,
                            aiConfig: val === 'ai' ? { aggression: 50, expansion: 50, techFocus: 50, economyBonus: 0 } : undefined
                          };
                          return copy;
                        });
                      }}
                      style={{
                        background: 'rgba(0,0,0,0.8)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        fontSize: '13px',
                        flex: isMobile ? 1 : undefined
                      }}
                      disabled={idx === 0}
                    >
                      <option value="human">🌐 HUMAN</option>
                      <option value="ai">🤖 AI</option>
                    </select>
   
                    {/* Team Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: isMobile ? 1 : undefined }}>
                      <select
                        value={player.team}
                        onChange={(e) => updatePlayerSetup(idx, 'team', parseInt(e.target.value))}
                        style={{
                          background: 'rgba(0,0,0,0.8)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'white',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          width: '100%'
                        }}
                      >
                        <option value={1}>Team 1</option>
                        <option value={2}>Team 2</option>
                        <option value={3}>Team 3</option>
                        <option value={4}>Team 4</option>
                      </select>
                    </div>
                  </div>

                  {/* Group C: Local Playable & Assigned Email OR AI Difficulty Selector */}
                  <div style={isMobile ? { display: 'flex', gap: '8px', alignItems: 'center', width: '100%', flexWrap: 'wrap' } : { display: 'contents' }}>
                    {!isOfflineElectron ? (
                      player.type === 'human' ? (
                        <>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-secondary)' }}>
                            <input
                              type="checkbox"
                              checked={!!player.isLocal}
                              disabled={idx === 0}
                              onChange={(e) => updatePlayerSetup(idx, 'isLocal', e.target.checked)}
                              style={{ accentColor: 'var(--accent-cyan)' }}
                            />
                            <span>LOCAL</span>
                          </label>
                          <input
                            type="text"
                            placeholder={idx === 0 ? (currentUser?.email || 'Owner') : 'Remote commander email'}
                            value={idx === 0 ? (currentUser?.email || '') : (player.assignedEmail || '')}
                            disabled={idx === 0}
                            onChange={(e) => updatePlayerSetup(idx, 'assignedEmail', e.target.value)}
                            style={{
                              background: 'rgba(0,0,0,0.5)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              color: 'white',
                              padding: '6px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              width: isMobile ? 'auto' : '100%',
                              flex: isMobile ? 1 : undefined,
                              boxSizing: 'border-box'
                            }}
                          />
                        </>
                      ) : (
                        <div style={{ gridColumn: isMobile ? undefined : 'span 2', display: 'flex', gap: '8px', alignItems: 'center', flex: isMobile ? 1 : undefined, width: isMobile ? '100%' : undefined }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>DIFFICULTY:</span>
                          <select
                            value={player.difficulty || 'medium'}
                            onChange={(e) => {
                              const diffVal = e.target.value;
                              setPlayersSetup(prev => {
                                const copy = [...prev];
                                const playerCopy = { ...copy[idx] };
                                playerCopy.difficulty = diffVal as any;
                                
                                if (diffVal === 'easy') {
                                  playerCopy.aiConfig = { aggression: 20, expansion: 20, techFocus: 15, economyBonus: 0 };
                                } else if (diffVal === 'hard') {
                                  playerCopy.aiConfig = { aggression: 90, expansion: 90, techFocus: 90, economyBonus: 15 };
                                } else if (diffVal === 'medium') {
                                  playerCopy.aiConfig = { aggression: 50, expansion: 50, techFocus: 50, economyBonus: 0 };
                                } else if (diffVal === 'custom' && !playerCopy.aiConfig) {
                                  playerCopy.aiConfig = { aggression: 50, expansion: 50, techFocus: 50, economyBonus: 0 };
                                }
                                copy[idx] = playerCopy;
                                return copy;
                              });
                            }}
                            style={{
                              background: 'rgba(0,0,0,0.8)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              color: 'white',
                              padding: '6px 10px',
                              borderRadius: '4px',
                              fontSize: '13px',
                              flex: 1
                            }}
                          >
                            <option value="easy">🟢 Novice AI</option>
                            <option value="medium">🟡 Standard AI</option>
                            <option value="hard">🔴 Brutal AI</option>
                            <option value="custom">⚙️ Custom Setup</option>
                          </select>
                        </div>
                      )
                    ) : (
                      player.type === 'human' ? (
                        !isMobile ? <div /> : null
                      ) : (
                        <select
                          value={player.difficulty || 'medium'}
                          onChange={(e) => {
                            const diffVal = e.target.value;
                            setPlayersSetup(prev => {
                              const copy = [...prev];
                              const playerCopy = { ...copy[idx] };
                              playerCopy.difficulty = diffVal as any;
                              
                              if (diffVal === 'easy') {
                                playerCopy.aiConfig = { aggression: 20, expansion: 20, techFocus: 15, economyBonus: 0 };
                              } else if (diffVal === 'hard') {
                                playerCopy.aiConfig = { aggression: 90, expansion: 90, techFocus: 90, economyBonus: 15 };
                              } else if (diffVal === 'medium') {
                                playerCopy.aiConfig = { aggression: 50, expansion: 50, techFocus: 50, economyBonus: 0 };
                              } else if (diffVal === 'custom' && !playerCopy.aiConfig) {
                                playerCopy.aiConfig = { aggression: 50, expansion: 50, techFocus: 50, economyBonus: 0 };
                              }
                              copy[idx] = playerCopy;
                              return copy;
                            });
                          }}
                          style={{
                            background: 'rgba(0,0,0,0.8)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'white',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            fontSize: '13px',
                            width: '100%'
                          }}
                        >
                          <option value="easy">🟢 Novice AI</option>
                          <option value="medium">🟡 Standard AI</option>
                          <option value="hard">🔴 Brutal AI</option>
                          <option value="custom">⚙️ Custom Setup</option>
                        </select>
                      )
                    )}
                  </div>

                  {/* Custom AI Config Sliders Panel */}
                  {player.type === 'ai' && player.difficulty === 'custom' && (
                    <div style={{
                      gridColumn: '1 / -1',
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(0, 240, 255, 0.2)',
                      boxShadow: '0 0 10px rgba(0, 240, 255, 0.05)',
                      padding: '12px 16px',
                      borderRadius: '6px',
                      marginTop: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}>
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--accent-cyan)',
                        fontFamily: 'Orbitron',
                        letterSpacing: '1px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span>⚙️</span> CUSTOM INTELLIGENCE SUBSYSTEMS
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                        gap: '12px 20px',
                        fontSize: '12px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                            <span>Aggression / Offensive Drive</span>
                            <span className="telemetry" style={{ color: 'var(--accent-cyan)' }}>{player.aiConfig?.aggression ?? 50}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={player.aiConfig?.aggression ?? 50}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setPlayersSetup(prev => {
                                const copy = [...prev];
                                copy[idx] = {
                                  ...copy[idx],
                                  aiConfig: {
                                    ...(copy[idx].aiConfig || { aggression: 50, expansion: 50, techFocus: 50, economyBonus: 0 }),
                                    aggression: val
                                  }
                                };
                                return copy;
                              });
                            }}
                            style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                            <span>Expansion / Annexation Range</span>
                            <span className="telemetry" style={{ color: 'var(--accent-cyan)' }}>{player.aiConfig?.expansion ?? 50}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={player.aiConfig?.expansion ?? 50}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setPlayersSetup(prev => {
                                const copy = [...prev];
                                copy[idx] = {
                                  ...copy[idx],
                                  aiConfig: {
                                    ...(copy[idx].aiConfig || { aggression: 50, expansion: 50, techFocus: 50, economyBonus: 0 }),
                                    expansion: val
                                  }
                                };
                                return copy;
                              });
                            }}
                            style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                            <span>Upgrade Focus / Tech Upgrade Rate</span>
                            <span className="telemetry" style={{ color: 'var(--accent-cyan)' }}>{player.aiConfig?.techFocus ?? 50}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={player.aiConfig?.techFocus ?? 50}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setPlayersSetup(prev => {
                                const copy = [...prev];
                                copy[idx] = {
                                  ...copy[idx],
                                  aiConfig: {
                                    ...(copy[idx].aiConfig || { aggression: 50, expansion: 50, techFocus: 50, economyBonus: 0 }),
                                    techFocus: val
                                  }
                                };
                                return copy;
                              });
                            }}
                            style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                            <span>Economy / Credits Yield per turn</span>
                            <span className="telemetry" style={{ color: 'var(--accent-green)' }}>+{player.aiConfig?.economyBonus ?? 0} CR</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="30"
                            value={player.aiConfig?.economyBonus ?? 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setPlayersSetup(prev => {
                                const copy = [...prev];
                                copy[idx] = {
                                  ...copy[idx],
                                  aiConfig: {
                                    ...(copy[idx].aiConfig || { aggression: 50, expansion: 50, techFocus: 50, economyBonus: 0 }),
                                    economyBonus: val
                                  }
                                };
                                return copy;
                              });
                            }}
                            style={{ width: '100%', accentColor: 'var(--accent-green)' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Remove Button on desktop */}
                  {!isMobile && (
                    idx > 0 && playersSetup.length > 2 ? (
                      <button
                        className="btn-sci-fi btn-danger"
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          justifyContent: 'center'
                        }}
                        onClick={() => handleRemovePlayer(player.id)}
                      >
                        ✕
                      </button>
                    ) : (
                      <div />
                    )
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Faction Button */}
          {playersSetup.length < 8 && (
            <button 
              className="btn-sci-fi" 
              style={{ width: '100%', justifyContent: 'center', fontSize: '13px', borderStyle: 'dashed' }}
              onClick={handleAddPlayer}
            >
              + RECRUIT NEW GALAXY FACTION
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
          <button className="btn-sci-fi" onClick={handleStartGame} style={{ flex: 1, justifyContent: 'center' }}>
            LAUNCH GALAXY SIMULATION
          </button>
          <button className="btn-sci-fi btn-danger" onClick={handleReturnToMenu}>
            RETURN
          </button>
        </div>
      </div>
    </div>
  );
};
