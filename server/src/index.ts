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

  // NEW: Lobby ready toggle
  socket.on('lobby:toggle-ready', () => {
    gameState.togglePlayerReady(socket.id);
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
