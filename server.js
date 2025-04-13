const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let gameState = {
  countdown: 15,
  bets: []
};

// Serve file frontend
app.use(express.static(path.join(__dirname, 'public')));

// Socket.IO logic
io.on('connection', (socket) => {
  console.log('User connected');

  socket.emit('gameState', gameState);

  socket.on('placeBet', (bet) => {
    gameState.bets.push(bet);
    io.emit('betPlaced', bet);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Countdown timer
setInterval(() => {
  gameState.countdown--;

  io.emit('countdown', gameState.countdown);

  if (gameState.countdown <= 0) {
    const result = Math.floor(Math.random() * 37);
    io.emit('spinResult', result);
    gameState.bets = [];
    gameState.countdown = 15;
  }
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
