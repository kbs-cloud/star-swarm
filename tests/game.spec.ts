import { test, expect } from '@playwright/test';

test.describe('Star-Swarm E2E Tests', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', exception => {
      consoleErrors.push(exception.message);
    });
  });

  test('should launch the game, configure lobby, start skirmish, and verify render is clean', async ({ page }) => {
    // 1. Navigate to the local server
    await page.goto('http://localhost:5173/');

    // Verify Title
    await expect(page).toHaveTitle(/Star-Swarm | Tactical Space strategy/i);

    // Verify Title Text is visible
    const gameHeading = page.locator('h1:has-text("STAR-SWARM")');
    await expect(gameHeading).toBeVisible();

    // Verify Menu buttons are visible
    const skirmishBtn = page.locator('button:has-text("AI SKIRMISH MATCH")');
    const hotseatBtn = page.locator('button:has-text("LOCAL MULTIPLAYER (HOTSEAT)")');
    await expect(skirmishBtn).toBeVisible();
    await expect(hotseatBtn).toBeVisible();

    // 2. Click AI Skirmish Match
    await skirmishBtn.click();

    // Verify Lobby config is displayed
    const lobbyHeader = page.locator('h2:has-text("TACTICAL SETUP LOBBY")');
    await expect(lobbyHeader).toBeVisible();

    const startBtn = page.locator('button:has-text("LAUNCH GALAXY SIMULATION")');
    await expect(startBtn).toBeVisible();

    // 3. Launch the game simulation
    await startBtn.click();

    // 4. Verify HUD & Canvas starmap are visible and rendered without errors
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Wait 1.5 seconds to let the canvas render its initial frames
    await page.waitForTimeout(1500);

    // Assert that NO console errors or exceptions were recorded during map rendering
    expect(consoleErrors).toEqual([]);

    // Verify Dashboard active player indicator is present
    const activePlayerText = page.getByText("ACTIVE FACTION", { exact: true });
    await expect(activePlayerText).toBeVisible();

    // Verify Turn progress bar is showing Turn #1
    const turnIndicator = page.getByText("GALACTIC TURN", { exact: true });
    await expect(turnIndicator).toBeVisible();
    const turnNumber = page.locator('.telemetry:has-text("#1")');
    await expect(turnNumber).toBeVisible();

    // 5. Click End Turn and verify it cycles successfully
    const endTurnBtn = page.locator('button:has-text("END TURN")');
    await expect(endTurnBtn).toBeVisible();
    await endTurnBtn.click();

    // Let the AI run its turn calculations and update state
    await page.waitForTimeout(1000);

    // Verify turn progresses to #2 (Vanguard turn returns after AI actions complete)
    const nextTurnIndicator = page.locator('.telemetry:has-text("#2")');
    await expect(nextTurnIndicator).toBeVisible();

    // Confirm again that there are no canvas or syntax errors in the console
    expect(consoleErrors).toEqual([]);
  });
});
