// Star-Swarm Game State Engine (TypeScript)

export interface ShipDef {
  name: string;
  cost: number;
  speed: number; // Lightyears per turn
  hp: number;
  attack: number;
  hitChance: number;
  sensorRange?: number;
  description: string;
}

export interface UpgradeDef {
  name: string;
  baseCost: number;
  multiplier: number;
  description: string;
}

export interface GameRules {
  version?: number;
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  enableCredits: boolean;
  enableUpgrades: boolean;
  captureRequiresColonyShip: boolean;
  startingResources: number;
  resourcesPerTurn: {
    base: number;
    randomAdd: number;
  };
  startingShips: Record<string, number>;
  neutralStartingShipsRange: {
    min: number;
    max: number;
    type: string;
  };
  nodeProduction: {
    enabled: boolean;
    shipsPerTurn: number;
    shipType: string;
  };
  ships: Record<string, ShipDef>;
  upgrades: Record<string, UpgradeDef>;
  starSightRange?: number;
}

export interface BuildJob {
  shipType: string;
  turnsRemaining: number;
  totalTurns: number;
}

export interface StarSystem {
  id: number;
  name: string;
  x: number;
  y: number;
  owner: number; // 0 = Neutral, 1+ = Player Factions
  ships: {
    Fighter: number;
    Cruiser: number;
    Scout: number;
    Colony: number;
    [key: string]: number;
  };
  shipyardLvl: number;
  sensorLvl: number;
  shieldsLvl: number;
  buildQueue: BuildJob[];
  resourcesPerTurn: number;
  isHomePlanet?: boolean;
}

export interface FleetLocation {
  x: number;
  y: number;
  name: string;
  id: number | null;
}

export interface Coordinate {
  x: number;
  y: number;
}

export interface Fleet {
  id: string;
  owner: number;
  ships: {
    Fighter: number;
    Cruiser: number;
    Scout: number;
    Colony: number;
    [key: string]: number;
  };
  source: FleetLocation;
  destination: FleetLocation;
  currentPos: Coordinate;
  turnsRemaining: number;
  totalTurns: number;
  isRecalling: boolean;
  speed: number;
}

export interface AIConfig {
  aggression: number;   // 0 - 100
  expansion: number;    // 0 - 100
  techFocus: number;    // 0 - 100
  economyBonus: number; // 0 - 30
}

export interface Player {
  id: number;
  type: 'human' | 'ai';
  team: number;
  name: string;
  color?: string;
  isLocal?: boolean;
  assignedEmail?: string | null;
  endedTurn?: boolean;
  difficulty?: 'easy' | 'medium' | 'hard' | 'custom';
  aiConfig?: AIConfig;
}

export interface PlayerState {
  id: number;
  name: string;
  type: 'human' | 'ai';
  team: number;
  resources: number;
  tech: {
    Hyperdrive: number;
    [key: string]: number;
  };
  lost: boolean;
  color?: string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'custom';
  aiConfig?: AIConfig;
}

export interface CombatRound {
  round: number;
  attackerRemaining: Record<string, number>;
  defenderRemaining: Record<string, number>;
  attackerHits: number;
  defenderHits: number;
}

export interface CombatReport {
  attackerId: number;
  defenderId: number;
  startAttacker: Record<string, number>;
  startDefender: Record<string, number>;
  endAttacker: Record<string, number>;
  endDefender: Record<string, number>;
  winner: number;
  log: CombatRound[];
}

export interface GameEvent {
  type: 'merge' | 'battle' | 'elimination';
  systemId?: number;
  systemName?: string;
  playerId?: number;
  shipsMerged?: Record<string, number>;
  attacker?: number;
  defender?: number;
  results?: CombatReport;
}

export interface ActionLogEntry {
  timestamp: string;
  playerId: number;
  playerName: string;
  turnNumber: number;
  actionType: string;
  details: string;
}

export interface GameState {
  gridWidth: number;
  gridHeight: number;
  systems: StarSystem[];
  fleets: Fleet[];
  players: Player[];
  playerState: Record<number, PlayerState>;
  turnNumber: number;
  activePlayerIdx: number;
  combatLog: GameEvent[];
  actionLog?: ActionLogEntry[];
  rules?: GameRules;
  turnStyle?: 'simultaneous' | 'sequential';
  seed?: string | number;
  rngState?: number;
}

export function hashSeed(seed: string | number | undefined): number {
  if (seed === undefined || seed === null || seed === '') {
    return Math.floor(Math.random() * 2147483647);
  }
  if (typeof seed === 'number') {
    return seed | 0;
  }
  let hash = 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function seededRandom(state: GameState): number {
  if (state.rngState === undefined) {
    state.rngState = hashSeed(state.seed);
  }
  state.rngState = (state.rngState * 1664525 + 1013904223) | 0;
  return (state.rngState >>> 0) / 4294967296;
}

export const SHIP_TYPES: Record<string, ShipDef> = {
  Fighter: {
    name: 'Fighter',
    cost: 12,
    speed: 4.0,
    hp: 1,
    attack: 1,
    hitChance: 0.5,
    description: 'Fast, cheap swarm unit. Excellent interceptor.'
  },
  Cruiser: {
    name: 'Cruiser',
    cost: 36,
    speed: 2.0,
    hp: 4,
    attack: 4,
    hitChance: 0.65,
    description: 'Heavy warship. Absorbs damage and deals heavy fire.'
  },
  Scout: {
    name: 'Scout',
    cost: 15,
    speed: 6.0,
    hp: 1,
    attack: 0.5,
    hitChance: 0.33,
    sensorRange: 12.0,
    description: 'Ultra-fast reconnaissance. Expands team vision map.'
  },
  Colony: {
    name: 'Colony Ship',
    cost: 45,
    speed: 2.5,
    hp: 2,
    attack: 0,
    hitChance: 0,
    description: 'Specialized vessel required to annex neutral clusters.'
  }
};

export const UPGRADES: Record<string, UpgradeDef> = {
  Shipyard: {
    name: 'Hyper Shipyard',
    baseCost: 30,
    multiplier: 1.6,
    description: 'Increases local ship production speed (+1 queue slot & reduces build times).'
  },
  Sensors: {
    name: 'Sensor Array',
    baseCost: 25,
    multiplier: 1.5,
    description: 'Expands cluster sensor vision radius (+2.5 Lightyears per level).'
  },
  Shields: {
    name: 'Deflector Shields',
    baseCost: 35,
    multiplier: 1.7,
    description: 'Absorbs incoming damage in battles (+1 damage absorbed per round per level).'
  },
  Hyperdrive: {
    name: 'Hyperdrive Engine',
    baseCost: 50,
    multiplier: 2.0,
    description: 'Global upgrade: Increases speed of all dispatched fleets (+15% speed).'
  }
};

export const NORMAL_RULES: GameRules = {
  version: 1,
  id: 'normal',
  name: 'Normal Mode',
  description: 'Standard rules with shipyard queues, resource collection, and tech upgrades.',
  isDefault: true,
  enableCredits: true,
  enableUpgrades: true,
  captureRequiresColonyShip: true,
  startingResources: 60,
  resourcesPerTurn: {
    base: 15,
    randomAdd: 10
  },
  startingShips: {
    Fighter: 8,
    Cruiser: 1,
    Scout: 2,
    Colony: 1
  },
  neutralStartingShipsRange: {
    min: 1,
    max: 4,
    type: 'Fighter'
  },
  nodeProduction: {
    enabled: false,
    shipsPerTurn: 0,
    shipType: ''
  },
  ships: SHIP_TYPES,
  upgrades: UPGRADES,
  starSightRange: 6.0
};

export const SIMPLE_RULES: GameRules = {
  version: 1,
  id: 'simple',
  name: 'Simple Mode',
  description: 'Nodes produce ships directly. One ship type, no upgrades, and no credits.',
  isDefault: true,
  enableCredits: false,
  enableUpgrades: false,
  captureRequiresColonyShip: false,
  startingResources: 0,
  resourcesPerTurn: {
    base: 0,
    randomAdd: 0
  },
  startingShips: {
    Fighter: 5
  },
  neutralStartingShipsRange: {
    min: 1,
    max: 3,
    type: 'Fighter'
  },
  nodeProduction: {
    enabled: true,
    shipsPerTurn: 2,
    shipType: 'Fighter'
  },
  ships: {
    Fighter: {
      name: 'Fighter',
      cost: 0,
      speed: 4.0,
      hp: 1,
      attack: 1,
      hitChance: 0.5,
      description: 'Basic combat unit. Captures nodes and attacks enemies.'
    }
  },
  upgrades: {},
  starSightRange: 6.0
};

export const FACTION_INFO: Record<number, { name: string; color: string; team: number }> = {
  0: { name: 'Neutral / Independent', color: '#8ba2b5', team: 0 },
  1: { name: 'Vanguard Swarm', color: '#00f0ff', team: 1 },
  2: { name: 'Nebula Collective', color: '#ff007f', team: 2 },
  3: { name: 'Solar Apex', color: '#ffaa00', team: 3 },
  4: { name: 'Void Keepers', color: '#39ff14', team: 4 },
  5: { name: 'Astral Syndicate', color: '#b026ff', team: 1 },
  6: { name: 'Crimson Alliance', color: '#ff2a2a', team: 2 },
  7: { name: 'Zenith Coalition', color: '#e1b12c', team: 3 },
  8: { name: 'Quantum Union', color: '#00a8ff', team: 4 }
};

const STAR_NAMES = [
  'Alpha Centauri', 'Sirius prime', 'Betelgeuse Secundus', 'Rigel Cluster', 'Vega Station',
  'Altair Prime', 'Proxima Outpost', 'Aldebaran Core', 'Antares Maw', 'Capella Hub',
  'Arcturus Nexus', 'Castor Forge', 'Pollux Drift', 'Spica Haven', 'Fomalhaut Deep',
  'Deneb Core', 'Regulus Void', 'Bellatrix Station', 'Castor Nexus', 'Mizar Outpost',
  'Alioth Spire', 'Alkaid Ridge', 'Dubhe Void', 'Merak Forge', 'Phecda Reach'
];

export function initializeGame(options: {
  gridWidth?: number;
  gridHeight?: number;
  numSystems?: number;
  players?: Player[];
  rules?: GameRules;
  turnStyle?: 'simultaneous' | 'sequential';
  seed?: string | number;
} = {}): GameState {
  const rules = options.rules || NORMAL_RULES;
  const width = options.gridWidth || 60;
  const height = options.gridHeight || 60;
  const numSystems = options.numSystems || 16;
  const players = options.players || [
    { id: 1, type: 'human', team: 1, name: 'Vanguard (You)', isLocal: true, assignedEmail: null, endedTurn: false },
    { id: 2, type: 'ai', team: 2, name: 'Nebula AI', isLocal: false, assignedEmail: null, endedTurn: false },
    { id: 3, type: 'ai', team: 3, name: 'Solar AI', isLocal: false, assignedEmail: null, endedTurn: false },
    { id: 4, type: 'ai', team: 4, name: 'Void AI', isLocal: false, assignedEmail: null, endedTurn: false }
  ];

  const seedVal = options.seed !== undefined ? options.seed : Math.floor(Math.random() * 2147483647);
  let localRngState = hashSeed(seedVal);
  const nextRandom = () => {
    localRngState = (localRngState * 1664525 + 1013904223) | 0;
    return (localRngState >>> 0) / 4294967296;
  };

  const systems: StarSystem[] = [];
  const minDistance = 8.0;

  for (let i = 0; i < numSystems; i++) {
    let x = 0, y = 0, tooClose = false;
    let attempts = 0;

    do {
      x = Math.floor(nextRandom() * (width - 8)) + 4;
      y = Math.floor(nextRandom() * (height - 8)) + 4;
      tooClose = false;

      for (const sys of systems) {
        const dist = Math.sqrt((sys.x - x) ** 2 + (sys.y - y) ** 2);
        if (dist < minDistance) {
          tooClose = true;
          break;
        }
      }
      attempts++;
    } while (tooClose && attempts < 100);

    const name = STAR_NAMES[i % STAR_NAMES.length] + (i >= STAR_NAMES.length ? ` ${Math.floor(i / STAR_NAMES.length) + 1}` : '');
    
    const initialShips: Record<string, number> = {};
    Object.keys(rules.ships).forEach(type => {
      initialShips[type] = 0;
    });

    systems.push({
      id: i + 1,
      name,
      x,
      y,
      owner: 0,
      ships: initialShips as any,
      shipyardLvl: 1,
      sensorLvl: 1,
      shieldsLvl: 0,
      buildQueue: [],
      resourcesPerTurn: rules.resourcesPerTurn.base + Math.floor(nextRandom() * (rules.resourcesPerTurn.randomAdd + 1))
    });
  }

  const processedPlayers: Player[] = players.map(p => {
    const factionDefault = FACTION_INFO[p.id] || { color: '#ffffff', name: p.name, team: p.team };
    return {
      ...p,
      color: p.color || factionDefault.color,
      team: p.team !== undefined ? p.team : factionDefault.team,
      isLocal: p.isLocal !== undefined ? p.isLocal : (p.type === 'human'),
      assignedEmail: p.assignedEmail || null,
      endedTurn: p.endedTurn || false,
      difficulty: p.difficulty || 'medium',
      aiConfig: p.aiConfig
    };
  });

  // Helper to compute Euclidean distance
  const getDistance = (s1: StarSystem, s2: StarSystem) => {
    return Math.sqrt((s1.x - s2.x) ** 2 + (s1.y - s2.y) ** 2);
  };

  const N = processedPlayers.length;
  let bestSystems: StarSystem[] = [];
  let bestMinDist = -1;
  let bestAvgDist = -1;

  if (N > 0 && systems.length >= N) {
    // Try starting the greedy selection from each available system
    for (let startIdx = 0; startIdx < systems.length; startIdx++) {
      const selected: StarSystem[] = [systems[startIdx]];

      while (selected.length < N) {
        let nextSys: StarSystem | null = null;
        let maxMinDist = -1;

        for (const sys of systems) {
          if (selected.includes(sys)) continue;

          let minDist = Infinity;
          for (const sel of selected) {
            const d = getDistance(sys, sel);
            if (d < minDist) {
              minDist = d;
            }
          }

          if (minDist > maxMinDist) {
            maxMinDist = minDist;
            nextSys = sys;
          }
        }

        if (nextSys) {
          selected.push(nextSys);
        } else {
          break;
        }
      }

      // Evaluate the selected set of systems
      let minDist = Infinity;
      let sumDist = 0;
      let count = 0;

      for (let i = 0; i < selected.length; i++) {
        for (let j = i + 1; j < selected.length; j++) {
          const d = getDistance(selected[i], selected[j]);
          if (d < minDist) {
            minDist = d;
          }
          sumDist += d;
          count++;
        }
      }
      const avgDist = count > 0 ? sumDist / count : 0;

      // Maximize minimum pairwise distance, breaking ties with average distance
      if (minDist > bestMinDist || (minDist === bestMinDist && avgDist > bestAvgDist)) {
        bestMinDist = minDist;
        bestAvgDist = avgDist;
        bestSystems = selected;
      }
    }
  } else {
    // Fallback: just use whatever systems we have
    bestSystems = systems.slice(0, N);
  }

  // Shuffle the selected best systems to assign them randomly to players
  const shuffledBest = [...bestSystems];
  for (let i = shuffledBest.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [shuffledBest[i], shuffledBest[j]] = [shuffledBest[j], shuffledBest[i]];
  }

  processedPlayers.forEach((player, idx) => {
    if (shuffledBest.length === 0) return;
    const startingSys = shuffledBest[idx % shuffledBest.length];
    startingSys.owner = player.id;

    const startingShips: Record<string, number> = {};
    Object.keys(rules.ships).forEach(type => {
      startingShips[type] = rules.startingShips[type] || 0;
    });
    startingSys.ships = startingShips as any;

    startingSys.shipyardLvl = 1;
    startingSys.sensorLvl = 2;
    startingSys.shieldsLvl = rules.enableUpgrades ? 1 : 0;
  });

  systems.forEach(sys => {
    if (sys.owner === 0) {
      const range = rules.neutralStartingShipsRange;
      const count = Math.floor(nextRandom() * (range.max - range.min + 1)) + range.min;
      if (sys.ships[range.type] !== undefined) {
        sys.ships[range.type] = count;
      }
    }
  });

  const playerState: Record<number, PlayerState> = {};
  processedPlayers.forEach(p => {
    playerState[p.id] = {
      id: p.id,
      name: p.name,
      type: p.type,
      team: p.team,
      resources: rules.startingResources,
      tech: {
        Hyperdrive: 0
      },
      lost: false,
      color: p.color,
      difficulty: p.difficulty || 'medium',
      aiConfig: p.aiConfig
    };
  });

  const state: GameState = {
    gridWidth: width,
    gridHeight: height,
    systems,
    fleets: [],
    players: processedPlayers,
    playerState,
    turnNumber: 1,
    activePlayerIdx: 0,
    combatLog: [],
    rules,
    turnStyle: options.turnStyle || 'simultaneous',
    seed: seedVal,
    rngState: localRngState
  };

  reassignHomePlanets(state);

  return state;
}

export function computeVision(gameState: GameState, playerId: number): {
  coordinates: Set<string>;
  systems: Set<number>;
  fleets: Set<string>;
} {
  const player = gameState.playerState[playerId];
  if (!player) return { coordinates: new Set(), systems: new Set(), fleets: new Set() };

  const team = player.team;
  const visibleCoords = new Set<string>();
  const visibleSystems = new Set<number>();
  const visibleFleets = new Set<string>();

  const alliedPlayerIds = gameState.players
    .filter(p => p.team === team)
    .map(p => p.id);

  const markCircleVisible = (cx: number, cy: number, radius: number) => {
    const rSq = radius * radius;
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(gameState.gridWidth - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(gameState.gridHeight - 1, Math.ceil(cy + radius));

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= rSq) {
          visibleCoords.add(`${x},${y}`);
        }
      }
    }
  };

  gameState.systems.forEach(sys => {
    if (alliedPlayerIds.includes(sys.owner)) {
      visibleSystems.add(sys.id);
      const sensorRadius = (gameState.rules?.starSightRange ?? 6.0) + (sys.sensorLvl || 1) * 2.5;
      markCircleVisible(sys.x, sys.y, sensorRadius);
    }
  });

  gameState.fleets.forEach(fleet => {
    if (alliedPlayerIds.includes(fleet.owner)) {
      visibleFleets.add(fleet.id);
      const hasScout = (fleet.ships.Scout || 0) > 0;
      const activeRules = gameState.rules || NORMAL_RULES;
      const scoutDef = activeRules.ships.Scout || SHIP_TYPES.Scout;
      const sensorRadius = hasScout ? (scoutDef.sensorRange || 12.0) : 5.0;
      markCircleVisible(fleet.currentPos.x, fleet.currentPos.y, sensorRadius);
    }
  });

  gameState.systems.forEach(sys => {
    if (visibleCoords.has(`${sys.x},${sys.y}`)) {
      visibleSystems.add(sys.id);
    }
  });

  gameState.fleets.forEach(fleet => {
    const fx = Math.round(fleet.currentPos.x);
    const fy = Math.round(fleet.currentPos.y);
    if (visibleCoords.has(`${fx},${fy}`)) {
      visibleFleets.add(fleet.id);
    }
  });

  return {
    coordinates: visibleCoords,
    systems: visibleSystems,
    fleets: visibleFleets
  };
}

export function dispatchFleet(
  gameState: GameState,
  playerId: number,
  sourceSysId: number,
  destSysId: number,
  shipQuantities: Record<string, number>
): { success: boolean; reason?: string; fleet?: Fleet } {
  const source = gameState.systems.find(s => s.id === sourceSysId);
  const dest = gameState.systems.find(s => s.id === destSysId);
  
  if (!source || !dest || source.owner !== playerId) {
    return { success: false, reason: 'Invalid source/destination or ownership.' };
  }

  for (const [shipType, qty] of Object.entries(shipQuantities)) {
    if (qty < 0 || (source.ships[shipType] || 0) < qty) {
      return { success: false, reason: `Insufficient ${shipType} at source.` };
    }
  }

  const totalShips = Object.values(shipQuantities).reduce((a, b) => a + b, 0);
  if (totalShips <= 0) return { success: false, reason: 'Must send at least 1 ship.' };

  for (const [shipType, qty] of Object.entries(shipQuantities)) {
    source.ships[shipType] -= qty;
  }

  const activeRules = gameState.rules || NORMAL_RULES;
  let slowestSpeed = Infinity;
  for (const [shipType, qty] of Object.entries(shipQuantities)) {
    if (qty > 0) {
      const shipSpeed = activeRules.ships[shipType]?.speed || SHIP_TYPES[shipType]?.speed || 1.0;
      slowestSpeed = Math.min(slowestSpeed, shipSpeed);
    }
  }

  const hyperdriveLvl = gameState.playerState[playerId].tech.Hyperdrive || 0;
  const actualSpeed = slowestSpeed * (1.0 + hyperdriveLvl * 0.15);

  const dist = Math.sqrt((dest.x - source.x) ** 2 + (dest.y - source.y) ** 2);
  const totalTurns = Math.max(1, Math.ceil(dist / actualSpeed));

  const initialFleetShips: Record<string, number> = {};
  Object.keys(activeRules.ships).forEach(type => {
    initialFleetShips[type] = 0;
  });

  const newFleet: Fleet = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    owner: playerId,
    ships: { ...initialFleetShips, ...shipQuantities } as any,
    source: { x: source.x, y: source.y, name: source.name, id: source.id },
    destination: { x: dest.x, y: dest.y, name: dest.name, id: dest.id },
    currentPos: { x: source.x, y: source.y },
    turnsRemaining: totalTurns,
    totalTurns: totalTurns,
    isRecalling: false,
    speed: actualSpeed
  };

  gameState.fleets.push(newFleet);
  logAction(gameState, playerId, 'dispatch_fleet', `Dispatched fleet with ships ${Object.entries(shipQuantities).filter(([_, q]) => q > 0).map(([t, q]) => `${t}:${q}`).join(', ')} from ${source.name} to ${dest.name}`);
  return { success: true, fleet: newFleet };
}

export function recallFleet(
  gameState: GameState,
  playerId: number,
  fleetId: string
): { success: boolean; reason?: string } {
  const fleet = gameState.fleets.find(f => f.id === fleetId);
  if (!fleet || fleet.owner !== playerId) return { success: false, reason: 'Fleet not found or unauthorized.' };
  if (fleet.isRecalling) return { success: false, reason: 'Fleet is already returning.' };

  fleet.isRecalling = true;

  const prevDest = { ...fleet.destination };
  const prevSource = { ...fleet.source };

  fleet.destination = { x: prevSource.x, y: prevSource.y, name: prevSource.name, id: prevSource.id };
  fleet.source = { x: fleet.currentPos.x, y: fleet.currentPos.y, name: `Deep Space near ${prevDest.name}`, id: null };

  const turnsTraveled = fleet.totalTurns - fleet.turnsRemaining;
  fleet.turnsRemaining = Math.max(1, turnsTraveled);
  fleet.totalTurns = fleet.turnsRemaining;

  logAction(gameState, playerId, 'recall_fleet', `Recalled fleet returning to base ${fleet.destination.name}`);
  return { success: true };
}

export function upgradeSystem(
  gameState: GameState,
  playerId: number,
  systemId: number,
  upgradeType: string
): { success: boolean; reason?: string } {
  const activeRules = gameState.rules || NORMAL_RULES;
  if (!activeRules.enableUpgrades) {
    return { success: false, reason: 'Upgrades are disabled in this game mode.' };
  }

  const player = gameState.playerState[playerId];
  if (!player || player.lost) return { success: false, reason: 'Player invalid.' };

  const upgrades = activeRules.upgrades || UPGRADES;

  if (upgradeType === 'Hyperdrive') {
    const currentLvl = player.tech.Hyperdrive || 0;
    const upgradeDef = upgrades.Hyperdrive || UPGRADES.Hyperdrive;
    const cost = activeRules.enableCredits
      ? Math.round(upgradeDef.baseCost * (upgradeDef.multiplier ** currentLvl))
      : 0;

    if (activeRules.enableCredits && player.resources < cost) {
      return { success: false, reason: `Requires ${cost} resources (Have: ${player.resources}).` };
    }

    if (activeRules.enableCredits) {
      player.resources -= cost;
    }
    player.tech.Hyperdrive += 1;
    logAction(gameState, playerId, 'upgrade_system', `Upgraded global Hyperdrive technology to level ${player.tech.Hyperdrive}`);
    return { success: true };
  }

  const sys = gameState.systems.find(s => s.id === systemId);
  if (!sys || sys.owner !== playerId) return { success: false, reason: 'System not owned.' };

  let currentLvl = 1;
  let prop: 'shipyardLvl' | 'sensorLvl' | 'shieldsLvl' = 'shipyardLvl';

  if (upgradeType === 'Shipyard') {
    currentLvl = sys.shipyardLvl;
    prop = 'shipyardLvl';
  } else if (upgradeType === 'Sensors') {
    currentLvl = sys.sensorLvl;
    prop = 'sensorLvl';
  } else if (upgradeType === 'Shields') {
    currentLvl = sys.shieldsLvl;
    prop = 'shieldsLvl';
  } else {
    return { success: false, reason: 'Unknown upgrade type.' };
  }

  const upgradeDef = upgrades[upgradeType] || UPGRADES[upgradeType];
  const cost = activeRules.enableCredits
    ? Math.round(upgradeDef.baseCost * (upgradeDef.multiplier ** (currentLvl - (upgradeType === 'Shields' ? 0 : 1))))
    : 0;

  if (activeRules.enableCredits && player.resources < cost) {
    return { success: false, reason: `Requires ${cost} resources (Have: ${player.resources}).` };
  }

  if (activeRules.enableCredits) {
    player.resources -= cost;
  }
  sys[prop] += 1;

  logAction(gameState, playerId, 'upgrade_system', `Upgraded ${upgradeType} to level ${sys[prop]} at ${sys.name}`);
  return { success: true };
}

export function queueShipProduction(
  gameState: GameState,
  playerId: number,
  systemId: number,
  shipType: string
): { success: boolean; reason?: string } {
  const activeRules = gameState.rules || NORMAL_RULES;
  if (activeRules.nodeProduction?.enabled) {
    return { success: false, reason: 'Manual ship production is disabled in this mode. Nodes produce ships automatically.' };
  }

  const sys = gameState.systems.find(s => s.id === systemId);
  if (!sys || sys.owner !== playerId) return { success: false, reason: 'System not owned.' };

  const shipDef = activeRules.ships[shipType] || SHIP_TYPES[shipType];
  if (!shipDef) return { success: false, reason: 'Unknown ship type.' };

  const maxQueue = sys.shipyardLvl + 1;
  if (sys.buildQueue.length >= maxQueue) {
    return { success: false, reason: `Production line full. Upgrade Shipyard to expand capacity (Max: ${maxQueue}).` };
  }

  const player = gameState.playerState[playerId];
  const cost = activeRules.enableCredits ? shipDef.cost : 0;
  if (activeRules.enableCredits && player.resources < cost) {
    return { success: false, reason: `Insufficient funds. Ship costs ${cost}.` };
  }

  if (activeRules.enableCredits) {
    player.resources -= cost;
  }

  let buildTime = 1;
  if (shipType === 'Colony') buildTime = 2;
  if (shipType === 'Cruiser') buildTime = 3;

  const timeReduction = Math.floor((sys.shipyardLvl - 1) / 2);
  buildTime = Math.max(1, buildTime - timeReduction);

  sys.buildQueue.push({
    shipType,
    turnsRemaining: buildTime,
    totalTurns: buildTime
  });

  logAction(gameState, playerId, 'queue_production', `Queued ${shipType} production at ${sys.name}`);
  return { success: true };
}

export function resolveCombat(
  attackerId: number,
  defenderId: number,
  attackerShips: Record<string, number>,
  defenderShips: Record<string, number>,
  defenderShieldsLvl = 0,
  shipDefs: Record<string, ShipDef> = SHIP_TYPES,
  gameState?: GameState
): CombatReport {
  const log: CombatRound[] = [];
  const startAttacker = { ...attackerShips };
  const startDefender = { ...defenderShips };

  let round = 1;
  const aShips = { ...attackerShips };
  const dShips = { ...defenderShips };

  const getRand = () => gameState ? seededRandom(gameState) : Math.random();

  while (
    Object.values(aShips).reduce((a, b) => a + b, 0) > 0 &&
    Object.values(dShips).reduce((a, b) => a + b, 0) > 0 &&
    round <= 10
  ) {
    let attackerHits = 0;
    let defenderHits = 0;

    for (const [type, qty] of Object.entries(aShips)) {
      if (qty <= 0) continue;
      const def = shipDefs[type] || SHIP_TYPES[type];
      if (!def) continue;
      for (let i = 0; i < qty; i++) {
        if (getRand() < def.hitChance) {
          attackerHits += def.attack;
        }
      }
    }

    for (const [type, qty] of Object.entries(dShips)) {
      if (qty <= 0) continue;
      const def = shipDefs[type] || SHIP_TYPES[type];
      if (!def) continue;
      for (let i = 0; i < qty; i++) {
        if (getRand() < def.hitChance) {
          defenderHits += def.attack;
        }
      }
    }

    if (defenderShieldsLvl > 0) {
      const absorbed = Math.min(attackerHits, defenderShieldsLvl);
      attackerHits -= absorbed;
    }

    const applyDamage = (ships: Record<string, number>, damage: number) => {
      let dmgLeft = damage;
      // Sort ship types by HP (ascending) so fragile ships take damage first
      const order = Object.keys(ships).sort((a, b) => {
        const hpA = (shipDefs[a] || SHIP_TYPES[a])?.hp || 1;
        const hpB = (shipDefs[b] || SHIP_TYPES[b])?.hp || 1;
        return hpA - hpB;
      });
      
      for (const type of order) {
        if ((ships[type] || 0) <= 0 || dmgLeft <= 0) continue;
        const def = shipDefs[type] || SHIP_TYPES[type];
        const hp = def ? def.hp : 1;
        
        const potentialKills = Math.floor(dmgLeft / hp);
        const actualKills = Math.min(ships[type], potentialKills);
        
        ships[type] -= actualKills;
        dmgLeft -= actualKills * hp;

        if (dmgLeft > 0 && ships[type] > 0) {
          ships[type]--;
          dmgLeft = 0;
        }
      }
    };

    applyDamage(dShips, attackerHits);
    applyDamage(aShips, defenderHits);

    log.push({
      round,
      attackerRemaining: { ...aShips },
      defenderRemaining: { ...dShips },
      attackerHits,
      defenderHits
    });

    round++;
  }

  const attackerSurvived = Object.values(aShips).reduce((a, b) => a + b, 0) > 0;
  const defenderSurvived = Object.values(dShips).reduce((a, b) => a + b, 0) > 0;

  return {
    attackerId,
    defenderId,
    startAttacker,
    startDefender,
    endAttacker: aShips,
    endDefender: dShips,
    winner: attackerSurvived ? attackerId : (defenderSurvived ? defenderId : 0),
    log
  };
}

export function processTurnEnd(gameState: GameState): void {
  const newCombatLogs: GameEvent[] = [];
  const activeRules = gameState.rules || NORMAL_RULES;

  // 1. Process automated node production or manual build queues
  if (activeRules.nodeProduction?.enabled) {
    const prod = activeRules.nodeProduction;
    gameState.systems.forEach(sys => {
      if (sys.owner !== 0) {
        const player = gameState.playerState[sys.owner];
        if (player && !player.lost) {
          sys.ships[prod.shipType] = (sys.ships[prod.shipType] || 0) + prod.shipsPerTurn;
        }
      }
    });
  } else {
    gameState.systems.forEach(sys => {
      if (sys.owner === 0) return;

      if (sys.buildQueue && sys.buildQueue.length > 0) {
        const currentJob = sys.buildQueue[0];
        currentJob.turnsRemaining -= 1;

        if (currentJob.turnsRemaining <= 0) {
          sys.ships[currentJob.shipType] = (sys.ships[currentJob.shipType] || 0) + 1;
          sys.buildQueue.shift();
        }
      }
    });
  }

  // 2. Collect resources (only if credits are enabled)
  if (activeRules.enableCredits) {
    gameState.systems.forEach(sys => {
      if (sys.owner !== 0) {
        const player = gameState.playerState[sys.owner];
        if (player && !player.lost) {
          player.resources += sys.resourcesPerTurn;
        }
      }
    });
  }

  const survivingFleets: Fleet[] = [];
  
  gameState.fleets.forEach(fleet => {
    fleet.turnsRemaining -= 1;

    const progress = (fleet.totalTurns - fleet.turnsRemaining) / fleet.totalTurns;
    
    let targetX: number, targetY: number;
    const destSys = gameState.systems.find(s => s.id === fleet.destination.id);
    
    if (destSys) {
      targetX = destSys.x;
      targetY = destSys.y;
    } else {
      targetX = fleet.destination.x;
      targetY = fleet.destination.y;
    }

    const startX = fleet.isRecalling ? fleet.source.x : (gameState.systems.find(s => s.id === fleet.source.id)?.x || fleet.source.x);
    const startY = fleet.isRecalling ? fleet.source.y : (gameState.systems.find(s => s.id === fleet.source.id)?.y || fleet.source.y);

    fleet.currentPos.x = startX + (targetX - startX) * Math.min(1.0, progress);
    fleet.currentPos.y = startY + (targetY - startY) * Math.min(1.0, progress);

    if (fleet.turnsRemaining <= 0) {
      const system = gameState.systems.find(s => s.id === fleet.destination.id);
      
      if (!system) return;

      const teamA = gameState.playerState[fleet.owner]?.team;
      const teamB = gameState.playerState[system.owner]?.team;

      if (system.owner === fleet.owner || (teamA === teamB && system.owner !== 0)) {
        for (const [shipType, qty] of Object.entries(fleet.ships)) {
          system.ships[shipType] = (system.ships[shipType] || 0) + qty;
        }
        
        newCombatLogs.push({
          type: 'merge',
          systemId: system.id,
          systemName: system.name,
          playerId: fleet.owner,
          shipsMerged: fleet.ships
        });
      } else {
        const battle = resolveCombat(
          fleet.owner,
          system.owner,
          fleet.ships,
          system.ships,
          system.owner === 0 ? 0 : system.shieldsLvl,
          activeRules.ships,
          gameState
        );

        newCombatLogs.push({
          type: 'battle',
          systemId: system.id,
          systemName: system.name,
          attacker: fleet.owner,
          defender: system.owner,
          results: battle
        });

        const emptyShips: Record<string, number> = {};
        Object.keys(activeRules.ships).forEach(type => {
          emptyShips[type] = 0;
        });

        system.ships = { ...emptyShips, ...battle.endDefender } as any;

        if (battle.winner === fleet.owner) {
          const hasColony = (battle.endAttacker.Colony || 0) > 0;
          const canCapture = !activeRules.captureRequiresColonyShip || hasColony;

          if (canCapture) {
            system.owner = fleet.owner;
            system.ships = { ...emptyShips, ...battle.endAttacker } as any;
            if (activeRules.captureRequiresColonyShip) {
              system.ships.Colony = Math.max(0, (system.ships.Colony || 0) - 1);
            }
            
            system.shipyardLvl = Math.max(1, system.shipyardLvl - 1);
            system.sensorLvl = Math.max(1, system.sensorLvl - 1);
            system.shieldsLvl = Math.max(0, system.shieldsLvl - 1);
            
            system.buildQueue = [];
          } else {
            system.owner = 0;
            system.ships = { ...emptyShips } as any;
            
            if (Object.values(battle.endAttacker).reduce((a,b)=>a+b, 0) > 0) {
              const returnSpeed = fleet.speed;
              const returnDist = Math.sqrt((fleet.source.x - system.x) ** 2 + (fleet.source.y - system.y) ** 2);
              const returnTurns = Math.max(1, Math.ceil(returnDist / returnSpeed));

              const returnFleet: Fleet = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                owner: fleet.owner,
                ships: { ...emptyShips, ...battle.endAttacker } as any,
                source: { x: system.x, y: system.y, name: system.name, id: system.id },
                destination: { x: fleet.source.x, y: fleet.source.y, name: fleet.source.name, id: fleet.source.id },
                currentPos: { x: system.x, y: system.y },
                turnsRemaining: returnTurns,
                totalTurns: returnTurns,
                isRecalling: true,
                speed: returnSpeed
              };
              survivingFleets.push(returnFleet);
            }
          }
        }
      }
    } else {
      survivingFleets.push(fleet);
    }
  });

  gameState.fleets = survivingFleets;

  // Reassign home planets after combat and captures but before checking player elimination
  reassignHomePlanets(gameState);

  gameState.players.forEach(p => {
    const pState = gameState.playerState[p.id];
    if (pState.lost) return;

    const ownsSystems = gameState.systems.some(s => s.owner === p.id);
    const hasFleets = gameState.fleets.some(f => f.owner === p.id);

    if (!ownsSystems && !hasFleets) {
      pState.lost = true;
      newCombatLogs.push({
        type: 'elimination',
        playerId: p.id
      });
    }
  });

  gameState.combatLog = [...newCombatLogs, ...gameState.combatLog].slice(0, 30);
  logAction(gameState, 0, 'process_turn_end', `Advanced to turn ${gameState.turnNumber + 1}`);
  gameState.turnNumber += 1;
}

export function reassignHomePlanets(gameState: GameState): void {
  gameState.players.forEach(player => {
    if (player.id === 0) return; // skip neutral
    
    // Find all systems currently owned by this player
    const playerSystems = gameState.systems.filter(s => s.owner === player.id);
    if (playerSystems.length === 0) {
      return;
    }
    
    // Check if player already has exactly one home planet in their currently owned systems
    const currentHome = playerSystems.find(s => s.isHomePlanet);
    if (currentHome) {
      // Player already has an active home planet. Make sure no other systems of theirs are marked as home.
      playerSystems.forEach(s => {
        if (s.id !== currentHome.id) {
          s.isHomePlanet = false;
        }
      });
      return;
    }
    
    // If the player does not have a home planet among their owned systems, select the best one
    // Sorting criteria: shipyardLvl desc, sensorLvl desc, resourcesPerTurn desc, shieldsLvl desc, id asc
    const sortedSystems = [...playerSystems].sort((a, b) => {
      if (b.shipyardLvl !== a.shipyardLvl) return b.shipyardLvl - a.shipyardLvl;
      if (b.sensorLvl !== a.sensorLvl) return b.sensorLvl - a.sensorLvl;
      if (b.resourcesPerTurn !== a.resourcesPerTurn) return b.resourcesPerTurn - a.resourcesPerTurn;
      if (b.shieldsLvl !== a.shieldsLvl) return b.shieldsLvl - a.shieldsLvl;
      return a.id - b.id;
    });
    
    const newHome = sortedSystems[0];
    newHome.isHomePlanet = true;
    
    // Log the capital reassignment
    logAction(gameState, player.id, 'capital_reassignment', `Established new capital planet at ${newHome.name}`);
    
    // Mark others as false just to be safe
    playerSystems.forEach(s => {
      if (s.id !== newHome.id) {
        s.isHomePlanet = false;
      }
    });
  });

  // Clean up any neutral systems to ensure they are not marked as home planets
  gameState.systems.forEach(s => {
    if (s.owner === 0) {
      s.isHomePlanet = false;
    }
  });
}

export function cancelDispatch(
  gameState: GameState,
  playerId: number,
  fleetId: string
): { success: boolean; reason?: string } {
  const fleetIndex = gameState.fleets.findIndex(f => f.id === fleetId);
  if (fleetIndex === -1) return { success: false, reason: 'Fleet not found.' };
  const fleet = gameState.fleets[fleetIndex];
  if (fleet.owner !== playerId) return { success: false, reason: 'Unauthorized.' };
  
  if (fleet.turnsRemaining !== fleet.totalTurns || fleet.isRecalling) {
    return { success: false, reason: 'Fleet has already departed. Use Recall instead.' };
  }
  
  const sourceSystem = gameState.systems.find(s => s.id === fleet.source.id);
  if (sourceSystem) {
    for (const [shipType, qty] of Object.entries(fleet.ships)) {
      sourceSystem.ships[shipType] = (sourceSystem.ships[shipType] || 0) + qty;
    }
  }
  
  gameState.fleets.splice(fleetIndex, 1);
  logAction(gameState, playerId, 'cancel_dispatch', `Cancelled fleet dispatch to ${fleet.destination.name}`);
  return { success: true };
}

export function cancelProduction(
  gameState: GameState,
  playerId: number,
  systemId: number,
  jobIndex: number
): { success: boolean; reason?: string } {
  const sys = gameState.systems.find(s => s.id === systemId);
  if (!sys || sys.owner !== playerId) return { success: false, reason: 'System not owned.' };
  
  if (!sys.buildQueue || jobIndex < 0 || jobIndex >= sys.buildQueue.length) {
    return { success: false, reason: 'Production job not found.' };
  }
  
  const job = sys.buildQueue[jobIndex];
  const activeRules = gameState.rules || NORMAL_RULES;
  const shipDef = activeRules.ships[job.shipType] || SHIP_TYPES[job.shipType];
  if (shipDef && activeRules.enableCredits) {
    gameState.playerState[playerId].resources += shipDef.cost;
  }
  
  sys.buildQueue.splice(jobIndex, 1);
  logAction(gameState, playerId, 'cancel_production', `Cancelled ${job.shipType} production at ${sys.name}`);
  return { success: true };
}

export function logAction(
  gameState: GameState,
  playerId: number,
  actionType: string,
  details: string
): void {
  if (!gameState.actionLog) {
    gameState.actionLog = [];
  }
  let playerName = 'System';
  if (playerId > 0) {
    const player = gameState.players.find(p => p.id === playerId) || gameState.playerState[playerId];
    playerName = player ? player.name : `Player ${playerId}`;
  }
  
  gameState.actionLog.push({
    timestamp: new Date().toISOString(),
    playerId,
    playerName,
    turnNumber: gameState.turnNumber,
    actionType,
    details
  });
  
  if (gameState.actionLog.length > 100) {
    gameState.actionLog = gameState.actionLog.slice(-100);
  }
}

export function checkGameOver(state: GameState): boolean {
  const activeTeams = new Set();
  state.players.forEach(p => {
    const pState = state.playerState[p.id];
    if (pState && !pState.lost) {
      activeTeams.add(p.team);
    }
  });
  return activeTeams.size <= 1;
}

export function advanceSequentialTurns(
  state: GameState,
  runAITurnFn: (state: GameState, playerId: number) => void
): void {
  if (state.turnStyle !== 'sequential') return;

  let roundInProgress = true;
  while (roundInProgress) {
    if (checkGameOver(state)) {
      break;
    }

    // 1. Check if the current active player is an AI and needs to play
    const activePlayer = state.players[state.activePlayerIdx];
    if (activePlayer && activePlayer.type === 'ai' && !state.playerState[activePlayer.id].lost && !activePlayer.endedTurn) {
      runAITurnFn(state, activePlayer.id);
      activePlayer.endedTurn = true;
    }

    // 2. Check if all active players (both human and AI) have ended their turns
    const activePlayers = state.players.filter(p => !state.playerState[p.id].lost);
    const allActiveEnded = activePlayers.every(p => p.endedTurn);

    if (allActiveEnded) {
      // Roll over round
      processTurnEnd(state);

      // Reset endedTurn flags for all players for the new round
      state.players.forEach(p => {
        p.endedTurn = false;
      });

      // Set active player back to the first active player (human or AI)
      const firstActive = state.players.find(p => !state.playerState[p.id].lost);
      if (firstActive) {
        state.activePlayerIdx = state.players.indexOf(firstActive);
      } else {
        break;
      }
    } else {
      // If current active player has ended their turn, transition to the next player in order
      const currentActive = state.players[state.activePlayerIdx];
      if (currentActive && currentActive.endedTurn) {
        let nextIdx = state.activePlayerIdx;
        let foundNext = false;
        for (let i = 0; i < state.players.length; i++) {
          nextIdx = (nextIdx + 1) % state.players.length;
          const p = state.players[nextIdx];
          if (!state.playerState[p.id].lost && !p.endedTurn) {
            state.activePlayerIdx = nextIdx;
            foundNext = true;
            break;
          }
        }
        if (!foundNext) {
          break;
        }
      } else {
        // Active player is human and hasn't ended their turn. Wait for user input.
        roundInProgress = false;
      }
    }
  }
}


