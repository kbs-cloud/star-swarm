import React from 'react';
import { GameState } from '../../game/gameState';
import { GameMetadata, JoinRequest } from '../../game/gameApi';
import { UserAccount } from '../../game/auth';
import { getGameTurnStatus, canCancelEndTurnInGame } from '../../utils/gameHelpers';
import { copyToClipboard } from '../../utils/clipboard';
import { isElectronMode } from '../../utils/env';

interface MenuScreenProps {
  currentUser: UserAccount | null;
  savedGames: GameMetadata[];
  totalGamesCount: number;
  gameSearchQuery: string;
  setGameSearchQuery: (val: string) => void;
  showAdvancedFilters: boolean;
  setShowAdvancedFilters: (val: boolean) => void;
  gameSearchStatus: string;
  setGameSearchStatus: (val: string) => void;
  gameTurnsFilter: string;
  setGameTurnsFilter: (val: string) => void;
  gameStartDate: string;
  setGameStartDate: (val: string) => void;
  gameEndDate: string;
  setGameEndDate: (val: string) => void;
  loadGamesList: (reset: boolean) => void;
  isInfiniteLoading: boolean;
  homePendingRequests: { [gameId: string]: JoinRequest[] };
  setHomePendingRequests: React.Dispatch<React.SetStateAction<{ [gameId: string]: JoinRequest[] }>>;
  joinPanelGameId: string | null;
  setJoinPanelGameId: (id: string | null) => void;
  joinAssignSlot: { [reqId: number]: number };
  setJoinAssignSlot: React.Dispatch<React.SetStateAction<{ [reqId: number]: number }>>;
  handleStartSkirmishLobby: () => void;
  handleCancelEndTurnForGame: (gameId: string, playerId: number) => void;
  loadGameFromId: (gameId: string) => void;
  setGameToDelete: (game: GameMetadata | null) => void;
  acceptJoinRequest: (gameId: string, reqId: number, slotId: number, email: string) => Promise<{ success: boolean; error?: string }>;
  rejectJoinRequest: (gameId: string, reqId: number) => Promise<{ success: boolean; error?: string }>;
  showToast: (msg: string, type?: 'success' | 'warning' | 'info', duration?: number) => void;
  showError: (msg: string) => void;
  compactMode: boolean;
}

export const MenuScreen: React.FC<MenuScreenProps> = ({
  currentUser,
  savedGames,
  totalGamesCount,
  gameSearchQuery,
  setGameSearchQuery,
  showAdvancedFilters,
  setShowAdvancedFilters,
  gameSearchStatus,
  setGameSearchStatus,
  gameTurnsFilter,
  setGameTurnsFilter,
  gameStartDate,
  setGameStartDate,
  gameEndDate,
  setGameEndDate,
  loadGamesList,
  isInfiniteLoading,
  homePendingRequests,
  setHomePendingRequests,
  joinPanelGameId,
  setJoinPanelGameId,
  joinAssignSlot,
  setJoinAssignSlot,
  handleStartSkirmishLobby,
  handleCancelEndTurnForGame,
  loadGameFromId,
  setGameToDelete,
  acceptJoinRequest,
  rejectJoinRequest,
  showToast,
  showError,
  compactMode
}) => {
  const [activeMenuTab, setActiveMenuTab] = React.useState<'skirmish' | 'simulations'>('skirmish');
  const hasSavedSimulations = currentUser || savedGames.length > 0;

  // Render initialization panel
  const renderSkirmishBootPanel = (isCompact: boolean) => (
    <div style={{
      width: isCompact ? '100%' : '450px',
      maxWidth: isCompact ? '500px' : 'none',
      padding: isCompact ? '20px' : '30px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      maxHeight: '100%',
      overflowY: 'auto',
      boxSizing: 'border-box'
    }} className="glass-panel glass-panel-neon-cyan">
      <h2 style={{ fontSize: isCompact ? '16px' : '18px', textAlign: 'center', color: 'var(--accent-cyan)', fontFamily: 'Orbitron' }}>
        INITIALIZE SYSTEM BOOT
      </h2>
      
      <button className="btn-sci-fi" style={{ justifyContent: 'center' }} onClick={handleStartSkirmishLobby}>
        SKIRMISH MATCH
      </button>
      
      <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
        <strong>RULES OF ENGAGEMENT:</strong>
        <ul style={{ paddingLeft: '20px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <li>Fog of war covers grid sectors outside sensor range.</li>
          <li>Sensor vision is shared across teams.</li>
          <li>Enemy ship inventories are concealed behind deflector shields.</li>
          <li>Recall dispatched fleets mid-flight. They take the same duration to return.</li>
        </ul>
      </div>
    </div>
  );

  // Render simulations history panel
  const renderSimulationsPanel = (isCompact: boolean) => (
    <div style={{
      flex: isCompact ? '1 1 auto' : '1 1 500px',
      width: isCompact ? '100%' : 'auto',
      maxWidth: isCompact ? '500px' : '600px',
      padding: isCompact ? '20px' : '30px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      maxHeight: '100%',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }} className="glass-panel glass-panel-neon-magenta">
      <h2 style={{ fontSize: isCompact ? '16px' : '18px', textAlign: 'center', color: 'var(--accent-magenta)', fontFamily: 'Orbitron' }}>
        ACTIVE SAVED SIMULATIONS
      </h2>

      {/* Search & Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="SEARCH BY GAME, PLAYER OR EMAIL..."
            value={gameSearchQuery}
            onChange={(e) => setGameSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 0, 127, 0.3)',
              borderRadius: '4px',
              padding: '8px 12px',
              color: 'white',
              fontSize: '11px',
              fontFamily: 'Share Tech Mono',
              outline: 'none'
            }}
          />
          <button
            className="btn-sci-fi"
            style={{ padding: '8px 12px', fontSize: '11px' }}
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            {showAdvancedFilters ? '⚙️ HIDE FILTERS' : '⚙️ FILTERS'}
          </button>
        </div>

        {showAdvancedFilters && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            background: 'rgba(0, 0, 0, 0.25)',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 0, 127, 0.15)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>TURN STATUS</label>
              <select
                value={gameSearchStatus}
                onChange={(e) => setGameSearchStatus(e.target.value)}
                style={{
                  background: '#090514',
                  border: '1px solid rgba(255, 0, 127, 0.25)',
                  borderRadius: '4px',
                  padding: '6px',
                  color: 'white',
                  fontSize: '11px',
                  fontFamily: 'Share Tech Mono',
                  outline: 'none'
                }}
              >
                <option value="all">ALL SIMULATIONS</option>
                <option value="your_turn">YOUR TURN</option>
                <option value="waiting">WAITING ON OTHERS</option>
                <option value="game_over">GAME OVER</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>TURN NUMBER</label>
              <input
                type="number"
                placeholder="EXACT TURN..."
                value={gameTurnsFilter}
                onChange={(e) => setGameTurnsFilter(e.target.value)}
                style={{
                  background: '#090514',
                  border: '1px solid rgba(255, 0, 127, 0.25)',
                  borderRadius: '4px',
                  padding: '6px',
                  color: 'white',
                  fontSize: '11px',
                  fontFamily: 'Share Tech Mono',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>START DATE</label>
              <input
                type="date"
                value={gameStartDate}
                onChange={(e) => setGameStartDate(e.target.value)}
                style={{
                  background: '#090514',
                  border: '1px solid rgba(255, 0, 127, 0.25)',
                  borderRadius: '4px',
                  padding: '6px',
                  color: 'white',
                  fontSize: '11px',
                  fontFamily: 'Share Tech Mono',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>END DATE</label>
              <input
                type="date"
                value={gameEndDate}
                onChange={(e) => setGameEndDate(e.target.value)}
                style={{
                  background: '#090514',
                  border: '1px solid rgba(255, 0, 127, 0.25)',
                  borderRadius: '4px',
                  padding: '6px',
                  color: 'white',
                  fontSize: '11px',
                  fontFamily: 'Share Tech Mono',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                className="btn-sci-fi btn-danger"
                style={{ padding: '4px 8px', fontSize: '9px' }}
                onClick={() => {
                  setGameSearchQuery('');
                  setGameSearchStatus('all');
                  setGameStartDate('');
                  setGameEndDate('');
                  setGameTurnsFilter('');
                }}
              >
                RESET FILTERS
              </button>
            </div>
          </div>
        )}
      </div>

      <div 
        onScroll={(e) => {
          const target = e.currentTarget;
          const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 25;
          if (isNearBottom && !isInfiniteLoading && savedGames.length < totalGamesCount) {
            loadGamesList(false);
          }
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          flex: 1,
          minHeight: '120px',
          overflowY: 'auto',
          paddingRight: '6px'
        }}
      >
        {savedGames.map((game) => {
          const pendingReqs = homePendingRequests[game.id] || [];
          const isPanelOpen = joinPanelGameId === game.id;
          
          let gameStateObj: GameState | null = null;
          try {
            gameStateObj = typeof game.game_state === 'string' ? JSON.parse(game.game_state) : game.game_state;
          } catch (e) {
            // ignore
          }

          const guestNameVal = localStorage.getItem('starswarm_guest_name') || '';
          const userEmail = currentUser?.email || guestNameVal;
          const ownedGames = JSON.parse(localStorage.getItem('starswarm_owned_games') || '[]');
          const isLocalOwner = ownedGames.includes(game.id);
          const isOwner = game.owner_email 
            ? (userEmail && game.owner_email.trim().toLowerCase() === userEmail.trim().toLowerCase())
            : (isLocalOwner || !userEmail);

          // Get free human slots for this game
          const freeSlots: { id: number; name: string }[] = (() => {
            if (!gameStateObj) return [];
            return (gameStateObj.players || []).filter((p: any) => p.type === 'human' && !p.assignedEmail).map((p: any) => ({ id: p.id, name: p.name }));
          })();

          const turnNumber = gameStateObj?.turnNumber || 1;
          const totalPlayers = gameStateObj?.players?.length || 0;
          const activePlayersCount = gameStateObj ? gameStateObj.players.filter(p => !gameStateObj.playerState[p.id]?.lost).length : 0;

          return (
            <div key={game.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '12px 14px',
                borderRadius: '6px',
                border: isPanelOpen ? '1px solid rgba(0,240,255,0.35)' : '1px solid rgba(255, 0, 127, 0.15)',
                transition: 'border-color 0.2s',
              }} className="saved-game-row">
                <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 'bold',
                      color: 'white',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {game.name}
                    </div>
                    {/* Pending join requests badge */}
                    {!isElectronMode() && pendingReqs.length > 0 && (
                      <span
                        style={{
                          background: 'var(--accent-cyan)',
                          color: '#000',
                          borderRadius: '10px',
                          padding: '1px 7px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          fontFamily: 'Share Tech Mono',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                        onClick={(e) => { e.stopPropagation(); setJoinPanelGameId(isPanelOpen ? null : game.id); }}
                        title="Click to manage join requests"
                      >
                        📡 {pendingReqs.length} JOIN{pendingReqs.length > 1 ? 'S' : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }} className="telemetry">
                    UPDATED: {new Date(game.updated_at).toLocaleString()}
                  </div>

                  {/* Host and Game details info */}
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', fontFamily: 'Share Tech Mono' }}>
                    HOST: <span style={{ color: 'white' }}>{isOwner ? 'You' : (game.owner_email || 'Unknown')}</span>
                  </div>

                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'Share Tech Mono' }}>
                    TURN: <span style={{ color: 'white' }}>{turnNumber}</span> · FACTIONS: <span style={{ color: 'white' }}>{activePlayersCount}/{totalPlayers} Active</span>
                  </div>

                  {/* Factions Inline list */}
                  {gameStateObj && gameStateObj.players && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                      {gameStateObj.players.map(p => {
                        const isPlayerLost = gameStateObj?.playerState[p.id]?.lost;
                        const isPlayerMe = userEmail && p.assignedEmail?.trim().toLowerCase() === userEmail.trim().toLowerCase();
                        return (
                          <div
                            key={p.id}
                            style={{
                              fontSize: '9px',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: isPlayerLost ? 'rgba(255,255,255,0.02)' : `${p.color}10`,
                              border: `1px solid ${isPlayerLost ? 'rgba(255,255,255,0.08)' : p.color}25`,
                              color: isPlayerLost ? 'var(--text-muted)' : (isPlayerMe ? 'white' : 'var(--text-secondary)'),
                              textDecoration: isPlayerLost ? 'line-through' : 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                            title={`${p.name} ${p.assignedEmail ? `(${p.assignedEmail})` : '(Local)'}${isPlayerLost ? ' - DEFEATED' : ''}`}
                          >
                            <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: isPlayerLost ? '#555' : p.color }} />
                            {p.name.split(' ')[0]} {isPlayerMe && '(You)'}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>STATUS:</span>
                    <span style={{
                      color: getGameTurnStatus(game, userEmail || null) === 'YOUR TURN' ? 'var(--accent-green)' : 'var(--accent-yellow)',
                      fontWeight: 'bold',
                      fontFamily: 'Share Tech Mono'
                    }}>
                      {getGameTurnStatus(game, userEmail || null)}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', minWidth: '90px' }}>
                  {/* Invite link copy button */}
                  {!isElectronMode() && (
                    <button
                      className="btn-sci-fi"
                      style={{ padding: '4px 8px', fontSize: '9px' }}
                      title="Copy invite link"
                      onClick={(e) => {
                        e.stopPropagation();
                        const inviteUrl = `${window.location.origin}${window.location.pathname}?gameId=${game.invite_code || game.id}`;
                        copyToClipboard(inviteUrl).then((success) => {
                          if (success) {
                            showToast('🔗 Invite link copied to clipboard!', 'success', 3000);
                          } else {
                            window.prompt('Copy invite link manually:', inviteUrl);
                          }
                        }).catch(() => {
                          window.prompt('Copy invite link manually:', inviteUrl);
                        });
                      }}
                    >
                      🔗 INVITE
                    </button>
                  )}
                  {canCancelEndTurnInGame(game, currentUser) && (
                    <button
                      className="btn-sci-fi btn-danger animate-pulse"
                      style={{ padding: '6px 10px', fontSize: '10px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        let stateObj: GameState;
                        try {
                          stateObj = typeof game.game_state === 'string' ? JSON.parse(game.game_state) : game.game_state;
                          const userPlayer = stateObj.players.find(p => (userEmail && p.assignedEmail?.trim().toLowerCase() === userEmail.trim().toLowerCase()) || (p.id === 1 && p.isLocal));
                          if (userPlayer) {
                            handleCancelEndTurnForGame(game.id, userPlayer.id);
                          }
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                    >
                      UNDO END
                    </button>
                  )}
                  <button
                    className="btn-sci-fi"
                    style={{ padding: '6px 10px', fontSize: '10px' }}
                    onClick={() => {
                      loadGameFromId(game.id);
                      window.history.pushState(null, '', `?gameId=${game.id}`);
                    }}
                  >
                    RESUME
                  </button>
                  {isOwner && (
                    <button
                      className="btn-sci-fi btn-danger"
                      style={{ padding: '6px 8px', fontSize: '10px', justifyContent: 'center' }}
                      onClick={() => setGameToDelete(game)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* JOIN REQUESTS EXPAND PANEL */}
              {!isElectronMode() && isPanelOpen && pendingReqs.length > 0 && (
                <div style={{
                  background: 'rgba(0,240,255,0.04)',
                  border: '1px solid rgba(0,240,255,0.2)',
                  borderRadius: '6px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontFamily: 'Orbitron', letterSpacing: '1px', marginBottom: '2px' }}>
                    📡 INCOMING JOIN REQUESTS
                  </div>
                  {pendingReqs.map(req => (
                    <div key={req.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '4px',
                      padding: '8px 10px',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '11px', color: 'white', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {req.email}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono' }}>
                          Req #{req.id} · {new Date(req.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                      {freeSlots.length > 0 ? (
                        <>
                          <select
                            value={joinAssignSlot[req.id] || freeSlots[0].id}
                            onChange={e => setJoinAssignSlot(prev => ({ ...prev, [req.id]: parseInt(e.target.value) }))}
                            style={{
                              background: 'rgba(0,0,0,0.7)',
                              border: '1px solid rgba(0,240,255,0.3)',
                              color: 'white',
                              borderRadius: '4px',
                              padding: '3px 6px',
                              fontSize: '10px',
                              fontFamily: 'Share Tech Mono',
                              maxWidth: '120px'
                            }}
                          >
                            {freeSlots.map(slot => (
                              <option key={slot.id} value={slot.id}>Slot {slot.id}: {slot.name}</option>
                            ))}
                          </select>
                          <button
                            className="btn-sci-fi"
                            style={{ padding: '3px 8px', fontSize: '9px' }}
                            onClick={async (e) => {
                              e.stopPropagation();
                              const slotId = joinAssignSlot[req.id] || freeSlots[0].id;
                              const res = await acceptJoinRequest(game.id, req.id, slotId, req.email);
                              if (res.success) {
                                showToast(`✅ ${req.email} assigned to slot ${slotId}!`, 'success');
                                setHomePendingRequests(h => ({
                                  ...h,
                                  [game.id]: (h[game.id] || []).filter(r => r.id !== req.id)
                                }));
                                if ((homePendingRequests[game.id] || []).length <= 1) {
                                  setJoinPanelGameId(null);
                                }
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
                        onClick={async (e) => {
                          e.stopPropagation();
                          const res = await rejectJoinRequest(game.id, req.id);
                          if (res.success) {
                            showToast(`❌ Rejected join request from ${req.email}.`, 'warning', 3000);
                            setHomePendingRequests(h => ({
                              ...h,
                              [game.id]: (h[game.id] || []).filter(r => r.id !== req.id)
                            }));
                            if ((homePendingRequests[game.id] || []).length <= 1) {
                              setJoinPanelGameId(null);
                            }
                          } else {
                            showError(res.error || 'Failed to reject request.');
                          }
                        }}
                      >
                        REJECT
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {isInfiniteLoading && (
          <div style={{ textAlign: 'center', color: 'var(--accent-cyan)', fontFamily: 'Share Tech Mono', fontSize: '11px', padding: '10px' }} className="animate-pulse">
            📡 DOWNLOADING SIMULATION TELEMETRY...
          </div>
        )}

        {savedGames.length === 0 && !isInfiniteLoading && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', fontSize: '13px', padding: '30px 10px' }}>
            NO MATCHING COMMAND SIMULATIONS FOUND
          </div>
        )}

        {savedGames.length < totalGamesCount && !isInfiniteLoading && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono', fontSize: '11px', padding: '8px' }}>
            SCROLL TO LOAD MORE SIMULATIONS ({savedGames.length} OF {totalGamesCount})
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={compactMode ? {
      height: 'calc(100vh - 40px)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'center',
      gap: '12px',
      zIndex: 1,
      position: 'relative',
      padding: '10px 20px 20px 20px',
      width: '100vw',
      boxSizing: 'border-box',
      overflow: 'hidden'
    } : {
      height: 'calc(100vh - 40px)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'center',
      gap: '20px',
      zIndex: 1,
      position: 'relative',
      padding: '30px 20px 20px 20px',
      boxSizing: 'border-box'
    }}>
      {/* Title Header */}
      <div style={{ textAlign: 'center', margin: '0 0 5px 0' }}>
        <h1 style={compactMode ? {
          fontFamily: 'Orbitron',
          fontSize: '28px',
          fontWeight: 800,
          letterSpacing: '2px',
          background: 'linear-gradient(135deg, #00f0ff, #ff007f)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 0 15px rgba(0, 240, 255, 0.2)',
          margin: '2px 0'
        } : {
          fontFamily: 'Orbitron',
          fontSize: '48px',
          fontWeight: 800,
          letterSpacing: '4px',
          background: 'linear-gradient(135deg, #00f0ff, #ff007f)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 0 20px rgba(0, 240, 255, 0.2)',
          margin: '5px 0'
        }}>STAR-SWARM</h1>
        <p style={compactMode ? {
          fontSize: '10px',
          color: 'var(--text-secondary)',
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
          fontFamily: 'Share Tech Mono',
          margin: 0
        } : {
          fontSize: '13px',
          color: 'var(--text-secondary)',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          fontFamily: 'Share Tech Mono',
          margin: 0
        }}>Tactical Grid Space Conquest</p>
      </div>

      {/* Main content body */}
      {compactMode ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          width: '100%',
          maxWidth: '500px',
          alignItems: 'center',
          flex: 1,
          minHeight: 0,
          maxHeight: '100%',
          overflow: 'hidden'
        }}>
          {/* Tab Selection Header Bar */}
          {hasSavedSimulations && (
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button
                onClick={() => setActiveMenuTab('skirmish')}
                style={{
                  flex: 1,
                  padding: '12px',
                  fontFamily: 'Orbitron',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  background: activeMenuTab === 'skirmish' ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0,0,0,0.4)',
                  border: activeMenuTab === 'skirmish' ? '1px solid var(--accent-cyan)' : '1px solid rgba(0, 240, 255, 0.2)',
                  color: activeMenuTab === 'skirmish' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: activeMenuTab === 'skirmish' ? '0 0 15px rgba(0, 240, 255, 0.2)' : 'none',
                  transition: 'all 0.2s ease',
                  letterSpacing: '1px'
                }}
              >
                🌌 START MATCH
              </button>
              <button
                onClick={() => setActiveMenuTab('simulations')}
                style={{
                  flex: 1,
                  padding: '12px',
                  fontFamily: 'Orbitron',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  background: activeMenuTab === 'simulations' ? 'rgba(255, 0, 127, 0.15)' : 'rgba(0,0,0,0.4)',
                  border: activeMenuTab === 'simulations' ? '1px solid var(--accent-magenta)' : '1px solid rgba(255, 0, 127, 0.2)',
                  color: activeMenuTab === 'simulations' ? 'var(--accent-magenta)' : 'var(--text-muted)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: activeMenuTab === 'simulations' ? '0 0 15px rgba(255, 0, 127, 0.2)' : 'none',
                  transition: 'all 0.2s ease',
                  letterSpacing: '1px'
                }}
              >
                💾 SIMULATIONS
              </button>
            </div>
          )}

          {/* Active Tab Panel */}
          {(!hasSavedSimulations || activeMenuTab === 'skirmish') ? renderSkirmishBootPanel(true) : renderSimulationsPanel(true)}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          gap: '24px',
          alignItems: hasSavedSimulations ? 'stretch' : 'center',
          flexDirection: hasSavedSimulations ? 'row' : 'column',
          justifyContent: 'center',
          maxWidth: '1100px',
          width: '100%',
          flex: 1,
          minHeight: 0,
          maxHeight: 'calc(100% - 100px)'
        }}>
          {renderSkirmishBootPanel(false)}
          {hasSavedSimulations && renderSimulationsPanel(false)}
        </div>
      )}
    </div>
  );
};
