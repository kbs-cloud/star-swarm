// Star-Swarm Express Backend & SQLite Database Server
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.BACKEND_PORT || process.env.PORT || 3001;

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Enable CORS for frontend proxy / local testing origins
app.use(cors({
  origin: ['http://localhost:8080', 'http://127.0.0.1:8080'],
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

// CSRF Handshake endpoint (Initializes CSRF cookies on SPA mount)
app.get('/api/csrf-init', (req, res) => {
  let csrfToken = req.cookies['csrf_token'];
  if (!csrfToken) {
    csrfToken = crypto.randomBytes(24).toString('hex');
    // Set a non-HttpOnly cookie so the JS client can read it to submit in headers
    res.cookie('csrf_token', csrfToken, {
      path: '/',
      sameSite: 'lax',
      // TODO(security): Set secure: true in production HTTPS
      secure: false
    });
  }
  res.status(200).json({ success: true });
});

// Middleware to validate CSRF token on state-changing requests
function validateCSRF(req, res, next) {
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
  const sessionId = req.cookies['session_id'];
  if (!sessionId) {
    return callback(null, null);
  }

  const now = new Date().toISOString();
  db.get(
    `SELECT s.csrf_token, u.email, u.display_name, u.is_google_linked, u.games_played, u.games_won 
     FROM sessions s 
     JOIN users u ON s.email = u.email 
     WHERE s.id = ? AND s.expires_at > ?`,
    [sessionId, now],
    (err, row) => {
      if (err || !row) {
        return callback(null, null);
      }
      callback(null, row);
    }
  );
}

// In-memory presence store
// Key: gameId, Value: Array of { email, lastSeen }
const gamePresence = new Map();

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

// Endpoint: Register new user
app.post('/api/register', validateCSRF, (req, res) => {
  const { email, password } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = bcrypt.hashSync(password, 10);

  db.run(
    'INSERT INTO users (email, password_hash, is_google_linked) VALUES (?, ?, 0)',
    [normalizedEmail, passwordHash],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'An account with this email already exists.' });
        }
        return res.status(500).json({ error: 'Database registration error.' });
      }
      res.status(201).json({ success: true, message: 'Account registered successfully.' });
    }
  );
});

// Endpoint: Traditional login
app.post('/api/login', validateCSRF, (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  db.get('SELECT * FROM users WHERE email = ?', [normalizedEmail], (err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: 'Account not found. Please register first.' });
    }

    if (!user.password_hash) {
      return res.status(400).json({ 
        error: 'This account was created with Google Sign-in. Please click "Sign in with Google" to access it.' 
      });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect password.' });
    }

    // Create session
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours expiration
    const csrfToken = req.cookies['csrf_token'] || crypto.randomBytes(24).toString('hex');

    db.run(
      'INSERT INTO sessions (id, email, expires_at, csrf_token) VALUES (?, ?, ?, ?)',
      [sessionId, normalizedEmail, expiresAt, csrfToken],
      (sessionErr) => {
        if (sessionErr) {
          return res.status(500).json({ error: 'Failed to create active session.' });
        }

        // Set HttpOnly cookie
        res.cookie('session_id', sessionId, {
          httpOnly: true,
          sameSite: 'lax',
          // TODO(security): Set secure: true in production HTTPS
          secure: false,
          maxAge: 2 * 60 * 60 * 1000 // 2 hours
        });

        res.status(200).json({
          success: true,
          user: {
            email: user.email,
            displayName: user.display_name || null,
            isGoogleLinked: user.is_google_linked === 1,
            stats: { gamesPlayed: user.games_played, gamesWon: user.games_won }
          }
        });
      }
    );
  });
});

// Endpoint: Google login (Simulated OAuth integration)
app.post('/api/google-login', validateCSRF, (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid Google account email.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Find or create user
  db.get('SELECT * FROM users WHERE email = ?', [normalizedEmail], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database query error.' });
    }

    if (user) {
      // User exists. Update is_google_linked if not already set.
      if (user.is_google_linked === 0) {
        db.run('UPDATE users SET is_google_linked = 1 WHERE email = ?', [normalizedEmail]);
      }
      createAndSendSession(user.email, user.games_played, user.games_won, 1, user.display_name);
    } else {
      // User does not exist, auto-create
      db.run(
        'INSERT INTO users (email, password_hash, is_google_linked) VALUES (?, NULL, 1)',
        [normalizedEmail],
        function (insertErr) {
          if (insertErr) {
            return res.status(500).json({ error: 'Failed to auto-register Google account.' });
          }
          createAndSendSession(normalizedEmail, 0, 0, 1, null);
        }
      );
    }
  });

  function createAndSendSession(userEmail, gamesPlayed, gamesWon, isGoogleLinked, displayName) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const csrfToken = req.cookies['csrf_token'] || crypto.randomBytes(24).toString('hex');

    db.run(
      'INSERT INTO sessions (id, email, expires_at, csrf_token) VALUES (?, ?, ?, ?)',
      [sessionId, userEmail, expiresAt, csrfToken],
      (sessionErr) => {
        if (sessionErr) {
          return res.status(500).json({ error: 'Failed to create active session.' });
        }

        res.cookie('session_id', sessionId, {
          httpOnly: true,
          sameSite: 'lax',
          secure: false,
          maxAge: 2 * 60 * 60 * 1000
        });

        res.status(200).json({
          success: true,
          user: {
            email: userEmail,
            displayName: displayName || null,
            isGoogleLinked: isGoogleLinked === 1,
            stats: { gamesPlayed, gamesWon }
          }
        });
      }
    );
  }
});

// Endpoint: Get current user session details
app.get('/api/me', (req, res) => {
  getSessionUser(req, (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Unauthorized. No active session.' });
    }
    res.status(200).json({
      success: true,
      user: {
        email: user.email,
        displayName: user.display_name || null,
        isGoogleLinked: user.is_google_linked === 1,
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
    if (err || !user) {
      return res.status(401).json({ error: 'Unauthorized. Please log in first.' });
    }

    const { search, status, startDate, endDate, turns, limit, offset } = req.query;

    db.all(
      'SELECT id, invite_code, owner_email, name, game_state, created_at, updated_at FROM games WHERE owner_email = ? OR game_state LIKE ? ORDER BY updated_at DESC',
      [user.email, '%"assignedEmail":"' + user.email + '"%'],
      (queryErr, rows) => {
        if (queryErr) {
          console.error('Error fetching games:', queryErr.message);
          return res.status(500).json({ error: 'Failed to fetch saved games.' });
        }

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
            const turnStatus = getGameTurnStatus(parsedState, row.owner_email, user.email);
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
    );
  });
});

// Endpoint: Create a new game entry in DB
app.post('/api/games', validateCSRF, (req, res) => {
  getSessionUser(req, (err, user) => {
    const { name, game_state } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid game name.' });
    }
    if (!game_state) {
      return res.status(400).json({ error: 'Missing game state.' });
    }
    const gameStateStr = typeof game_state === 'string' ? game_state : JSON.stringify(game_state);
    
    const gameId = crypto.randomUUID();
    
    generateUniqueInviteCode((inviteCode, codeErr) => {
      if (codeErr || !inviteCode) {
        return res.status(500).json({ error: 'Failed to generate invite code.' });
      }
      
      const ownerEmail = user ? user.email : null;
      db.run(
        'INSERT INTO games (id, invite_code, owner_email, name, game_state) VALUES (?, ?, ?, ?, ?)',
        [gameId, inviteCode, ownerEmail, name.trim(), gameStateStr],
        function (insertErr) {
          if (insertErr) {
            console.error('Error creating game:', insertErr.message);
            return res.status(500).json({ error: 'Failed to create game session.' });
          }
          res.status(201).json({
            success: true,
            gameId,
            inviteCode,
            name: name.trim(),
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
    const { game_state } = req.body;
    if (!game_state) {
      return res.status(400).json({ error: 'Missing game state for update.' });
    }
    const gameStateStr = typeof game_state === 'string' ? game_state : JSON.stringify(game_state);
    
      db.get('SELECT owner_email FROM games WHERE id = ?', [gameId], (findErr, row) => {
        if (findErr) {
          return res.status(500).json({ error: 'Database validation error.' });
        }
        if (!row) {
          return res.status(404).json({ error: 'Game not found.' });
        }
        
        const now = new Date().toISOString();
      db.run(
        'UPDATE games SET game_state = ?, updated_at = ? WHERE id = ?',
        [gameStateStr, now, gameId],
        function (updateErr) {
          if (updateErr) {
            console.error('Error updating game:', updateErr.message);
            return res.status(500).json({ error: 'Failed to update game state.' });
          }
          const presenceEmail = user ? user.email : (req.headers['x-guest-email'] || req.headers['x-guest-name']);
          if (presenceEmail) {
            updatePresence(gameId, presenceEmail);
          }
          res.status(200).json({
            success: true,
            connectedPlayers: getPresence(gameId),
            message: 'Game state updated successfully.'
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
