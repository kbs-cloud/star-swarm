// Star-Swarm AI Decision Engine (TypeScript)
import { GameState, dispatchFleet, upgradeSystem, queueShipProduction, seededRandom } from './gameState';

/**
 * Executes a turn for an AI player.
 * Performs builds, upgrades, and dispatches fleets.
 */
export function runAITurn(gameState: GameState, aiPlayerId: number): void {
  const aiState = gameState.playerState[aiPlayerId];
  if (!aiState || aiState.lost) return;

  const difficulty = aiState.difficulty || 'medium';

  // 0. Resolve AI parameters based on custom or preset settings
  let config = aiState.aiConfig;
  if (!config || difficulty !== 'custom') {
    // Fall back to preset mappings
    if (difficulty === 'easy') {
      config = { aggression: 20, expansion: 20, techFocus: 15, economyBonus: 0 };
    } else if (difficulty === 'hard') {
      config = { aggression: 90, expansion: 90, techFocus: 90, economyBonus: 15 };
    } else {
      // Default to medium
      config = { aggression: 50, expansion: 50, techFocus: 50, economyBonus: 0 };
    }
  }

  // Apply economy resource bonus at the start of the turn
  if (config.economyBonus > 0) {
    aiState.resources += config.economyBonus;
  }

  // Easy / low-aggression skip check: if aggression is very low, there is a chance to skip turn actions.
  // Max skip chance is 35% when aggression is 0.
  if (config.aggression < 30) {
    const skipChance = 0.35 * (1 - config.aggression / 30);
    if (seededRandom(gameState) < skipChance) {
      return;
    }
  }

  const aiSystems = gameState.systems.filter(s => s.owner === aiPlayerId);
  if (aiSystems.length === 0) return;

  const activeRules = (gameState.rules || {
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
  }) as any;

  // 1. Tech Upgrades (scaled based on techFocus 0-100)
  const techUpgradeChance = 0.1 + (config.techFocus / 100) * 0.5; // 0.1 to 0.6

  if (activeRules.enableUpgrades && activeRules.enableCredits && aiState.resources > 80 && seededRandom(gameState) < techUpgradeChance) {
    const hyperdriveLvl = aiState.tech.Hyperdrive || 0;
    const hyperdriveDef = activeRules.upgrades?.Hyperdrive || { baseCost: 50, multiplier: 2.0 };
    const hyperdriveCost = Math.round(hyperdriveDef.baseCost * (hyperdriveDef.multiplier ** hyperdriveLvl));
    if (aiState.resources >= hyperdriveCost) {
      upgradeSystem(gameState, aiPlayerId, aiSystems[0].id, 'Hyperdrive');
    }
  }

  // 2. Base Upgrades & Build Queue management for each owned cluster
  const shipyardUpgradeChance = 0.1 + (config.techFocus / 100) * 0.3; // 0.1 to 0.4
  const shieldsUpgradeChance = 0.1 + (config.techFocus / 100) * 0.3;  // 0.1 to 0.4
  const sensorsUpgradeChance = 0.05 + (config.techFocus / 100) * 0.25; // 0.05 to 0.3
  const resourceBuffer = Math.max(0, 60 - (config.techFocus / 100) * 60); // Focus 0 -> Buffer 60; Focus 100 -> Buffer 0

  aiSystems.forEach(sys => {
    if (activeRules.enableUpgrades) {
      const shipyardDef = activeRules.upgrades?.Shipyard || { baseCost: 30, multiplier: 1.6 };
      const shipyardCost = Math.round(shipyardDef.baseCost * (shipyardDef.multiplier ** (sys.shipyardLvl - 1)));
      if ((!activeRules.enableCredits || aiState.resources > shipyardCost + resourceBuffer) && sys.shipyardLvl < 4 && seededRandom(gameState) < shipyardUpgradeChance) {
        upgradeSystem(gameState, aiPlayerId, sys.id, 'Shipyard');
      }

      const shieldsDef = activeRules.upgrades?.Shields || { baseCost: 35, multiplier: 1.7 };
      const shieldsCost = Math.round(shieldsDef.baseCost * (shieldsDef.multiplier ** sys.shieldsLvl));
      if ((!activeRules.enableCredits || aiState.resources > shieldsCost + resourceBuffer) && sys.shieldsLvl < 3 && seededRandom(gameState) < shieldsUpgradeChance) {
        upgradeSystem(gameState, aiPlayerId, sys.id, 'Shields');
      }

      const sensorDef = activeRules.upgrades?.Sensors || { baseCost: 25, multiplier: 1.5 };
      const sensorCost = Math.round(sensorDef.baseCost * (sensorDef.multiplier ** (sys.sensorLvl - 1)));
      if ((!activeRules.enableCredits || aiState.resources > sensorCost + resourceBuffer + 10) && sys.sensorLvl < 3 && seededRandom(gameState) < sensorsUpgradeChance) {
        upgradeSystem(gameState, aiPlayerId, sys.id, 'Sensors');
      }
    }

    // Queue Ship Production if queue isn't full and manual production is allowed
    if (!activeRules.nodeProduction?.enabled) {
      const shipTypes = Object.keys(activeRules.ships);
      if (shipTypes.length > 0) {
        const maxQueue = config.techFocus < 30 ? 1 : (sys.shipyardLvl + 1);
        const buildBuffer = Math.max(0, 15 - (config.techFocus / 100) * 15); // Focus 0 -> Buffer 15; Focus 100 -> Buffer 0

        while (sys.buildQueue.length < maxQueue) {
          const cheapestCost = Math.min(...Object.values(activeRules.ships).map((s: any) => s.cost));
          if (activeRules.enableCredits && aiState.resources < cheapestCost + buildBuffer) {
            break;
          }

          let shipToBuild = shipTypes[0];

          // Smart standard ships logic
          if (activeRules.ships.Colony && activeRules.ships.Cruiser && activeRules.ships.Scout) {
            const hasColonyInSys = (sys.ships.Colony || 0) > 0;
            const countColonyInQueued = sys.buildQueue.filter(q => q.shipType === 'Colony').length;

            if (!hasColonyInSys && countColonyInQueued === 0 && (!activeRules.enableCredits || aiState.resources >= activeRules.ships.Colony.cost + buildBuffer) && seededRandom(gameState) < 0.6) {
              shipToBuild = 'Colony';
            } else if (activeRules.ships.Cruiser && (!activeRules.enableCredits || aiState.resources >= activeRules.ships.Cruiser.cost + buildBuffer) && seededRandom(gameState) < 0.35) {
              shipToBuild = 'Cruiser';
            } else if (activeRules.ships.Scout && (!activeRules.enableCredits || aiState.resources >= activeRules.ships.Scout.cost + buildBuffer) && seededRandom(gameState) < 0.2) {
              shipToBuild = 'Scout';
            } else if (activeRules.ships.Fighter && (!activeRules.enableCredits || aiState.resources >= activeRules.ships.Fighter.cost + buildBuffer)) {
              shipToBuild = 'Fighter';
            } else {
              break;
            }
          } else {
            // General selection
            const affordableShips = shipTypes.filter(type => !activeRules.enableCredits || aiState.resources >= activeRules.ships[type].cost + buildBuffer);
            if (affordableShips.length === 0) break;
            shipToBuild = affordableShips[Math.floor(seededRandom(gameState) * affordableShips.length)];
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

    // AI Expansion (scaled based on expansion 0-100)
    const maxExpansionDist = 15.0 + (config.expansion / 100) * 25.0; // 15.0 to 40.0 LY

    if (activeRules.captureRequiresColonyShip) {
      if ((sys.ships.Colony || 0) > 0) {
        const closestNeutral = targets.find(t => t.system.owner === 0);

        if (closestNeutral && closestNeutral.dist < maxExpansionDist) {
          const sendShips: Record<string, number> = {};
          Object.keys(activeRules.ships).forEach(type => {
            sendShips[type] = 0;
          });
          sendShips.Colony = 1;
          
          const maxFighters = Math.floor((config.expansion / 100) * 5); // 0 to 5
          const maxCruisers = Math.floor((config.expansion / 100) * 2); // 0 to 2
          
          if (sys.ships.Fighter && maxFighters > 0) sendShips.Fighter = Math.min(sys.ships.Fighter, maxFighters);
          if (sys.ships.Cruiser && maxCruisers > 0) sendShips.Cruiser = Math.min(sys.ships.Cruiser, maxCruisers);
          
          dispatchFleet(gameState, aiPlayerId, sys.id, closestNeutral.system.id, sendShips);
        }
      }
    } else {
      const shipTypes = Object.keys(activeRules.ships);
      const primaryShipType = shipTypes.find(t => t === 'Fighter') || shipTypes[0];
      if (primaryShipType && (sys.ships[primaryShipType] || 0) > 5) {
        const closestNeutral = targets.find(t => t.system.owner === 0);

        if (closestNeutral && closestNeutral.dist < maxExpansionDist) {
          const expansionRatio = 0.3 + (config.expansion / 100) * 0.4; // 30% to 70%
          const qtyToSend = Math.floor(sys.ships[primaryShipType] * expansionRatio);
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

    // AI Aggression (scaled based on aggression 0-100)
    let militaryStrength = 0;
    Object.entries(sys.ships).forEach(([type, qty]) => {
      const def = activeRules.ships[type];
      const attack = def ? def.attack : 1;
      const hp = def ? def.hp : 1;
      militaryStrength += qty * attack * hp;
    });

    const militaryThreshold = 18 - (config.aggression / 100) * 12; // 18 down to 6
    const maxAggressionDist = 15.0 + (config.aggression / 100) * 30.0; // 15.0 to 45.0 LY
    const attackRatio = 0.45 + (config.aggression / 100) * 0.45; // 45% to 90%

    if (militaryStrength > militaryThreshold) {
      let hostileTarget = null;

      if (config.aggression >= 70) {
        // Smart targeting: Find enemy bases and prioritize weaker/closer ones
        const hostileTargets = targets.filter(t => {
          const tOwner = t.system.owner;
          const targetTeam = tOwner === 0 ? 0 : gameState.playerState[tOwner]?.team;
          return tOwner !== 0 && targetTeam !== team; // Priority to active enemies
        });

        hostileTargets.sort((a, b) => {
          const defA = Object.values(a.system.ships).reduce((x, y) => x + y, 0);
          const defB = Object.values(b.system.ships).reduce((x, y) => x + y, 0);
          return (a.dist * (1 + defA)) - (b.dist * (1 + defB)); // balances distance and defenses
        });

        if (hostileTargets.length > 0 && hostileTargets[0].dist < maxAggressionDist) {
          hostileTarget = hostileTargets[0];
        } else {
          // Fall back to closest neutral
          hostileTarget = targets.find(t => t.system.owner === 0 && t.dist < maxAggressionDist);
        }
      } else {
        // Standard proximity targeting
        hostileTarget = targets.find(t => {
          const tOwner = t.system.owner;
          const targetTeam = tOwner === 0 ? 0 : gameState.playerState[tOwner]?.team;
          return (tOwner === 0 || targetTeam !== team) && t.dist < maxAggressionDist;
        });
      }

      if (hostileTarget && hostileTarget.dist < maxAggressionDist) {
        const sendShips: Record<string, number> = {};
        Object.entries(sys.ships).forEach(([type, qty]) => {
          if (type === 'Colony' && activeRules.captureRequiresColonyShip) {
            sendShips[type] = 0;
          } else {
            sendShips[type] = Math.floor(qty * attackRatio);
          }
        });

        const totalToSend = Object.values(sendShips).reduce((a, b) => a + b, 0);
        if (totalToSend > 0) {
          dispatchFleet(gameState, aiPlayerId, sys.id, hostileTarget.system.id, sendShips);
        }
      } else if (config.aggression >= 30) {
        // Support allies (Skip if aggression is very low, e.g. Easy presets)
        const maxSupportDist = 15.0 + (config.aggression / 100) * 15.0; // 15.0 to 30.0 LY
        const supportRatio = 0.2 + (config.aggression / 100) * 0.4;     // 20% to 60%

        const alliedTarget = targets.find(t => {
          const tOwner = t.system.owner;
          const targetTeam = tOwner === 0 ? 0 : gameState.playerState[tOwner]?.team;
          return tOwner !== 0 && targetTeam === team && t.system.owner !== aiPlayerId;
        });

        if (alliedTarget && alliedTarget.dist < maxSupportDist) {
          const sendShips: Record<string, number> = {};
          Object.entries(sys.ships).forEach(([type, qty]) => {
            if (type === 'Colony' && activeRules.captureRequiresColonyShip) {
              sendShips[type] = 0;
            } else {
              sendShips[type] = Math.floor(qty * supportRatio);
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
