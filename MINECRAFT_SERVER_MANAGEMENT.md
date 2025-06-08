# 🎮 Minecraft Server Management - Complete Guide

## Overview

The Pegasus Nest project provides a comprehensive Minecraft server management system with auto-shutdown capabilities, real-time monitoring, and complete UI-ready API integration. This document covers every aspect of server creation, handling, and control.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Server Configuration](#server-configuration)
3. [Server Lifecycle Management](#server-lifecycle-management)
4. [Auto-Shutdown System](#auto-shutdown-system)
5. [Player Activity Monitoring](#player-activity-monitoring)
6. [API Endpoints](#api-endpoints)
7. [Dashboard Integration](#dashboard-integration)
8. [Container Management](#container-management)
9. [Database-Free Operations](#database-free-operations)
10. [Real-time Features](#real-time-features)
11. [Error Handling & Recovery](#error-handling--recovery)
12. [Performance Optimization](#performance-optimization)
13. [Deployment & Scaling](#deployment--scaling)
14. [Security & Isolation](#security--isolation)
15. [Monitoring & Analytics](#monitoring--analytics)
16. [Troubleshooting Guide](#troubleshooting-guide)

---

## Architecture Overview

### Core Components

#### 1. MinecraftServerService

**File**: `src/services/minecraft-server.service.ts`

The central service responsible for all server operations:

- **Server Registry**: In-memory Map storage for server statuses
- **Container Management**: Docker container lifecycle control
- **Auto-Shutdown Logic**: Intelligent resource management
- **Player Monitoring**: Real-time activity tracking
- **Configuration Management**: Server settings and properties

#### 2. MinecraftServerController

**File**: `src/controllers/minecraft-server.controller.ts`

RESTful API endpoints for server control:

- CRUD operations for servers
- Real-time status monitoring
- Command execution interface
- Configuration updates
- Plugin management

#### 3. ServerDashboardController

**File**: `src/controllers/server-dashboard.controller.ts`

Dashboard-specific endpoints for UI integration:

- System statistics
- User dashboards
- Activity monitoring
- Quick actions
- Live status updates

### System Architecture Flow

```
User Request → API Controller → MinecraftServerService → Docker Container
                    ↓
                Registry Storage (In-Memory)
                    ↓
            Auto-Shutdown Monitoring
                    ↓
            Player Activity Tracking
```

---

## Server Configuration

### MinecraftServerConfig Interface

```typescript
interface MinecraftServerConfig {
  userId: string; // User identifier
  serverName: string; // Server display name
  port: number; // Server port (25565+)
  maxPlayers?: number; // Maximum players (default: 20)
  gameMode?: 'survival' | 'creative' | 'adventure' | 'spectator';
  difficulty?: 'peaceful' | 'easy' | 'normal' | 'hard';
  enableWhitelist?: boolean; // Whitelist mode
  memoryLimit?: string; // JVM memory limit (e.g., "2G")
  javaArgs?: string[]; // Additional JVM arguments
  plugins?: string[]; // Plugin list
}
```

### ServerStatus Interface

```typescript
interface ServerStatus {
  id: string; // Unique server ID (userId_serverName)
  userId: string; // Owner user ID
  status:
    | 'creating'
    | 'starting'
    | 'running'
    | 'stopping'
    | 'stopped'
    | 'error';
  port: number; // Server port
  playerCount: number; // Current player count
  maxPlayers: number; // Maximum players
  uptime: number; // Server uptime in seconds
  lastSeen: Date; // Last status update
  lastPlayerActivity: Date; // Last player activity timestamp
  autoShutdown: boolean; // Auto-shutdown enabled
  inactiveShutdownMinutes: number; // Inactivity timeout
  containerId?: string; // Docker container ID
  error?: string; // Error message if any
  serverName?: string; // Display name
  gameMode?: string; // Current game mode
  difficulty?: string; // Current difficulty
  pvp?: boolean; // PvP enabled
  onlinePlayers?: string[]; // List of online players
}
```

### Default Configuration Values

```typescript
const DEFAULT_CONFIG = {
  maxPlayers: 20,
  gameMode: 'survival',
  difficulty: 'normal',
  enableWhitelist: false,
  memoryLimit: '1G',
  autoShutdown: true,
  inactiveShutdownMinutes: 10,
  pvp: true,
};
```

---

## Server Lifecycle Management

### 1. Server Creation Process

#### Step-by-Step Flow:

1. **Configuration Validation**

   ```typescript
   await this.validateServerConfig(config);
   ```

2. **Directory Structure Creation**

   ```
   servers/
   ├── {userId}_{serverName}/
   │   ├── world/
   │   ├── plugins/
   │   ├── server.properties
   │   ├── bukkit.yml
   │   └── spigot.yml
   ```

3. **Plugin Installation**

   ```typescript
   await this.installUserPlugins(config.userId, serverPath);
   ```

4. **Server Configuration Generation**

   ```typescript
   await this.generateServerConfig(config, serverPath);
   ```

5. **Docker Container Creation**

   ```typescript
   const containerId = await this.createServerContainer(config, serverPath);
   ```

6. **Registry Registration**
   ```typescript
   this.serverRegistry.set(serverStatus.id, serverStatus);
   ```

### 2. Server Starting Process

```typescript
async startServer(serverId: string): Promise<void> {
  const server = this.serverRegistry.get(serverId);

  // Update status to starting
  server.status = 'starting';

  // Start Docker container
  await this.docker.getContainer(server.containerId).start();

  // Wait for server to be ready
  await this.waitForServerReady(serverId);

  // Update status to running
  server.status = 'running';
  server.lastSeen = new Date();
}
```

### 3. Server Stopping Process

```typescript
async stopServer(serverId: string): Promise<void> {
  const server = this.serverRegistry.get(serverId);

  // Send stop command gracefully
  await this.sendCommand(serverId, 'stop');

  // Wait for graceful shutdown
  await this.waitForServerStop(serverId, 30000);

  // Force stop container if needed
  await this.docker.getContainer(server.containerId).stop();

  // Update status
  server.status = 'stopped';
  server.lastSeen = new Date();
}
```

### 4. Server Restart Process

```typescript
async restartServer(serverId: string): Promise<void> {
  await this.stopServer(serverId);
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  await this.startServer(serverId);
}
```

### 5. Server Deletion Process

```typescript
async deleteServer(serverId: string): Promise<void> {
  // Stop server if running
  if (server.status === 'running') {
    await this.stopServer(serverId);
  }

  // Remove Docker container
  await this.docker.getContainer(server.containerId).remove({ force: true });

  // Clean up files
  await this.cleanupServerFiles(serverPath);

  // Remove from registry
  this.serverRegistry.delete(serverId);
}
```

---

## Auto-Shutdown System

### Overview

The auto-shutdown system automatically stops servers when no players are online for a configurable period, optimizing resource usage.

### Key Features

- **Configurable Timeouts**: Per-server inactivity timeouts (default: 10 minutes)
- **Player Activity Monitoring**: Real-time tracking of player joins/leaves
- **Graceful Shutdown**: Proper server stop sequence before container termination
- **Resource Optimization**: Automatic cleanup of empty servers

### Implementation Details

#### 1. Player Activity Monitoring

```typescript
// Runs every 2 minutes
private readonly playerMonitoringInterval = setInterval(
  () => {
    this.monitorAllServerActivity();
  },
  2 * 60 * 1000
);

async monitorAllServerActivity(): Promise<void> {
  for (const [serverId, server] of this.serverRegistry) {
    if (server.status === 'running') {
      await this.monitorPlayerActivity(serverId);
    }
  }
}
```

#### 2. Player Count Detection

```typescript
async monitorPlayerActivity(serverId: string): Promise<void> {
  const server = this.serverRegistry.get(serverId);
  const currentPlayers = await this.getOnlinePlayers(serverId);

  const previousCount = server.playerCount;
  server.playerCount = currentPlayers.length;
  server.onlinePlayers = currentPlayers;

  // Update activity timestamp if players are online
  if (currentPlayers.length > 0) {
    server.lastPlayerActivity = new Date();
  }

  // Log player count changes
  if (previousCount !== currentPlayers.length) {
    this.logger.log(
      `Server ${serverId} player count changed: ${previousCount} → ${currentPlayers.length}`
    );
  }
}
```

#### 3. Auto-Shutdown Logic

```typescript
// Runs every 5 minutes
private readonly serverCleanupInterval = setInterval(
  () => {
    this.cleanupInactiveServers();
  },
  5 * 60 * 1000
);

async cleanupInactiveServers(): Promise<void> {
  const now = new Date();

  for (const [serverId, server] of this.serverRegistry) {
    if (server.status === 'running' && server.autoShutdown) {
      const inactiveTime = now.getTime() - server.lastPlayerActivity.getTime();
      const thresholdTime = server.inactiveShutdownMinutes * 60 * 1000;

      if (server.playerCount === 0 && inactiveTime > thresholdTime) {
        const inactiveMinutes = Math.floor(inactiveTime / (60 * 1000));
        this.logger.log(
          `Auto-stopping empty server: ${serverId} (empty for ${inactiveMinutes} minutes)`
        );

        await this.stopServer(serverId);
      }
    }
  }
}
```

#### 4. Configuration Management

```typescript
async updateAutoShutdownSettings(
  serverId: string,
  settings: { enabled: boolean; inactiveMinutes: number }
): Promise<void> {
  const server = this.serverRegistry.get(serverId);

  server.autoShutdown = settings.enabled;
  server.inactiveShutdownMinutes = settings.inactiveMinutes;

  await this.saveServerStatus(server);

  this.logger.log(
    `Updated auto-shutdown for ${serverId}: enabled=${settings.enabled}, timeout=${settings.inactiveMinutes}min`
  );
}
```

---

## Player Activity Monitoring

### Real-time Player Detection

#### 1. Online Player Retrieval

```typescript
async getOnlinePlayers(serverId: string): Promise<string[]> {
  try {
    const server = this.serverRegistry.get(serverId);

    if (server.status !== 'running') {
      return [];
    }

    // Execute 'list' command to get online players
    const result = await this.executeServerCommand(serverId, 'list');

    // Parse player list from server output
    return this.parsePlayerList(result);
  } catch (error) {
    this.logger.error(`Failed to get online players for ${serverId}:`, error);
    return [];
  }
}
```

#### 2. Player List Parsing

```typescript
private parsePlayerList(commandOutput: string): string[] {
  // Parse Minecraft server 'list' command output
  // Example: "There are 2 of a max of 20 players online: player1, player2"

  const playerMatch = commandOutput.match(/players online: (.+)$/);
  if (!playerMatch || !playerMatch[1]) {
    return [];
  }

  return playerMatch[1]
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0);
}
```

#### 3. Activity Timestamp Management

```typescript
private updatePlayerActivity(serverId: string, playerCount: number): void {
  const server = this.serverRegistry.get(serverId);

  if (playerCount > 0) {
    // Players are online, update activity timestamp
    server.lastPlayerActivity = new Date();
  }

  // Always update last seen
  server.lastSeen = new Date();
}
```

### Monitoring Intervals

- **Player Monitoring**: Every 2 minutes
- **Auto-Shutdown Check**: Every 5 minutes
- **Status Updates**: Real-time on API calls

---

## API Endpoints

### User Management

#### Create User

```http
POST /minecraft/users
Content-Type: application/json

{
  "username": "player123",
  "email": "player@example.com",
  "maxServers": 5
}
```

#### Get User Info

```http
GET /minecraft/users/{userId}
```

### Server Lifecycle

#### Create Server

```http
POST /minecraft/servers
Content-Type: application/json

{
  "userId": "user-uuid",
  "serverName": "MyServer",
  "port": 25565,
  "maxPlayers": 20,
  "gameMode": "survival",
  "difficulty": "normal",
  "memory": "2G",
  "autoStart": true,
  "autoShutdown": true,
  "inactiveShutdownMinutes": 15
}
```

#### Start Server

```http
POST /minecraft/servers/{serverId}/start
```

#### Stop Server

```http
POST /minecraft/servers/{serverId}/stop
```

#### Restart Server

```http
POST /minecraft/servers/{serverId}/restart
```

#### Delete Server

```http
DELETE /minecraft/servers/{serverId}
```

### Server Monitoring

#### Get Server Status

```http
GET /minecraft/servers/{serverId}
```

**Response Example:**

```json
{
  "success": true,
  "message": "Server status retrieved successfully",
  "data": {
    "server": {
      "id": "user123_MyServer",
      "userId": "user-uuid",
      "status": "running",
      "port": 25565,
      "playerCount": 2,
      "maxPlayers": 20,
      "uptime": 3600,
      "lastSeen": "2025-06-08T13:39:45.123Z",
      "lastPlayerActivity": "2025-06-08T13:35:12.456Z",
      "autoShutdown": true,
      "inactiveShutdownMinutes": 10,
      "serverName": "MyServer",
      "gameMode": "survival",
      "difficulty": "normal",
      "pvp": true,
      "onlinePlayers": ["player1", "player2"]
    }
  },
  "timestamp": "2025-06-08T13:39:45.123Z"
}
```

#### Get Online Players

```http
GET /minecraft/servers/{serverId}/players
```

#### Get Server Logs

```http
GET /minecraft/servers/{serverId}/logs?lines=100
```

#### Get Server Metrics

```http
GET /minecraft/servers/{serverId}/metrics
```

### Configuration Management

#### Update Server Config

```http
PATCH /minecraft/servers/{serverId}/config
Content-Type: application/json

{
  "maxPlayers": 30,
  "gameMode": "creative",
  "difficulty": "hard",
  "pvp": false
}
```

#### Update Auto-Shutdown Settings

```http
PATCH /minecraft/servers/{serverId}/auto-shutdown
Content-Type: application/json

{
  "enabled": true,
  "inactiveMinutes": 15
}
```

### Command Execution

#### Execute Server Command

```http
POST /minecraft/servers/{serverId}/command
Content-Type: application/json

{
  "command": "say Hello, World!",
  "timeout": 5000
}
```

### Bulk Operations

#### Get All Servers

```http
GET /minecraft/servers
```

#### Get User Servers

```http
GET /minecraft/users/{userId}/servers
```

---

## Dashboard Integration

### System Statistics

#### Get Dashboard Stats

```http
GET /dashboard/stats
```

**Response:**

```json
{
  "totalServers": 15,
  "runningServers": 8,
  "stoppedServers": 7,
  "errorServers": 0,
  "totalPlayers": 42,
  "totalUsers": 12,
  "systemUptime": 86400,
  "timestamp": "2025-06-08T13:39:45.123Z"
}
```

### User Dashboard

#### Get User Dashboard

```http
GET /dashboard/users/{userId}
```

**Response:**

```json
{
  "user": {
    "id": "user-uuid",
    "username": "player123",
    "email": "player@example.com"
  },
  "servers": [
    {
      "id": "user123_MyServer",
      "serverName": "MyServer",
      "status": "running",
      "playerCount": 2,
      "maxPlayers": 20,
      "port": 25565,
      "uptime": 3600,
      "autoShutdown": true,
      "inactiveShutdownMinutes": 10
    }
  ],
  "totalServers": 1,
  "runningServers": 1,
  "stoppedServers": 0,
  "totalPlayers": 2
}
```

### Activity Monitoring

#### Get Activity Summary

```http
GET /dashboard/activity
```

#### Get Live Server Status

```http
GET /dashboard/servers/{serverId}/live-status
```

### Quick Actions

#### Execute Quick Action

```http
POST /dashboard/quick-action
Content-Type: application/json

{
  "action": "start" | "stop" | "restart",
  "serverId": "user123_MyServer"
}
```

---

## Container Management

### Docker Configuration

#### Base Image

```dockerfile
FROM openjdk:17-jre-slim
```

#### Container Setup

```typescript
async createServerContainer(
  config: MinecraftServerConfig,
  serverPath: string
): Promise<string> {
  const containerConfig = {
    Image: 'minecraft-server:latest',
    name: `minecraft-${config.userId}-${config.serverName}`,
    ExposedPorts: {
      [`${config.port}/tcp`]: {}
    },
    HostConfig: {
      PortBindings: {
        [`${config.port}/tcp`]: [{ HostPort: config.port.toString() }]
      },
      Binds: [
        `${serverPath}:/minecraft`
      ],
      Memory: this.parseMemoryLimit(config.memoryLimit || '1G')
    },
    Env: [
      'EULA=TRUE',
      `MAX_PLAYERS=${config.maxPlayers || 20}`,
      `GAME_MODE=${config.gameMode || 'survival'}`,
      `DIFFICULTY=${config.difficulty || 'normal'}`
    ]
  };

  const container = await this.docker.createContainer(containerConfig);
  return container.id;
}
```

#### Resource Limits

```typescript
private parseMemoryLimit(memoryLimit: string): number {
  const match = memoryLimit.match(/^(\d+)([GM])$/);
  if (!match) return 1024 * 1024 * 1024; // Default 1GB

  const value = parseInt(match[1]);
  const unit = match[2];

  return unit === 'G'
    ? value * 1024 * 1024 * 1024
    : value * 1024 * 1024;
}
```

### Container Lifecycle

#### Start Container

```typescript
async startContainer(containerId: string): Promise<void> {
  const container = this.docker.getContainer(containerId);
  await container.start();

  // Wait for container to be ready
  await this.waitForContainerReady(containerId);
}
```

#### Stop Container

```typescript
async stopContainer(containerId: string, graceful: boolean = true): Promise<void> {
  const container = this.docker.getContainer(containerId);

  if (graceful) {
    // Send stop signal and wait
    await container.kill({ signal: 'SIGTERM' });
    await this.waitForContainerStop(containerId, 30000);
  } else {
    // Force stop
    await container.kill({ signal: 'SIGKILL' });
  }
}
```

#### Container Health Monitoring

```typescript
async checkContainerHealth(containerId: string): Promise<boolean> {
  try {
    const container = this.docker.getContainer(containerId);
    const info = await container.inspect();

    return info.State.Running && info.State.Health?.Status === 'healthy';
  } catch (error) {
    return false;
  }
}
```

---

## Database-Free Operations

### In-Memory Storage

The system uses `Map<string, ServerStatus>` for server registry:

```typescript
private readonly serverRegistry = new Map<string, ServerStatus>();

// Storage operations
setServer(serverId: string, status: ServerStatus): void {
  this.serverRegistry.set(serverId, status);
}

getServer(serverId: string): ServerStatus | undefined {
  return this.serverRegistry.get(serverId);
}

getAllServers(): ServerStatus[] {
  return Array.from(this.serverRegistry.values());
}

deleteServer(serverId: string): boolean {
  return this.serverRegistry.delete(serverId);
}
```

### Persistence Strategy

#### File-Based Backup (Optional)

```typescript
async saveServerRegistryToFile(): Promise<void> {
  const data = Array.from(this.serverRegistry.entries());
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile('data/servers.json', json);
}

async loadServerRegistryFromFile(): Promise<void> {
  try {
    const json = await fs.readFile('data/servers.json', 'utf8');
    const data = JSON.parse(json);
    this.serverRegistry.clear();

    for (const [key, value] of data) {
      this.serverRegistry.set(key, value);
    }
  } catch (error) {
    this.logger.warn('No server registry file found, starting fresh');
  }
}
```

### Data Consistency

#### Registry Synchronization

```typescript
async syncRegistryWithContainers(): Promise<void> {
  const containers = await this.docker.listContainers({ all: true });

  for (const containerInfo of containers) {
    const serverName = this.extractServerNameFromContainer(containerInfo);
    if (serverName) {
      await this.updateServerStatusFromContainer(serverName, containerInfo);
    }
  }
}
```

---

## Real-time Features

### WebSocket Integration

#### Status Broadcasting

```typescript
@WebSocketGateway({
  cors: { origin: '*' },
  path: '/minecraft-status',
})
export class MinecraftStatusGateway {
  @WebSocketServer()
  server: Server;

  broadcastServerStatusUpdate(serverId: string, status: ServerStatus): void {
    this.server.emit('server-status-update', {
      serverId,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastPlayerUpdate(serverId: string, players: string[]): void {
    this.server.emit('player-update', {
      serverId,
      players,
      playerCount: players.length,
      timestamp: new Date().toISOString(),
    });
  }
}
```

#### Live Status Updates

```typescript
@SubscribeMessage('subscribe-server-status')
handleSubscribeServerStatus(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { serverId: string }
): void {
  client.join(`server-${data.serverId}`);

  // Send current status immediately
  const server = this.serverService.getServer(data.serverId);
  if (server) {
    client.emit('server-status', server);
  }
}

@SubscribeMessage('unsubscribe-server-status')
handleUnsubscribeServerStatus(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { serverId: string }
): void {
  client.leave(`server-${data.serverId}`);
}
```

### Server-Sent Events (SSE)

#### Live Logs Streaming

```typescript
@Get('/servers/:serverId/logs/stream')
async streamLogs(
  @Param('serverId') serverId: string,
  @Res() response: Response
): Promise<void> {
  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Connection', 'keep-alive');

  const logStream = await this.serverService.getLogStream(serverId);

  logStream.on('data', (data: string) => {
    response.write(`data: ${JSON.stringify({ log: data, timestamp: Date.now() })}\n\n`);
  });

  logStream.on('end', () => {
    response.end();
  });
}
```

---

## Error Handling & Recovery

### Error Types

```typescript
export enum ServerErrorType {
  CREATION_FAILED = 'creation_failed',
  START_FAILED = 'start_failed',
  STOP_FAILED = 'stop_failed',
  CONTAINER_ERROR = 'container_error',
  NETWORK_ERROR = 'network_error',
  RESOURCE_LIMIT = 'resource_limit',
  PERMISSION_ERROR = 'permission_error',
}

export interface ServerError {
  type: ServerErrorType;
  message: string;
  serverId: string;
  timestamp: Date;
  details?: any;
}
```

### Error Recovery Strategies

#### Automatic Recovery

```typescript
async attemptServerRecovery(serverId: string, error: ServerError): Promise<boolean> {
  const server = this.serverRegistry.get(serverId);

  switch (error.type) {
    case ServerErrorType.CONTAINER_ERROR:
      return await this.recoverFromContainerError(serverId);

    case ServerErrorType.NETWORK_ERROR:
      return await this.recoverFromNetworkError(serverId);

    case ServerErrorType.RESOURCE_LIMIT:
      return await this.recoverFromResourceLimit(serverId);

    default:
      return false;
  }
}

private async recoverFromContainerError(serverId: string): Promise<boolean> {
  try {
    // Try to restart the container
    await this.restartServer(serverId);
    return true;
  } catch (error) {
    // If restart fails, recreate the container
    try {
      await this.recreateServerContainer(serverId);
      return true;
    } catch (recreateError) {
      this.logger.error(`Failed to recover server ${serverId}:`, recreateError);
      return false;
    }
  }
}
```

#### Circuit Breaker Pattern

```typescript
export class ServerCircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 5;
  private readonly recoveryTimeout = 60000; // 1 minute

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isCircuitOpen()) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private isCircuitOpen(): boolean {
    if (this.failureCount >= this.failureThreshold) {
      const now = Date.now();
      if (now - this.lastFailureTime < this.recoveryTimeout) {
        return true;
      } else {
        // Half-open state - try recovery
        this.failureCount = 0;
        return false;
      }
    }
    return false;
  }

  private onSuccess(): void {
    this.failureCount = 0;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
  }
}
```

### Health Checks

#### Container Health Monitoring

```typescript
async performHealthCheck(serverId: string): Promise<HealthCheckResult> {
  const server = this.serverRegistry.get(serverId);
  const result: HealthCheckResult = {
    serverId,
    healthy: false,
    checks: {},
    timestamp: new Date()
  };

  // Container status check
  result.checks.container = await this.checkContainerHealth(server.containerId);

  // Port accessibility check
  result.checks.port = await this.checkPortAccessibility(server.port);

  // Server responsiveness check
  result.checks.responsive = await this.checkServerResponsiveness(serverId);

  // Resource usage check
  result.checks.resources = await this.checkResourceUsage(server.containerId);

  result.healthy = Object.values(result.checks).every(check => check === true);

  return result;
}
```

---

## Performance Optimization

### Resource Management

#### Memory Optimization

```typescript
class ServerResourceManager {
  private readonly memoryThresholds = {
    warning: 0.8, // 80% memory usage
    critical: 0.9, // 90% memory usage
  };

  async optimizeServerResources(serverId: string): Promise<void> {
    const server = this.serverRegistry.get(serverId);
    const usage = await this.getContainerResourceUsage(server.containerId);

    if (usage.memoryPercentage > this.memoryThresholds.critical) {
      await this.performCriticalMemoryOptimization(serverId);
    } else if (usage.memoryPercentage > this.memoryThresholds.warning) {
      await this.performMemoryOptimization(serverId);
    }
  }

  private async performMemoryOptimization(serverId: string): Promise<void> {
    // Trigger garbage collection
    await this.sendCommand(serverId, 'gc');

    // Clear inactive chunks
    await this.sendCommand(serverId, 'chunkclear');

    this.logger.log(`Performed memory optimization for server ${serverId}`);
  }

  private async performCriticalMemoryOptimization(
    serverId: string,
  ): Promise<void> {
    // Kick idle players
    await this.kickIdlePlayers(serverId);

    // Force memory cleanup
    await this.performMemoryOptimization(serverId);

    // If still critical, consider restart
    const usage = await this.getContainerResourceUsage(serverId);
    if (usage.memoryPercentage > this.memoryThresholds.critical) {
      this.logger.warn(
        `Critical memory usage persists for ${serverId}, considering restart`,
      );
    }
  }
}
```

#### CPU Optimization

```typescript
async optimizeCPUUsage(serverId: string): Promise<void> {
  const server = this.serverRegistry.get(serverId);

  // Adjust tick rate if needed
  if (server.playerCount < 5) {
    await this.sendCommand(serverId, 'tps-limiter 15'); // Reduce TPS for empty servers
  } else {
    await this.sendCommand(serverId, 'tps-limiter 20'); // Full TPS for active servers
  }

  // Optimize view distance based on player count
  const viewDistance = Math.max(6, Math.min(16, server.playerCount * 2));
  await this.sendCommand(serverId, `view-distance ${viewDistance}`);
}
```

### Caching Strategies

#### Server Status Caching

```typescript
class ServerStatusCache {
  private cache = new Map<string, { status: ServerStatus; expiry: number }>();
  private readonly CACHE_TTL = 30000; // 30 seconds

  get(serverId: string): ServerStatus | null {
    const cached = this.cache.get(serverId);
    if (!cached || Date.now() > cached.expiry) {
      this.cache.delete(serverId);
      return null;
    }
    return cached.status;
  }

  set(serverId: string, status: ServerStatus): void {
    this.cache.set(serverId, {
      status: { ...status },
      expiry: Date.now() + this.CACHE_TTL,
    });
  }

  invalidate(serverId: string): void {
    this.cache.delete(serverId);
  }

  clear(): void {
    this.cache.clear();
  }
}
```

---

## Deployment & Scaling

### Docker Deployment

#### Production Dockerfile

```dockerfile
# Multi-stage build for optimization
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM openjdk:17-jre-slim

# Install Node.js for the API
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Create app directory
WORKDIR /app

# Copy built application
COPY --from=builder /app .

# Create directories for server data
RUN mkdir -p /app/servers /app/data /app/logs

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
```

#### Docker Compose Configuration

```yaml
version: '3.8'

services:
  pegasus-nest:
    build: .
    ports:
      - '3000:3000'
    volumes:
      - ./servers:/app/servers
      - ./data:/app/data
      - ./logs:/app/logs
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - NODE_ENV=production
      - PORT=3000
      - MAX_SERVERS_PER_USER=5
      - DEFAULT_MEMORY_LIMIT=2G
      - AUTO_SHUTDOWN_DEFAULT=true
      - MONITORING_INTERVAL=120000
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
```

### Horizontal Scaling

#### Load Balancer Configuration

```nginx
upstream pegasus_nest {
    server pegasus-nest-1:3000;
    server pegasus-nest-2:3000;
    server pegasus-nest-3:3000;
}

server {
    listen 80;
    server_name api.pegasus-nest.com;

    location / {
        proxy_pass http://pegasus_nest;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

#### Server Distribution Strategy

```typescript
class ServerDistributor {
  private nodes: string[] = ['node1', 'node2', 'node3'];
  private serverCounts = new Map<string, number>();

  selectOptimalNode(config: MinecraftServerConfig): string {
    // Simple round-robin with load consideration
    let selectedNode = this.nodes[0];
    let minLoad = this.serverCounts.get(selectedNode) || 0;

    for (const node of this.nodes) {
      const load = this.serverCounts.get(node) || 0;
      if (load < minLoad) {
        minLoad = load;
        selectedNode = node;
      }
    }

    return selectedNode;
  }

  registerServer(nodeId: string): void {
    const current = this.serverCounts.get(nodeId) || 0;
    this.serverCounts.set(nodeId, current + 1);
  }

  unregisterServer(nodeId: string): void {
    const current = this.serverCounts.get(nodeId) || 0;
    this.serverCounts.set(nodeId, Math.max(0, current - 1));
  }
}
```

---

## Security & Isolation

### User Isolation

#### Directory Structure

```
servers/
├── user1_server1/
├── user1_server2/
├── user2_server1/
└── user3_server1/
```

#### Access Control

```typescript
class SecurityService {
  validateServerAccess(userId: string, serverId: string): boolean {
    const server = this.serverRegistry.get(serverId);
    return server && server.userId === userId;
  }

  sanitizeServerName(name: string): string {
    // Remove potentially dangerous characters
    return name.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 32);
  }

  validateServerConfig(config: MinecraftServerConfig): void {
    // Port range validation
    if (config.port < 25565 || config.port > 30000) {
      throw new Error('Port must be between 25565 and 30000');
    }

    // Memory limit validation
    const memoryBytes = this.parseMemoryLimit(config.memoryLimit || '1G');
    if (memoryBytes > 8 * 1024 * 1024 * 1024) {
      // Max 8GB
      throw new Error('Memory limit cannot exceed 8GB');
    }

    // Server name validation
    if (!config.serverName.match(/^[a-zA-Z0-9_-]{1,32}$/)) {
      throw new Error('Invalid server name format');
    }
  }
}
```

### Network Security

#### Container Network Isolation

```typescript
async createSecureServerContainer(config: MinecraftServerConfig): Promise<string> {
  const networkName = `minecraft-${config.userId}`;

  // Create user-specific network if it doesn't exist
  await this.createUserNetwork(networkName);

  const containerConfig = {
    Image: 'minecraft-server:latest',
    name: `minecraft-${config.userId}-${config.serverName}`,
    NetworkingConfig: {
      EndpointsConfig: {
        [networkName]: {}
      }
    },
    HostConfig: {
      NetworkMode: networkName,
      PortBindings: {
        '25565/tcp': [{ HostPort: config.port.toString() }]
      },
      // Security constraints
      ReadonlyRootfs: false,
      SecurityOpt: ['no-new-privileges:true'],
      CapDrop: ['ALL'],
      CapAdd: ['CHOWN', 'DAC_OVERRIDE', 'SETGID', 'SETUID']
    }
  };

  const container = await this.docker.createContainer(containerConfig);
  return container.id;
}
```

---

## Monitoring & Analytics

### Metrics Collection

#### Server Metrics

```typescript
interface ServerMetrics {
  serverId: string;
  timestamp: Date;
  playerCount: number;
  uptime: number;
  memoryUsage: {
    used: number;
    available: number;
    percentage: number;
  };
  cpuUsage: {
    percentage: number;
    cores: number;
  };
  networkIO: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  tps: number; // Ticks per second
  mspt: number; // Milliseconds per tick
}

class MetricsCollector {
  private metrics = new Map<string, ServerMetrics[]>();
  private readonly maxMetricsAge = 24 * 60 * 60 * 1000; // 24 hours

  async collectServerMetrics(serverId: string): Promise<ServerMetrics> {
    const server = this.serverRegistry.get(serverId);
    const containerStats = await this.getContainerStats(server.containerId);
    const gameStats = await this.getGameStats(serverId);

    const metrics: ServerMetrics = {
      serverId,
      timestamp: new Date(),
      playerCount: server.playerCount,
      uptime: server.uptime,
      memoryUsage: {
        used: containerStats.memory.usage,
        available: containerStats.memory.limit,
        percentage:
          (containerStats.memory.usage / containerStats.memory.limit) * 100,
      },
      cpuUsage: {
        percentage: containerStats.cpu.percentage,
        cores: containerStats.cpu.cores,
      },
      networkIO: containerStats.network,
      tps: gameStats.tps,
      mspt: gameStats.mspt,
    };

    this.storeMetrics(serverId, metrics);
    return metrics;
  }

  private storeMetrics(serverId: string, metrics: ServerMetrics): void {
    if (!this.metrics.has(serverId)) {
      this.metrics.set(serverId, []);
    }

    const serverMetrics = this.metrics.get(serverId)!;
    serverMetrics.push(metrics);

    // Clean old metrics
    const cutoff = Date.now() - this.maxMetricsAge;
    this.metrics.set(
      serverId,
      serverMetrics.filter((m) => m.timestamp.getTime() > cutoff),
    );
  }

  getMetricsHistory(
    serverId: string,
    duration: number = 3600000,
  ): ServerMetrics[] {
    const serverMetrics = this.metrics.get(serverId) || [];
    const cutoff = Date.now() - duration;

    return serverMetrics.filter((m) => m.timestamp.getTime() > cutoff);
  }
}
```

### Analytics Dashboard

#### Performance Analytics

```typescript
class AnalyticsService {
  generateServerAnalytics(serverId: string): ServerAnalytics {
    const metrics = this.metricsCollector.getMetricsHistory(serverId);

    return {
      serverId,
      generatedAt: new Date(),
      summary: {
        averagePlayerCount: this.calculateAveragePlayerCount(metrics),
        peakPlayerCount: this.calculatePeakPlayerCount(metrics),
        totalUptime: this.calculateTotalUptime(metrics),
        averageMemoryUsage: this.calculateAverageMemoryUsage(metrics),
        averageCpuUsage: this.calculateAverageCpuUsage(metrics),
        averageTPS: this.calculateAverageTPS(metrics),
      },
      trends: {
        playerCountTrend: this.analyzePlayerCountTrend(metrics),
        performanceTrend: this.analyzePerformanceTrend(metrics),
        resourceUsageTrend: this.analyzeResourceUsageTrend(metrics),
      },
      recommendations: this.generateRecommendations(metrics),
    };
  }

  private generateRecommendations(metrics: ServerMetrics[]): string[] {
    const recommendations: string[] = [];
    const avgMemory = this.calculateAverageMemoryUsage(metrics);
    const avgCPU = this.calculateAverageCpuUsage(metrics);
    const avgTPS = this.calculateAverageTPS(metrics);

    if (avgMemory > 80) {
      recommendations.push(
        'Consider increasing memory allocation or optimizing plugins',
      );
    }

    if (avgCPU > 70) {
      recommendations.push(
        'High CPU usage detected - consider reducing view distance or optimizing world generation',
      );
    }

    if (avgTPS < 18) {
      recommendations.push(
        'Low TPS detected - check for lag-causing plugins or world corruption',
      );
    }

    return recommendations;
  }
}
```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Server Won't Start

**Symptoms:**

- Server status stuck on "starting"
- Container exits immediately
- Port binding errors

**Diagnosis:**

```typescript
async diagnoseStartupIssue(serverId: string): Promise<DiagnosisResult> {
  const server = this.serverRegistry.get(serverId);
  const diagnosis: DiagnosisResult = {
    serverId,
    issues: [],
    solutions: []
  };

  // Check port availability
  if (!(await this.isPortAvailable(server.port))) {
    diagnosis.issues.push(`Port ${server.port} is already in use`);
    diagnosis.solutions.push('Change server port or stop conflicting service');
  }

  // Check container logs
  const logs = await this.getContainerLogs(server.containerId);
  if (logs.includes('EULA')) {
    diagnosis.issues.push('EULA not accepted');
    diagnosis.solutions.push('Ensure EULA=true is set in environment variables');
  }

  // Check memory limits
  const memoryInfo = await this.getSystemMemoryInfo();
  if (memoryInfo.available < this.parseMemoryLimit(server.memoryLimit)) {
    diagnosis.issues.push('Insufficient system memory');
    diagnosis.solutions.push('Reduce memory allocation or free up system memory');
  }

  return diagnosis;
}
```

#### 2. Auto-Shutdown Not Working

**Symptoms:**

- Servers stay running when empty
- Incorrect player count detection
- Auto-shutdown disabled unexpectedly

**Solution:**

```typescript
async troubleshootAutoShutdown(serverId: string): Promise<void> {
  const server = this.serverRegistry.get(serverId);

  // Verify auto-shutdown is enabled
  if (!server.autoShutdown) {
    this.logger.warn(`Auto-shutdown disabled for ${serverId}`);
    return;
  }

  // Test player detection
  const players = await this.getOnlinePlayers(serverId);
  this.logger.log(`Current players on ${serverId}: ${players.join(', ')}`);

  // Check last activity timestamp
  const inactiveTime = Date.now() - server.lastPlayerActivity.getTime();
  const thresholdTime = server.inactiveShutdownMinutes * 60 * 1000;

  this.logger.log(
    `Inactive time: ${Math.floor(inactiveTime / 60000)}min, Threshold: ${server.inactiveShutdownMinutes}min`
  );

  // Force activity check
  await this.monitorPlayerActivity(serverId);
}
```

#### 3. High Resource Usage

**Symptoms:**

- Slow server performance
- High memory or CPU usage
- System instability

**Solution:**

```typescript
async optimizeHighResourceUsage(serverId: string): Promise<void> {
  const metrics = await this.collectServerMetrics(serverId);

  if (metrics.memoryUsage.percentage > 85) {
    await this.performMemoryOptimization(serverId);
  }

  if (metrics.cpuUsage.percentage > 80) {
    await this.optimizeCPUUsage(serverId);
  }

  if (metrics.tps < 18) {
    await this.optimizeServerPerformance(serverId);
  }

  // Generate performance report
  await this.generatePerformanceReport(serverId);
}
```

#### 4. Container Network Issues

**Symptoms:**

- Cannot connect to server
- Network timeouts
- Port binding failures

**Solution:**

```typescript
async fixNetworkIssues(serverId: string): Promise<void> {
  const server = this.serverRegistry.get(serverId);

  // Recreate container with fresh network settings
  await this.stopServer(serverId);
  await this.recreateServerContainer(serverId);
  await this.startServer(serverId);

  // Verify network connectivity
  const connectivity = await this.testServerConnectivity(serverId);
  if (!connectivity.success) {
    throw new Error(`Network connectivity test failed: ${connectivity.error}`);
  }
}
```

### Diagnostic Tools

#### Health Check Endpoint

```typescript
@Get('/minecraft/health')
async getServerSystemHealth(): Promise<SystemHealthReport> {
  const report: SystemHealthReport = {
    timestamp: new Date(),
    overall: 'healthy',
    components: {
      docker: await this.checkDockerHealth(),
      memory: await this.checkSystemMemory(),
      disk: await this.checkDiskSpace(),
      network: await this.checkNetworkConnectivity(),
      servers: await this.checkAllServersHealth()
    },
    metrics: {
      totalServers: this.serverRegistry.size,
      runningServers: this.getRunningServerCount(),
      systemUptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    }
  };

  // Determine overall health
  const componentStatuses = Object.values(report.components);
  if (componentStatuses.some(status => status === 'critical')) {
    report.overall = 'critical';
  } else if (componentStatuses.some(status => status === 'warning')) {
    report.overall = 'warning';
  }

  return report;
}
```

### Logging and Debugging

#### Structured Logging

```typescript
class ServerLogger {
  private logger = new Logger('MinecraftServerService');

  logServerEvent(serverId: string, event: string, details?: any): void {
    this.logger.log({
      serverId,
      event,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  logPlayerActivity(
    serverId: string,
    players: string[],
    previousCount: number,
  ): void {
    this.logger.log({
      serverId,
      event: 'player_activity',
      currentPlayers: players,
      playerCount: players.length,
      previousCount,
      timestamp: new Date().toISOString(),
    });
  }

  logAutoShutdown(
    serverId: string,
    reason: string,
    inactiveMinutes: number,
  ): void {
    this.logger.log({
      serverId,
      event: 'auto_shutdown',
      reason,
      inactiveMinutes,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## Conclusion

This comprehensive guide covers all aspects of Minecraft server management in the Pegasus Nest project. The system provides:

- **Complete Server Lifecycle Management**: From creation to deletion
- **Intelligent Auto-Shutdown**: Resource optimization through activity monitoring
- **Real-time Monitoring**: Live status updates and player tracking
- **Robust API**: Full CRUD operations with UI-ready endpoints
- **Database-Free Architecture**: In-memory storage with optional persistence
- **Container Orchestration**: Docker-based isolation and resource management
- **Performance Optimization**: Resource monitoring and automatic optimization
- **Security**: User isolation and access control
- **Scalability**: Horizontal scaling support with load balancing
- **Comprehensive Monitoring**: Metrics collection and analytics
- **Error Recovery**: Automatic fault detection and recovery

The system is designed to be production-ready with proper error handling, monitoring, and optimization features while maintaining simplicity and performance.
