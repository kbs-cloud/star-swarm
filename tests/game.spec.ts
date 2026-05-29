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

  test('should support Simple Mode with node production and hidden upgrades/credits', async ({ page }) => {
    const randomEmail = `simple-commander-${Date.now()}@example.com`;
    
    // 1. Navigate to the local server
    await page.goto('http://localhost:8080/');

    // 2. Open auth modal and register a new commander account
    const establishLinkBtn = page.locator('button:has-text("ESTABLISH COMMAND LINK")');
    await establishLinkBtn.click();

    const registerTab = page.locator('button:has-text("REGISTER")');
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

    // Verify logged in
    const logoutBtn = page.locator('button:has-text("LOG OUT")');
    await expect(logoutBtn).toBeVisible();

    // 3. Click AI Skirmish Match
    const skirmishBtn = page.locator('button:has-text("SKIRMISH MATCH")');
    await skirmishBtn.click();

    // 4. Select Simple Mode ruleset in the dropdown
    const modeDropdown = page.locator('select').first();
    await modeDropdown.selectOption('simple');

    // Verify description is visible
    await expect(page.locator('text=Nodes produce ships directly')).toBeVisible();

    // 5. Launch the game simulation
    const startBtn = page.locator('button:has-text("LAUNCH GALAXY SIMULATION")');
    await startBtn.click();

    // 6. Verify Dashboard active player indicator and that credits/upgrades/global tech are hidden
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    await expect(page.getByText("ACTIVE FACTION", { exact: true })).toBeVisible();

    // Resource pool / CR indicator should be hidden since credits are disabled
    await expect(page.locator('text=RESOURCE POOL')).not.toBeVisible();
    await expect(page.locator('text=CR')).not.toBeVisible();

    // Global tech and Upgrades should be hidden
    await expect(page.locator('text=HYPERDRIVE GLOBAL TECH')).not.toBeVisible();
    await expect(page.locator('text=UPGRADE SYSTEMS')).not.toBeVisible();

    // 7. Click End Turn and verify it cycles successfully
    const endTurnBtn = page.locator('button:has-text("END TURN")');
    await expect(endTurnBtn).toBeVisible();
    await endTurnBtn.click();

    // Let the AI run its turn calculations and update state
    await page.waitForTimeout(1500);

    // Verify turn progresses to #2 (Vanguard turn returns after AI actions complete)
    const nextTurnIndicator = page.locator('.telemetry:has-text("#2")');
    await expect(nextTurnIndicator).toBeVisible();

    // Confirm that there are no canvas or syntax errors in the console
    expect(consoleErrors).toEqual([]);
  });

  test('should support per-user rulesets and versioned import/export with preview/migration', async ({ page }) => {
    let exportedString = '';
    
    // Expose mock copy function to store the export string
    await page.exposeFunction('mockCopyText', (text: string) => {
      exportedString = text;
    });

    // Mock clipboard writeText
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text: string) => {
            (window as any).mockCopyText(text);
            return Promise.resolve();
          }
        },
        configurable: true
      });
    });

    const userA = `user-a-${Date.now()}@example.com`;
    const userB = `user-b-${Date.now()}@example.com`;

    // --- USER A FLOW ---
    await page.goto('http://localhost:8080/');

    // Login User A
    const linkBtnA = page.locator('button:has-text("ESTABLISH COMMAND LINK")');
    await linkBtnA.click();
    const regTabA = page.locator('button:has-text("REGISTER")');
    await regTabA.click();
    await page.locator('input[type="email"]').fill(userA);
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('text=Account created successfully')).toBeVisible();
    await page.locator('input[type="email"]').fill(userA);
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('button:has-text("LOG OUT")')).toBeVisible();

    // Open Skirmish Match Setup Lobby
    await page.locator('button:has-text("SKIRMISH MATCH")').click();
    await expect(page.locator('h2:has-text("TACTICAL SETUP LOBBY")')).toBeVisible();

    // Copy default Normal Mode to create custom ruleset
    await page.locator('button:has-text("COPY")').click();
    const modeDropdown = page.locator('select').first();
    await modeDropdown.selectOption({ label: 'Copy of Normal Mode [CUSTOM]' });

    // Open editor, change name to "User A Special" and save
    await page.locator('button:has-text("EDIT")').click();
    await expect(page.locator('h2:has-text("CUSTOM RULESET DESIGNER")')).toBeVisible();
    await page.locator('div:has-text("RULESET NAME") > input').first().fill('User A Special');
    await page.locator('button:has-text("SAVE PROTOCOLS")').click();
    await expect(page.locator('h2:has-text("CUSTOM RULESET DESIGNER")')).not.toBeVisible();
    await expect(modeDropdown).toContainText('User A Special');

    // Export "User A Special" ruleset
    await page.locator('button:has-text("EXPORT")').click();
    await page.waitForTimeout(500);
    expect(exportedString).toContain('SS-RULES-V1-');

    // Logout User A
    await page.locator('button:has-text("RETURN")').click();
    await page.locator('button:has-text("LOG OUT")').click();

    // --- USER B FLOW ---
    // Register & Login User B
    await page.locator('button:has-text("ESTABLISH COMMAND LINK")').click();
    await page.locator('button:has-text("REGISTER")').click();
    await page.locator('input[type="email"]').fill(userB);
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=Account created successfully')).toBeVisible();

    await page.locator('input[type="email"]').fill(userB);
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('button:has-text("LOG OUT")')).toBeVisible();

    // Open Skirmish Match Setup Lobby
    await page.locator('button:has-text("SKIRMISH MATCH")').click();

    // Verify User A's custom ruleset is NOT visible under User B
    const dropdownTextB = await modeDropdown.textContent();
    expect(dropdownTextB).not.toContain('User A Special');

    // Import User A's ruleset
    await page.locator('button:has-text("IMPORT")').click();
    await expect(page.locator('h2:has-text("IMPORT RULESET PROTOCOL")')).toBeVisible();
    await page.locator('textarea').fill(exportedString);
    await page.locator('button:has-text("DECRYPT & PREVIEW")').click();

    // Verify Migration/Preview modal
    await expect(page.locator('h2:has-text("RULESET IMPORT PREVIEW & MIGRATION")')).toBeVisible();
    await expect(page.locator('text=Version Check OK')).toBeVisible();

    // Edit Name in preview to "User B Imported"
    await page.locator('div:has-text("RULESET NAME") > input').first().fill('User B Imported');
    await page.locator('button:has-text("CONFIRM IMPORT PROTOCOL")').click();

    // Verify preview closed and dropdown contains the newly imported ruleset
    await expect(page.locator('h2:has-text("RULESET IMPORT PREVIEW & MIGRATION")')).not.toBeVisible();
    await expect(modeDropdown).toContainText('User B Imported');

    // Confirm that there are no console errors or exceptions
    expect(consoleErrors).toEqual([]);
  });
});
