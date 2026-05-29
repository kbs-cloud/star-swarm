# Changelog

## New Features
- **Configurable Factions**: You can now customize the number of players (from 2 to 8) in the lobby.
- **Controller Type Assignment**: Factions can be customized as Human players or AI controllers in both hotseat and skirmish modes.
- **Dynamic Faction Customization**: Custom names and team configurations can be set in the lobby.
- **Secure Commands Link**: You can register and log in to a commander account using an email and password.
- **Google Sign-In**: You can connect and sign in directly using Google credentials.
- **Account Linking**: Signing in with Google automatically links to your registered email account even if you set a password earlier.
- **Commander Record Telemetry**: Your win/loss statistics are recorded and displayed in the main menu profile widget.

## Bug Fixes
- **Vite Cache Access**: Fixed a startup error related to root-owned cache folders by redirecting the developer cache.
- **CommonJS Module Loading**: Renamed the server entry point to resolve Node.js ES module scope conflicts.

## Changes
- **Smart Parameter Suggestions**: Slider values for map size and cluster bases are automatically adjusted to optimal recommendations when changing player count.
- **Dynamic Theme Coloring**: Game systems and moving fleets on the star map reflect your selected player colors.
