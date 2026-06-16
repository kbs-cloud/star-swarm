import React, { useRef, useEffect, useState } from 'react';
import { GameState, StarSystem, Fleet, computeVision } from '../game/gameState';

interface StarMapProps {
  gameState: GameState;
  activePlayerId: number;
  selectedSystemId: number | null;
  setSelectedSystemId: (id: number | null) => void;
  selectedFleetId: string | null;
  setSelectedFleetId: (id: string | null) => void;
  onSelectTargetSystem: (sys: StarSystem) => void;
  centerOnCoords: { x: number; y: number; trigger: number } | null;
  targetSystemId: number | null;
  isMobile: boolean;
  isSelectingTarget: boolean;
  setIsSelectingTarget: (v: boolean) => void;
}

export const StarMap: React.FC<StarMapProps> = ({
  gameState,
  activePlayerId,
  selectedSystemId,
  setSelectedSystemId,
  selectedFleetId,
  setSelectedFleetId,
  onSelectTargetSystem,
  centerOnCoords,
  targetSystemId,
  isMobile,
  isSelectingTarget,
  setIsSelectingTarget,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Transform states
  const [zoom, setZoom] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(50);
  const [panY, setPanY] = useState<number>(50);
  const [hoveredSysId, setHoveredSysId] = useState<number | null>(null);
  const [hoveredFleetId, setHoveredFleetId] = useState<string | null>(null);
  const [showZoomMenu, setShowZoomMenu] = useState<boolean>(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    system: StarSystem;
  } | null>(null);

  // Mouse drag states
  const isDragging = useRef<boolean>(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragMoved = useRef<boolean>(false);
  const touchStartDist = useRef<number>(0);
  const touchStartZoom = useRef<number>(1.0);
  const touchStartMidpoint = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActive = useRef<boolean>(false);

  // Calculate Active Vision
  const vision = computeVision(gameState, activePlayerId);

  const selectedSystem = gameState.systems.find(s => s.id === selectedSystemId);
  const alliedPlayerIds = gameState.players
    .filter(p => p.team === gameState.playerState[activePlayerId]?.team)
    .map(p => p.id);
  const isFriendlySystemSelected = selectedSystem && alliedPlayerIds.includes(selectedSystem.owner);
  const isFleetSelected = !!selectedFleetId;

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

  // Centering on coordinates
  useEffect(() => {
    if (centerOnCoords && canvasRef.current) {
      const canvas = canvasRef.current;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      setPanX(cx - centerOnCoords.x * cellSize * zoom);
      setPanY(cy - centerOnCoords.y * cellSize * zoom);
    }
  }, [centerOnCoords]);

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
      ctx.fillStyle = '#05030dA0';
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
          const sensorRadius = ((gameState.rules?.starSightRange ?? 6.0) + sys.sensorLvl * 2.5) * cellSize;
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

        const ownerColor = gameState.playerState[fleet.owner]?.color || '#8ba2b5';
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
        const ownerColor = gameState.playerState[sysOwner]?.color || '#8ba2b5';

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

        // Swarm target system selection indicator (locked target indicator)
        if (sys.id === targetSystemId) {
          ctx.strokeStyle = '#39ff14'; // neon green
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 2]);
          ctx.beginPath();
          ctx.arc(sys.x * cellSize, sys.y * cellSize, 11, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }



        // Draw system names
        ctx.fillStyle = isSysVisible ? '#ffffff' : 'rgba(255, 255, 255, 0.4)';
        ctx.font = '11px "Outfit"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const displayName = sys.isHomePlanet ? `👑 ${sys.name}` : sys.name;
        ctx.fillText(displayName, sys.x * cellSize, sys.y * cellSize - 12);

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
      ctx.fillStyle = 'rgba(4, 2, 9, 0.2)';
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
  }, [gameState, activePlayerId, zoom, panX, panY, selectedSystemId, selectedFleetId, hoveredSysId, hoveredFleetId, vision, targetSystemId]);

  const findSystemAtCoords = (clickX: number, clickY: number) => {
    const selectThreshold = 15;
    for (const sys of gameState.systems) {
      const sysScreenX = sys.x * cellSize * zoom + panX;
      const sysScreenY = sys.y * cellSize * zoom + panY;
      const dist = Math.sqrt((sysScreenX - clickX) ** 2 + (sysScreenY - clickY) ** 2);
      if (dist <= selectThreshold) {
        return sys;
      }
    }
    return null;
  };

  const getConstrainedMenuPos = (clickX: number, clickY: number, rectWidth: number, rectHeight: number) => {
    const menuWidth = 190;
    const menuHeight = 140;

    let posX = clickX + 10;
    let posY = clickY + 10;

    if (posX + menuWidth > rectWidth) {
      posX = clickX - menuWidth - 10;
    }
    if (posY + menuHeight > rectHeight) {
      posY = clickY - menuHeight - 10;
    }

    posX = Math.max(10, Math.min(posX, rectWidth - menuWidth - 10));
    posY = Math.max(10, Math.min(posY, rectHeight - menuHeight - 10));

    return { x: posX, y: posY };
  };

  const handleSelectionAtCoords = (clickX: number, clickY: number, isCtrl: boolean) => {
    // Close context menu on normal selection click
    setContextMenu(null);

    // 1. Check if clicked a star system (within a radius of 15px)
    const clickedSys = findSystemAtCoords(clickX, clickY);

    if (clickedSys) {
      setSelectedFleetId(null);

      // If we already have a system selected, and we Ctrl + click another system (or targeting mode is active, or a friendly system is selected), trigger targeting
      if (selectedSystemId && selectedSystemId !== clickedSys.id && (isCtrl || isSelectingTarget || isFriendlySystemSelected)) {
        onSelectTargetSystem(clickedSys);
      } else {
        setSelectedSystemId(clickedSys.id);
      }
      return;
    }

    // 2. Check if clicked a fleet (within 15px screen distance)
    let clickedFleet: Fleet | null = null;
    const visibleFleets = gameState.fleets.filter(f => vision.fleets.has(f.id));
    const selectThreshold = 15;

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

  // Click handler: Selects star systems or fleets on the canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragMoved.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    handleSelectionAtCoords(clickX, clickY, e.ctrlKey);
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
        setContextMenu(null); // Close context menu on pan drag
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
    setContextMenu(null); // Close context menu on mouse down
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

  const handleTouchStart = (e: TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    setContextMenu(null); // Close context menu on touch start

    if (e.touches.length === 1) {
      // Single touch drag to pan
      isDragging.current = true;
      dragMoved.current = false;
      const touch = e.touches[0];
      const startX = touch.clientX - rect.left;
      const startY = touch.clientY - rect.top;
      dragStart.current = { x: startX, y: startY };
      touchStartDist.current = 0;

      // Start long press timer
      longPressActive.current = false;
      if (longPressTimer.current) clearTimeout(longPressTimer.current);

      const clickedSys = findSystemAtCoords(startX, startY);
      if (clickedSys) {
        longPressTimer.current = setTimeout(() => {
          longPressActive.current = true;
          const pos = getConstrainedMenuPos(startX, startY, rect.width, rect.height);
          setContextMenu({
            x: pos.x,
            y: pos.y,
            system: clickedSys
          });
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
        }, 600);
      }
    } else if (e.touches.length === 2) {
      // Dual touch pinch to zoom
      isDragging.current = false;
      dragMoved.current = false;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.sqrt((touch1.clientX - touch2.clientX) ** 2 + (touch1.clientY - touch2.clientY) ** 2);
      touchStartDist.current = dist;
      touchStartZoom.current = zoom;
      
      const midX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
      const midY = (touch1.clientY + touch2.clientY) / 2 - rect.top;
      touchStartMidpoint.current = { x: midX, y: midY };
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (e.touches.length === 1 && isDragging.current) {
      // Panning
      const touch = e.touches[0];
      const mx = touch.clientX - rect.left;
      const my = touch.clientY - rect.top;
      const dx = mx - dragStart.current.x;
      const dy = my - dragStart.current.y;

      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragMoved.current = true;
      }

      if (longPressActive.current) return;

      if (dragMoved.current) {
        setPanX(px => px + dx);
        setPanY(py => py + dy);
        dragStart.current = { x: mx, y: my };
      }
    } else if (e.touches.length === 2 && touchStartDist.current > 0) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      // Pinch to Zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.sqrt((touch1.clientX - touch2.clientX) ** 2 + (touch1.clientY - touch2.clientY) ** 2);
      const factor = dist / touchStartDist.current;
      const newZoom = Math.min(3.0, Math.max(0.3, touchStartZoom.current * factor));

      const midX = touchStartMidpoint.current.x;
      const midY = touchStartMidpoint.current.y;
      const gridMid = screenToGrid(midX, midY);

      const newPanX = midX - gridMid.x * cellSize * newZoom;
      const newPanY = midY - gridMid.y * cellSize * newZoom;

      setZoom(newZoom);
      setPanX(newPanX);
      setPanY(newPanY);
    } else {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };

  const handleTouchEnd = (_e: TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (longPressActive.current) {
      isDragging.current = false;
      longPressActive.current = false;
      return;
    }

    if (isDragging.current && !dragMoved.current) {
      // Tap selection
      handleSelectionAtCoords(dragStart.current.x, dragStart.current.y, false);
    }
    isDragging.current = false;
    touchStartDist.current = 0;
  };

  // Zoom with scroll wheel centered at current mouse cursor
  const handleWheel = (e: WheelEvent) => {
    setContextMenu(null); // Close context menu on zoom wheel
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

  const handleContextMenuNative = (e: MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const clickedSys = findSystemAtCoords(clickX, clickY);
    if (clickedSys) {
      const pos = getConstrainedMenuPos(clickX, clickY, rect.width, rect.height);
      setContextMenu({
        x: pos.x,
        y: pos.y,
        system: clickedSys
      });
    } else {
      setContextMenu(null);
    }
  };

  // Event handler refs to prevent recreation of event listeners
  const touchStartRef = useRef(handleTouchStart);
  const touchMoveRef = useRef(handleTouchMove);
  const touchEndRef = useRef(handleTouchEnd);
  const wheelRef = useRef(handleWheel);
  const contextMenuRef = useRef(handleContextMenuNative);

  useEffect(() => {
    touchStartRef.current = handleTouchStart;
    touchMoveRef.current = handleTouchMove;
    touchEndRef.current = handleTouchEnd;
    wheelRef.current = handleWheel;
    contextMenuRef.current = handleContextMenuNative;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      touchStartRef.current(e);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      touchMoveRef.current(e);
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      touchEndRef.current(e);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelRef.current(e);
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      contextMenuRef.current(e);
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);

  // Find active systems coordinates for selected system to display on tooltip
  const activeSystem = gameState.systems.find(s => s.id === selectedSystemId);
  const activeFleet = gameState.fleets.find(f => f.id === selectedFleetId);



  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {isSelectingTarget && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(5, 3, 13, 0.9)',
          border: '1px solid var(--accent-green)',
          boxShadow: '0 0 15px rgba(57, 255, 20, 0.3)',
          padding: '10px 20px',
          borderRadius: '8px',
          color: 'var(--accent-green)',
          fontFamily: 'Orbitron',
          fontSize: '13px',
          letterSpacing: '1px',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          pointerEvents: 'auto'
        }}>
          <span>🎯 TARGETING MODE: TAP DESTINATION SYSTEM</span>
          <button 
            className="btn-sci-fi btn-danger" 
            style={{ padding: '3px 8px', fontSize: '10px' }}
            onClick={() => setIsSelectingTarget(false)}
          >
            CANCEL
          </button>
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: isDragging.current ? 'grabbing' : 'grab', touchAction: 'none' }}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      />

      {/* Telemetry panel (Zoom / Pan Coordinates) */}
      <div style={{
        position: 'absolute',
        bottom: isMobile ? (window.innerHeight <= 480 ? '48px' : '65px') : '20px',
        left: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        pointerEvents: 'none',
        zIndex: 90
      }}>
        <div className="grid-indicator" style={{ fontSize: window.innerHeight <= 480 ? '9px' : '11px', padding: window.innerHeight <= 480 ? '2px 6px' : '4px 8px' }}>
          TELEMETRY RANGE: {mapWidth}x{mapHeight} LY
        </div>
        <div className="grid-indicator" style={{ fontSize: window.innerHeight <= 480 ? '9px' : '11px', padding: window.innerHeight <= 480 ? '2px 6px' : '4px 8px' }}>
          ZOOM: {Math.round(zoom * 100)}%
        </div>
        {activeSystem && (
          <div className="grid-indicator" style={{ color: 'var(--accent-magenta)', fontSize: window.innerHeight <= 480 ? '9px' : '11px', padding: window.innerHeight <= 480 ? '2px 6px' : '4px 8px' }}>
            LOCKED ON: {activeSystem.name} ({activeSystem.x}, {activeSystem.y})
          </div>
        )}
        {activeFleet && (
          <div className="grid-indicator" style={{ color: 'var(--accent-yellow)', fontSize: window.innerHeight <= 480 ? '9px' : '11px', padding: window.innerHeight <= 480 ? '2px 6px' : '4px 8px' }}>
            LOCKED ON FLEET: {Object.values(activeFleet.ships).reduce((a, b) => a + b, 0)} ships to {activeFleet.destination.name}
          </div>
        )}
      </div>

      {/* Floating Zoom Controls Trigger and Popout Panel */}
      <div 
        style={{
          position: 'absolute',
          bottom: isMobile ? (window.innerHeight <= 480 ? '48px' : '65px') : '20px',
          right: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px',
          zIndex: 150
        }}
        onMouseEnter={() => !isMobile && setShowZoomMenu(true)}
        onMouseLeave={() => !isMobile && setShowZoomMenu(false)}
      >
        {showZoomMenu && (
          <div 
            style={{
              display: 'flex',
              gap: '6px',
              padding: '6px',
              background: 'rgba(5, 3, 13, 0.9)',
              border: '1px solid rgba(0, 240, 255, 0.3)',
              borderRadius: '6px',
              boxShadow: '0 0 15px rgba(0, 240, 255, 0.2)',
              pointerEvents: 'auto'
            }}
            className="animate-fade-in"
          >
            <button className="btn-sci-fi" onClick={handleZoomIn} style={{ padding: '6px 12px', fontSize: '12px' }} title="Zoom In">+</button>
            <button className="btn-sci-fi" onClick={handleZoomOut} style={{ padding: '6px 12px', fontSize: '12px' }} title="Zoom Out">-</button>
            <button className="btn-sci-fi" onClick={handleResetView} style={{ padding: '6px 12px', fontSize: '11px' }} title="Reset Zoom">RESET</button>
          </div>
        )}
        <button
          className="btn-sci-fi"
          onClick={() => setShowZoomMenu(!showZoomMenu)}
          style={{
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            padding: 0,
            borderRadius: '50%',
            background: showZoomMenu ? 'rgba(0, 240, 255, 0.2)' : 'rgba(5, 3, 13, 0.7)',
            border: '1px solid rgba(0, 240, 255, 0.4)',
            boxShadow: '0 0 10px rgba(0, 240, 255, 0.15)',
            pointerEvents: 'auto',
            cursor: 'pointer'
          }}
          title="Map Navigation / Zoom Controls"
        >
          🔍
        </button>
      </div>

      {contextMenu && (
        <div 
          style={{
            position: 'absolute',
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            background: 'rgba(6, 4, 18, 0.95)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--accent-cyan)',
            boxShadow: '0 0 20px rgba(0, 240, 255, 0.25)',
            borderRadius: '6px',
            padding: '8px 0',
            minWidth: '180px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            fontFamily: 'Orbitron, sans-serif'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            padding: '4px 14px 8px 14px',
            borderBottom: '1px solid rgba(0, 240, 255, 0.15)',
            marginBottom: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}>
            <span style={{ fontSize: '11px', color: '#fff', fontWeight: 'bold', letterSpacing: '1px' }}>
              {contextMenu.system.name}
            </span>
            <span style={{ fontSize: '8px', color: 'var(--accent-cyan)', fontFamily: 'Share Tech Mono' }}>
              COORD: {contextMenu.system.x}, {contextMenu.system.y} LY
            </span>
          </div>

          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: '#e2e8f0',
              padding: '8px 14px',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '11px',
              letterSpacing: '1px',
              transition: 'background 0.15s, color 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onClick={() => {
              setSelectedFleetId(null);
              setSelectedSystemId(contextMenu.system.id);
              setContextMenu(null);
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 240, 255, 0.1)';
              e.currentTarget.style.color = 'var(--accent-cyan)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#e2e8f0';
            }}
          >
            <span>🔍</span> INSPECT SYSTEM
          </button>

          {contextMenu.system.id !== selectedSystemId && (isFriendlySystemSelected || isFleetSelected) ? (
            <button
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-green)',
                padding: '8px 14px',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '11px',
                letterSpacing: '1px',
                transition: 'background 0.15s, color 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 'bold'
              }}
              onClick={() => {
                onSelectTargetSystem(contextMenu.system);
                setContextMenu(null);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(57, 255, 20, 0.15)';
                e.currentTarget.style.textShadow = '0 0 5px rgba(57, 255, 20, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.textShadow = 'none';
              }}
            >
              <span>🎯</span> SET AS TARGET
            </button>
          ) : (
            <div
              style={{
                color: 'rgba(255, 255, 255, 0.3)',
                padding: '8px 14px',
                fontSize: '10px',
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'not-allowed'
              }}
              title="Select a friendly system or fleet first to target this destination"
            >
              <span>🔒</span> TARGETING LOCKED
            </div>
          )}

          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              padding: '6px 14px',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '10px',
              letterSpacing: '1.5px',
              transition: 'background 0.15s',
              marginTop: '4px',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onClick={() => setContextMenu(null)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span>❌</span> CLOSE MENU
          </button>
        </div>
      )}
    </div>
  );
};
