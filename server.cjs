// Star-Swarm Express Backend & SQLite Database Server
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

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
    `SELECT s.csrf_token, u.email, u.is_google_linked, u.games_played, u.games_won 
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
      createAndSendSession(user.email, user.games_played, user.games_won, 1);
    } else {
      // User does not exist, auto-create
      db.run(
        'INSERT INTO users (email, password_hash, is_google_linked) VALUES (?, NULL, 1)',
        [normalizedEmail],
        function (insertErr) {
          if (insertErr) {
            return res.status(500).json({ error: 'Failed to auto-register Google account.' });
          }
          createAndSendSession(normalizedEmail, 0, 0, 1);
        }
      );
    }
  });

  function createAndSendSession(userEmail, gamesPlayed, gamesWon, isGoogleLinked) {
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
        isGoogleLinked: user.is_google_linked === 1,
        stats: { gamesPlayed: user.games_played, gamesWon: user.games_won }
      }
    });
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

// Start Express server
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Star-Swarm auth server listening strictly on http://127.0.0.1:${PORT}`);
});
