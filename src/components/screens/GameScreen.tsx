import React from 'react';
import { GameState, Player, StarSystem } from '../../game/gameState';
import { StarMap } from '../StarMap';
import { Dashboard } from '../Dashboard';
import { JoinRequest } from '../../game/gameApi';

interface GameScreenProps {
  gameState: GameState;
  activePlayer: Player | null;
  selectedSystemId: number | null;
  setSelectedSystemId: (id: number | null) => void;
  selectedFleetId: string | null;
  setSelectedFleetId: (id: string | null) => void;
  onSelectTargetSystem: (system: StarSystem) => void;
  centerOnCoords: { x: number; y: number; trigger: number } | null;
  setCenterOnCoords: (coords: { x: number; y: number; trigger: number }) => void;
  targetSystem: StarSystem | null;
  setTargetSystem: (system: StarSystem | null) => void;
  isLoadingGame: boolean;
  onCancelLoading: () => void;
  onEndTurn: () => void;
  onReturnToMenu: () => void;
  onRenamePlayer: (playerId: number, newName: string) => void;
  onCancelEndTurn: (playerId: number) => void;
  activeGameName: string;
  onRenameGame: (newName: string) => void;
  onQueueShip: (shipType: string) => void;
  onUpgradeSystem: (upgradeType: string, systemId?: number) => void;
  onDispatchFleet: (destSysId: number, ships: Record<string, number>) => void;
  onRecallFleet: (fleetId: string) => void;
  onCancelDispatch: (fleetId: string) => void;
  onCancelProduction: (systemId: number, index: number) => void;
  currentUser: { email: string } | null;
  activeGameId: string | null;
  gameOwnerEmail: string;
  connectedPlayers: string[];
  isPlayerLocalToClient: (player: Player) => boolean;
  onClaimFaction: (playerId: number) => void;
  onTogglePlayerLocal: (playerId: number) => void;
  onAssignPlayerEmail: (playerId: number, email: string) => void;
  soundMuted: boolean;
  onToggleSoundMuted: () => void;
  staticBg: boolean;
  onToggleStaticBg: () => void;
  homePendingRequests: { [gameId: string]: JoinRequest[] };
  setHomePendingRequests: React.Dispatch<React.SetStateAction<{ [gameId: string]: JoinRequest[] }>>;
  joinPanelGameId: string | null;
  setJoinPanelGameId: (id: string | null) => void;
  joinAssignSlot: { [reqId: number]: number };
  setJoinAssignSlot: React.Dispatch<React.SetStateAction<{ [reqId: number]: number }>>;
  acceptJoinRequest: (gameId: string, reqId: number, slotId: number, email: string) => Promise<{ success: boolean; error?: string }>;
  rejectJoinRequest: (gameId: string, reqId: number) => Promise<{ success: boolean; error?: string }>;
  loadGameFromId: (gameId: string) => void;
  showToast: (msg: string, type?: 'success' | 'warning' | 'info', duration?: number) => void;
  showError: (msg: string) => void;
  compactMode: boolean;
  isMobile: boolean;
  activeMobileTab: 'map' | 'empire' | 'tactics';
  setActiveMobileTab: (tab: 'map' | 'empire' | 'tactics') => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  gameState,
  activePlayer,
  selectedSystemId,
  setSelectedSystemId,
  selectedFleetId,
  setSelectedFleetId,
  onSelectTargetSystem,
  centerOnCoords,
  setCenterOnCoords,
  targetSystem,
  setTargetSystem,
  isLoadingGame,
  onCancelLoading,
  onEndTurn,
  onReturnToMenu,
  onRenamePlayer,
  onCancelEndTurn,
  activeGameName,
  onRenameGame,
  onQueueShip,
  onUpgradeSystem,
  onDispatchFleet,
  onRecallFleet,
  onCancelDispatch,
  onCancelProduction,
  currentUser,
  activeGameId,
  gameOwnerEmail,
  connectedPlayers,
  isPlayerLocalToClient,
  onClaimFaction,
  onTogglePlayerLocal,
  onAssignPlayerEmail,
  soundMuted,
  onToggleSoundMuted,
  staticBg,
  onToggleStaticBg,
  homePendingRequests,
  setHomePendingRequests,
  joinPanelGameId,
  setJoinPanelGameId,
  joinAssignSlot,
  setJoinAssignSlot,
  acceptJoinRequest,
  rejectJoinRequest,
  loadGameFromId,
  showToast,
  showError,
  compactMode,
  isMobile,
  activeMobileTab,
  setActiveMobileTab
}) => {
  const [isSelectingTarget, setIsSelectingTarget] = React.useState(false);

  return (
    <div style={{ width: '100vw', height: '100dvh', position: 'relative' }}>
      <StarMap
        gameState={gameState}
        activePlayerId={activePlayer?.id || 1}
        selectedSystemId={selectedSystemId}
        setSelectedSystemId={setSelectedSystemId}
        selectedFleetId={selectedFleetId}
        setSelectedFleetId={setSelectedFleetId}
        onSelectTargetSystem={(sys) => {
          onSelectTargetSystem(sys);
          setIsSelectingTarget(false);
        }}
        centerOnCoords={centerOnCoords}
        targetSystemId={targetSystem?.id || null}
        isMobile={isMobile}
        isSelectingTarget={isSelectingTarget}
        setIsSelectingTarget={setIsSelectingTarget}
      />
      {!isLoadingGame ? (
        <>
          <Dashboard
            gameState={gameState}
            activePlayerId={activePlayer?.id || 1}
            selectedSystemId={selectedSystemId}
            selectedFleetId={selectedFleetId}
            setSelectedSystemId={setSelectedSystemId}
            setSelectedFleetId={setSelectedFleetId}
            onEndTurn={onEndTurn}
            onReturnToMenu={onReturnToMenu}
            onRenamePlayer={onRenamePlayer}
            onCancelEndTurn={onCancelEndTurn}
            gameName={activeGameName}
            onRenameGame={onRenameGame}
            onQueueShip={onQueueShip}
            onUpgradeSystem={onUpgradeSystem}
            onDispatchFleet={onDispatchFleet}
            onRecallFleet={onRecallFleet}
            onCancelDispatch={onCancelDispatch}
            onCancelProduction={onCancelProduction}
            onCenterOnCoords={(x, y) => setCenterOnCoords({ x, y, trigger: Date.now() })}
            targetSystem={targetSystem}
            setTargetSystem={setTargetSystem}
            currentUserEmail={currentUser?.email || localStorage.getItem('starswarm_guest_name') || ""}
            gameOwnerEmail={(() => {
              const userEmail = currentUser?.email || localStorage.getItem('starswarm_guest_name');
              const ownedGames = JSON.parse(localStorage.getItem('starswarm_owned_games') || '[]');
              const isLocalOwner = activeGameId ? ownedGames.includes(activeGameId) : false;
              if (gameOwnerEmail) return gameOwnerEmail;
              if (isLocalOwner && userEmail) return userEmail;
              return "";
            })()}
            connectedPlayers={connectedPlayers}
            isPlayerLocalToClient={isPlayerLocalToClient}
            onClaimFaction={onClaimFaction}
            onTogglePlayerLocal={onTogglePlayerLocal}
            onAssignPlayerEmail={onAssignPlayerEmail}
            soundMuted={soundMuted}
            onToggleSoundMuted={onToggleSoundMuted}
            staticBg={staticBg}
            onToggleStaticBg={onToggleStaticBg}
            compactMode={compactMode}
            isMobile={isMobile}
            activeMobileTab={activeMobileTab}
            setActiveMobileTab={setActiveMobileTab}
            isSelectingTarget={isSelectingTarget}
            setIsSelectingTarget={setIsSelectingTarget}
          />

          {/* IN-GAME JOIN REQUEST PANEL (host only) */}
          {(() => {
            const userEmail = currentUser?.email || localStorage.getItem('starswarm_guest_name');
            const ownedGames = JSON.parse(localStorage.getItem('starswarm_owned_games') || '[]');
            const isLocalOwner = activeGameId ? ownedGames.includes(activeGameId) : false;
            const isOwner = gameOwnerEmail ? (gameOwnerEmail === userEmail) : (isLocalOwner || !userEmail);
            return isOwner;
          })() && activeGameId && (homePendingRequests[activeGameId] || []).length > 0 && (() => {
            const reqs = homePendingRequests[activeGameId] || [];
            const isPanelOpen = joinPanelGameId === activeGameId;
            const freeSlots = gameState.players.filter(p => p.type === 'human' && !p.assignedEmail).map(p => ({ id: p.id, name: p.name }));
             return (
              <div style={isMobile ? {
                position: 'absolute',
                top: '55px',
                right: '10px',
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                pointerEvents: 'auto',
                maxWidth: '280px'
              } : {
                position: 'absolute',
                top: '90px',
                right: '420px',
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                pointerEvents: 'auto',
                maxWidth: '300px'
              }}>
                <div
                  style={{
                    background: 'rgba(0, 240, 255, 0.12)',
                    border: '1px solid var(--accent-cyan)',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 0 15px rgba(0,240,255,0.2)'
                  }}
                  onClick={() => setJoinPanelGameId(isPanelOpen ? null : activeGameId)}
                >
                  <span style={{ fontSize: '16px' }}>📡</span>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--accent-cyan)', fontFamily: 'Orbitron', letterSpacing: '1px' }}>
                    {reqs.length} JOIN REQUEST{reqs.length > 1 ? 'S' : ''}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)', transform: isPanelOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
                </div>

                {isPanelOpen && (
                  <div style={{
                    background: 'rgba(5, 15, 30, 0.96)',
                    border: '1px solid rgba(0,240,255,0.25)',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                  }}>
                    {reqs.map(req => (
                      <div key={req.id} style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <div style={{ fontSize: '11px', color: 'white', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {req.email}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {freeSlots.length > 0 ? (
                            <>
                              <select
                                value={joinAssignSlot[req.id] || freeSlots[0].id}
                                onChange={e => setJoinAssignSlot(prev => ({ ...prev, [req.id]: parseInt(e.target.value) }))}
                                style={{
                                  flex: 1,
                                  background: 'rgba(0,0,0,0.7)',
                                  border: '1px solid rgba(0,240,255,0.3)',
                                  color: 'white',
                                  borderRadius: '4px',
                                  padding: '3px 6px',
                                  fontSize: '10px',
                                  fontFamily: 'Share Tech Mono'
                                }}
                              >
                                {freeSlots.map(slot => (
                                  <option key={slot.id} value={slot.id}>{slot.name}</option>
                                ))}
                              </select>
                              <button
                                className="btn-sci-fi"
                                style={{ padding: '3px 8px', fontSize: '9px' }}
                                onClick={async () => {
                                  const slotId = joinAssignSlot[req.id] || freeSlots[0].id;
                                  const res = await acceptJoinRequest(activeGameId, req.id, slotId, req.email);
                                  if (res.success) {
                                    showToast(`✅ ${req.email} assigned!`, 'success');
                                    setHomePendingRequests(h => ({ ...h, [activeGameId]: (h[activeGameId] || []).filter(r => r.id !== req.id) }));
                                    // Refresh game state so slot assignment is visible
                                    loadGameFromId(activeGameId);
                                  } else {
                                    showError(res.error || 'Failed to assign slot.');
                                  }
                                }}
                              >
                                ACCEPT
                              </button>
                            </>
                          ) : (
                            <span style={{ fontSize: '9px', color: 'var(--accent-yellow)', fontFamily: 'Share Tech Mono' }}>No free slots</span>
                          )}
                          <button
                            className="btn-sci-fi btn-danger"
                            style={{ padding: '3px 8px', fontSize: '9px' }}
                            onClick={async () => {
                              const res = await rejectJoinRequest(activeGameId, req.id);
                              if (res.success) {
                                showToast(`❌ Rejected ${req.email}`, 'warning', 3000);
                                setHomePendingRequests(h => ({ ...h, [activeGameId]: (h[activeGameId] || []).filter(r => r.id !== req.id) }));
                              } else {
                                showError(res.error || 'Failed to reject.');
                              }
                            }}
                          >
                            REJECT
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </>
      ) : (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(5, 3, 13, 0.45)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          color: 'var(--text-primary)',
          fontFamily: '"Share Tech Mono", monospace'
        }}>
          {/* Sci-fi Loading Card */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            padding: '40px 50px',
            borderRadius: '16px',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            background: 'rgba(10, 7, 24, 0.85)',
            boxShadow: '0 0 40px rgba(0, 240, 255, 0.15), inset 0 0 20px rgba(0, 240, 255, 0.05)',
            maxWidth: '480px',
            width: '90%',
            textAlign: 'center'
          }}>
            <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto' }}>
              {/* Glowing, rotating outer ring */}
              <div className="spin-loader" style={{
                width: '100%',
                height: '100%',
                border: '3px solid transparent',
                borderTopColor: 'var(--accent-cyan)',
                borderBottomColor: 'var(--accent-cyan)',
                borderRadius: '50%'
              }} />
              {/* Inner pulsing star core */}
              <div style={{
                position: 'absolute',
                top: '25%',
                left: '25%',
                width: '50%',
                height: '50%',
                backgroundColor: 'var(--accent-magenta)',
                borderRadius: '50%',
                boxShadow: '0 0 15px var(--accent-magenta)',
                animation: 'pulse 1.2s ease-in-out infinite alternate'
              }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h2 style={{
                letterSpacing: '3px',
                color: 'var(--accent-cyan)',
                textShadow: '0 0 10px rgba(0, 240, 255, 0.6)',
                margin: 0,
                fontSize: '20px',
                fontWeight: 700
              }}>
                INITIALIZING SIMULATION
              </h2>
              <div style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }} className="pulse-light">
                Quantum Grid Sync...
              </div>
            </div>

            {/* Subtext info */}
            <div style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: '16px',
              width: '100%',
              lineHeight: '1.6'
            }}>
              Connecting to Star-Swarm core server. Constructing visual grid matrix. Please stand by, Admiral.
            </div>

            <button 
              className="btn-sci-fi btn-danger" 
              onClick={onCancelLoading} 
              style={{
                marginTop: '8px',
                width: '100%',
                justifyContent: 'center',
                fontWeight: 600,
                letterSpacing: '1.5px',
                fontSize: '12px'
              }}
            >
              ABORT SIMULATION
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
