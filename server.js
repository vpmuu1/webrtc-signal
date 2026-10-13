const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);

// 允许所有来源跨域（测试用，生产可收紧）
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 健康检查（Render 需要）
app.get('/', (req, res) => {
  res.send('WebRTC Signaling Server is running ✅');
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // 加入房间
  socket.on('join', (roomId) => {
    socket.join(roomId);
    console.log(`${socket.id} joined room: ${roomId}`);

    // 通知房间里其他人：有人加入了
    socket.to(roomId).emit('peer-joined', { peerId: socket.id });

    // 告诉新加入的人：房间里已有哪些人
    const clients = io.sockets.adapter.rooms.get(roomId);
    if (clients) {
      const others = [...clients].filter(id => id !== socket.id);
      socket.emit('peers-in-room', { peers: others });
    }
  });

  // 转发信令消息（offer / answer / ice-candidate）
  // 前端发送格式：{ roomId, type, data, to? }
  socket.on('signal', ({ roomId, type, data, to }) => {
    if (to) {
      // 定向发给某个 peer
      io.to(to).emit('signal', {
        from: socket.id,
        type,
        data
      });
    } else {
      // 广播给房间里其他人
      socket.to(roomId).emit('signal', {
        from: socket.id,
        type,
        data
      });
    }
  });

  // 离开房间 / 断开
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Socket.io 会自动从房间移除，这里可选通知其他人
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
