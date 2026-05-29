# Star-Swarm: Tactical Grid Space Conquest

Star-Swarm is a premium browser-based turn-based tactical space strategy game. Control production systems, build fleets, manage tech trees, and conquer the galaxy. Play in skirmish mode against simulated AI or in local pass-and-play hotseat multiplayer.

## Key Features

- **Interactive Canvas Star Map**: Smooth mouse/trackpad panning and mouse wheel zoom, featuring vector travel tracking lines, sensor range rings, and fog of war.
- **Deep Economic & Production Systems**: Manage shipyards, queue ships (Fighters, Corvettes, Destroyers, Cruisers), upgrade systems, and customize production clusters.
- **Secrecy Gate for Hotseat Multiplayer**: Screen lockdown and secrecy gates that hide sensor layouts and system statistics between turns to prevent screen-peeping during hotseat matches.
- **Simulated AI Factions**: Automated skirmish opponents with intelligent expansion, system upgrades, and tactical fleet dispatches.
- **Sci-Fi Glassmorphic UI**: Premium retro-futuristic telemetry panels, real-time alerts, system dashboards, and diagnostic logs built with outfit typography.
- **Playwright Test Suite**: End-to-end integration tests that validate lobby configuration, Turn/HUD loops, AI progression, and rendering.

---

## Tech Stack & Architecture

- **Core**: React, TypeScript, HTML5 Canvas, and custom modern CSS styling.
- **Icons**: Lucide React.
- **Build Tool**: Vite.
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
