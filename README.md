# Star-Swarm: Tactical Grid Space Conquest

Star-Swarm is a premium browser-based turn-based tactical space strategy game. Control production systems, build fleets, manage tech trees, and conquer the galaxy. Play in skirmish mode against simulated AI or in local pass-and-play hotseat multiplayer.

## Key Features

- **Interactive Canvas Star Map**: Smooth mouse/trackpad panning and mouse wheel zoom, featuring vector travel tracking lines, sensor range rings, and fog of war.
- **Deep Economic & Production Systems**: Manage shipyards, queue ships (Fighters, Corvettes, Destroyers, Cruisers), upgrade systems, and customize production clusters.
- **Flexible Setup Lobby**: Configure 2 to 8 players, customize names and teams, and choose between Human or AI controllers with smart map parameter recommendations. Support Turn Resolution Styles (Sequential vs Simultaneous) and manage remote player slot requests directly.
- **Custom Game Modes & Rulesets**: Design custom galaxy rulesets (toggling credits, upgrades, neutral starship ranges, automated production) or choose Simple Mode for direct node production with custom ship definition attributes.
- **Database Game Persistence**: Matches are saved directly to the database. Resume your active games at any time, with turns, fleets, and ship queues fully preserved.
- **URL-Based Resuming & Sharing**: Every match has a dedicated URL query param (`?gameId=UUID` or shortened invite code), enabling you to bookmark your sessions or share the link to load the same game elsewhere.
- **Persistent User Accounts**: Secure server-side registration and authentication via SQLite database storage and password hashing.
- **Integrated Google Sign-in**: Simulated OAuth account selector that links Gmail accounts automatically and tracks career victory telemetry.
- **Secrecy Gate for Hotseat Multiplayer**: Screen lockdown and secrecy gates that hide sensor layouts and system statistics between turns to prevent screen-peeping during hotseat matches.
- **Simulated AI Factions**: Automated skirmish opponents with intelligent expansion, system upgrades, and tactical fleet dispatches.
- **Commander Profiles & Turn Recovery**: Customize global display names in the settings panel and rename factions mid-game. Instantly cancel accidentally ended turns from local/remote waiting screens or directly from the Concourse home screen.
- **Sci-Fi Glassmorphic UI**: Premium retro-futuristic telemetry panels, real-time alerts, system dashboards, and diagnostic logs built with outfit typography.
- **Playwright Test Suite**: End-to-end integration tests that validate lobby configuration, Turn/HUD loops, AI progression, and rendering.

---

## Tech Stack & Architecture

- **Frontend**: React, TypeScript, HTML5 Canvas, and custom modern CSS styling.
- **Backend API**: Node.js Express server running concurrently on `127.0.0.1:3001`.
- **Database**: SQLite database (`starswarm.db`) managing persistent accounts and session linkage.
- **Security**: Server-side `bcryptjs` password encryption and double-submit CSRF cookie checks.
- **Icons**: Lucide React.
- **Build Tool**: Vite with local development proxying and isolated cache caching.
- **Port Customization**: Configured to listen on custom ports via the `PORT` environment variable (default: `8080`).

---

## Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```
   *To run on a custom port:*
   ```bash
   PORT=9000 npm run dev
   ```

3. **Build Production Assets**:
   ```bash
   npm run build
   ```

4. **Run End-to-End Tests**:
   ```bash
   npx playwright test
   ```
