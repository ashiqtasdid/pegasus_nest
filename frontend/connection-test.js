const io = require('socket.io-client');

console.log('🔌 Testing WebSocket connection...');

const socket = io('http://localhost:3000/agent-feedback', {
  timeout: 5000,
  forceNew: true,
});

socket.on('connect', () => {
  console.log('✅ Connected successfully! Socket ID:', socket.id);
  socket.disconnect();
  process.exit(0);
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection failed:', error.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('⏰ Connection timeout');
  process.exit(1);
}, 6000);
