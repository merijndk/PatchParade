import dotenv from 'dotenv';
import { httpServer, io } from './server.js';
import { GameStateManager } from './game/GameStateManager.js';
import { generatePlayerName } from './utils/NameGenerator.js';

dotenv.config();

const gameState = new GameStateManager(io);
const PORT = process.env.PORT || 3000;

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Create player with random name
  const newPlayer = gameState.addPlayer(socket.id);
  newPlayer.name = generatePlayerName();

  const allPlayers = gameState.getAllPlayers();

  socket.emit('player:welcome', {
    playerId: socket.id,
    players: allPlayers,
    availableMinigames: gameState.getAvailableMinigames(),
  });

  socket.broadcast.emit('player:joined', newPlayer);

  socket.on('player:move', (position) => {
    gameState.updatePlayerPosition(socket.id, position.x, position.y);

    socket.broadcast.emit('player:moved', {
      id: socket.id,
      x: position.x,
      y: position.y,
    });
  });

  socket.on('player:change-name', (name) => {
    gameState.changePlayerName(socket.id, name);
  });

  // NEW: Lobby ready toggle
  socket.on('lobby:toggle-ready', () => {
    gameState.togglePlayerReady(socket.id);
  });

  // NEW: Vote for minigame
  socket.on('lobby:vote-minigame', (minigameId) => {
    gameState.voteForMinigame(socket.id, minigameId);
  });

  // NEW: Request current lobby state
  socket.on('lobby:request-state', () => {
    const allPlayers = gameState.getAllPlayers();
    socket.emit('lobby:state-sync', allPlayers);
  });

  // NEW: Return to lobby from results (placeholder for future)
  socket.on('results:return-to-lobby', () => {
    gameState.returnToLobby();
  });

  // Minigame ready signal from client
  socket.on('minigame:ready', () => {
    console.log(`Received minigame:ready from player ${socket.id}`);
    gameState.onMinigameReady(socket.id);
  });

  // Bumper Balls specific events
  socket.on('minigame:bumper-balls:dash', () => {
    const result = gameState.activateDash(socket.id);
    if (result.success) {
      io.emit('minigame:bumper-balls:dash-activated', {
        playerId: socket.id,
        dirX: result.dirX!,
        dirY: result.dirY!
      });
    }
  });

  socket.on('minigame:bumper-balls:input', (data) => {
    gameState.updateBumperBallsInput(socket.id, data.dirX, data.dirY);
  });

  // Mining Madness specific events
  socket.on('minigame:mining-madness:start-mining', (rockId) => {
    if (gameState.startMining(socket.id, rockId)) {
      // Start monitoring mining progress
      const progressInterval = setInterval(() => {
        if (gameState.isPlayerMining(socket.id, rockId)) {
          gameState.updateMiningProgress(rockId, socket.id);
        } else {
          clearInterval(progressInterval);
        }
      }, 100); // Update every 100ms
    }
  });

  socket.on('minigame:mining-madness:stop-mining', (rockId) => {
    gameState.stopMining(rockId, socket.id);
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    gameState.removePlayer(socket.id);

    io.emit('player:left', socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Lobby system ready - waiting for players...');
});
