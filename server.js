const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(__dirname));

// Store active users by room
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  let currentRoom = null;
  let currentUser = null;

  // User joins a room
  socket.on('join-room', (data) => {
    const { roomId, user } = data;

    console.log(`User ${user.name} (${user.id}) joining room ${roomId}`);

    // Leave previous room if in one
    if (currentRoom) {
      socket.leave(currentRoom);
      removeUserFromRoom(currentRoom, socket.id);
    }

    // Join new room
    socket.join(roomId);
    currentRoom = roomId;
    currentUser = user;

    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }

    const room = rooms.get(roomId);
    room.set(socket.id, user);

    // Send current room state to the new user
    const existingUsers = Array.from(room.values()).filter(u => u.id !== user.id);
    socket.emit('room-state', { users: existingUsers });

    // Notify others in the room about the new user
    socket.to(roomId).emit('user-joined', user);

    console.log(`Room ${roomId} now has ${room.size} users`);
  });

  // User updates their position
  socket.on('update-position', (data) => {
    if (!currentRoom || !currentUser) return;

    const { x, y } = data;

    // Update stored user data
    const room = rooms.get(currentRoom);
    if (room && room.has(socket.id)) {
      const user = room.get(socket.id);
      user.x = x;
      user.y = y;

      // Broadcast to others in the room
      socket.to(currentRoom).emit('user-moved', {
        userId: currentUser.id,
        x,
        y
      });
    }
  });

  // User updates their state (muted, speaking, megaphone, etc.)
  socket.on('update-state', (data) => {
    if (!currentRoom || !currentUser) return;

    const room = rooms.get(currentRoom);
    if (room && room.has(socket.id)) {
      const user = room.get(socket.id);

      // Update user state
      if (data.isMuted !== undefined) user.isMuted = data.isMuted;
      if (data.isSpeaking !== undefined) user.isSpeaking = data.isSpeaking;
      if (data.megaphoneActive !== undefined) user.megaphoneActive = data.megaphoneActive;

      // Broadcast to others in the room
      socket.to(currentRoom).emit('user-state-changed', {
        userId: currentUser.id,
        ...data
      });
    }
  });

  // WebRTC signaling - route messages to specific users
  socket.on('webrtc-offer', (data) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    // Find the target user's socket ID
    for (const [socketId, user] of room.entries()) {
      if (user.id === data.to) {
        io.to(socketId).emit('webrtc-offer', {
          from: currentUser.id,
          offer: data.offer
        });
        break;
      }
    }
  });

  socket.on('webrtc-answer', (data) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    for (const [socketId, user] of room.entries()) {
      if (user.id === data.to) {
        io.to(socketId).emit('webrtc-answer', {
          from: currentUser.id,
          answer: data.answer
        });
        break;
      }
    }
  });

  socket.on('webrtc-ice-candidate', (data) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    for (const [socketId, user] of room.entries()) {
      if (user.id === data.to) {
        io.to(socketId).emit('webrtc-ice-candidate', {
          from: currentUser.id,
          candidate: data.candidate
        });
        break;
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    if (currentRoom && currentUser) {
      removeUserFromRoom(currentRoom, socket.id);

      // Notify others in the room
      socket.to(currentRoom).emit('user-left', currentUser.id);

      console.log(`User ${currentUser.name} left room ${currentRoom}`);
    }
  });
});

function removeUserFromRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  if (room) {
    room.delete(socketId);

    // Clean up empty rooms
    if (room.size === 0) {
      rooms.delete(roomId);
      console.log(`Room ${roomId} is now empty and removed`);
    }
  }
}

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('WebSocket server ready for connections');
});
