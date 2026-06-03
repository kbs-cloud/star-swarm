import { test, expect } from '@playwright/test';
import { initializeGame, StarSystem, reassignHomePlanets } from '../src/game/gameState';

test.describe('Game State Engine - Spacing Optimization', () => {
  test('should assign starting systems to players and maximize minimum distance', () => {
    // Initialize a game with 4 players and 16 systems
    const players = [
      { id: 1, type: 'human' as const, team: 1, name: 'P1' },
      { id: 2, type: 'ai' as const, team: 2, name: 'P2' },
      { id: 3, type: 'ai' as const, team: 3, name: 'P3' },
      { id: 4, type: 'ai' as const, team: 4, name: 'P4' }
    ];

    const state = initializeGame({
      numSystems: 16,
      players,
      gridWidth: 60,
      gridHeight: 60
    });

    // Check that we have 16 systems
    expect(state.systems).toHaveLength(16);

    // Verify all 4 players got exactly one starting system
    const startingSystems = state.systems.filter(sys => sys.owner !== 0);
    expect(startingSystems).toHaveLength(4);

    const ownerIds = startingSystems.map(sys => sys.owner).sort();
    expect(ownerIds).toEqual([1, 2, 3, 4]);

    // Let's compute all pairwise distances between starting systems
    const distances: number[] = [];
    for (let i = 0; i < startingSystems.length; i++) {
      for (let j = i + 1; j < startingSystems.length; j++) {
        const s1 = startingSystems[i];
        const s2 = startingSystems[j];
        const d = Math.sqrt((s1.x - s2.x) ** 2 + (s1.y - s2.y) ** 2);
        distances.push(d);
      }
    }

    const minDist = Math.min(...distances);
    console.log(`Optimized starting systems minimum distance: ${minDist}`);
    
    // With 4 players on a 60x60 grid, they should be well spaced out.
    // Let's assert that the minimum distance is at least 15 units.
    expect(minDist).toBeGreaterThanOrEqual(15);
  });

  test('should perform statistically better than random selection', () => {
    const players = [
      { id: 1, type: 'human' as const, team: 1, name: 'P1' },
      { id: 2, type: 'ai' as const, team: 2, name: 'P2' },
      { id: 3, type: 'ai' as const, team: 3, name: 'P3' },
      { id: 4, type: 'ai' as const, team: 4, name: 'P4' }
    ];

    let totalOptimizedMinDist = 0;
    let totalRandomMinDist = 0;
    const runs = 100;

    for (let run = 0; run < runs; run++) {
      const state = initializeGame({
        numSystems: 16,
        players,
        gridWidth: 60,
        gridHeight: 60
      });

      const startingSystems = state.systems.filter(sys => sys.owner !== 0);
      let optMin = Infinity;
      for (let i = 0; i < startingSystems.length; i++) {
        for (let j = i + 1; j < startingSystems.length; j++) {
          const d = Math.sqrt((startingSystems[i].x - startingSystems[j].x) ** 2 + (startingSystems[i].y - startingSystems[j].y) ** 2);
          if (d < optMin) optMin = d;
        }
      }
      totalOptimizedMinDist += optMin;

      // Simulate a random selection from the same systems
      const systemIndices = Array.from({ length: state.systems.length }, (_, i) => i);
      for (let i = systemIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [systemIndices[i], systemIndices[j]] = [systemIndices[j], systemIndices[i]];
      }
      const randomStartSystems = systemIndices.slice(0, players.length).map(idx => state.systems[idx]);
      let randMin = Infinity;
      for (let i = 0; i < randomStartSystems.length; i++) {
        for (let j = i + 1; j < randomStartSystems.length; j++) {
          const d = Math.sqrt((randomStartSystems[i].x - randomStartSystems[j].x) ** 2 + (randomStartSystems[i].y - randomStartSystems[j].y) ** 2);
          if (d < randMin) randMin = d;
        }
      }
      totalRandomMinDist += randMin;
    }

    const avgOptimizedMin = totalOptimizedMinDist / runs;
    const avgRandomMin = totalRandomMinDist / runs;

    console.log(`Average Minimum Distance over ${runs} runs:`);
    console.log(`- Spacing Optimization: ${avgOptimizedMin.toFixed(2)} units`);
    console.log(`- Random Selection: ${avgRandomMin.toFixed(2)} units`);

    // Verify optimized spacing is significantly better than random
    expect(avgOptimizedMin).toBeGreaterThan(avgRandomMin + 10);
  });

  test('should initialize exactly one home planet per player', () => {
    const players = [
      { id: 1, type: 'human' as const, team: 1, name: 'P1' },
      { id: 2, type: 'ai' as const, team: 2, name: 'P2' }
    ];
    const state = initializeGame({
      numSystems: 6,
      players
    });

    const p1Home = state.systems.filter(s => s.owner === 1 && s.isHomePlanet);
    const p2Home = state.systems.filter(s => s.owner === 2 && s.isHomePlanet);

    expect(p1Home).toHaveLength(1);
    expect(p2Home).toHaveLength(1);
  });

  test('should reassign home planet using priority rules when home planet is lost', () => {
    const players = [
      { id: 1, type: 'human' as const, team: 1, name: 'P1' }
    ];
    const state = initializeGame({
      numSystems: 6,
      players
    });

    // Make sure we know which is the home system
    const originalHome = state.systems.find(s => s.owner === 1 && s.isHomePlanet)!;
    
    // Add two more systems owned by P1
    const sys2 = state.systems.find(s => s.owner === 0)!;
    sys2.owner = 1;
    sys2.shipyardLvl = 1;
    sys2.sensorLvl = 1;
    sys2.resourcesPerTurn = 10;
    
    const sys3 = state.systems.filter(s => s.owner === 0 && s.id !== sys2.id)[0];
    sys3.owner = 1;
    sys3.shipyardLvl = 2; // Higher shipyard level should win!
    sys3.sensorLvl = 1;
    sys3.resourcesPerTurn = 5;

    // Simulate losing the original home planet (capture by neutral or other)
    originalHome.owner = 2;
    originalHome.isHomePlanet = false;

    reassignHomePlanets(state);

    // Verify sys3 (with shipyardLvl = 2) is the new home planet
    expect(sys3.isHomePlanet).toBe(true);
    expect(sys2.isHomePlanet).toBeFalsy();
    expect(originalHome.isHomePlanet).toBeFalsy();

    // Now modify stats so sys2 has higher sensor level
    sys3.isHomePlanet = false;
    sys3.shipyardLvl = 1;
    sys2.shipyardLvl = 1;
    sys2.sensorLvl = 3; // Higher sensor lvl should win!
    sys3.sensorLvl = 1;

    reassignHomePlanets(state);
    expect(sys2.isHomePlanet).toBe(true);
    expect(sys3.isHomePlanet).toBeFalsy();
  });

  test('should generate identical layout when given the same seed', () => {
    const players = [
      { id: 1, type: 'human' as const, team: 1, name: 'P1' },
      { id: 2, type: 'ai' as const, team: 2, name: 'P2' }
    ];

    const seed = 'test-star-swarm-seed-123';

    const state1 = initializeGame({
      numSystems: 8,
      players,
      seed
    });

    const state2 = initializeGame({
      numSystems: 8,
      players,
      seed
    });

    // Check that positions and names are identical
    expect(state1.systems).toHaveLength(8);
    expect(state2.systems).toHaveLength(8);

    for (let i = 0; i < 8; i++) {
      const s1 = state1.systems[i];
      const s2 = state2.systems[i];
      expect(s1.name).toBe(s2.name);
      expect(s1.x).toBe(s2.x);
      expect(s1.y).toBe(s2.y);
      expect(s1.owner).toBe(s2.owner);
      expect(s1.resourcesPerTurn).toBe(s2.resourcesPerTurn);
      expect(s1.ships).toEqual(s2.ships);
    }
  });

  test('should generate different layouts when given different seeds', () => {
    const players = [
      { id: 1, type: 'human' as const, team: 1, name: 'P1' },
      { id: 2, type: 'ai' as const, team: 2, name: 'P2' }
    ];

    const state1 = initializeGame({
      numSystems: 8,
      players,
      seed: 'seed-alpha'
    });

    const state2 = initializeGame({
      numSystems: 8,
      players,
      seed: 'seed-beta'
    });

    // Check that at least some system positions differ
    let coordinateDiffers = false;
    for (let i = 0; i < 8; i++) {
      if (state1.systems[i].x !== state2.systems[i].x || state1.systems[i].y !== state2.systems[i].y) {
        coordinateDiffers = true;
        break;
      }
    }
    expect(coordinateDiffers).toBe(true);
  });
});

import { runAITurn } from '../src/game/ai';

test.describe('AI Difficulty Levels', () => {
  test('should initialize players with medium difficulty by default', () => {
    const players = [
      { id: 1, type: 'human' as const, team: 1, name: 'P1' },
      { id: 2, type: 'ai' as const, team: 2, name: 'P2' }
    ];
    const state = initializeGame({
      numSystems: 4,
      players
    });
    
    expect(state.players[1].difficulty).toBe('medium');
    expect(state.playerState[2].difficulty).toBe('medium');
  });

  test('should initialize players with chosen difficulty', () => {
    const players = [
      { id: 1, type: 'human' as const, team: 1, name: 'P1' },
      { id: 2, type: 'ai' as const, team: 2, name: 'P2', difficulty: 'hard' as const },
      { id: 3, type: 'ai' as const, team: 3, name: 'P3', difficulty: 'easy' as const }
    ];
    const state = initializeGame({
      numSystems: 4,
      players
    });
    
    expect(state.players[1].difficulty).toBe('hard');
    expect(state.playerState[2].difficulty).toBe('hard');
    expect(state.players[2].difficulty).toBe('easy');
    expect(state.playerState[3].difficulty).toBe('easy');
  });

  test('should apply resource bonus to hard AI on turn start', () => {
    const players = [
      { id: 1, type: 'human' as const, team: 1, name: 'P1' },
      { id: 2, type: 'ai' as const, team: 2, name: 'P2', difficulty: 'hard' as const }
    ];
    const state = initializeGame({
      numSystems: 4,
      players
    });

    // Clear all systems owned by player 2 to prevent any upgrades/production spending
    state.systems.forEach(sys => {
      if (sys.owner === 2) {
        sys.owner = 0;
      }
    });

    const initialResources = state.playerState[2].resources;
    runAITurn(state, 2);
    // Hard AI gets +15 CR bonus and returns early due to 0 owned systems
    expect(state.playerState[2].resources).toBe(initialResources + 15);
  });

  test('should initialize and respect custom AI config sliders', () => {
    const players = [
      { id: 1, type: 'human' as const, team: 1, name: 'P1' },
      {
        id: 2,
        type: 'ai' as const,
        team: 2,
        name: 'P2',
        difficulty: 'custom' as const,
        aiConfig: { aggression: 40, expansion: 30, techFocus: 20, economyBonus: 25 }
      }
    ];
    const state = initializeGame({
      numSystems: 4,
      players
    });

    expect(state.players[1].difficulty).toBe('custom');
    expect(state.players[1].aiConfig?.economyBonus).toBe(25);
    expect(state.playerState[2].difficulty).toBe('custom');
    expect(state.playerState[2].aiConfig?.aggression).toBe(40);

    // Clear owned systems to test economy bonus alone
    state.systems.forEach(sys => {
      if (sys.owner === 2) sys.owner = 0;
    });

    const initialResources = state.playerState[2].resources;
    runAITurn(state, 2);
    expect(state.playerState[2].resources).toBe(initialResources + 25);
  });
});
