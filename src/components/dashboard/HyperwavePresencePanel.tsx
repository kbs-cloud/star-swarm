import React from 'react';
import { GameState, Player } from '../../game/gameState';

interface HyperwavePresencePanelProps {
  gameState: GameState;
  connectedPlayers: string[];
  gameOwnerEmail: string;
  currentUserEmail: string;
  isPlayerLocalToClient: (player: Player) => boolean;
  onRenamePlayer: (playerId: number, newName: string) => void;
  onTogglePlayerLocal: (playerId: number) => void;
  onClaimFaction: (playerId: number) => void;
  onAssignPlayerEmail: (playerId: number, email: string) => void;
  onCenterOnCoords: (x: number, y: number) => void;
  setSelectedSystemId: (id: number | null) => void;
}

export const HyperwavePresencePanel: React.FC<HyperwavePresencePanelProps> = ({
  gameState,
  connectedPlayers,
  gameOwnerEmail,
  currentUserEmail,
  isPlayerLocalToClient,
  onRenamePlayer,
  onTogglePlayerLocal,
  onClaimFaction,
  onAssignPlayerEmail,
  onCenterOnCoords,
  setSelectedSystemId
}) => {
  const handleCenterOnHome = (playerId: number) => {
    let homeSystem = gameState.systems.find(s => s.owner === playerId && s.isHomePlanet);
    if (!homeSystem) {
      homeSystem = gameState.systems.find(s => s.owner === playerId);
    }
    if (homeSystem) {
      setSelectedSystemId(homeSystem.id);
      onCenterOnCoords(homeSystem.x, homeSystem.y);
    }
  };

  const isOwner = gameOwnerEmail === currentUserEmail;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '180px' }}>
      {gameState.players.map((player) => {
        const isOnline = player.type === 'ai' || (player.assignedEmail && connectedPlayers.includes(player.assignedEmail)) || (player.id === 1 && connectedPlayers.includes(gameOwnerEmail));
        const playerStateInfo = gameState.playerState[player.id];
        const isMe = player.assignedEmail === currentUserEmail;

        return (
          <div key={player.id} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
              <div 
                onClick={() => handleCenterOnHome(player.id)}
                title={`Center on ${player.name}'s Home Planet`}
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: player.color || '#ffffff',
                  boxShadow: `0 0 6px ${player.color}`,
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }} 
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'scale(1.4)';
                  e.currentTarget.style.boxShadow = `0 0 10px 2.5px ${player.color}`;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = `0 0 6px ${player.color}`;
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {isPlayerLocalToClient(player) ? (
                    <input
                      type="text"
                      value={player.name}
                      onChange={(e) => {
                        onRenamePlayer(player.id, e.target.value);
                      }}
                      style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(0, 240, 255, 0.3)',
                        color: 'white',
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        width: '100px',
                        fontFamily: 'Share Tech Mono'
                      }}
                    />
                  ) : (
                    <span>{player.name}</span>
                  )}
                  {player.type === 'ai' && (
                    <span style={{
                      fontSize: '9px',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      background: player.difficulty === 'hard'
                        ? 'rgba(255, 0, 127, 0.15)'
                        : player.difficulty === 'easy'
                          ? 'rgba(57, 255, 20, 0.15)'
                          : 'rgba(0, 240, 255, 0.15)',
                      border: player.difficulty === 'hard'
                        ? '1px solid rgba(255, 0, 127, 0.3)'
                        : player.difficulty === 'easy'
                          ? '1px solid rgba(57, 255, 20, 0.3)'
                          : '1px solid rgba(0, 240, 255, 0.3)',
                      color: player.difficulty === 'hard'
                        ? 'var(--accent-magenta)'
                        : player.difficulty === 'easy'
                          ? 'var(--accent-green)'
                          : 'var(--accent-cyan)',
                      fontFamily: 'Share Tech Mono',
                      letterSpacing: '0.5px'
                    }}>
                      {player.difficulty ? player.difficulty.toUpperCase() : 'AI'}
                    </span>
                  )}
                  {isMe && <span style={{ fontSize: '9px', color: 'var(--accent-cyan)' }}>[YOU]</span>}
                </div>
                {player.type === 'human' && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {player.assignedEmail || 'Unassigned Link'}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Connection status */}
              <span style={{
                fontSize: '10px',
                color: isOnline ? 'var(--accent-green)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isOnline ? 'var(--accent-green)' : '#888'
                }} />
                {player.type === 'ai' ? 'AUTO' : (isOnline ? 'ONLN' : 'OFFL')}
              </span>

              {/* Turn Status */}
              {player.type === 'human' && !playerStateInfo?.lost && (
                <span style={{
                  fontSize: '10px',
                  color: player.endedTurn ? 'var(--accent-green)' : 'var(--accent-yellow)',
                  fontFamily: 'Share Tech Mono'
                }}>
                  {player.endedTurn ? 'READY' : 'WAIT'}
                </span>
              )}

              {/* Local Toggle Checkbox */}
              {player.type === 'human' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={!!player.isLocal}
                    disabled={!isOwner && !isMe}
                    onChange={() => onTogglePlayerLocal(player.id)}
                    style={{ accentColor: 'var(--accent-cyan)', margin: 0 }}
                  />
                  <span>LCL</span>
                </label>
              )}

              {/* Claim Button */}
              {player.type === 'human' && !player.assignedEmail && !isMe && (
                <button
                  className="btn-sci-fi"
                  style={{ padding: '2px 6px', fontSize: '9px', textTransform: 'uppercase' }}
                  onClick={() => onClaimFaction(player.id)}
                >
                  CLAIM
                </button>
              )}

              {/* Owner Assign Option: Clear or Assign if Owner */}
              {isOwner && player.type === 'human' && player.assignedEmail && player.id !== 1 && (
                <button
                  className="btn-sci-fi btn-danger"
                  style={{ padding: '2px 4px', fontSize: '9px' }}
                  onClick={() => onAssignPlayerEmail(player.id, '')}
                >
                  RESET
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
