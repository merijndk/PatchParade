# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PatchParade is a real-time multiplayer minigame system built with Phaser.js (client) and Socket.io (server). Players compete in minigames like obstacle dodging, with lobby system, countdown, gameplay, and results phases.

## Development Commands

### Server
```bash
cd server
npm install
npm run dev          # Start development server with nodemon
npm run build        # Compile TypeScript to dist/
npm start            # Run production build
npm run type-check   # Check types without emitting
```

### Client
```bash
cd client
npm install
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Build for production
npm run preview      # Preview production build
npm run type-check   # Check types without emitting
```

## Architecture

### Game State Flow
1. **Lobby Phase**: Players connect, vote for minigames, toggle ready status via LobbyManager
2. **Countdown Phase**: When all players ready, GamePhaseManager starts countdown
3. **Playing Phase**: Selected minigame starts (determined by vote tally), ObstacleManager handles spawning/collision
4. **Results Phase**: GameStateManager calculates rankings, awards points based on survival time

### Key Components

**Server (`server/src/`):**
- `GameStateManager`: Central coordinator managing players, phases, minigame lifecycle, and vote tallying
- `LobbyManager`: Handles ready states, minigame voting, vote tallying with tiebreaker logic
- `GamePhaseManager`: Manages phase transitions and countdown broadcasts
- `ObstacleManager`: Server-authoritative obstacle spawning, movement, and collision detection
- `ConfigLoader`: Loads minigame configs from `config/minigames.json`

**Client (`client/src/`):**
- `SocketManager`: Centralized Socket.io event handlers, registered in Phaser registry
- `LobbyScene`: Minigame voting UI, ready toggle, click-to-edit player names, listens for phase transitions
- `CountdownScene`: Visual countdown display
- `GameScene`: Minigame rendering, player movement, obstacle visualization
- `ResultsScene`: Rankings display with return-to-lobby button

### Socket.io Event Flow

**Lobby voting system:**
1. Server sends available minigames (including "Random" option) in `player:welcome` event
2. Players vote via `lobby:vote-minigame` event
3. Server broadcasts `lobby:vote-changed` when individual votes change
4. Server broadcasts `lobby:vote-tally` with current vote counts and winning minigame
5. When all players ready, server uses vote tally to select minigame (random selection on ties)
6. If "Random" wins, server randomly selects an actual minigame at game start

**Server-authoritative minigame:**
1. Server spawns obstacles at intervals (`minigame:obstacle-dodge:obstacle-spawn`)
2. Server updates obstacle positions at 60 FPS (`minigame:obstacle-dodge:obstacle-update`)
3. Clients send player movement (`player:move`)
4. Server checks collisions and broadcasts deaths (`minigame:obstacle-dodge:player-death`)
5. Server ends game when ≤1 player alive, sends `game:ended` with rankings

**Synchronization:**
- Clients signal `minigame:ready` when GameScene is initialized
- Server waits for all players to be ready before starting game loop (prevents desync)
- Obstacle state is fully managed server-side; clients only render positions

### Type Safety

Shared types are defined separately in `server/src/types/index.ts` and `client/src/types/index.ts`. Both define:
- `PlayerState`: Player position, color, ready status, points, alive state
- `GamePhase`: Enum for lobby/countdown/playing/results
- `MinigameInfo`: Minigame ID and display name (for voting UI)
- `ServerToClientEvents` / `ClientToServerEvents`: Socket.io event signatures including voting events
- `ObstacleState`, `MinigameConfig`, `GameResults`

### Configuration

**Server:** `.env` file with `PORT`, `NODE_ENV`, `CORS_ORIGIN`
**Client:** `.env` file with `VITE_SERVER_URL`

Both use `dotenv` package. Default server is `http://localhost:3000`, client is `http://localhost:5173`.

### Lobby Features

**Minigame Voting:**
- Players vote for which minigame to play (or "Random")
- Vote counts displayed in real-time with winning game highlighted in green
- Ties resolved by random selection
- "Random" option randomly selects an actual minigame if it wins
- Votes reset when returning to lobby after game ends

**Player Name Editing:**
- Click on your own name in the player list to edit it
- Type new name, press Enter to confirm or Escape to cancel
- Editing state shows blinking cursor (_)
- Hover over your name shows cyan color to indicate it's clickable

### Adding New Minigames

1. Add config to `server/src/config/minigames.json` (will automatically appear in voting UI)
2. Create manager class similar to `ObstacleManager` (spawn logic, collision detection)
3. Update `GameStateManager.startMinigame()` to instantiate your manager
4. Add minigame-specific socket events to `types/index.ts` (both server and client)
5. Create client scene or extend `GameScene` to render minigame elements
6. Update `SocketManager` with new event listeners for minigame-specific events

## Notes

- Server is authoritative for all game logic (collision detection, scoring)
- Player movement is client-predicted but server validates positions via clamping
- Scene transitions use Phaser's scene.start() with data passing (e.g., results object)
- SocketManager instance is stored in Phaser registry and reused across scenes
- Use `removeAllListeners()` in scene shutdown to prevent memory leaks
- Don't run the server after changes, I will do it myself