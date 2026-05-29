// Star-Swarm AI Decision Engine (TypeScript)
import { GameState, StarSystem, dispatchFleet, upgradeSystem, queueShipProduction, SHIP_TYPES } from './gameState';

/**
 * Executes a turn for an AI player.
 * Performs builds, upgrades, and dispatches fleets.
 */
export function runAITurn(gameState: GameState, aiPlayerId: number): void {
  const aiState = gameState.playerState[aiPlayerId];
  if (!aiState || aiState.lost) return;

  const aiSystems = gameState.systems.filter(s => s.owner === aiPlayerId);
  if (aiSystems.length === 0) return;

  // 1. Tech Upgrades
  // AI upgrades Hyperdrive occasionally if it has plenty of resources
  if (aiState.resources > 80 && Math.random() < 0.3) {
    const hyperdriveLvl = aiState.tech.Hyperdrive || 0;
    const hyperdriveCost = Math.round(50 * (2.0 ** hyperdriveLvl));
    if (aiState.resources >= hyperdriveCost) {
      upgradeSystem(gameState, aiPlayerId, aiSystems[0].id, 'Hyperdrive');
    }
  }

  // 2. Base Upgrades & Build Queue management for each owned cluster
  aiSystems.forEach(sys => {
    // Maybe upgrade shipyard or shields
    const shipyardCost = Math.round(30 * (1.6 ** (sys.shipyardLvl - 1)));
    if (aiState.resources > shipyardCost + 30 && sys.shipyardLvl < 4 && Math.random() < 0.25) {
      upgradeSystem(gameState, aiPlayerId, sys.id, 'Shipyard');
    }

    const shieldsCost = Math.round(35 * (1.7 ** sys.shieldsLvl));
    if (aiState.resources > shieldsCost + 30 && sys.shieldsLvl < 3 && Math.random() < 0.25) {
      upgradeSystem(gameState, aiPlayerId, sys.id, 'Shields');
    }

    const sensorCost = Math.round(25 * (1.5 ** (sys.sensorLvl - 1)));
    if (aiState.resources > sensorCost + 40 && sys.sensorLvl < 3 && Math.random() < 0.15) {
      upgradeSystem(gameState, aiPlayerId, sys.id, 'Sensors');
    }

    // Queue Ship Production if queue isn't full
    const maxQueue = sys.shipyardLvl + 1;
    while (sys.buildQueue.length < maxQueue && aiState.resources >= 12) {
      // Determine what to build:
      // If we don't have a Colony ship and there are neutral systems, build Colony ship
      const hasColonyInSys = (sys.ships.Colony || 0) > 0;
      const countColonyInQueued = sys.buildQueue.filter(q => q.shipType === 'Colony').length;
      
      let shipToBuild = 'Fighter';
      
      if (!hasColonyInSys && countColonyInQueued === 0 && aiState.resources >= 45 && Math.random() < 0.6) {
        shipToBuild = 'Colony';
      } else if (aiState.resources >= 36 && Math.random() < 0.35) {
        shipToBuild = 'Cruiser';
      } else if (aiState.resources >= 15 && Math.random() < 0.2) {
        shipToBuild = 'Scout';
      }

      const buildRes = queueShipProduction(gameState, aiPlayerId, sys.id, shipToBuild);
      if (!buildRes.success) {
        // Can't afford or build queue full, break
        break;
      }
    }
  });

  // 3. Fleet Deployments / Expansion & Attacks
  // For each system, evaluate target destinations
  aiSystems.forEach(sys => {
    // Find closest systems to evaluate targets
    const targets = gameState.systems
      .map(otherSys => {
        const dist = Math.sqrt((otherSys.x - sys.x) ** 2 + (otherSys.y - sys.y) ** 2);
        return { system: otherSys, dist };
      })
      .filter(t => t.system.id !== sys.id)
      .sort((a, b) => a.dist - b.dist);

    const team = aiState.team;

    // AI Expansion: Colony deployment
    if (sys.ships.Colony > 0) {
      // Find closest neutral system
      const closestNeutral = targets.find(t => t.system.owner === 0);
      if (closestNeutral && closestNeutral.dist < 25.0) {
        // Send a colonization fleet: 1 Colony ship + escort (Fighters/Cruisers)
        const sendShips = {
          Colony: 1,
          Fighter: Math.min(sys.ships.Fighter, 3), // send up to 3 fighters for protection
          Cruiser: Math.min(sys.ships.Cruiser, 1),
          Scout: 0
        };
        
        dispatchFleet(gameState, aiPlayerId, sys.id, closestNeutral.system.id, sendShips);
      }
    }

    // AI Aggression: Military deployment
    const militaryStrength = sys.ships.Fighter * 1 + sys.ships.Cruiser * 4;
    // If we have a significant force, coordinate an attack or reinforcement
    if (militaryStrength > 10) {
      // Look for a hostile or neutral system to attack
      const hostileTarget = targets.find(t => {
        const tOwner = t.system.owner;
        const targetTeam = tOwner === 0 ? 0 : gameState.playerState[tOwner]?.team;
        return tOwner === 0 || targetTeam !== team;
      });

      if (hostileTarget && hostileTarget.dist < 30.0) {
        // Attack! Send 75% of military assets
        const fightersToSend = Math.floor(sys.ships.Fighter * 0.75);
        const cruisersToSend = Math.floor(sys.ships.Cruiser * 0.75);
        const scoutsToSend = sys.ships.Scout; // Send all scouts for vision

        if (fightersToSend > 0 || cruisersToSend > 0) {
          const sendShips = {
            Fighter: fightersToSend,
            Cruiser: cruisersToSend,
            Scout: scoutsToSend,
            Colony: 0
          };
          dispatchFleet(gameState, aiPlayerId, sys.id, hostileTarget.system.id, sendShips);
        }
      } else {
        // Reinforce allied systems if there are no close hostiles
        const alliedTarget = targets.find(t => {
          const tOwner = t.system.owner;
          const targetTeam = tOwner === 0 ? 0 : gameState.playerState[tOwner]?.team;
          return tOwner !== 0 && targetTeam === team && t.system.owner !== aiPlayerId;
        });

        if (alliedTarget && alliedTarget.dist < 20.0) {
          // Send 40% of fighters/cruisers to reinforce
          const fightersToSend = Math.floor(sys.ships.Fighter * 0.4);
          const cruisersToSend = Math.floor(sys.ships.Cruiser * 0.4);
          if (fightersToSend > 0 || cruisersToSend > 0) {
            dispatchFleet(gameState, aiPlayerId, sys.id, alliedTarget.system.id, {
              Fighter: fightersToSend,
              Cruiser: cruisersToSend,
              Scout: 0,
              Colony: 0
            });
          }
        }
      }
    }
  });
}
