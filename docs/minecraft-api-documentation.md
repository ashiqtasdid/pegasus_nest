# Minecraft Server Management API Documentation

## Overview

This API provides comprehensive management of Minecraft servers with automatic provisioning, monitoring, backup, and real-time status updates. Each user can have their own isolated Minecraft server instance with full management capabilities.

## Base URL

```
http://localhost:3000/api/minecraft
```

## WebSocket Connection

```
ws://localhost:3000/minecraft-status
```

## Authentication

All API endpoints support optional authentication through JWT tokens or API keys. Include the token in the `Authorization` header:

```
Authorization: Bearer <your-token>
```

## API Endpoints

### User Management

#### Create User

**POST** `/users`

Creates a new user and automatically provisions a Minecraft server.

**Request Body:**

```json
{
  "username": "player123",
  "email": "player@example.com",
  "minecraftUsername": "MinecraftPlayer",
  "serverConfig": {
    "maxPlayers": 20,
    "difficulty": "normal",
    "gamemode": "survival",
    "pvp": true,
    "plugins": ["worldedit", "essentials"]
  }
}
```

**Response:**

```json
{
  "id": "user-123",
  "username": "player123",
  "email": "player@example.com",
  "minecraftUsername": "MinecraftPlayer",
  "hasMinecraftServer": true,
  "serverStatus": "starting",
  "createdAt": "2024-01-01T12:00:00Z"
}
```

#### Get User

**GET** `/users/:userId`

Retrieves user information and server status.

**Response:**

```json
{
  "id": "user-123",
  "username": "player123",
  "email": "player@example.com",
  "hasMinecraftServer": true,
  "serverStatus": "running",
  "serverInfo": {
    "port": 25565,
    "playerCount": 3,
    "maxPlayers": 20,
    "uptime": 86400
  },
  "createdAt": "2024-01-01T12:00:00Z"
}
```

#### Update User

**PUT** `/users/:userId`

Updates user information and optionally server configuration.

**Request Body:**

```json
{
  "email": "newemail@example.com",
  "serverConfig": {
    "maxPlayers": 30,
    "difficulty": "hard"
  }
}
```

#### Delete User

**DELETE** `/users/:userId`

Deletes a user and their associated Minecraft server.

**Query Parameters:**

- `deleteData` (boolean): Whether to delete server data (default: false)

#### List Users

**GET** `/users`

Lists all users with pagination.

**Query Parameters:**

- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10)
- `hasServer` (boolean): Filter by server status

### Server Management

#### Start Server

**POST** `/servers/:userId/start`

Starts the Minecraft server for a user.

**Response:**

```json
{
  "status": "starting",
  "containerId": "container-123",
  "message": "Server is starting up"
}
```

#### Stop Server

**POST** `/servers/:userId/stop`

Stops the Minecraft server for a user.

**Query Parameters:**

- `force` (boolean): Force stop the server (default: false)

#### Restart Server

**POST** `/servers/:userId/restart`

Restarts the Minecraft server for a user.

#### Get Server Status

**GET** `/servers/:userId/status`

Gets detailed server status information.

**Response:**

```json
{
  "status": "running",
  "uptime": 86400,
  "playerCount": 3,
  "players": ["Player1", "Player2", "Player3"],
  "maxPlayers": 20,
  "cpuUsage": 45.2,
  "memoryUsage": 2048,
  "diskUsage": 1024,
  "port": 25565,
  "version": "1.20.1",
  "lastActivity": "2024-01-01T12:00:00Z"
}
```

#### Get Server Logs

**GET** `/servers/:userId/logs`

Retrieves server logs.

**Query Parameters:**

- `lines` (number): Number of log lines to retrieve (default: 100)
- `since` (string): ISO timestamp to get logs since

**Response:**

```json
{
  "logs": [
    "[12:00:00] [Server thread/INFO]: Player1 joined the game",
    "[12:01:00] [Server thread/INFO]: Player1 left the game"
  ],
  "totalLines": 1000
}
```

#### Execute Command

**POST** `/servers/:userId/command`

Executes a command on the Minecraft server via RCON.

**Request Body:**

```json
{
  "command": "list"
}
```

**Response:**

```json
{
  "command": "list",
  "output": "There are 3 players online: Player1, Player2, Player3",
  "success": true,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### Update Server Configuration

**PUT** `/servers/:userId/config`

Updates server configuration (server.properties).

**Request Body:**

```json
{
  "maxPlayers": 30,
  "difficulty": "hard",
  "pvp": false,
  "gamemode": "creative"
}
```

### Plugin Management

#### Install Plugin

**POST** `/servers/:userId/plugins`

Installs a plugin from the user's generated plugins.

**Request Body:**

```json
{
  "pluginId": "plugin-123",
  "autoRestart": true
}
```

#### List Installed Plugins

**GET** `/servers/:userId/plugins`

Lists all installed plugins.

**Response:**

```json
{
  "plugins": [
    {
      "id": "plugin-123",
      "name": "CustomPlugin",
      "version": "1.0.0",
      "enabled": true,
      "description": "A custom generated plugin"
    }
  ]
}
```

#### Remove Plugin

**DELETE** `/servers/:userId/plugins/:pluginId`

Removes an installed plugin.

#### Enable/Disable Plugin

**PUT** `/servers/:userId/plugins/:pluginId`

Enables or disables a plugin.

**Request Body:**

```json
{
  "enabled": true
}
```

### Backup Management

#### Create Backup

**POST** `/servers/:userId/backups`

Creates a manual backup of the server.

**Request Body:**

```json
{
  "includePlugins": true,
  "includeLogs": false,
  "description": "Before major update"
}
```

**Response:**

```json
{
  "backupId": "backup-456",
  "status": "creating",
  "estimatedSize": 104857600
}
```

#### List Backups

**GET** `/servers/:userId/backups`

Lists all backups for a user.

**Response:**

```json
{
  "backups": [
    {
      "id": "backup-456",
      "filename": "minecraft-server-user-123-2024-01-01.zip",
      "size": 104857600,
      "createdAt": "2024-01-01T12:00:00Z",
      "type": "manual",
      "status": "completed"
    }
  ]
}
```

#### Restore Backup

**POST** `/servers/:userId/backups/:backupId/restore`

Restores a server from a backup.

**Response:**

```json
{
  "status": "restoring",
  "message": "Server is being restored from backup"
}
```

#### Delete Backup

**DELETE** `/servers/:userId/backups/:backupId`

Deletes a backup.

#### Get Backup Configuration

**GET** `/servers/:userId/backups/config`

Gets backup configuration.

**Response:**

```json
{
  "enabled": true,
  "frequency": "daily",
  "retentionDays": 7,
  "includePlugins": true,
  "includeLogs": false,
  "compression": "zip",
  "maxBackupSize": 1000
}
```

#### Update Backup Configuration

**PUT** `/servers/:userId/backups/config`

Updates backup configuration.

**Request Body:**

```json
{
  "frequency": "weekly",
  "retentionDays": 14,
  "includePlugins": false
}
```

### Monitoring and Metrics

#### Get Health Status

**GET** `/health`

Gets overall system health status.

**Response:**

```json
{
  "status": "healthy",
  "totalServers": 10,
  "activeServers": 8,
  "systemLoad": 45.2,
  "memoryUsage": 60.1,
  "diskUsage": 30.5,
  "lastCheck": "2024-01-01T12:00:00Z"
}
```

#### Get Server Metrics

**GET** `/servers/:userId/metrics`

Gets detailed server performance metrics.

**Response:**

```json
{
  "cpuUsage": 45.2,
  "memoryUsage": 2048,
  "diskUsage": 1024,
  "networkIn": 1000,
  "networkOut": 800,
  "playerCount": 3,
  "tps": 19.8,
  "uptime": 86400,
  "errors": [],
  "warnings": ["High CPU usage detected"],
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### Force Health Check

**POST** `/servers/:userId/health-check`

Forces an immediate health check for a server.

**Response:**

```json
{
  "status": "healthy",
  "checks": {
    "container": "running",
    "rcon": "connected",
    "disk": "normal",
    "memory": "normal"
  }
}
```

## WebSocket Events

### Connection

Connect to the WebSocket endpoint:

```javascript
const socket = io('ws://localhost:3000/minecraft-status');
```

### Client Events (Send to Server)

#### Subscribe to User Updates

```javascript
socket.emit('subscribe-user', {
  userId: 'user-123',
  authToken: 'optional-token',
});
```

#### Unsubscribe from User Updates

```javascript
socket.emit('unsubscribe-user', {
  userId: 'user-123',
});
```

#### Get Server Logs

```javascript
socket.emit('get-server-logs', {
  userId: 'user-123',
  lines: 50,
});
```

#### Execute Command

```javascript
socket.emit('execute-command', {
  userId: 'user-123',
  command: 'list',
  authToken: 'optional-token',
});
```

### Server Events (Receive from Server)

#### Initial Status

```javascript
socket.on('initial-status', (data) => {
  console.log('Initial server statuses:', data);
});
```

#### Server Status Update

```javascript
socket.on('server-status-update', (data) => {
  console.log('Server status changed:', data);
  // data: { userId, status, timestamp }
});
```

#### Server Event

```javascript
socket.on('server-event', (data) => {
  console.log('Server event:', data);
  // data: { userId, event, data, timestamp }
});
```

#### Log Update

```javascript
socket.on('log-update', (data) => {
  console.log('New log line:', data.logLine);
  // data: { userId, logLine, timestamp }
});
```

#### Player Event

```javascript
socket.on('player-event', (data) => {
  console.log('Player event:', data);
  // data: { userId, playerName, event: 'join'|'leave', timestamp }
});
```

#### System Metrics

```javascript
socket.on('system-metrics', (data) => {
  console.log('System metrics:', data);
  // data: { userId, metrics, timestamp }
});
```

#### Command Result

```javascript
socket.on('command-result', (data) => {
  console.log('Command executed:', data);
  // data: { userId, command, result }
});
```

#### Error

```javascript
socket.on('error', (data) => {
  console.error('Error:', data.message);
});
```

## Error Handling

All API endpoints return consistent error responses:

```json
{
  "error": {
    "code": "SERVER_NOT_FOUND",
    "message": "Minecraft server not found for user",
    "details": {
      "userId": "user-123"
    }
  }
}
```

Common error codes:

- `USER_NOT_FOUND`: User does not exist
- `SERVER_NOT_FOUND`: Minecraft server not found
- `SERVER_ALREADY_RUNNING`: Attempted to start already running server
- `SERVER_NOT_RUNNING`: Attempted operation on stopped server
- `BACKUP_IN_PROGRESS`: Backup operation already in progress
- `INSUFFICIENT_RESOURCES`: Not enough system resources
- `PLUGIN_NOT_FOUND`: Plugin not found
- `INVALID_COMMAND`: Invalid Minecraft command
- `AUTHENTICATION_REQUIRED`: Authentication required for operation

## Rate Limiting

API endpoints are rate-limited:

- General endpoints: 100 requests per minute
- Command execution: 10 requests per minute
- Backup operations: 5 requests per hour

## Example Usage

### JavaScript/Node.js

```javascript
const axios = require('axios');
const io = require('socket.io-client');

// Create a new user with Minecraft server
const response = await axios.post('http://localhost:3000/api/minecraft/users', {
  username: 'testuser',
  email: 'test@example.com',
  minecraftUsername: 'TestPlayer',
  serverConfig: {
    maxPlayers: 10,
    difficulty: 'normal',
  },
});

const userId = response.data.id;

// Connect to WebSocket for real-time updates
const socket = io('ws://localhost:3000/minecraft-status');
socket.emit('subscribe-user', { userId });

socket.on('server-status-update', (data) => {
  console.log('Server status:', data.status);
});

// Start the server
await axios.post(`http://localhost:3000/api/minecraft/servers/${userId}/start`);

// Execute a command
await axios.post(
  `http://localhost:3000/api/minecraft/servers/${userId}/command`,
  {
    command: 'time set day',
  },
);
```

### Python

```python
import requests
import socketio

# Create user
response = requests.post('http://localhost:3000/api/minecraft/users', json={
    'username': 'testuser',
    'email': 'test@example.com',
    'minecraftUsername': 'TestPlayer'
})

user_id = response.json()['id']

# WebSocket connection
sio = socketio.Client()

@sio.event
def server_status_update(data):
    print(f"Server status: {data['status']}")

sio.connect('ws://localhost:3000/minecraft-status')
sio.emit('subscribe-user', {'userId': user_id})

# Start server
requests.post(f'http://localhost:3000/api/minecraft/servers/{user_id}/start')
```

This API provides a complete solution for managing Minecraft servers with real-time monitoring, automatic backups, and plugin integration.
