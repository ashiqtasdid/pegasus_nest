# 🤖 Agent Feedback Dashboard

A real-time, VS Code-inspired frontend interface for monitoring Minecraft plugin generation using intelligent agents. This dashboard provides live progress tracking, detailed phase monitoring, and interactive feedback during the multi-agent orchestration process.

## ✨ Features

### 🔄 Real-time Progress Tracking

- **Live WebSocket Connection**: Instant updates from the agent orchestration system
- **Phase-by-Phase Monitoring**: Track all 6 phases of plugin creation (Analysis, Optimization, Generation, Quality, Compilation, Assessment)
- **Weighted Progress Calculation**: Accurate progress estimation based on phase complexity
- **Estimated Time Remaining**: Dynamic time predictions based on current performance

### 🎯 VS Code-Inspired Interface

- **Dark Theme**: Professional VS Code-like appearance with syntax highlighting colors
- **Progress Bars**: Animated progress indicators with shimmer effects
- **Status Indicators**: Real-time connection status and phase completion states
- **Task-Level Tracking**: Granular visibility into individual agent tasks

### 📊 Advanced Monitoring

- **Agent Performance Metrics**: Track individual agent efficiency and task completion
- **Activity Log**: Comprehensive logging with timestamps and categorized messages
- **Error Handling**: Detailed error reporting with retry mechanisms
- **Session Management**: Track multiple plugin creation sessions

### 🚀 Interactive Experience

- **Form Validation**: Client-side validation with helpful error messages
- **Toast Notifications**: Non-intrusive success and error notifications
- **Responsive Design**: Mobile-friendly layout that adapts to any screen size
- **Keyboard Shortcuts**: Quick actions for power users

## 🏗️ Architecture

### Frontend Components

```
frontend/
├── index.html          # Main HTML structure
├── styles.css          # VS Code-inspired styling
├── script.js           # WebSocket client & UI logic
└── README.md           # This documentation
```

### WebSocket Integration

- **Namespace**: `/agent-feedback`
- **Events**: `agent-progress`, `agent-task`, `agent-error`, `agent-complete`
- **Session Management**: Subscribe/unsubscribe to specific plugin creation sessions

### Backend Integration

- **REST API**: Plugin creation endpoint (`/create/plugin`)
- **Real-time Updates**: WebSocket events from `AgentFeedbackGateway`
- **Session Tracking**: Synchronized with backend session management

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- A running Pegasus Nest backend server
- Modern web browser with WebSocket support

### Option 1: Simple HTTP Server (Recommended)

```powershell
# Navigate to frontend directory
cd e:\Codespace\pegasus_nest\frontend

# Start simple HTTP server (Python)
python -m http.server 8080

# Or using Node.js
npx serve . -p 8080

# Or using live-server for development
npx live-server --port=8080
```

### Option 2: Integration with Backend

Add the following to your NestJS app to serve static files:

```typescript
// In main.ts
app.useStaticAssets(join(__dirname, '..', 'frontend'), {
  prefix: '/dashboard/',
});
```

### Access the Dashboard

- **Standalone**: http://localhost:8080
- **Integrated**: http://localhost:3000/dashboard

## 📖 Usage Guide

### 1. Plugin Creation

1. **Enter User ID**: Your unique identifier for plugin storage
2. **Describe Plugin**: Detailed description of the Minecraft plugin you want
3. **Select Accuracy**: Choose between High, Maximum, or Ultra accuracy levels
4. **Click Create**: Initiates the agent orchestration process

### 2. Real-time Monitoring

- **Overall Progress**: Watch the main progress bar fill as phases complete
- **Phase Details**: Monitor individual phases with task-level granularity
- **Current Activity**: See exactly what the agents are working on right now
- **Agent Performance**: Track which agents are performing best

### 3. Activity Log

- **Timestamped Entries**: Every action is logged with precise timestamps
- **Categorized Messages**: Info, Success, Warning, and Error levels
- **Searchable History**: Scroll through the complete creation process
- **Export Capability**: Copy logs for debugging or analysis

### 4. Results & Download

- **Success Metrics**: View quality scores, compilation results, and performance stats
- **File Listing**: See all generated plugin files
- **Download Options**: Get your completed plugin as a ZIP file
- **Start New**: Quickly reset for another plugin creation

## 🔧 Configuration

### WebSocket Settings

```javascript
// In script.js - modify connection settings
this.socket = io('/agent-feedback', {
  transports: ['websocket'],
  timeout: 10000,
  forceNew: true,
});
```

### API Endpoints

```javascript
// Backend URL configuration
const API_BASE = 'http://localhost:3000'; // Adjust as needed
const CREATE_ENDPOINT = `${API_BASE}/create/plugin`;
```

### Theme Customization

Modify CSS variables in `styles.css`:

```css
:root {
  --bg-primary: #1e1e1e; /* Main background */
  --accent-primary: #007acc; /* Primary accent color */
  --success-color: #4ec9b0; /* Success indicators */
  --error-color: #f44747; /* Error indicators */
  /* ... more variables */
}
```

## 🎨 Customization

### Adding New Phases

1. **Backend**: Add phase to `AgentFeedbackSession` interface
2. **Frontend HTML**: Add new phase item in `index.html`
3. **Frontend JS**: Update phase handling in `script.js`
4. **CSS**: Add phase-specific styling if needed

### Custom Metrics

```javascript
// In script.js - modify getMetricClass() and formatMetricValue()
getMetricClass(key, value) {
    if (key === 'customMetric') return 'custom';
    // ... existing logic
}
```

### Additional Event Types

```javascript
// In script.js - add new WebSocket event handlers
this.socket.on('custom-event', (data) => this.handleCustomEvent(data));
```

## 🐛 Troubleshooting

### Connection Issues

1. **Check Backend**: Ensure Pegasus Nest server is running on correct port
2. **CORS Settings**: Verify WebSocket CORS configuration allows frontend origin
3. **Network**: Check firewall settings aren't blocking WebSocket connections

### Missing Progress Updates

1. **Session ID**: Verify frontend receives correct session ID from backend
2. **Subscription**: Check WebSocket subscription to session is successful
3. **Event Emission**: Verify backend is emitting progress events correctly

### Performance Issues

1. **Logging**: Reduce log verbosity by filtering message types
2. **DOM Updates**: Batch DOM updates for better performance
3. **Memory**: Clear old sessions to prevent memory leaks

### Common Error Messages

- **"Not connected to server"**: WebSocket connection failed
- **"Session not found"**: Backend session expired or invalid
- **"Plugin creation failed"**: Check backend logs for detailed error

## 🧪 Development

### Local Development Setup

```powershell
# Install development dependencies
npm install -g live-server

# Start with auto-reload
live-server --port=8080 --open=index.html
```

### Testing WebSocket Events

```javascript
// In browser console - simulate events
agentClient.handleProgressUpdate({
  sessionId: 'test-session',
  phase: 'generation',
  progress: 75,
  message: 'Generating main plugin class...',
});
```

### Browser DevTools

- **Network Tab**: Monitor WebSocket connection and messages
- **Console**: View detailed logging and error messages
- **Elements**: Inspect DOM updates and CSS animations

## 🔮 Future Enhancements

### Planned Features

- **🎵 Audio Notifications**: Sound alerts for completion/errors
- **📱 Mobile App**: React Native companion app
- **🔍 Search & Filter**: Advanced log filtering and search
- **📊 Analytics Dashboard**: Historical performance metrics
- **🎨 Theme Selector**: Multiple color themes and customization
- **💾 Session Persistence**: Save and resume sessions across browser restarts

### Integration Possibilities

- **📧 Email Notifications**: Send completion emails
- **🔔 Push Notifications**: Browser push for background updates
- **📈 Grafana Integration**: Advanced metrics visualization
- **🤖 Discord Bot**: Plugin creation status in Discord
- **📱 Slack Integration**: Team notifications

## 🛡️ Security Considerations

### Input Validation

- Client-side validation is implemented but **never trusted**
- Server-side validation is the authoritative source
- XSS protection through proper HTML escaping

### WebSocket Security

- Origin checking should be implemented on backend
- Authentication tokens for sensitive operations
- Rate limiting to prevent abuse

### Data Privacy

- Session IDs are non-predictable
- User data is not stored in localStorage
- Logs don't contain sensitive information

## 📚 API Reference

### WebSocket Events

#### Outgoing (Client → Server)

```javascript
// Subscribe to session updates
socket.emit('subscribe-session', {
  sessionId: 'session-id',
  userId: 'user-id',
});

// Unsubscribe from session
socket.emit('unsubscribe-session', {
  sessionId: 'session-id',
});
```

#### Incoming (Server → Client)

```javascript
// Progress updates
socket.on('agent-progress', {
    sessionId: 'session-id',
    phase: 'generation',
    step: 'Creating main class',
    progress: 75,
    message: 'Generating core functionality...',
    estimatedTimeRemaining: 120000,
    timestamp: '2025-06-09T...'
});

// Task-specific events
socket.on('agent-task', {
    sessionId: 'session-id',
    taskId: 'task-123',
    type: 'generation',
    action: 'code-generation',
    status: 'completed',
    agentId: 'agent-001',
    result: { ... }
});

// Error events
socket.on('agent-error', {
    sessionId: 'session-id',
    phase: 'compilation',
    error: 'Build failed',
    details: { ... }
});

// Completion events
socket.on('agent-complete', {
    sessionId: 'session-id',
    result: { pluginName: '...', files: [...] },
    metrics: { quality: 95, performance: 87 }
});
```

### REST API

#### Create Plugin

```javascript
POST /create/plugin
Content-Type: application/json

{
    "prompt": "Create a teleportation plugin with home commands",
    "userId": "user-123",
    "accuracyLevel": "maximum"
}

// Response
{
    "success": true,
    "sessionId": "sess_1717956789_abc123",
    "pluginName": "TeleportationPlugin",
    "message": "Plugin creation initiated"
}
```

## 🤝 Contributing

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch
3. **Test** your changes thoroughly
4. **Submit** a pull request with detailed description

### Code Style

- Use **2 spaces** for indentation
- Follow **ES6+** JavaScript standards
- Add **JSDoc comments** for functions
- Use **semantic CSS class names**

### Testing Guidelines

- Test WebSocket connections with various scenarios
- Verify responsive design on multiple devices
- Check performance with rapid event updates
- Validate error handling and edge cases

---

**Built with ❤️ for the Minecraft modding community**

_This dashboard represents the cutting-edge of real-time development monitoring, bringing the power and elegance of VS Code's interface to Minecraft plugin creation._
