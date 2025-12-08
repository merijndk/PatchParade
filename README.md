# PatchParade

A real-time multiplayer game built with Phaser.js and Socket.io. Players can move around and see other players in real-time.

## Project Structure

This repository contains two separate projects:

- **client/** - Phaser.js web client with Vite bundler
- **server/** - Node.js Socket.io server with Express

## Tech Stack

- **Language**: TypeScript
- **Client**: Phaser.js 3 + Vite + Socket.io Client
- **Server**: Express + Socket.io + TypeScript
- **Real-time Communication**: Socket.io

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher recommended)
- npm

### Server Setup

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file (copy from `.env` example if provided):
   ```bash
   PORT=3000
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:5173
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

   The server will run on `http://localhost:3000`

### Client Setup

1. Navigate to the client directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file (copy from `.env` example if provided):
   ```bash
   VITE_SERVER_URL=http://localhost:3000
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

   The client will open in your browser at `http://localhost:5173`

## How to Play

- **Movement**: Use WASD or Arrow keys to move your player
- **Multiplayer**: Open multiple browser tabs/windows to see real-time multiplayer in action
- Each player is represented as a colored circle
- Players spawn at random positions when they connect

## Development Workflow

1. **Terminal 1** - Start the server:
   ```bash
   cd server
   npm run dev
   ```

2. **Terminal 2** - Start the client:
   ```bash
   cd client
   npm run dev
   ```

3. **Browser** - Open `http://localhost:5173` in multiple tabs/windows to test multiplayer

## Production Build

### Build Server

```bash
cd server
npm run build
npm start
```

The built files will be in `server/dist/`

### Build Client

```bash
cd client
npm run build
```

The built files will be in `client/dist/` and can be deployed to any static hosting service (Netlify, Vercel, etc.)

## Architecture

### Socket.io Events

**Client → Server:**
- `player:move` - Send player position updates

**Server → Client:**
- `player:welcome` - Initial connection with player ID and all existing players
- `player:joined` - New player joined the game
- `player:left` - Player disconnected
- `player:moved` - Another player moved

### Game Flow

1. Client connects to server
2. Server assigns unique ID and random spawn position/color
3. Server sends all existing players to the new client
4. Client renders all players as circles
5. When player moves (WASD/Arrows), position updates are sent to server
6. Server broadcasts position to all other clients
7. All clients update the moving player's position in real-time

## License

MIT
