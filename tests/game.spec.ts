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
    const activePlayerText = page.locator('div:has-text("YOUR TURN"), div:has-text("ACTIVE FACTION")').first();
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
    await expect(page.locator('div:has-text("YOUR TURN"), div:has-text("ACTIVE FACTION")').first()).toBeVisible();

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

  test('should support sequential turn resolution and cycle turns in order', async ({ page }) => {
    const randomEmail = `sequential-commander-${Date.now()}@example.com`;

    // 1. Navigate to the local server
    await page.goto('http://localhost:8080/');

    // 2. Register & Login
    const establishLinkBtn = page.locator('button:has-text("ESTABLISH COMMAND LINK")');
    await establishLinkBtn.click();
    const registerTab = page.locator('button:has-text("REGISTER")');
    await registerTab.click();
    await page.locator('input[type="email"]').fill(randomEmail);
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=Account created successfully')).toBeVisible();

    await page.locator('input[type="email"]').fill(randomEmail);
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('button:has-text("LOG OUT")')).toBeVisible();

    // 3. Click AI Skirmish Match
    const skirmishBtn = page.locator('button:has-text("SKIRMISH MATCH")');
    await skirmishBtn.click();

    // 4. Select "SEQUENTIAL" turn style in the lobby dropdown
    const styleDropdown = page.locator('#turn-style-select');
    await styleDropdown.selectOption('sequential');

    // 5. Launch the game simulation
    const startBtn = page.locator('button:has-text("LAUNCH GALAXY SIMULATION")');
    await startBtn.click();

    // 6. Verify Dashboard active player indicator
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    await expect(page.locator('div:has-text("YOUR TURN")').first()).toBeVisible();

    // Verify Turn is Turn #1
    const turnNumber = page.locator('.telemetry:has-text("#1")');
    await expect(turnNumber).toBeVisible();

    // 7. Click End Turn. In sequential mode, all AI players take their turns instantly.
    // Since there are no other human players, the round should immediately resolve and return to Vanguard on Turn #2.
    const endTurnBtn = page.locator('button:has-text("END TURN")');
    await expect(endTurnBtn).toBeVisible();
    await endTurnBtn.click();

    // Let the turns advance sequentially and resolve the round
    await page.waitForTimeout(1500);

    // Verify turn progresses directly to #2
    const nextTurnIndicator = page.locator('.telemetry:has-text("#2")');
    await expect(nextTurnIndicator).toBeVisible();

    // Verify we are back to our turn
    await expect(page.locator('div:has-text("YOUR TURN")').first()).toBeVisible();

    // Confirm that there are no console errors or exceptions
    expect(consoleErrors).toEqual([]);
  });

  test('should support simultaneous turns with multiple players and sync turn states correctly', async ({ browser }) => {
    const userA = `user-a-${Date.now()}@example.com`;
    const userB = `user-b-${Date.now()}@example.com`;

    // 1. Setup Context B for User B: Register and log in
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto('http://localhost:8080/');
    const establishLinkBtnB = pageB.locator('button:has-text("ESTABLISH COMMAND LINK")');
    await establishLinkBtnB.click();
    const registerTabB = pageB.locator('button:has-text("REGISTER")');
    await registerTabB.click();
    await pageB.locator('input[type="email"]').fill(userB);
    await pageB.locator('input[type="password"]').fill('password123');
    await pageB.locator('button[type="submit"]').click();
    await expect(pageB.locator('text=Account created successfully')).toBeVisible();

    await pageB.locator('input[type="email"]').fill(userB);
    await pageB.locator('input[type="password"]').fill('password123');
    await pageB.locator('button[type="submit"]').click();
    await expect(pageB.locator('button:has-text("LOG OUT")')).toBeVisible();

    // 2. Setup Context A for User A: Register, log in, configure lobby
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await pageA.goto('http://localhost:8080/');
    const establishLinkBtnA = pageA.locator('button:has-text("ESTABLISH COMMAND LINK")');
    await establishLinkBtnA.click();
    const registerTabA = pageA.locator('button:has-text("REGISTER")');
    await registerTabA.click();
    await pageA.locator('input[type="email"]').fill(userA);
    await pageA.locator('input[type="password"]').fill('password123');
    await pageA.locator('button[type="submit"]').click();
    await expect(pageA.locator('text=Account created successfully')).toBeVisible();

    await pageA.locator('input[type="email"]').fill(userA);
    await pageA.locator('input[type="password"]').fill('password123');
    await pageA.locator('button[type="submit"]').click();
    await expect(pageA.locator('button:has-text("LOG OUT")')).toBeVisible();

    // 3. Start skirmish lobby for User A
    const skirmishBtn = pageA.locator('button:has-text("SKIRMISH MATCH")');
    await skirmishBtn.click();

    // Locate the second player row (index 1)
    const row2 = pageA.locator('div:has(h3:has-text("FACTIONS & TEAM MAPPING")) + div > div').nth(1);
    const controllerSelect = row2.locator('select').first();
    await controllerSelect.selectOption('human');

    const localCheckbox = row2.locator('input[type="checkbox"]');
    await localCheckbox.uncheck();

    const emailInput = row2.locator('input[placeholder="Remote commander email"]');
    await emailInput.fill(userB);

    // Launch the game
    const startBtn = pageA.locator('button:has-text("LAUNCH GALAXY SIMULATION")');
    await startBtn.click();

    // Get the game ID from URL
    await expect(pageA.locator('canvas')).toBeVisible();
    const url = pageA.url();
    const gameIdMatch = url.match(/gameId=([^&]+)/);
    const gameId = gameIdMatch ? gameIdMatch[1] : '';
    expect(gameId).not.toBe('');

    // 4. Click End Turn on Page A
    const endTurnBtnA = pageA.locator('button:has-text("END TURN")');
    await expect(endTurnBtnA).toBeVisible();
    await endTurnBtnA.click();

    // Page A should display the waiting overlay waiting for User B's Nebula AI
    const overlayA = pageA.locator('h2:has-text("HYPERWAVE SYNC ACTIVE")');
    await expect(overlayA).toBeVisible();
    await expect(pageA.locator(`text=${userB}`).first()).toBeVisible();

    // 5. User B navigates to the game URL
    await pageB.goto(`http://localhost:8080/?gameId=${gameId}`);
    
    // Page B should load the game screen since User B is already logged in
    await expect(pageB.locator('canvas')).toBeVisible();
    
    // Page B should be interactive because Nebula AI (assigned to User B) has not ended its turn yet
    await expect(pageB.locator('h2:has-text("HYPERWAVE SYNC ACTIVE")')).not.toBeVisible();
    await expect(pageB.locator('div:has-text("YOUR TURN")').first()).toBeVisible();

    // Click End Turn on Page B
    const endTurnBtnB = pageB.locator('button:has-text("END TURN")');
    await expect(endTurnBtnB).toBeVisible();
    await endTurnBtnB.click();

    // Both players have ended their turn, so the round should roll over to Turn #2
    await pageA.waitForTimeout(2000);

    // Verify turn progresses to #2 on both clients and overlays are removed
    await expect(overlayA).not.toBeVisible();
    await expect(pageA.locator('.telemetry:has-text("#2")')).toBeVisible();
    await expect(pageB.locator('.telemetry:has-text("#2")')).toBeVisible();

    // Clean up
    await contextA.close();
    await contextB.close();
  });

  test('should support shortened invite links and resolve both invite code and UUID', async ({ browser }) => {
    let copiedInviteUrl = '';
    
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    
    // Expose mock copy function to store the invite URL
    await pageA.exposeFunction('mockCopyInvite', (text: string) => {
      copiedInviteUrl = text;
    });

    // Mock clipboard writeText
    await pageA.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text: string) => {
            (window as any).mockCopyInvite(text);
            return Promise.resolve();
          }
        },
        configurable: true
      });
    });

    const userA = `host-${Date.now()}@example.com`;
    const userB = `guest-${Date.now()}@example.com`;

    // --- HOST (USER A) FLOW ---
    await pageA.goto('http://localhost:8080/');
    await pageA.locator('button:has-text("ESTABLISH COMMAND LINK")').click();
    await pageA.locator('button:has-text("REGISTER")').click();
    await pageA.locator('input[type="email"]').fill(userA);
    await pageA.locator('input[type="password"]').fill('password123');
    await pageA.locator('button[type="submit"]').click();
    await expect(pageA.locator('text=Account created successfully')).toBeVisible();

    await pageA.locator('input[type="email"]').fill(userA);
    await pageA.locator('input[type="password"]').fill('password123');
    await pageA.locator('button[type="submit"]').click();
    await expect(pageA.locator('button:has-text("LOG OUT")')).toBeVisible();

    // Start skirmish lobby and add User B
    await pageA.locator('button:has-text("SKIRMISH MATCH")').click();
    const row2 = pageA.locator('div:has(h3:has-text("FACTIONS & TEAM MAPPING")) + div > div').nth(1);
    await row2.locator('select').first().selectOption('human');
    await row2.locator('input[type="checkbox"]').uncheck();
    await row2.locator('input[placeholder="Remote commander email"]').fill(userB);

    // Launch game
    const createResponsePromise = pageA.waitForResponse(response =>
      response.url().includes('/api/games') && response.request().method() === 'POST'
    );
    await pageA.locator('button:has-text("LAUNCH GALAXY SIMULATION")').click();
    await expect(pageA.locator('canvas')).toBeVisible();

    const createResponse = await createResponsePromise;
    const createData = await createResponse.json();
    const uuid = createData.gameId;
    const shortCode = createData.inviteCode;
    expect(uuid).toHaveLength(36); // Verify it is a full UUID
    expect(shortCode).toHaveLength(8); // Verify short code is 8 chars

    // Verify browser URL contains short code
    const gameUrl = pageA.url();
    expect(gameUrl).toContain(`gameId=${shortCode}`);

    // Return to menu
    await pageA.locator('button:has-text("HOME")').click();
    await expect(pageA.locator('button:has-text("SKIRMISH MATCH")')).toBeVisible();

    // Wait for the games list to load
    await pageA.waitForTimeout(1000);

    // Copy the invite link from the saved games list
    const inviteBtn = pageA.locator('button:has-text("🔗 INVITE")').first();
    await expect(inviteBtn).toBeVisible();
    await inviteBtn.click();
    await pageA.waitForTimeout(500);

    // Verify invite url was copied and contains the correct shortCode
    expect(copiedInviteUrl).not.toBe('');
    const copiedUrlMatch = copiedInviteUrl.match(/gameId=([^&]+)/);
    const copiedShortCode = copiedUrlMatch ? copiedUrlMatch[1] : '';
    expect(copiedShortCode).toBe(shortCode);
    
    // --- GUEST (USER B) FLOW ---
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto('http://localhost:8080/');

    // Register & Login User B
    await pageB.locator('button:has-text("ESTABLISH COMMAND LINK")').click();
    await pageB.locator('button:has-text("REGISTER")').click();
    await pageB.locator('input[type="email"]').fill(userB);
    await pageB.locator('input[type="password"]').fill('password123');
    await pageB.locator('button[type="submit"]').click();
    await expect(pageB.locator('text=Account created successfully')).toBeVisible();

    await pageB.locator('input[type="email"]').fill(userB);
    await pageB.locator('input[type="password"]').fill('password123');
    await pageB.locator('button[type="submit"]').click();
    await expect(pageB.locator('button:has-text("LOG OUT")')).toBeVisible();

    // Navigate using the shortened invite link (short code)
    await pageB.goto(`http://localhost:8080/?gameId=${shortCode}`);
    await expect(pageB.locator('canvas')).toBeVisible(); // Should load the game successfully!

    // Return User B to menu
    await pageB.locator('button:has-text("HOME")').click();

    // Navigate using the original UUID link
    await pageB.goto(`http://localhost:8080/?gameId=${uuid}`);
    await expect(pageB.locator('canvas')).toBeVisible(); // Should also load the game successfully!

    await contextA.close();
    await contextB.close();
  });
});
