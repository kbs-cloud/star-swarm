import React from 'react';
import { GameMetadata, deleteGame } from '../../game/gameApi';

interface DeleteGameModalProps {
  gameToDelete: GameMetadata | null;
  onClose: () => void;
  onDeleted: () => void;
  onShowError: (msg: string) => void;
}

export const DeleteGameModal: React.FC<DeleteGameModalProps> = ({
  gameToDelete,
  onClose,
  onDeleted,
  onShowError
}) => {
  if (!gameToDelete) return null;

  const handleConfirmDelete = async () => {
    const delRes = await deleteGame(gameToDelete.id);
    if (delRes.success) {
      const ownedGames = JSON.parse(localStorage.getItem('starswarm_owned_games') || '[]');
      const updatedOwned = ownedGames.filter((id: string) => id !== gameToDelete.id);
      localStorage.setItem('starswarm_owned_games', JSON.stringify(updatedOwned));
      onDeleted();
    } else {
      onShowError(delRes.error || 'Failed to delete game.');
    }
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100dvh',
      background: 'rgba(5, 3, 13, 0.85)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1001
    }}>
      <div style={{
        width: '400px',
        padding: '30px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }} className="glass-panel glass-panel-neon-magenta">
        <h2 style={{ fontSize: '18px', color: 'var(--accent-magenta)', fontFamily: 'Orbitron', letterSpacing: '1px', textAlign: 'center' }}>
          DECOMMISSION SIMULATION?
        </h2>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.5' }}>
          Are you sure you want to delete the simulation record for:
          <div style={{ color: 'white', fontWeight: 'bold', margin: '10px 0', fontSize: '14px' }}>
            {gameToDelete.name}
          </div>
          This action is irreversible. All ship registries, star grid data, and fleets will be decommissioned.
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button
            className="btn-sci-fi btn-danger"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={handleConfirmDelete}
          >
            DECOMMISSION
          </button>
          <button
            className="btn-sci-fi"
            style={{ flex: 1, justifyContent: 'center', background: 'rgba(255,255,255,0.05)' }}
            onClick={onClose}
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
};
