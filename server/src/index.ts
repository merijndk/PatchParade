import dotenv from 'dotenv';
import { httpServer, io } from './server.js';
import { GameState } from './game/GameState.js';

dotenv.config();

const gameState = new GameState();
const PORT = process.env.PORT || 3000;

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  const newPlayer = gameState.addPlayer(socket.id);
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

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    gameState.removePlayer(socket.id);

    io.emit('player:left', socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
