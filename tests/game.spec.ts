import { test, expect } from '@playwright/test';

test.describe('Star-Swarm E2E Tests', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(({ page }) => {
    consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (!txt.includes('401') && !txt.includes('Unauthorized')) {
          consoleErrors.push(txt);
        }
      }
    });
    page.on('pageerror', exception => {
      consoleErrors.push(exception.message);
    });
  });

  test('should register, login, configure lobby, start skirmish, and verify render is clean', async ({ page }) => {
    const randomEmail = `commander-${Date.now()}@example.com`;
    
    // 1. Navigate to the local server
    await page.goto('http://localhost:8080/');

    // Verify Title
    await expect(page).toHaveTitle(/Star-Swarm | Tactical Space strategy/i);

    // Verify Title Text is visible
    const gameHeading = page.locator('h1:has-text("STAR-SWARM")');
    await expect(gameHeading).toBeVisible();

    // Verify Menu buttons are visible
    const skirmishBtn = page.locator('button:has-text("SKIRMISH MATCH")');
    await expect(skirmishBtn).toBeVisible();

    // 2. Open auth modal and register a new commander account
    const establishLinkBtn = page.locator('button:has-text("ESTABLISH COMMAND LINK")');
    await expect(establishLinkBtn).toBeVisible();
    await establishLinkBtn.click();

    const registerTab = page.locator('button:has-text("REGISTER")');
    await expect(registerTab).toBeVisible();
    await registerTab.click();

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await emailInput.fill(randomEmail);
    await passwordInput.fill('password123');

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Wait for registration success message to verify the tab has transitioned
    await expect(page.locator('text=Account created successfully')).toBeVisible();

    // After registration, it automatically shifts to sign in. Log in.
    await emailInput.fill(randomEmail);
    await passwordInput.fill('password123');
    await submitBtn.click();

    // Verify logged in (LOG OUT button is visible in authentication HUD overlay)
    const logoutBtn = page.locator('button:has-text("LOG OUT")');
    await expect(logoutBtn).toBeVisible();

    // 3. Click AI Skirmish Match
    await skirmishBtn.click();

    // Verify Lobby config is displayed
    const lobbyHeader = page.locator('h2:has-text("TACTICAL SETUP LOBBY")');
    await expect(lobbyHeader).toBeVisible();

    const startBtn = page.locator('button:has-text("LAUNCH GALAXY SIMULATION")');
    await expect(startBtn).toBeVisible();

    // 4. Launch the game simulation
    await startBtn.click();

    // 5. Verify HUD & Canvas starmap are visible and rendered without errors
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

    // 6. Click End Turn and verify it cycles successfully
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
