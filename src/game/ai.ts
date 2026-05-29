// Star-Swarm AI Decision Engine (TypeScript)
import { GameState, dispatchFleet, upgradeSystem, queueShipProduction } from './gameState';

/**
 * Executes a turn for an AI player.
 * Performs builds, upgrades, and dispatches fleets.
 */
export function runAITurn(gameState: GameState, aiPlayerId: number): void {
  const aiState = gameState.playerState[aiPlayerId];
  if (!aiState || aiState.lost) return;

  const aiSystems = gameState.systems.filter(s => s.owner === aiPlayerId);
  if (aiSystems.length === 0) return;

  const activeRules = gameState.rules || {
    enableCredits: true,
    enableUpgrades: true,
    captureRequiresColonyShip: true,
    ships: {
      Fighter: { name: 'Fighter', cost: 12, speed: 4.0, hp: 1, attack: 1, hitChance: 0.5, description: '' },
      Cruiser: { name: 'Cruiser', cost: 36, speed: 2.0, hp: 4, attack: 4, hitChance: 0.65, description: '' },
      Scout: { name: 'Scout', cost: 15, speed: 6.0, hp: 1, attack: 0.5, hitChance: 0.33, sensorRange: 12.0, description: '' },
      Colony: { name: 'Colony Ship', cost: 45, speed: 2.5, hp: 2, attack: 0, hitChance: 0, description: '' }
    },
    upgrades: {
      Shipyard: { name: 'Shipyard', baseCost: 30, multiplier: 1.6, description: '' },
      Sensors: { name: 'Sensors', baseCost: 25, multiplier: 1.5, description: '' },
      Shields: { name: 'Shields', baseCost: 35, multiplier: 1.7, description: '' },
      Hyperdrive: { name: 'Hyperdrive', baseCost: 50, multiplier: 2.0, description: '' }
    }
  };

  // 1. Tech Upgrades
  // AI upgrades Hyperdrive occasionally if it has plenty of resources and upgrades are enabled
  if (activeRules.enableUpgrades && activeRules.enableCredits && aiState.resources > 80 && Math.random() < 0.3) {
    const hyperdriveLvl = aiState.tech.Hyperdrive || 0;
    const hyperdriveDef = activeRules.upgrades?.Hyperdrive || { baseCost: 50, multiplier: 2.0 };
    const hyperdriveCost = Math.round(hyperdriveDef.baseCost * (hyperdriveDef.multiplier ** hyperdriveLvl));
    if (aiState.resources >= hyperdriveCost) {
      upgradeSystem(gameState, aiPlayerId, aiSystems[0].id, 'Hyperdrive');
    }
  }

  // 2. Base Upgrades & Build Queue management for each owned cluster
  aiSystems.forEach(sys => {
    if (activeRules.enableUpgrades) {
      const shipyardDef = activeRules.upgrades?.Shipyard || { baseCost: 30, multiplier: 1.6 };
      const shipyardCost = Math.round(shipyardDef.baseCost * (shipyardDef.multiplier ** (sys.shipyardLvl - 1)));
      if ((!activeRules.enableCredits || aiState.resources > shipyardCost + 30) && sys.shipyardLvl < 4 && Math.random() < 0.25) {
        upgradeSystem(gameState, aiPlayerId, sys.id, 'Shipyard');
      }

      const shieldsDef = activeRules.upgrades?.Shields || { baseCost: 35, multiplier: 1.7 };
      const shieldsCost = Math.round(shieldsDef.baseCost * (shieldsDef.multiplier ** sys.shieldsLvl));
      if ((!activeRules.enableCredits || aiState.resources > shieldsCost + 30) && sys.shieldsLvl < 3 && Math.random() < 0.25) {
        upgradeSystem(gameState, aiPlayerId, sys.id, 'Shields');
      }

      const sensorDef = activeRules.upgrades?.Sensors || { baseCost: 25, multiplier: 1.5 };
      const sensorCost = Math.round(sensorDef.baseCost * (sensorDef.multiplier ** (sys.sensorLvl - 1)));
      if ((!activeRules.enableCredits || aiState.resources > sensorCost + 40) && sys.sensorLvl < 3 && Math.random() < 0.15) {
        upgradeSystem(gameState, aiPlayerId, sys.id, 'Sensors');
      }
    }

    // Queue Ship Production if queue isn't full and manual production is allowed
    if (!activeRules.nodeProduction?.enabled) {
      const shipTypes = Object.keys(activeRules.ships);
      if (shipTypes.length > 0) {
        const maxQueue = sys.shipyardLvl + 1;
        while (sys.buildQueue.length < maxQueue) {
          const cheapestCost = Math.min(...Object.values(activeRules.ships).map(s => s.cost));
          if (activeRules.enableCredits && aiState.resources < cheapestCost) {
            break;
          }

          let shipToBuild = shipTypes[0];

          // Smart standard ships logic
          if (activeRules.ships.Colony && activeRules.ships.Cruiser && activeRules.ships.Scout) {
            const hasColonyInSys = (sys.ships.Colony || 0) > 0;
            const countColonyInQueued = sys.buildQueue.filter(q => q.shipType === 'Colony').length;

            if (!hasColonyInSys && countColonyInQueued === 0 && (!activeRules.enableCredits || aiState.resources >= activeRules.ships.Colony.cost) && Math.random() < 0.6) {
              shipToBuild = 'Colony';
            } else if (activeRules.ships.Cruiser && (!activeRules.enableCredits || aiState.resources >= activeRules.ships.Cruiser.cost) && Math.random() < 0.35) {
              shipToBuild = 'Cruiser';
            } else if (activeRules.ships.Scout && (!activeRules.enableCredits || aiState.resources >= activeRules.ships.Scout.cost) && Math.random() < 0.2) {
              shipToBuild = 'Scout';
            } else if (activeRules.ships.Fighter && (!activeRules.enableCredits || aiState.resources >= activeRules.ships.Fighter.cost)) {
              shipToBuild = 'Fighter';
            }
          } else {
            // General selection
            const affordableShips = shipTypes.filter(type => !activeRules.enableCredits || aiState.resources >= activeRules.ships[type].cost);
            if (affordableShips.length === 0) break;
            shipToBuild = affordableShips[Math.floor(Math.random() * affordableShips.length)];
          }

          const buildRes = queueShipProduction(gameState, aiPlayerId, sys.id, shipToBuild);
          if (!buildRes.success) {
            break;
          }
        }
      }
    }
  });

  // 3. Fleet Deployments / Expansion & Attacks
  aiSystems.forEach(sys => {
    const targets = gameState.systems
      .map(otherSys => {
        const dist = Math.sqrt((otherSys.x - sys.x) ** 2 + (otherSys.y - sys.y) ** 2);
        return { system: otherSys, dist };
      })
      .filter(t => t.system.id !== sys.id)
      .sort((a, b) => a.dist - b.dist);

    const team = aiState.team;

    // AI Expansion
    if (activeRules.captureRequiresColonyShip) {
      if ((sys.ships.Colony || 0) > 0) {
        const closestNeutral = targets.find(t => t.system.owner === 0);
        if (closestNeutral && closestNeutral.dist < 25.0) {
          const sendShips: Record<string, number> = {};
          Object.keys(activeRules.ships).forEach(type => {
            sendShips[type] = 0;
          });
          sendShips.Colony = 1;
          if (sys.ships.Fighter) sendShips.Fighter = Math.min(sys.ships.Fighter, 3);
          if (sys.ships.Cruiser) sendShips.Cruiser = Math.min(sys.ships.Cruiser, 1);
          
          dispatchFleet(gameState, aiPlayerId, sys.id, closestNeutral.system.id, sendShips);
        }
      }
    } else {
      const shipTypes = Object.keys(activeRules.ships);
      const primaryShipType = shipTypes.find(t => t === 'Fighter') || shipTypes[0];
      if (primaryShipType && (sys.ships[primaryShipType] || 0) > 5) {
        const closestNeutral = targets.find(t => t.system.owner === 0);
        if (closestNeutral && closestNeutral.dist < 25.0) {
          const qtyToSend = Math.floor(sys.ships[primaryShipType] * 0.5);
          if (qtyToSend > 0) {
            const sendShips: Record<string, number> = {};
            shipTypes.forEach(type => {
              sendShips[type] = 0;
            });
            sendShips[primaryShipType] = qtyToSend;
            dispatchFleet(gameState, aiPlayerId, sys.id, closestNeutral.system.id, sendShips);
          }
        }
      }
    }

    // AI Aggression
    let militaryStrength = 0;
    Object.entries(sys.ships).forEach(([type, qty]) => {
      const def = activeRules.ships[type];
      const attack = def ? def.attack : 1;
      const hp = def ? def.hp : 1;
      militaryStrength += qty * attack * hp;
    });

    if (militaryStrength > 10) {
      const hostileTarget = targets.find(t => {
        const tOwner = t.system.owner;
        const targetTeam = tOwner === 0 ? 0 : gameState.playerState[tOwner]?.team;
        return tOwner === 0 || targetTeam !== team;
      });

      if (hostileTarget && hostileTarget.dist < 30.0) {
        const sendShips: Record<string, number> = {};
        Object.entries(sys.ships).forEach(([type, qty]) => {
          if (type === 'Colony' && activeRules.captureRequiresColonyShip) {
            sendShips[type] = 0;
          } else {
            sendShips[type] = Math.floor(qty * 0.75);
          }
        });

        const totalToSend = Object.values(sendShips).reduce((a, b) => a + b, 0);
        if (totalToSend > 0) {
          dispatchFleet(gameState, aiPlayerId, sys.id, hostileTarget.system.id, sendShips);
        }
      } else {
        const alliedTarget = targets.find(t => {
          const tOwner = t.system.owner;
          const targetTeam = tOwner === 0 ? 0 : gameState.playerState[tOwner]?.team;
          return tOwner !== 0 && targetTeam === team && t.system.owner !== aiPlayerId;
        });

        if (alliedTarget && alliedTarget.dist < 20.0) {
          const sendShips: Record<string, number> = {};
          Object.entries(sys.ships).forEach(([type, qty]) => {
            if (type === 'Colony' && activeRules.captureRequiresColonyShip) {
              sendShips[type] = 0;
            } else {
              sendShips[type] = Math.floor(qty * 0.4);
            }
          });

          const totalToSend = Object.values(sendShips).reduce((a, b) => a + b, 0);
          if (totalToSend > 0) {
            dispatchFleet(gameState, aiPlayerId, sys.id, alliedTarget.system.id, sendShips);
          }
        }
      }
    }
  });
}
