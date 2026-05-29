import React, { useRef, useEffect, useState } from 'react';
import { GameState, StarSystem, Fleet, FACTION_INFO, computeVision } from '../game/gameState';

interface StarMapProps {
  gameState: GameState;
  activePlayerId: number;
  selectedSystemId: number | null;
  setSelectedSystemId: (id: number | null) => void;
  selectedFleetId: string | null;
  setSelectedFleetId: (id: string | null) => void;
  onSelectTargetSystem: (sys: StarSystem) => void;
}

export const StarMap: React.FC<StarMapProps> = ({
  gameState,
  activePlayerId,
  selectedSystemId,
  setSelectedSystemId,
  selectedFleetId,
  setSelectedFleetId,
  onSelectTargetSystem,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Transform states
  const [zoom, setZoom] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(50);
  const [panY, setPanY] = useState<number>(50);
  const [hoveredSysId, setHoveredSysId] = useState<number | null>(null);
  const [hoveredFleetId, setHoveredFleetId] = useState<string | null>(null);

  // Mouse drag states
  const isDragging = useRef<boolean>(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragMoved = useRef<boolean>(false);

  // Calculate Active Vision
  const vision = computeVision(gameState, activePlayerId);

  // Grid sizing constants
  const mapWidth = gameState.gridWidth;
  const mapHeight = gameState.gridHeight;
  const cellSize = 20; // base pixels per lightyear

  // Converts canvas screen coordinates to grid coordinates
  const screenToGrid = (sx: number, sy: number) => {
    const gx = (sx - panX) / (cellSize * zoom);
    const gy = (sy - panY) / (cellSize * zoom);
    return { x: gx, y: gy };
  };

  // Zoom control helpers
  const handleZoomIn = () => setZoom(z => Math.min(3.0, z * 1.25));
  const handleZoomOut = () => setZoom(z => Math.max(0.3, z / 1.25));
  const handleResetView = () => {
    setZoom(1.0);
    setPanX(50);
    setPanY(50);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      // Resize to fit container
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background space nebula effect
      ctx.fillStyle = '#05030d';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Save drawing context
      ctx.save();
      // Apply Pan & Zoom transformations
      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);

      // 1. Draw Grid Lines
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
      ctx.lineWidth = 1;
      
      for (let x = 0; x <= mapWidth; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cellSize, 0);
        ctx.lineTo(x * cellSize, mapHeight * cellSize);
        ctx.stroke();
      }
      for (let y = 0; y <= mapHeight; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * cellSize);
        ctx.lineTo(mapWidth * cellSize, y * cellSize);
        ctx.stroke();
      }

      // Draw Grid labels (Lightyear markers) if zoomed in enough
      if (zoom > 0.6) {
        ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
        ctx.font = '8px "Share Tech Mono"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let x = 0; x <= mapWidth; x += 5) {
          ctx.fillText(`${x} LY`, x * cellSize, 4);
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (let y = 0; y <= mapHeight; y += 5) {
          ctx.fillText(`${y} LY`, 4, y * cellSize);
        }
      }

      // 2. Draw Sensor Ranges (Vision Circles) for active player/team
      ctx.fillStyle = 'rgba(0, 240, 255, 0.02)';
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
      ctx.lineWidth = 1;
      const alliedPlayerIds = gameState.players
        .filter(p => p.team === gameState.playerState[activePlayerId]?.team)
        .map(p => p.id);

      gameState.systems.forEach(sys => {
        if (alliedPlayerIds.includes(sys.owner)) {
          const sensorRadius = (6.0 + sys.sensorLvl * 2.5) * cellSize;
          ctx.beginPath();
          ctx.arc(sys.x * cellSize, sys.y * cellSize, sensorRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      });

      gameState.fleets.forEach(fleet => {
        if (alliedPlayerIds.includes(fleet.owner)) {
          const hasScout = fleet.ships.Scout > 0;
          const sensorRadius = (hasScout ? 12.0 : 5.0) * cellSize;
          ctx.beginPath();
          ctx.arc(fleet.currentPos.x * cellSize, fleet.currentPos.y * cellSize, sensorRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      });

      // 3. Draw Fleet Trajectories (Paths)
      gameState.fleets.forEach(fleet => {
        // Only draw if fleet is visible
        const isFleetVisible = vision.fleets.has(fleet.id);
        if (!isFleetVisible) return;

        const ownerColor = FACTION_INFO[fleet.owner]?.color || '#8ba2b5';
        const startX = fleet.isRecalling ? fleet.source.x : (gameState.systems.find(s => s.id === fleet.source.id)?.x || fleet.source.x);
        const startY = fleet.isRecalling ? fleet.source.y : (gameState.systems.find(s => s.id === fleet.source.id)?.y || fleet.source.y);
        
        let destX, destY;
        const destSys = gameState.systems.find(s => s.id === fleet.destination.id);
        if (destSys) {
          destX = destSys.x;
          destY = destSys.y;
        } else {
          destX = fleet.destination.x;
          destY = fleet.destination.y;
        }

        // Draw trajectory vector
        ctx.strokeStyle = ownerColor;
        ctx.lineWidth = fleet.id === selectedFleetId || fleet.id === hoveredFleetId ? 2 : 1;
        ctx.setLineDash(fleet.isRecalling ? [4, 4] : [8, 3]);
        ctx.beginPath();
        ctx.moveTo(startX * cellSize, startY * cellSize);
        ctx.lineTo(destX * cellSize, destY * cellSize);
        ctx.stroke();
        ctx.setLineDash([]); // Reset line dash

        // Draw current fleet position node
        ctx.fillStyle = ownerColor;
        ctx.beginPath();
        ctx.arc(fleet.currentPos.x * cellSize, fleet.currentPos.y * cellSize, 5, 0, Math.PI * 2);
        ctx.fill();

        // Draw glowing ring around selected fleet
        if (fleet.id === selectedFleetId) {
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(fleet.currentPos.x * cellSize, fleet.currentPos.y * cellSize, 9, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Draw fleet identifier text
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px "Outfit"';
        ctx.textAlign = 'center';
        const fleetCount = Object.values(fleet.ships).reduce((a, b) => a + b, 0);
        ctx.fillText(`Fleet (${fleetCount})`, fleet.currentPos.x * cellSize, fleet.currentPos.y * cellSize - 10);
      });

      // 4. Draw Systems (Star Clusters)
      gameState.systems.forEach(sys => {
        const isSysVisible = vision.systems.has(sys.id);
        const sysOwner = sys.owner;
        const ownerColor = FACTION_INFO[sysOwner]?.color || '#8ba2b5';
        
        // Draw star core glow
        const grad = ctx.createRadialGradient(
          sys.x * cellSize, sys.y * cellSize, 2,
          sys.x * cellSize, sys.y * cellSize, 12
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, ownerColor);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sys.x * cellSize, sys.y * cellSize, 14, 0, Math.PI * 2);
        ctx.fill();

        // Star orbit border ring
        ctx.strokeStyle = sys.id === selectedSystemId ? '#00f0ff' : 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = sys.id === selectedSystemId || sys.id === hoveredSysId ? 2 : 1;
        ctx.beginPath();
        ctx.arc(sys.x * cellSize, sys.y * cellSize, 8, 0, Math.PI * 2);
        ctx.stroke();

        // Draw system names
        ctx.fillStyle = isSysVisible ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
        ctx.font = '11px "Outfit"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(sys.name, sys.x * cellSize, sys.y * cellSize - 12);

        // Draw ship counts or question marks (FOG)
        ctx.font = '9px "Share Tech Mono"';
        ctx.textBaseline = 'top';
        if (isSysVisible) {
          // If owned by player/allied team, show detailed ship counts.
          // If owned by enemy, HIDE ship count details (draw "??") - CRITICAL REQUIREMENT
          const alliedTeam = gameState.playerState[activePlayerId]?.team;
          const systemTeam = sysOwner === 0 ? 0 : gameState.playerState[sysOwner]?.team;
          
          if (sysOwner === 0) {
            const neutralCount = Object.values(sys.ships).reduce((a, b) => a + b, 0);
            ctx.fillStyle = '#64748b';
            ctx.fillText(`${neutralCount} Ships`, sys.x * cellSize, sys.y * cellSize + 12);
          } else if (alliedTeam === systemTeam) {
            const totalShips = Object.values(sys.ships).reduce((a, b) => a + b, 0);
            ctx.fillStyle = ownerColor;
            ctx.fillText(`${totalShips} Ships`, sys.x * cellSize, sys.y * cellSize + 12);
          } else {
            ctx.fillStyle = '#ff007f';
            ctx.fillText('?? Ships', sys.x * cellSize, sys.y * cellSize + 12);
          }
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.fillText('UNKNOWN', sys.x * cellSize, sys.y * cellSize + 12);
        }
      });

      // 5. Draw Fog of War Shading Overlay
      // We divide the viewport into grid chunks and render shadow on those not in vision coordinates
      ctx.fillStyle = 'rgba(4, 2, 9, 0.65)';
      for (let x = 0; x < mapWidth; x++) {
        for (let y = 0; y < mapHeight; y++) {
          if (!vision.coordinates.has(`${x},${y}`)) {
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        }
      }

      ctx.restore();

      // Request next frame
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [gameState, activePlayerId, zoom, panX, panY, selectedSystemId, selectedFleetId, hoveredSysId, hoveredFleetId, vision]);

  // Click handler: Selects star systems or fleets on the canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragMoved.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const gridPos = screenToGrid(clickX, clickY);

    // 1. Check if clicked a star system (within a radius of 15px)
    let clickedSys: StarSystem | null = null;
    const selectThreshold = 15;

    for (const sys of gameState.systems) {
      const sysScreenX = sys.x * cellSize * zoom + panX;
      const sysScreenY = sys.y * cellSize * zoom + panY;
      const dist = Math.sqrt((sysScreenX - clickX) ** 2 + (sysScreenY - clickY) ** 2);
      if (dist <= selectThreshold) {
        clickedSys = sys;
        break;
      }
    }

    if (clickedSys) {
      setSelectedFleetId(null);
      
      // If we already have a system selected, and we click another system, trigger targeting
      if (selectedSystemId && selectedSystemId !== clickedSys.id) {
        onSelectTargetSystem(clickedSys);
      } else {
        setSelectedSystemId(clickedSys.id);
      }
      return;
    }

    // 2. Check if clicked a fleet (within 10px screen distance)
    let clickedFleet: Fleet | null = null;
    const visibleFleets = gameState.fleets.filter(f => vision.fleets.has(f.id));

    for (const fleet of visibleFleets) {
      const fleetScreenX = fleet.currentPos.x * cellSize * zoom + panX;
      const fleetScreenY = fleet.currentPos.y * cellSize * zoom + panY;
      const dist = Math.sqrt((fleetScreenX - clickX) ** 2 + (fleetScreenY - clickY) ** 2);
      if (dist <= selectThreshold) {
        clickedFleet = fleet;
        break;
      }
    }

    if (clickedFleet) {
      setSelectedSystemId(null);
      setSelectedFleetId(clickedFleet.id);
      return;
    }

    // Clicked empty space: deselect everything
    setSelectedSystemId(null);
    setSelectedFleetId(null);
  };

  // Track hover coordinate telemetry
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (isDragging.current) {
      const dx = mx - dragStart.current.x;
      const dy = my - dragStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragMoved.current = true;
      }
      if (dragMoved.current) {
        setPanX(px => px + dx);
        setPanY(py => py + dy);
        dragStart.current = { x: mx, y: my };
      }
      return;
    }

    // Update hovered system or fleet
    let hoverSys: number | null = null;
    let hoverFleet: string | null = null;
    const selectThreshold = 15;

    for (const sys of gameState.systems) {
      const sysScreenX = sys.x * cellSize * zoom + panX;
      const sysScreenY = sys.y * cellSize * zoom + panY;
      const dist = Math.sqrt((sysScreenX - mx) ** 2 + (sysScreenY - my) ** 2);
      if (dist <= selectThreshold) {
        hoverSys = sys.id;
        break;
      }
    }

    if (!hoverSys) {
      const visibleFleets = gameState.fleets.filter(f => vision.fleets.has(f.id));
      for (const fleet of visibleFleets) {
        const fleetScreenX = fleet.currentPos.x * cellSize * zoom + panX;
        const fleetScreenY = fleet.currentPos.y * cellSize * zoom + panY;
        const dist = Math.sqrt((fleetScreenX - mx) ** 2 + (fleetScreenY - my) ** 2);
        if (dist <= selectThreshold) {
          hoverFleet = fleet.id;
          break;
        }
      }
    }

    setHoveredSysId(hoverSys);
    setHoveredFleetId(hoverFleet);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) { // left click drag to pan
      isDragging.current = true;
      dragMoved.current = false;
      const rect = canvasRef.current?.getBoundingClientRect();
      dragStart.current = {
        x: e.clientX - (rect?.left || 0),
        y: e.clientY - (rect?.top || 0),
      };
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Zoom with scroll wheel centered at current mouse cursor
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const gridMouse = screenToGrid(mouseX, mouseY);
    
    // Zoom factor
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    const newZoom = Math.min(3.0, Math.max(0.3, zoom * factor));
    
    // Adjust pan coordinates to center zoom on mouse point
    const newPanX = mouseX - gridMouse.x * cellSize * newZoom;
    const newPanY = mouseY - gridMouse.y * cellSize * newZoom;

    setZoom(newZoom);
    setPanX(newPanX);
    setPanY(newPanY);
  };

  // Find active systems coordinates for selected system to display on tooltip
  const activeSystem = gameState.systems.find(s => s.id === selectedSystemId);
  const activeFleet = gameState.fleets.find(f => f.id === selectedFleetId);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: isDragging.current ? 'grabbing' : 'grab' }}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Telemetry panel (Zoom / Pan Coordinates) */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        pointerEvents: 'none'
      }}>
        <div className="grid-indicator">
          TELEMETRY RANGE: {mapWidth}x{mapHeight} LY
        </div>
        <div className="grid-indicator">
          ZOOM: {Math.round(zoom * 100)}%
        </div>
        {activeSystem && (
          <div className="grid-indicator" style={{ color: 'var(--accent-magenta)' }}>
            LOCKED ON: {activeSystem.name} ({activeSystem.x}, {activeSystem.y})
          </div>
        )}
        {activeFleet && (
          <div className="grid-indicator" style={{ color: 'var(--accent-yellow)' }}>
            LOCKED ON FLEET: {Object.values(activeFleet.ships).reduce((a,b)=>a+b, 0)} ships to {activeFleet.destination.name}
          </div>
        )}
      </div>

      {/* Zoom Toolbar overlay */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        gap: '8px'
      }} className="glass-panel" p="4px" style={{ padding: '6px', display: 'flex', gap: '8px' }}>
        <button className="btn-sci-fi" onClick={handleZoomIn} style={{ padding: '6px 12px', fontSize: '12px' }}>+</button>
        <button className="btn-sci-fi" onClick={handleZoomOut} style={{ padding: '6px 12px', fontSize: '12px' }}>-</button>
        <button className="btn-sci-fi" onClick={handleResetView} style={{ padding: '6px 12px', fontSize: '12px' }}>RESET</button>
      </div>
    </div>
  );
};
