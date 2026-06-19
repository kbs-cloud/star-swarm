// Star-Swarm Express Backend & SQLite Database Server
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
} catch (e) {
  console.warn('Failed to load local environment file:', e.message);
}

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');

const {
  initializeGame,
  queueShipProduction,
  upgradeSystem,
  dispatchFleet,
  recallFleet,
  cancelDispatch,
  cancelProduction,
  processTurnEnd,
  logAction,
  advanceSequentialTurns
} = require('./src/game/dist/gameState.js');
const { runAITurn } = require('./src/game/dist/ai.js');

const app = express();
const PORT = process.env.BACKEND_PORT || process.env.PORT || 29002;
app.set('trust proxy', 1);

// Database Connection
const dbPath = path.join(__dirname, 'starswarm.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initializeTables();
  }
});

// Create tables if they do not exist
function initializeTables() {
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        password_hash TEXT,
        is_google_linked INTEGER DEFAULT 0,
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0
      )
    `);

    // Sessions table
    db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        email TEXT,
        expires_at DATETIME,
        csrf_token TEXT,
        FOREIGN KEY(email) REFERENCES users(email) ON DELETE CASCADE
      )
    `);

    // Games table
    db.run(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        invite_code TEXT UNIQUE,
        owner_email TEXT,
        name TEXT,
        game_state TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(owner_email) REFERENCES users(email) ON DELETE CASCADE
      )
    `);

    // Add optional display_name column to users table dynamically if it does not exist.
    db.run("ALTER TABLE users ADD COLUMN display_name TEXT", (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.warn('Optional display_name column creation info:', err.message);
      }
    });

    // Add optional invite_code column to games table dynamically if it does not exist.
    db.run("ALTER TABLE games ADD COLUMN invite_code TEXT", (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.warn('Optional invite_code column creation info:', err.message);
      }
      db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_games_invite_code ON games(invite_code)", (idxErr) => {
        if (idxErr) {
          console.warn('Failed to create unique index on invite_code:', idxErr.message);
        }
        // Populate missing invite codes for existing games
        populateMissingInviteCodes();
      });
    });

    // Migrate join_requests: drop old table if it exists (may have wrong constraint)
    // and recreate with UNIQUE(game_id, email) so status is updated in place.
    db.run(`DROP TABLE IF EXISTS join_requests`, (dropErr) => {
      if (dropErr) console.error('join_requests drop error:', dropErr.message);
      db.run(`
        CREATE TABLE IF NOT EXISTS join_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          game_id TEXT NOT NULL,
          email TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('pending','accepted','rejected')) DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(game_id, email) ON CONFLICT REPLACE
        )
      `, (createErr) => {
        if (createErr) console.error('join_requests create error:', createErr.message);
        // Run anonymous games cleanup on startup after table initialization
        cleanupAnonymousGames();
      });
    });
  });
}

// Helper: encode a positive integer to base-62 string (dynamic length, collision-free)
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function encodeBase62(num) {
  if (num === 0) return '0';
  let s = '';
  while (num > 0) {
    s = BASE62[num % 62] + s;
    num = Math.floor(num / 62);
  }
  return s;
}

// Helper: generate a random invite code using base-62 character set
function generateInviteCode() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const bytes = crypto.randomBytes(8);
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i] % 62];
  }
  return result;
}

// Helper: generate a random space/sci-fi game name
function generateRandomGameName() {
  const prefixes = ['Nebula', 'Solar', 'Void', 'Star', 'Nova', 'Cosmo', 'Astra', 'Galactic', 'Orion', 'Hyperion'];
  const nouns = ['Swarm', 'Nest', 'Fleet', 'Sector', 'System', 'Cluster', 'Skirmish', 'Domain', 'Concourse', 'Cruiser'];
  const p = prefixes[Math.floor(Math.random() * prefixes.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  return `${p}-${n} ${Math.floor(100 + Math.random() * 900)}`;
}


// Generate a unique invite code checking against the database
function generateUniqueInviteCode(callback) {
  const code = generateInviteCode();
  db.get('SELECT id FROM games WHERE invite_code = ?', [code], (err, row) => {
    if (err) {
      return callback(null, err);
    }
    if (row) {
      return generateUniqueInviteCode(callback);
    }
    callback(code);
  });
}

// Populate missing invite codes for existing games (e.g. from migrations)
function populateMissingInviteCodes() {
  db.all('SELECT id FROM games WHERE invite_code IS NULL', [], (err, rows) => {
    if (err || !rows || rows.length === 0) return;

    let processed = 0;
    const updateNext = () => {
      if (processed >= rows.length) return;
      const row = rows[processed];
      generateUniqueInviteCode((code, codeErr) => {
        if (code && !codeErr) {
          db.run('UPDATE games SET invite_code = ? WHERE id = ?', [code, row.id], (updErr) => {
            processed++;
            updateNext();
          });
        } else {
          processed++;
          updateNext();
        }
      });
    };
    updateNext();
  });
}

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Enable CORS for frontend proxy / local testing origins (including Electron file:// / null origins)
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || origin === 'null' || origin.startsWith('file://')) {
      return callback(null, true);
    }
    const allowedOrigins = [
      'http://localhost:8080', 'http://127.0.0.1:8080',
      'http://localhost:19000', 'http://127.0.0.1:19000',
      'http://localhost:19001', 'http://127.0.0.1:19001',
      'http://localhost:19002', 'http://127.0.0.1:19002',
      'http://localhost:19003', 'http://127.0.0.1:19003'
    ];
    if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return callback(null, true);
    }
    callback(null, true);
  },
  credentials: true
}));

// Clean up expired sessions periodically
setInterval(() => {
  const now = new Date().toISOString();
  db.run('DELETE FROM sessions WHERE expires_at < ?', [now], (err) => {
    if (err) {
      console.error('Failed to clean up expired sessions:', err.message);
    }
  });
}, 10 * 60 * 1000); // Every 10 minutes

// Clean up inactive anonymous games (owner_email is null and no updates for 1 week)
function cleanupAnonymousGames() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  db.run(
    'DELETE FROM games WHERE owner_email IS NULL AND datetime(updated_at) < datetime(?)',
    [cutoff],
    function (err) {
      if (err) {
        console.error('Failed to clean up inactive anonymous games:', err.message);
      } else if (this.changes > 0) {
        console.log(`Cleaned up ${this.changes} inactive anonymous games (inactive for > 1 week).`);
      }
    }
  );
}

// Run hourly cleanup of inactive anonymous games
setInterval(cleanupAnonymousGames, 60 * 60 * 1000);

// CSRF Handshake endpoint (Initializes CSRF cookies on SPA mount)
app.get('/api/csrf-init', (req, res) => {
  let csrfToken = req.cookies['csrf_token'];
  if (!csrfToken) {
    csrfToken = crypto.randomBytes(24).toString('hex');
  }
  // Always ensure the cookie is set
  res.cookie('csrf_token', csrfToken, {
    path: '/',
    sameSite: 'lax',
    // TODO(security): Set secure: true in production HTTPS
    secure: false
  });
  // Also return the token directly in the JSON body so file:// clients can read it
  res.status(200).json({ success: true, csrfToken });
});

// Middleware to validate CSRF token on state-changing requests
function validateCSRF(req, res, next) {
  const origin = req.headers['origin'];
  const isElectron = !origin || origin === 'null' || origin.startsWith('file://');

  // If request is from Electron/cross-origin or authenticated via custom header, bypass CSRF
  if (isElectron || req.headers['x-session-id']) {
    return next();
  }

  const cookieToken = req.cookies['csrf_token'];
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    console.warn('CSRF validation failed: Token mismatch or missing.');
    return res.status(403).json({ error: 'CSRF token validation failed.' });
  }
  next();
}

// Session Validation Helper
function getSessionUser(req, callback) {
  const headerSessionId = req.headers['x-session-id'];
  const cookieSessionId = req.cookies['session_id'];

  if (!headerSessionId && !cookieSessionId) {
    return callback(null, null);
  }

  const now = new Date().toISOString();

  const querySession = (sid, next) => {
    db.get(
      `SELECT s.csrf_token, u.email, u.display_name, u.is_google_linked, u.games_played, u.games_won, u.password_hash 
       FROM sessions s 
       JOIN users u ON s.email = u.email 
       WHERE s.id = ? AND s.expires_at > ?`,
      [sid, now],
      (err, row) => {
        if (err || !row) return next(null);
        next(row);
      }
    );
  };

  if (headerSessionId) {
    querySession(headerSessionId, (user) => {
      if (user) {
        return callback(null, user);
      }
      if (cookieSessionId) {
        querySession(cookieSessionId, (cookieUser) => {
          callback(null, cookieUser);
        });
      } else {
        callback(null, null);
      }
    });
  } else {
    querySession(cookieSessionId, (user) => {
      callback(null, user);
    });
  }
}

// In-memory presence store
// Key: gameId, Value: Array of { email, lastSeen }
const gamePresence = new Map();

// In-memory pending auth requests for Electron browser-based polling
// Key: token, Value: { sessionId, error, createdAt }
const pendingAuths = new Map();

// Periodic cleanup of expired tokens (> 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of pendingAuths.entries()) {
    if (now - data.createdAt > 5 * 60 * 1000) {
      pendingAuths.delete(token);
    }
  }
}, 60000);

function updatePresence(gameId, email) {
  if (!gamePresence.has(gameId)) {
    gamePresence.set(gameId, []);
  }
  const list = gamePresence.get(gameId);
  const now = Date.now();
  const existing = list.find(item => item.email === email);
  if (existing) {
    existing.lastSeen = now;
  } else {
    list.push({ email, lastSeen: now });
  }
  // Clean up old ones (> 10 seconds)
  const freshList = list.filter(item => now - item.lastSeen < 10000);
  gamePresence.set(gameId, freshList);
}

function getPresence(gameId) {
  const list = gamePresence.get(gameId) || [];
  const now = Date.now();
  return list.filter(item => now - item.lastSeen < 10000).map(item => item.email);
}


// Resolve 'id' and 'gameId' parameters to the actual UUID if they are invite codes
app.param('id', (req, res, next, id) => {
  db.get('SELECT id FROM games WHERE id = ? OR invite_code = ?', [id, id], (err, row) => {
    if (err) return next(err);
    if (row) {
      req.params.id = row.id;
    }
    next();
  });
});

app.param('gameId', (req, res, next, gameId) => {
  db.get('SELECT id FROM games WHERE id = ? OR invite_code = ?', [gameId, gameId], (err, row) => {
    if (err) return next(err);
    if (row) {
      req.params.gameId = row.id;
    }
    next();
  });
});

// Endpoint: SSO Auth Callback redirect
app.get('/api/auth/callback', async (req, res) => {
  console.log('[/api/auth/callback] Incoming request. Query:', req.query, 'Headers:', req.headers, 'Cookies:', req.cookies);
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  const stateParams = new URLSearchParams(state || '');
  const isElectron = stateParams.get('source') === 'electron';
  const token = stateParams.get('token') || '';
  const isIframe = req.query.source === 'iframe';

  try {
    // Exchange the authorization code with kbs-auth server
    const authServerUrl = process.env.AUTH_SERVER_URL || 'http://localhost:29001';
    const tokenRes = await fetch(`${authServerUrl}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, client_id: 'starswarm' })
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.success) {
      throw new Error(tokenData.error || 'Failed to exchange auth token.');
    }

    const { email, displayName } = tokenData.user;
    const finalDisplayName = displayName || email.split('@')[0];

    db.get('SELECT email FROM users WHERE email = ?', [email], (err, user) => {
      const finalizeLogin = () => {
        const sessionId = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        const csrfToken = req.cookies['csrf_token'] || crypto.randomBytes(24).toString('hex');

        db.run(
          'INSERT INTO sessions (id, email, expires_at, csrf_token) VALUES (?, ?, ?, ?)',
          [sessionId, email, expiresAt, csrfToken],
          (sessionErr) => {
            if (sessionErr) {
              if (isElectron && token) {
                pendingAuths.set(token, { error: 'session_fail', createdAt: Date.now() });
                return renderAuthResponseHtml(res, 'Star-Swarm Session Error', 'SESSION DEPLOYMENT FAILURE', 'Failed to generate user commander session.', false);
              }
              if (isIframe) {
                return res.status(500).send('Session generation failed.');
              }
              return res.redirect('/login?error=session_fail');
            }

            res.cookie('session_id', sessionId, {
              httpOnly: true,
              path: '/',
              sameSite: 'lax',
              secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
              maxAge: 2 * 60 * 60 * 1000
            });

            if (isElectron && token) {
              pendingAuths.set(token, { sessionId, createdAt: Date.now() });
              return renderAuthResponseHtml(res, 'Star-Swarm Authenticated', 'COMMAND PROTOCOL ESTABLISHED', 'Commander authenticated successfully. You can now close this tab and return to the Star-Swarm game console.', true);
            }

            if (isIframe) {
              return res.send(`
                <!DOCTYPE html>
                <html>
                  <body>
                    <script>
                      window.parent.postMessage({ type: 'SSO_LOGIN_SUCCESS' }, window.location.origin);
                    </script>
                  </body>
                </html>
              `);
            }

            res.redirect('/');
          }
        );
      };

      if (user) {
        db.run('UPDATE users SET display_name = ? WHERE email = ?', [finalDisplayName, email], () => {
          finalizeLogin();
        });
      } else {
        db.run(
          'INSERT INTO users (email, password_hash, is_google_linked, display_name) VALUES (?, NULL, 0, ?)',
          [email, finalDisplayName],
          () => {
            finalizeLogin();
          }
        );
      }
    });
  } catch (error) {
    console.error('SSO callback exchange failed:', error);
    if (isElectron && token) {
      pendingAuths.set(token, { error: 'oauth_failed', createdAt: Date.now() });
      return renderAuthResponseHtml(res, 'Star-Swarm Auth Error', 'AUTHENTICATION FAILURE', 'Failed to link SSO session.', false);
    }
    if (isIframe) {
      return res.status(500).send('SSO exchange failed.');
    }
    res.redirect('/login?error=sso_failed');
  }
});

// Endpoint: Check if real Google OAuth is configured (Disabled locally, delegated to SSO)
app.get('/api/auth/google/config', (req, res) => {
  res.status(200).json({ enabled: true });
});

// Endpoint: Poll for Electron browser authentication status
app.get('/api/auth/poll', (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: 'Missing token parameter.' });
  }

  const auth = pendingAuths.get(token);
  if (!auth) {
    return res.status(200).json({ status: 'pending' });
  }

  if (auth.error) {
    pendingAuths.delete(token);
    return res.status(200).json({ status: 'error', error: auth.error });
  }

  // Success: return session ID
  pendingAuths.delete(token);
  return res.status(200).json({ status: 'success', sessionId: auth.sessionId });
});

// Helper to render sci-fi themed HTML auth pages for Electron login browser flows
function renderAuthResponseHtml(res, title, header, message, isSuccess) {
  const primaryColor = isSuccess ? '#39ff14' : '#ff007f';
  const shadowColor = isSuccess ? 'rgba(57, 255, 20, 0.2)' : 'rgba(255, 0, 127, 0.2)';
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet">
        <style>
          body {
            background-color: #05030d;
            color: ${primaryColor};
            font-family: 'Share Tech Mono', monospace;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            text-align: center;
            overflow: hidden;
          }
          .container {
            border: 1px solid ${primaryColor};
            padding: 40px;
            background: rgba(0,0,0,0.85);
            box-shadow: 0 0 30px ${shadowColor};
            border-radius: 4px;
            max-width: 450px;
          }
          h1 {
            color: #00ffff;
            font-size: 24px;
            letter-spacing: 2px;
            margin-bottom: 20px;
            text-shadow: 0 0 10px rgba(0,255,255,0.3);
          }
          p {
            font-size: 15px;
            line-height: 1.6;
            margin: 15px 0;
          }
          .accent-glow {
            text-shadow: 0 0 8px ${primaryColor};
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${header}</h1>
          <p class="accent-glow">${message}</p>
          <p style="color: #888; font-size: 12px; margin-top: 30px;">
            [COMMAND TERMINAL SECURED]
          </p>
        </div>
      </body>
    </html>
  `);
}

// Endpoint: Get current user session details
app.get('/api/me', (req, res) => {
  console.log('[/api/me] Incoming request. Headers:', req.headers, 'Cookies:', req.cookies);
  getSessionUser(req, (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Unauthorized. No active session.' });
    }
    const sessionId = req.headers['x-session-id'] || req.cookies['session_id'];
    res.status(200).json({
      success: true,
      sessionId,
      user: {
        email: user.email,
        displayName: user.display_name || null,
        isGoogleLinked: user.is_google_linked === 1,
        hasPassword: user.password_hash !== null && user.password_hash !== undefined,
        stats: { gamesPlayed: user.games_played, gamesWon: user.games_won }
      }
    });
  });
});

// Endpoint: Update user global settings
app.put('/api/settings', validateCSRF, (req, res) => {
  getSessionUser(req, (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Unauthorized. Please log in first.' });
    }
    const { displayName } = req.body;
    if (typeof displayName !== 'string') {
      return res.status(400).json({ error: 'Invalid display name.' });
    }
    db.run(
      'UPDATE users SET display_name = ? WHERE email = ?',
      [displayName.trim(), user.email],
      function (updateErr) {
        if (updateErr) {
          console.error('Error updating settings:', updateErr.message);
          return res.status(500).json({ error: 'Failed to update settings.' });
        }
        res.status(200).json({ success: true, message: 'Settings updated successfully.' });
      }
    );
  });
});

// Endpoint: Change user password (disabled, managed centrally)
app.put('/api/settings/password', validateCSRF, (req, res) => {
  res.status(400).json({ error: 'Passwords must be updated centrally on the KBS Auth portal.' });
});

const HUB_API_URL = process.env.HUB_API_URL || 'http://localhost:29000';
const HUB_APP_TOKEN = process.env.HUB_APP_TOKEN || 'starswarm_token_dev_999';

async function unlockHubAchievement(email, achievementId) {
  try {
    const res = await fetch(`${HUB_API_URL}/api/games-api/achievements/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Token': HUB_APP_TOKEN
      },
      body: JSON.stringify({ email, achievementId })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      console.log(`Successfully unlocked achievement ${achievementId} for user ${email} in Hub.`);
    } else {
      console.error(`Hub achievement unlock returned error:`, data.error || data);
    }
  } catch (err) {
    console.error(`Failed to connect to Hub achievements API:`, err.message);
  }
}

// Endpoint: Record telemetry game statistics
app.post('/api/stats', validateCSRF, (req, res) => {
  const { won } = req.body;

  getSessionUser(req, (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Unauthorized. Session expired.' });
    }

    const wonInc = won ? 1 : 0;
    db.run(
      'UPDATE users SET games_played = games_played + 1, games_won = games_won + ? WHERE email = ?',
      [wonInc, user.email],
      function (updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: 'Failed to update stats.' });
        }

        // Get updated stats to return
        db.get('SELECT games_played, games_won FROM users WHERE email = ?', [user.email], (selErr, row) => {
          if (selErr || !row) {
            return res.status(200).json({ success: true });
          }

          // Trigger Hub achievement unlock asynchronously
          if (won) {
            unlockHubAchievement(user.email, 'starswarm_first_victory');
          }

          res.status(200).json({
            success: true,
            stats: { gamesPlayed: row.games_played, gamesWon: row.games_won }
          });
        });
      }
    );
  });
});

// Endpoint: Log out user session
app.post('/api/logout', (req, res) => {
  const sessionId = req.cookies['session_id'];
  if (sessionId) {
    db.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
  }
  res.clearCookie('session_id');
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

// Helper to verify JWT signature using pure Node crypto module (offline verification)
function verifyJWT(token, publicKeyPem) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const data = headerB64 + '.' + payloadB64;
    const signature = Buffer.from(signatureB64, 'base64url');

    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    const isValid = verify.verify(publicKeyPem, signature);

    if (!isValid) return null;

    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    return JSON.parse(payloadJson);
  } catch (e) {
    return null;
  }
}

// Endpoint: Back-channel logout for SLO (Asymmetric JWT verification)
app.post('/api/auth/backchannel-logout', async (req, res) => {
  const { logout_token } = req.body;
  if (!logout_token) {
    return res.status(400).json({ error: 'Missing logout_token.' });
  }

  try {
    // 1. Fetch public key from auth server
    const authServerUrl = process.env.AUTH_SERVER_URL || 'http://localhost:29001';
    const certsRes = await fetch(`${authServerUrl}/api/auth/certs`);
    if (!certsRes.ok) {
      throw new Error(`Failed to fetch certs from auth server: ${certsRes.status}`);
    }
    const { keys } = await certsRes.json();
    const activeKey = keys?.find(k => k.kid === 'sso-key-1');
    if (!activeKey || !activeKey.pem) {
      throw new Error('Active public key not found in auth certs.');
    }

    // 2. Verify JWT signature
    const payload = verifyJWT(logout_token, activeKey.pem);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid logout token signature.' });
    }

    // 3. Validate claims
    const now = Math.floor(Date.now() / 1000);
    if (payload.iss !== 'kbs-auth') {
      return res.status(401).json({ error: 'Invalid issuer.' });
    }
    if (payload.aud !== 'starswarm') {
      return res.status(401).json({ error: 'Invalid audience.' });
    }
    if (payload.exp < now) {
      return res.status(401).json({ error: 'Logout token expired.' });
    }

    const email = payload.sub;
    if (!email) {
      return res.status(400).json({ error: 'Missing subject (email).' });
    }

    // 4. Invalidate sessions
    db.run('DELETE FROM sessions WHERE email = ?', [email], (err) => {
      if (err) {
        console.error('Error clearing sessions for email:', email, err.message);
        return res.status(500).json({ error: 'Database error clearing sessions.' });
      }
      console.log(`[Back-Channel Logout] Cleared local starswarm sessions for ${email}`);
      res.status(200).json({ success: true, message: 'Sessions cleared successfully.' });
    });
  } catch (error) {
    console.error('[Back-Channel Logout] Verification failed:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Helper to compute turn status on backend for filtering
function getGameTurnStatus(gameState, ownerEmail, currentUserEmail) {
  if (!gameState || !gameState.players || !gameState.playerState) return 'UNKNOWN';

  const activeTeams = new Set();
  gameState.players.forEach(p => {
    const pState = gameState.playerState[p.id];
    if (pState && !pState.lost) {
      activeTeams.add(p.team);
    }
  });
  if (activeTeams.size <= 1) {
    return 'GAME OVER';
  }

  const activeHumans = gameState.players.filter(p => p.type === 'human' && !gameState.playerState[p.id]?.lost);
  const userPlayer = activeHumans.find(p => p.assignedEmail === currentUserEmail || (p.id === 1 && p.isLocal && ownerEmail === currentUserEmail));

  if (gameState.turnStyle === 'sequential') {
    const activePlayer = gameState.players[gameState.activePlayerIdx];
    if (userPlayer && activePlayer && activePlayer.id === userPlayer.id) {
      return 'YOUR TURN';
    }
    if (activePlayer) {
      return `WAITING ON: ${activePlayer.name.toUpperCase()}`;
    }
    return 'PROCESSING TURN...';
  }

  if (userPlayer && !userPlayer.endedTurn) {
    return 'YOUR TURN';
  }

  const pendingPlayers = activeHumans.filter(p => !p.endedTurn);
  if (pendingPlayers.length === 1) {
    return `WAITING ON: ${pendingPlayers[0].name.toUpperCase()}`;
  } else if (pendingPlayers.length > 1) {
    return 'WAITING ON OTHER PLAYERS';
  }

  return 'PROCESSING TURN...';
}

// Endpoint: List active games for logged in user with search, filtering, and pagination
app.get('/api/games', (req, res) => {
  getSessionUser(req, (err, user) => {
    const { search, status, startDate, endDate, turns, limit, offset, ids } = req.query;

    const guestEmail = req.headers['x-guest-email'] || req.headers['x-guest-name'] || null;
    const effectiveEmail = user ? user.email : guestEmail;

    if (err || !user) {
      if (!ids) {
        return res.status(401).json({ error: 'Unauthorized. Please log in first.' });
      }

      const idList = typeof ids === 'string' ? ids.split(',').filter(Boolean) : [];
      if (idList.length === 0) {
        return res.status(200).json({ success: true, games: [], totalCount: 0 });
      }

      // Query database for these specific IDs
      const placeholders = idList.map(() => '?').join(',');
      db.all(
        `SELECT id, invite_code, owner_email, name, game_state, created_at, updated_at FROM games WHERE id IN (${placeholders}) ORDER BY updated_at DESC`,
        idList,
        (queryErr, rows) => {
          if (queryErr) {
            console.error('Error fetching guest games:', queryErr.message);
            return res.status(500).json({ error: 'Failed to fetch guest games.' });
          }
          filterAndSend(rows, effectiveEmail);
        }
      );
      return;
    }

    db.all(
      'SELECT id, invite_code, owner_email, name, game_state, created_at, updated_at FROM games WHERE owner_email = ? OR game_state LIKE ? ORDER BY updated_at DESC',
      [user.email, '%"assignedEmail":"' + user.email + '"%'],
      (queryErr, rows) => {
        if (queryErr) {
          console.error('Error fetching games:', queryErr.message);
          return res.status(500).json({ error: 'Failed to fetch saved games.' });
        }
        filterAndSend(rows, effectiveEmail);
      }
    );

    function filterAndSend(rows, emailToFilter) {
      // Filter games in memory
      const filteredGames = rows.filter(row => {
        let parsedState;
        try {
          parsedState = typeof row.game_state === 'string' ? JSON.parse(row.game_state) : row.game_state;
        } catch (e) {
          return false;
        }

        // Search term filter: matches game name, owner email, or any player's name or email
        if (search) {
          const sLower = search.toLowerCase();
          const matchesName = row.name && row.name.toLowerCase().includes(sLower);
          const matchesOwner = row.owner_email && row.owner_email.toLowerCase().includes(sLower);
          const matchesPlayers = parsedState.players && parsedState.players.some(p =>
            (p.name && p.name.toLowerCase().includes(sLower)) ||
            (p.assignedEmail && p.assignedEmail.toLowerCase().includes(sLower))
          );
          if (!matchesName && !matchesOwner && !matchesPlayers) {
            return false;
          }
        }

        // Status filter: "your_turn", "waiting", "game_over"
        if (status && status !== 'all') {
          const turnStatus = getGameTurnStatus(parsedState, row.owner_email, emailToFilter);
          if (status === 'your_turn') {
            if (turnStatus !== 'YOUR TURN') return false;
          } else if (status === 'waiting') {
            if (!turnStatus.startsWith('WAITING ON') && turnStatus !== 'WAITING ON OTHER PLAYERS') return false;
          } else if (status === 'game_over') {
            if (turnStatus !== 'GAME OVER') return false;
          }
        }

        // Date filters on updated_at
        if (startDate) {
          const start = new Date(startDate);
          const gameDate = new Date(row.updated_at);
          if (gameDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          const gameDate = new Date(row.updated_at);
          if (gameDate > end) return false;
        }

        // Turns filter
        if (turns) {
          const turnNum = parseInt(turns);
          if (!isNaN(turnNum) && parsedState.turnNumber !== turnNum) {
            return false;
          }
        }

        return true;
      });

      // Paginate
      const limitNum = parseInt(limit) || 10;
      const offsetNum = parseInt(offset) || 0;
      const paginatedGames = filteredGames.slice(offsetNum, offsetNum + limitNum);

      res.status(200).json({
        success: true,
        games: paginatedGames,
        totalCount: filteredGames.length
      });
    }
  });
});

// Endpoint: Sync local and remote matches
app.post('/api/games/sync', validateCSRF, (req, res) => {
  getSessionUser(req, (err, user) => {
    const guestEmail = req.headers['x-guest-email'] || req.headers['x-guest-name'] || null;
    const effectiveEmail = user ? user.email : guestEmail;

    if (!effectiveEmail) {
      return res.status(401).json({ error: 'Unauthorized. Please log in or establish guest identity first.' });
    }

    const { localGames } = req.body;
    if (!Array.isArray(localGames)) {
      return res.status(400).json({ error: 'Invalid sync payload. localGames must be an array.' });
    }

    // Pre-process local games: Replace 'commander@local' with 'effectiveEmail' and update timestamps if modified
    localGames.forEach(localGame => {
      let emailUpdated = false;
      if (localGame.owner_email === 'commander@local') {
        localGame.owner_email = effectiveEmail;
        emailUpdated = true;
      }
      if (localGame.game_state) {
        try {
          let state;
          let isString = false;
          if (typeof localGame.game_state === 'string') {
            state = JSON.parse(localGame.game_state);
            isString = true;
          } else {
            state = localGame.game_state;
          }

          if (state && Array.isArray(state.players)) {
            state.players.forEach(p => {
              if (p.assignedEmail === 'commander@local') {
                p.assignedEmail = effectiveEmail;
                emailUpdated = true;
              }
            });
            if (emailUpdated) {
              localGame.game_state = isString ? JSON.stringify(state) : state;
            }
          }
        } catch (e) {
          console.error('Error pre-processing game state during sync:', e);
        }
      }
      if (emailUpdated) {
        localGame.updated_at = new Date().toISOString();
      }
    });

    const localGameIds = localGames.map(g => g.id).filter(Boolean);
    const placeholders = localGameIds.map(() => '?').join(',');

    let query = 'SELECT id, invite_code, owner_email, name, game_state, created_at, updated_at FROM games WHERE owner_email = ? OR game_state LIKE ?';
    const queryParams = [effectiveEmail, '%"assignedEmail":"' + effectiveEmail + '"%'];

    if (localGameIds.length > 0) {
      query += ` OR id IN (${placeholders})`;
      queryParams.push(...localGameIds);
    }

    // Fetch matching games
    db.all(query, queryParams, (queryErr, serverRows) => {
      if (queryErr) {
        console.error('Error fetching games for sync:', queryErr.message);
        return res.status(500).json({ error: 'Failed to fetch server games for sync.' });
      }

      const serverGamesMap = new Map();
      serverRows.forEach(row => {
        serverGamesMap.set(row.id, row);
      });

      const localUpdates = [];
      const serverUpserts = [];

      // 1. Process local games
      localGames.forEach(localGame => {
        const serverGame = serverGamesMap.get(localGame.id);
        if (serverGame) {
          // Authorization check
          const isOwner = serverGame.owner_email === effectiveEmail;
          const isGuestGame = serverGame.owner_email === null || !serverGame.owner_email.includes('@') || serverGame.owner_email === 'commander@local';
          let isPlayer = false;
          try {
            const parsedState = typeof serverGame.game_state === 'string' ? JSON.parse(serverGame.game_state) : serverGame.game_state;
            isPlayer = parsedState?.players?.some(p => p.assignedEmail === effectiveEmail) || false;
          } catch (e) {}

          if (!isOwner && !isGuestGame && !isPlayer) {
            console.warn(`Sync warning: User ${effectiveEmail} is not authorized to update game ${localGame.id}`);
            return; // Skip unauthorized game sync
          }

          const localTime = new Date(localGame.updated_at).getTime();
          const serverTime = new Date(serverGame.updated_at).getTime();

          if (isGuestGame && user) {
            // Claim ownership of guest game on server
            // Clean up any remaining commander@local in the server's game_state if we use it
            let cleanServerState = serverGame.game_state;
            try {
              let state = typeof cleanServerState === 'string' ? JSON.parse(cleanServerState) : cleanServerState;
              if (state && Array.isArray(state.players)) {
                let stateUpdated = false;
                state.players.forEach(p => {
                  if (p.assignedEmail === 'commander@local') {
                    p.assignedEmail = user.email;
                    stateUpdated = true;
                  }
                });
                if (stateUpdated) {
                  cleanServerState = JSON.stringify(state);
                }
              }
            } catch (e) {
              console.error('Error cleaning server game state during guest claim:', e);
            }

            serverUpserts.push({
              id: localGame.id,
              invite_code: serverGame.invite_code || localGame.invite_code || generateInviteCode(),
              owner_email: user.email,
              name: serverTime > localTime ? serverGame.name : localGame.name,
              game_state: serverTime > localTime ? cleanServerState : (typeof localGame.game_state === 'string' ? localGame.game_state : JSON.stringify(localGame.game_state)),
              created_at: serverGame.created_at || localGame.created_at,
              updated_at: serverTime > localTime ? serverGame.updated_at : localGame.updated_at
            });

            if (serverTime > localTime) {
              localUpdates.push({
                id: serverGame.id,
                invite_code: serverGame.invite_code,
                owner_email: user.email,
                name: serverGame.name,
                game_state: cleanServerState,
                created_at: serverGame.created_at,
                updated_at: serverGame.updated_at
              });
            }
          } else if (localTime > serverTime) {
            // Local is newer: upload to server
            serverUpserts.push({
              id: localGame.id,
              invite_code: serverGame.invite_code || localGame.invite_code || generateInviteCode(),
              owner_email: (serverGame.owner_email === 'commander@local' || !serverGame.owner_email) ? effectiveEmail : serverGame.owner_email,
              name: localGame.name,
              game_state: typeof localGame.game_state === 'string' ? localGame.game_state : JSON.stringify(localGame.game_state),
              created_at: serverGame.created_at || localGame.created_at,
              updated_at: localGame.updated_at
            });
          } else if (serverTime > localTime) {
            // Server is newer: download to local
            localUpdates.push({
              id: serverGame.id,
              invite_code: serverGame.invite_code,
              owner_email: serverGame.owner_email,
              name: serverGame.name,
              game_state: serverGame.game_state,
              created_at: serverGame.created_at,
              updated_at: serverGame.updated_at
            });
          }
        } else {
          // Doesn't exist on server: insert into server
          serverUpserts.push({
            id: localGame.id,
            invite_code: localGame.invite_code || generateInviteCode(),
            owner_email: user ? user.email : null,
            name: localGame.name,
            game_state: typeof localGame.game_state === 'string' ? localGame.game_state : JSON.stringify(localGame.game_state),
            created_at: localGame.created_at || new Date().toISOString(),
            updated_at: localGame.updated_at || new Date().toISOString()
          });
        }
      });

      // 2. Process server games that are not in local list
      const localGamesSet = new Set(localGames.map(g => g.id));
      serverRows.forEach(serverGame => {
        const isOwner = serverGame.owner_email === effectiveEmail;
        let isPlayer = false;
        try {
          const parsedState = typeof serverGame.game_state === 'string' ? JSON.parse(serverGame.game_state) : serverGame.game_state;
          isPlayer = parsedState?.players?.some(p => p.assignedEmail === effectiveEmail) || false;
        } catch (e) {}

        if ((isOwner || isPlayer) && !localGamesSet.has(serverGame.id)) {
          localUpdates.push({
            id: serverGame.id,
            invite_code: serverGame.invite_code,
            owner_email: serverGame.owner_email,
            name: serverGame.name,
            game_state: serverGame.game_state,
            created_at: serverGame.created_at,
            updated_at: serverGame.updated_at
          });
        }
      });

      if (serverUpserts.length === 0) {
        const uniqueUpdatesMap = new Map();
        localUpdates.forEach(g => {
          uniqueUpdatesMap.set(g.id, g);
        });
        const deduplicatedUpdates = Array.from(uniqueUpdatesMap.values());
        return res.status(200).json({ success: true, localUpdates: deduplicatedUpdates });
      }

      let errorOccured = false;

      function executeUpsert(index) {
        if (index >= serverUpserts.length) {
          if (errorOccured) {
            res.status(500).json({ error: 'Database sync upsert failed.' });
          } else {
            // Deduplicate localUpdates before returning
            const uniqueUpdatesMap = new Map();
            localUpdates.forEach(g => {
              uniqueUpdatesMap.set(g.id, g);
            });
            const deduplicatedUpdates = Array.from(uniqueUpdatesMap.values());
            res.status(200).json({ success: true, localUpdates: deduplicatedUpdates });
          }
          return;
        }

        const game = serverUpserts[index];
        db.get('SELECT id FROM games WHERE invite_code = ? AND id != ?', [game.invite_code, game.id], (codeErr, codeRow) => {
          if (codeRow) {
            game.invite_code = generateInviteCode();
          }

          db.run(
            `INSERT INTO games (id, invite_code, owner_email, name, game_state, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               game_state = excluded.game_state,
               owner_email = CASE 
                 WHEN games.owner_email IS NULL OR games.owner_email NOT LIKE '%@%' OR games.owner_email = 'commander@local' THEN excluded.owner_email 
                 ELSE games.owner_email 
               END,
               updated_at = excluded.updated_at`,
            [game.id, game.invite_code, game.owner_email, game.name, game.game_state, game.created_at, game.updated_at],
            function(err) {
              if (err) {
                console.error('Error during sync upsert:', err.message);
                errorOccured = true;
              } else {
                localUpdates.push({
                  id: game.id,
                  invite_code: game.invite_code,
                  owner_email: game.owner_email,
                  name: game.name,
                  game_state: game.game_state,
                  created_at: game.created_at,
                  updated_at: game.updated_at
                });
              }
              executeUpsert(index + 1);
            }
          );
        });
      }

      executeUpsert(0);
    });
  });
});

// Endpoint: Create a new game entry in DB
app.post('/api/games', validateCSRF, (req, res) => {
  getSessionUser(req, (err, user) => {
    const { name, game_state, setupOptions } = req.body;
    let gameName = name && typeof name === 'string' ? name.trim() : '';
    if (!gameName) {
      gameName = generateRandomGameName();
    }

    let stateToSave;
    if (setupOptions) {
      try {
        stateToSave = initializeGame(setupOptions);
      } catch (initErr) {
        console.error('Failed to initialize game on server:', initErr);
        return res.status(500).json({ error: 'Failed to initialize game state.' });
      }
    } else if (game_state) {
      stateToSave = game_state;
    } else {
      return res.status(400).json({ error: 'Missing game state or setup options.' });
    }

    const gameStateStr = typeof stateToSave === 'string' ? stateToSave : JSON.stringify(stateToSave);

    const gameId = crypto.randomUUID();

    generateUniqueInviteCode((inviteCode, codeErr) => {
      if (codeErr || !inviteCode) {
        return res.status(500).json({ error: 'Failed to generate invite code.' });
      }

      const ownerEmail = user ? user.email : null;
      const now = new Date().toISOString();
      db.run(
        'INSERT INTO games (id, invite_code, owner_email, name, game_state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [gameId, inviteCode, ownerEmail, gameName, gameStateStr, now, now],
        function (insertErr) {
          if (insertErr) {
            console.error('Error creating game:', insertErr.message);
            return res.status(500).json({ error: 'Failed to create game session.' });
          }
          res.status(201).json({
            success: true,
            gameId,
            inviteCode,
            name: gameName,
            message: 'Game simulation saved to database.'
          });
        }
      );
    });
  });
});

// Endpoint: Fetch a specific game state by ID
app.get('/api/games/:id', (req, res) => {
  getSessionUser(req, (err, user) => {
    const gameId = req.params.id;
    db.get(
      'SELECT id, invite_code, owner_email, name, game_state, created_at, updated_at FROM games WHERE id = ?',
      [gameId],
      (queryErr, row) => {
        if (queryErr) {
          console.error('Error fetching game:', queryErr.message);
          return res.status(500).json({ error: 'Database error fetching game.' });
        }
        if (!row) {
          return res.status(404).json({ error: 'Game simulation not found.' });
        }

        let parsedState;
        try {
          parsedState = JSON.parse(row.game_state);
        } catch (parseErr) {
          return res.status(500).json({ error: 'Game state corruption detected.' });
        }

        const presenceEmail = user ? user.email : (req.headers['x-guest-email'] || req.headers['x-guest-name']);
        if (presenceEmail) {
          updatePresence(gameId, presenceEmail);
        }
        const connected = getPresence(gameId);

        res.status(200).json({
          success: true,
          connectedPlayers: connected,
          game: {
            id: row.id,
            inviteCode: row.invite_code,
            ownerEmail: row.owner_email,
            name: row.name,
            gameState: parsedState,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }
        });
      }
    );
  });
});


// Endpoint: Update an existing game state by ID
app.put('/api/games/:id', validateCSRF, (req, res) => {
  getSessionUser(req, (err, user) => {
    const gameId = req.params.id;
    const { game_state, name } = req.body;
    if (game_state) {
      return res.status(403).json({ error: 'Direct state updates are restricted. All game actions must run on the server side.' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Missing name for update.' });
    }

    db.get('SELECT owner_email FROM games WHERE id = ?', [gameId], (findErr, row) => {
      if (findErr) {
        return res.status(500).json({ error: 'Database validation error.' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Game not found.' });
      }

      const now = new Date().toISOString();
      const fields = [];
      const params = [];

      if (name && typeof name === 'string' && name.trim().length > 0) {
        fields.push('name = ?');
        params.push(name.trim());
      }

      fields.push('updated_at = ?');
      params.push(now);

      // Where clause param
      params.push(gameId);

      db.run(
        `UPDATE games SET ${fields.join(', ')} WHERE id = ?`,
        params,
        function (updateErr) {
          if (updateErr) {
            console.error('Error updating game:', updateErr.message);
            return res.status(500).json({ error: 'Failed to update game.' });
          }
          const presenceEmail = user ? user.email : (req.headers['x-guest-email'] || req.headers['x-guest-name']);
          if (presenceEmail) {
            updatePresence(gameId, presenceEmail);
          }
          res.status(200).json({
            success: true,
            connectedPlayers: getPresence(gameId),
            message: 'Game updated successfully.'
          });
        }
      );
    });
  });
});

// Helper functions for turn & game resolution are imported from gameState.js

// Endpoint: Process game action securely on server side
app.post('/api/games/:id/action', validateCSRF, (req, res) => {
  getSessionUser(req, (err, user) => {
    const gameId = req.params.id;
    const { action, playerId, params } = req.body;

    if (!action || playerId === undefined) {
      return res.status(400).json({ error: 'Missing action or playerId.' });
    }

    db.get('SELECT owner_email, game_state FROM games WHERE id = ?', [gameId], (findErr, row) => {
      if (findErr) return res.status(500).json({ error: 'Database error.' });
      if (!row) return res.status(404).json({ error: 'Game not found.' });

      let gameState;
      try {
        gameState = JSON.parse(row.game_state);
      } catch (parseErr) {
        return res.status(500).json({ error: 'Game state corruption.' });
      }

      const email = user ? user.email : (req.headers['x-guest-email'] || req.headers['x-guest-name']);
      const normalizedEmail = email ? email.trim().toLowerCase() : null;

      const player = gameState.players.find(p => p.id === Number(playerId));
      if (!player) return res.status(404).json({ error: 'Player slot not found.' });

      const isOwner = !row.owner_email || (normalizedEmail && row.owner_email.trim().toLowerCase() === normalizedEmail);
      const isAssigned = normalizedEmail && player.assignedEmail && player.assignedEmail.trim().toLowerCase() === normalizedEmail;
      const isAuthorized = isAssigned || (player.isLocal && isOwner);

      // Perform action-specific validations and operations
      let result = { success: false, reason: 'Unknown action' };

      if (action === 'claim_faction') {
        if (!normalizedEmail) {
          return res.status(400).json({ error: 'Commander link identity required.' });
        }
        if (player.type === 'human') {
          // If already claimed by someone else, block
          if (player.assignedEmail && player.assignedEmail.trim().toLowerCase() !== normalizedEmail) {
            return res.status(403).json({ error: 'Faction already claimed.' });
          }
          player.assignedEmail = normalizedEmail;
          player.isLocal = true;
          result = { success: true };
        } else {
          result = { success: false, reason: 'Cannot claim non-human slot.' };
        }
      } else if (action === 'toggle_player_local') {
        const isMe = normalizedEmail && player.assignedEmail?.trim().toLowerCase() === normalizedEmail;
        if (!isOwner && !isMe) {
          return res.status(403).json({ error: 'Unauthorized to toggle local status.' });
        }
        if (player.type === 'human') {
          player.isLocal = !player.isLocal;
          result = { success: true };
        } else {
          result = { success: false, reason: 'Slot is not a human player.' };
        }
      } else if (action === 'assign_player_email') {
        if (!isOwner) {
          return res.status(403).json({ error: 'Only game owner can assign player emails.' });
        }
        if (player.type === 'human') {
          player.assignedEmail = (params && params.email) ? params.email.trim().toLowerCase() : null;
          result = { success: true };
        } else {
          result = { success: false, reason: 'Slot is not a human player.' };
        }
      } else {
        // All gameplay moves require authorization
        if (!isAuthorized) {
          return res.status(403).json({ error: 'Unauthorized command code for this faction.' });
        }

        switch (action) {
          case 'dispatch_fleet':
            result = dispatchFleet(gameState, player.id, params.sourceSysId, params.destSysId, params.shipQuantities);
            break;
          case 'recall_fleet':
            result = recallFleet(gameState, player.id, params.fleetId);
            break;
          case 'upgrade_system':
            result = upgradeSystem(gameState, player.id, params.systemId, params.upgradeType);
            break;
          case 'queue_production':
            result = queueShipProduction(gameState, player.id, params.systemId, params.shipType);
            break;
          case 'cancel_dispatch':
            result = cancelDispatch(gameState, player.id, params.fleetId);
            break;
          case 'cancel_production':
            result = cancelProduction(gameState, player.id, params.systemId, params.jobIndex);
            break;
          case 'end_turn':
            player.endedTurn = true;
            logAction(gameState, player.id, 'end_turn', 'Submitted orders / ended turn');

            if (gameState.turnStyle === 'sequential') {
              advanceSequentialTurns(gameState, runAITurn);
            } else {
              const activeHumans = gameState.players.filter(p => p.type === 'human' && !gameState.playerState[p.id].lost);
              const allEnded = activeHumans.every(p => p.endedTurn);

              if (allEnded) {
                processTurnEnd(gameState);
                gameState.players.forEach(p => {
                  if (p.type === 'ai' && !gameState.playerState[p.id].lost) {
                    runAITurn(gameState, p.id);
                  }
                });
                gameState.players.forEach(p => {
                  p.endedTurn = false;
                });
                const firstActiveHuman = gameState.players.find(p => p.type === 'human' && !gameState.playerState[p.id].lost);
                if (firstActiveHuman) {
                  gameState.activePlayerIdx = gameState.players.indexOf(firstActiveHuman);
                }
              } else {
                let nextIdx = gameState.activePlayerIdx;
                for (let i = 0; i < gameState.players.length; i++) {
                  nextIdx = (nextIdx + 1) % gameState.players.length;
                  const p = gameState.players[nextIdx];
                  if (p.type === 'human' && !gameState.playerState[p.id].lost && !p.endedTurn) {
                    gameState.activePlayerIdx = nextIdx;
                    break;
                  }
                }
              }
            }
            result = { success: true };
            break;
          case 'cancel_end_turn':
            player.endedTurn = false;
            logAction(gameState, player.id, 'cancel_end_turn', 'Resumed orders (cancelled end turn)');
            gameState.activePlayerIdx = gameState.players.indexOf(player);
            result = { success: true };
            break;
          default:
            return res.status(400).json({ error: `Unsupported action: ${action}` });
        }
      }

      if (!result.success) {
        return res.status(400).json({ error: result.reason || 'Action failed.' });
      }

      // Save updated state and return it
      const newStateStr = JSON.stringify(gameState);
      const now = new Date().toISOString();
      db.run(
        'UPDATE games SET game_state = ?, updated_at = ? WHERE id = ?',
        [newStateStr, now, gameId],
        (updateErr) => {
          if (updateErr) {
            console.error('Action state save error:', updateErr.message);
            return res.status(500).json({ error: 'Failed to save updated state.' });
          }
          const presenceEmail = user ? user.email : (req.headers['x-guest-email'] || req.headers['x-guest-name']);
          if (presenceEmail) {
            updatePresence(gameId, presenceEmail);
          }
          res.status(200).json({
            success: true,
            gameState,
            connectedPlayers: getPresence(gameId)
          });
        }
      );
    });
  });
});

// Endpoint: Heartbeat/Presence update
app.post('/api/games/:id/presence', validateCSRF, (req, res) => {
  getSessionUser(req, (err, user) => {
    const gameId = req.params.id;
    const presenceEmail = user ? user.email : (req.headers['x-guest-email'] || req.headers['x-guest-name']);
    if (presenceEmail) {
      updatePresence(gameId, presenceEmail);
    }
    res.status(200).json({
      success: true,
      connectedPlayers: getPresence(gameId)
    });
  });
});

// Endpoint: Delete (decommission) a specific game simulation
app.delete('/api/games/:id', validateCSRF, (req, res) => {
  getSessionUser(req, (err, user) => {
    const gameId = req.params.id;

    db.get('SELECT owner_email FROM games WHERE id = ?', [gameId], (findErr, row) => {
      if (findErr) {
        return res.status(500).json({ error: 'Database validation error.' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Game not found.' });
      }
      if (row.owner_email && (!user || row.owner_email !== user.email)) {
        return res.status(403).json({ error: 'Forbidden. Only the creator can decommission this simulation.' });
      }

      db.run('DELETE FROM games WHERE id = ?', [gameId], function (deleteErr) {
        if (deleteErr) {
          console.error('Error deleting game:', deleteErr.message);
          return res.status(500).json({ error: 'Failed to delete game.' });
        }
        res.status(200).json({ success: true, message: 'Game decommissioned successfully.' });
      });
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// JOIN REQUEST FLOW
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/games/:gameId/join
 * Player submits a join request for the given game.
 * One pending request per player per game is enforced (UNIQUE on game_id, email).
 * Returns the join request id and a compact base-62 token.
 */
app.post('/api/games/:gameId/join', validateCSRF, (req, res) => {
  getSessionUser(req, (err, user) => {
    const { gameId } = req.params;
    const email = user ? user.email : (req.body.email || req.headers['x-guest-email'] || req.headers['x-guest-name']);
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      return res.status(400).json({ error: 'Display name is required to join.' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Verify the game exists
    db.get('SELECT id, owner_email FROM games WHERE id = ?', [gameId], (findErr, game) => {
      if (findErr) return res.status(500).json({ error: 'Database error.' });
      if (!game) return res.status(404).json({ error: 'Game not found.' });
      if (game.owner_email && game.owner_email === normalizedEmail) {
        return res.status(400).json({ error: 'You are the host of this game.' });
      }

      // Upsert: UNIQUE(game_id, email) ON CONFLICT REPLACE resets the row
      db.run(
        `INSERT OR REPLACE INTO join_requests (game_id, email, status)
         VALUES (?, ?, 'pending')`,
        [gameId, normalizedEmail],
        function (insertErr) {
          if (insertErr) {
            console.error('join_requests insert error:', insertErr.message);
            return res.status(500).json({ error: 'Failed to submit join request.' });
          }
          const joinId = this.lastID;
          const token = encodeBase62(joinId);
          res.status(201).json({ success: true, joinId, token });
        }
      );
    });
  });
});

/**
 * GET /api/games/:gameId/join-requests
 * Host fetches all pending join requests for their game.
 */
app.get('/api/games/:gameId/join-requests', (req, res) => {
  getSessionUser(req, (err, user) => {
    const { gameId } = req.params;

    db.get('SELECT owner_email FROM games WHERE id = ?', [gameId], (findErr, game) => {
      if (findErr) return res.status(500).json({ error: 'Database error.' });
      if (!game) return res.status(404).json({ error: 'Game not found.' });
      if (game.owner_email && (!user || game.owner_email !== user.email)) {
        return res.status(403).json({ error: 'Only the game host can view join requests.' });
      }

      db.all(
        `SELECT id, email, status, created_at FROM join_requests
         WHERE game_id = ? AND status = 'pending'
         ORDER BY created_at ASC`,
        [gameId],
        (queryErr, rows) => {
          if (queryErr) return res.status(500).json({ error: 'Failed to fetch join requests.' });
          res.status(200).json({ success: true, requests: rows || [] });
        }
      );
    });
  });
});

/**
 * GET /api/games/:gameId/my-join-status
 * Player polls this to find out if their request was accepted or rejected.
 */
app.get('/api/games/:gameId/my-join-status', (req, res) => {
  getSessionUser(req, (err, user) => {
    const { gameId } = req.params;
    const email = user ? user.email : (req.query.email || req.headers['x-guest-email'] || req.headers['x-guest-name']);
    if (!email) {
      return res.status(400).json({ error: 'Email is required to check status.' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    db.get(
      `SELECT id, status FROM join_requests WHERE game_id = ? AND email = ?`,
      [gameId, normalizedEmail],
      (queryErr, row) => {
        if (queryErr) return res.status(500).json({ error: 'Database error.' });
        if (!row) return res.status(200).json({ success: true, status: null });
        res.status(200).json({ success: true, status: row.status, joinId: row.id });
      }
    );
  });
});

/**
 * POST /api/games/:gameId/assign-slot
 * Host accepts a join request and assigns the player to a faction slot.
 * Body: { joinRequestId, playerId, email }
 */
app.post('/api/games/:gameId/assign-slot', validateCSRF, (req, res) => {
  getSessionUser(req, (err, user) => {
    const { gameId } = req.params;
    const { joinRequestId, playerId, email } = req.body;

    if (!playerId || !email) {
      return res.status(400).json({ error: 'playerId and email are required.' });
    }

    db.get('SELECT owner_email, game_state FROM games WHERE id = ?', [gameId], (findErr, game) => {
      if (findErr) return res.status(500).json({ error: 'Database error.' });
      if (!game) return res.status(404).json({ error: 'Game not found.' });
      if (game.owner_email && (!user || game.owner_email !== user.email)) {
        return res.status(403).json({ error: 'Only the game host can assign slots.' });
      }

      // Verify the join request is pending (if an id is provided)
      const afterVerify = () => {
        let parsedState;
        try { parsedState = JSON.parse(game.game_state); } catch (e) {
          return res.status(500).json({ error: 'Game state corruption.' });
        }

        const player = parsedState.players.find(p => p.id === Number(playerId));
        if (!player) return res.status(404).json({ error: 'Player slot not found.' });
        if (player.assignedEmail) {
          return res.status(400).json({ error: 'That slot is already taken.' });
        }

        player.assignedEmail = email.trim().toLowerCase();
        player.isLocal = false;

        const newStateStr = JSON.stringify(parsedState);
        const now = new Date().toISOString();
        db.run(
          'UPDATE games SET game_state = ?, updated_at = ? WHERE id = ?',
          [newStateStr, now, gameId],
          (updateErr) => {
            if (updateErr) return res.status(500).json({ error: 'Failed to update game state.' });

            // Mark the join request as accepted
            if (joinRequestId) {
              db.run(
                `UPDATE join_requests SET status = 'accepted' WHERE id = ? AND game_id = ?`,
                [joinRequestId, gameId]
              );
            } else {
              // Accept by email if no specific request id given
              db.run(
                `UPDATE join_requests SET status = 'accepted' WHERE game_id = ? AND email = ?`,
                [gameId, email.trim().toLowerCase()]
              );
            }

            res.status(200).json({ success: true, message: 'Player assigned to slot successfully.' });
          }
        );
      };

      if (joinRequestId) {
        db.get(
          `SELECT status, email FROM join_requests WHERE id = ? AND game_id = ?`,
          [joinRequestId, gameId],
          (reqErr, reqRow) => {
            if (reqErr || !reqRow) return res.status(404).json({ error: 'Join request not found.' });
            if (reqRow.status !== 'pending') return res.status(400).json({ error: 'Join request is no longer pending.' });
            afterVerify();
          }
        );
      } else {
        afterVerify();
      }
    });
  });
});

/**
 * POST /api/games/:gameId/reject-join
 * Host rejects a pending join request.
 * Body: { joinRequestId }
 */
app.post('/api/games/:gameId/reject-join', validateCSRF, (req, res) => {
  getSessionUser(req, (err, user) => {
    const { gameId } = req.params;
    const { joinRequestId } = req.body;

    if (!joinRequestId) return res.status(400).json({ error: 'joinRequestId is required.' });

    db.get('SELECT owner_email FROM games WHERE id = ?', [gameId], (findErr, game) => {
      if (findErr) return res.status(500).json({ error: 'Database error.' });
      if (!game) return res.status(404).json({ error: 'Game not found.' });
      if (game.owner_email && (!user || game.owner_email !== user.email)) {
        return res.status(403).json({ error: 'Only the game host can reject join requests.' });
      }

      db.run(
        `UPDATE join_requests SET status = 'rejected' WHERE id = ? AND game_id = ? AND status = 'pending'`,
        [joinRequestId, gameId],
        function (updateErr) {
          if (updateErr) return res.status(500).json({ error: 'Failed to reject join request.' });
          if (this.changes === 0) return res.status(404).json({ error: 'Pending join request not found.' });
          res.status(200).json({ success: true, message: 'Join request rejected.' });
        }
      );
    });
  });
});

// Start Express server
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Star-Swarm auth server listening strictly on http://127.0.0.1:${PORT}`);
});
