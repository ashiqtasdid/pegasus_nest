import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { RobustnessService } from '../common/robustness.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import Docker from 'dockerode';

const execPromise = promisify(exec);

export interface MinecraftServerConfig {
  userId: string;
  serverName: string;
  port: number;
  maxPlayers?: number;
  gameMode?: 'survival' | 'creative' | 'adventure' | 'spectator';
  difficulty?: 'peaceful' | 'easy' | 'normal' | 'hard';
  enableWhitelist?: boolean;
  memoryLimit?: string;
  javaArgs?: string[];
  plugins?: string[];
}

export interface ServerStatus {
  id: string;
  userId: string;
  status:
    | 'creating'
    | 'starting'
    | 'running'
    | 'stopping'
    | 'stopped'
    | 'error';
  port: number;
  playerCount: number;
  maxPlayers: number;
  uptime: number;
  lastSeen: Date;
  lastPlayerActivity: Date;
  autoShutdown: boolean;
  inactiveShutdownMinutes: number;
  containerId?: string;
  error?: string;
  serverName?: string;
  gameMode?: string;
  difficulty?: string;
  pvp?: boolean;
  onlinePlayers?: string[];
}

@Injectable()
export class MinecraftServerService implements OnModuleDestroy {
  private readonly logger = new Logger(MinecraftServerService.name);
  private readonly serverRegistry = new Map<string, ServerStatus>();
  private readonly serverCleanupInterval: NodeJS.Timeout;
  private readonly playerMonitoringInterval: NodeJS.Timeout;
  private readonly docker: Docker;

  constructor(private readonly robustnessService: RobustnessService) {
    // Initialize Docker client
    this.docker = new Docker();

    // Initialize service
    this.logger.log('Minecraft Server Service initialized');

    // Start cleanup interval (every 5 minutes)
    this.serverCleanupInterval = setInterval(
      () => {
        this.cleanupInactiveServers();
      },
      5 * 60 * 1000,
    );

    // Start player monitoring interval (every 2 minutes)
    this.playerMonitoringInterval = setInterval(
      () => {
        this.monitorAllServerActivity();
      },
      2 * 60 * 1000,
    );

    this.logger.log('Minecraft Server Service initialized with Docker API');
  }

  async onModuleDestroy() {
    clearInterval(this.serverCleanupInterval);
    clearInterval(this.playerMonitoringInterval);
    await this.stopAllServers();
    this.logger.log('Minecraft Server Service destroyed');
  }

  /**
   * Create and deploy a new Minecraft server for a user
   */
  async createUserServer(config: MinecraftServerConfig): Promise<ServerStatus> {
    try {
      this.logger.log(`Creating Minecraft server for user ${config.userId}`);

      // Validate configuration
      await this.validateServerConfig(config);

      // Create server directory structure
      const serverPath = await this.createServerStructure(config);

      // Copy user's plugins
      await this.installUserPlugins(config.userId, serverPath);

      // Generate server configuration
      await this.generateServerConfig(config, serverPath);

      // Create Docker container
      const containerId = await this.createServerContainer(config, serverPath);

      // Register server in database and memory
      const serverStatus: ServerStatus = {
        id: `${config.userId}_${config.serverName}`,
        userId: config.userId,
        status: 'creating',
        port: config.port,
        playerCount: 0,
        maxPlayers: config.maxPlayers || 20,
        uptime: 0,
        lastSeen: new Date(),
        lastPlayerActivity: new Date(),
        autoShutdown: true,
        inactiveShutdownMinutes: 10,
        serverName: config.serverName,
        gameMode: config.gameMode || 'survival',
        difficulty: config.difficulty || 'normal',
        pvp: true,
        onlinePlayers: [],
        containerId,
      };

      await this.saveServerStatus(serverStatus);
      this.serverRegistry.set(serverStatus.id, serverStatus);

      // Start the server
      await this.startServer(serverStatus.id);

      this.logger.log(`Server created successfully for user ${config.userId}`);
      return serverStatus;
    } catch (error) {
      this.logger.error(
        `Failed to create server for user ${config.userId}:`,
        error,
      );
      throw error;
    }
  }
  /**
   * Start a Minecraft server
   */
  async startServer(serverId: string): Promise<void> {
    const server = this.serverRegistry.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    try {
      server.status = 'starting';
      this.serverRegistry.set(serverId, server);

      if (server.containerId) {
        // Use Docker API instead of shell command
        const container = this.docker.getContainer(server.containerId);
        await container.start();

        // Wait for server to be ready
        await this.waitForServerReady(server.port);

        server.status = 'running';
        server.lastSeen = new Date();
        this.serverRegistry.set(serverId, server);
        await this.saveServerStatus(server);

        this.logger.log(
          `Server ${serverId} started successfully on port ${server.port}`,
        );
      }
    } catch (error) {
      server.status = 'error';
      server.error = error instanceof Error ? error.message : String(error);
      this.serverRegistry.set(serverId, server);
      await this.saveServerStatus(server);
      throw error;
    }
  }
  /**
   * Stop a Minecraft server
   */
  async stopServer(serverId: string): Promise<void> {
    const server = this.serverRegistry.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    try {
      server.status = 'stopping';
      this.serverRegistry.set(serverId, server);

      if (server.containerId) {
        const container = this.docker.getContainer(server.containerId);

        // Graceful shutdown with RCON command
        try {
          await this.sendRconCommand(server.port, 'stop');
          // Wait a bit for graceful shutdown
          await new Promise((resolve) => setTimeout(resolve, 10000));
        } catch (rconError) {
          this.logger.warn(
            `Failed to send stop command via RCON: ${rconError}`,
          );
        }

        // Use Docker API to stop container gracefully
        try {
          await container.stop({ t: 30 }); // Give 30 seconds for graceful shutdown
        } catch (stopError) {
          this.logger.warn(
            `Graceful stop failed, forcing container stop: ${stopError}`,
          );
          await container.kill(); // Force kill if graceful stop fails
        }
      }

      server.status = 'stopped';
      server.lastSeen = new Date();
      this.serverRegistry.set(serverId, server);
      await this.saveServerStatus(server);

      this.logger.log(`Server ${serverId} stopped successfully`);
    } catch (error) {
      server.status = 'error';
      server.error = error instanceof Error ? error.message : String(error);
      this.serverRegistry.set(serverId, server);
      await this.saveServerStatus(server);
      throw error;
    }
  }

  /**
   * Update server with new plugins
   */
  async updateServerPlugins(
    serverId: string,
    pluginNames: string[],
  ): Promise<void> {
    const server = this.serverRegistry.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    const serverPath = this.getServerPath(server.userId, serverId);

    // Stop server if running
    const wasRunning = server.status === 'running';
    if (wasRunning) {
      await this.stopServer(serverId);
    }

    // Update plugins
    await this.installUserPlugins(server.userId, serverPath, pluginNames);

    // Restart server if it was running
    if (wasRunning) {
      await this.startServer(serverId);
    }

    this.logger.log(`Updated plugins for server ${serverId}`);
  }
  /**
   * Remove a Minecraft server completely
   */
  async removeServer(serverId: string): Promise<void> {
    const server = this.serverRegistry.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    try {
      // Stop server if running
      if (server.status === 'running' || server.status === 'starting') {
        await this.stopServer(serverId);
      }

      // Remove container using Docker API
      if (server.containerId) {
        try {
          const container = this.docker.getContainer(server.containerId);
          await container.remove({ force: true });
        } catch (removeError) {
          this.logger.warn(
            `Failed to remove container ${server.containerId}: ${removeError}`,
          );
        }
      }

      // Remove server files
      const serverPath = this.getServerPath(server.userId, serverId);
      if (fs.existsSync(serverPath)) {
        await execPromise(`rm -rf "${serverPath}"`);
      }

      // Remove from database
      await this.deleteServerFromDB(serverId);

      // Remove from registry
      this.serverRegistry.delete(serverId);

      this.logger.log(`Server ${serverId} removed successfully`);
    } catch (error) {
      this.logger.error(`Failed to remove server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Get all servers across all users
   */
  async getAllServers(): Promise<ServerStatus[]> {
    const servers: ServerStatus[] = [];

    // Get from memory registry
    for (const [_, server] of this.serverRegistry) {
      servers.push(server);
    }

    // Also get from database for any not in memory
    const dbServers = await this.loadAllServers();
    for (const dbServer of dbServers) {
      if (!servers.find((s) => s.id === dbServer.id)) {
        servers.push(dbServer);
      }
    }

    return servers;
  }

  /**
   * Get all servers for a specific user
   */
  async getUserServers(userId: string): Promise<ServerStatus[]> {
    const servers: ServerStatus[] = [];

    // Get from memory registry
    for (const [_, server] of this.serverRegistry) {
      if (server.userId === userId) {
        servers.push(server);
      }
    }

    // Also get from in-memory registry only (database disabled)
    return servers;
  }

  /**
   * Get status of a specific server by ID
   */
  async getServerStatus(serverId: string): Promise<ServerStatus | null> {
    try {
      // First check memory registry
      const serverFromMemory = this.serverRegistry.get(serverId);
      if (serverFromMemory) {
        return serverFromMemory;
      }

      // Check in-memory registry only (database disabled)
      return null;
    } catch (error) {
      this.logger.error(`Failed to get server status for ${serverId}:`, error);
      return null;
    }
  }

  /**
   * Execute a command on a Minecraft server
   */
  async executeCommand(serverId: string, command: string): Promise<string> {
    const server = this.serverRegistry.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    if (server.status !== 'running') {
      throw new Error(`Server ${serverId} is not running`);
    }

    try {
      const result = await this.sendRconCommand(server.port, command);
      this.logger.log(`Executed command "${command}" on server ${serverId}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to execute command on server ${serverId}:`,
        error,
      );
      throw error;
    }
  }
  /**
   * Get server logs
   */
  async getServerLogs(
    serverId: string,
    lines: number = 100,
  ): Promise<string[]> {
    const server = this.serverRegistry.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    try {
      if (server.containerId) {
        // Use Docker API to get logs
        const container = this.docker.getContainer(server.containerId);
        const logStream = await container.logs({
          stdout: true,
          stderr: true,
          tail: lines,
          timestamps: false,
        });

        // Convert stream buffer to string and split into lines
        const logs = logStream.toString('utf8');
        return logs.split('\n').filter((line) => line.trim() !== '');
      } else {
        // Fallback to file logs
        const serverPath = this.getServerPath(server.userId, serverId);
        const logPath = path.join(serverPath, 'logs', 'latest.log');

        if (fs.existsSync(logPath)) {
          const { stdout } = await execPromise(`tail -n ${lines} "${logPath}"`);
          return stdout.split('\n').filter((line) => line.trim() !== '');
        }

        return [];
      }
    } catch (error) {
      this.logger.error(`Failed to get logs for server ${serverId}:`, error);
      return [];
    }
  }

  /**
   * Restart a Minecraft server
   */
  async restartServer(serverId: string): Promise<void> {
    const server = this.serverRegistry.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    try {
      this.logger.log(`Restarting server ${serverId}`);

      // Stop the server
      await this.stopServer(serverId);

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Start the server
      await this.startServer(serverId);

      this.logger.log(`Server ${serverId} restarted successfully`);
    } catch (error) {
      this.logger.error(`Failed to restart server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Update server configuration
   */
  async updateServerConfig(
    serverId: string,
    configUpdates: Partial<MinecraftServerConfig>,
  ): Promise<ServerStatus> {
    const server = this.serverRegistry.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    try {
      const serverPath = this.getServerPath(server.userId, serverId);

      // Stop server if running
      const wasRunning = server.status === 'running';
      if (wasRunning) {
        await this.stopServer(serverId);
      }

      // Update server.properties if needed
      if (
        configUpdates.maxPlayers ||
        configUpdates.gameMode ||
        configUpdates.difficulty
      ) {
        const propertiesPath = path.join(serverPath, 'server.properties');
        let properties = '';

        if (fs.existsSync(propertiesPath)) {
          properties = fs.readFileSync(propertiesPath, 'utf8');
        }

        if (configUpdates.maxPlayers) {
          properties = properties.replace(
            /max-players=\d+/,
            `max-players=${configUpdates.maxPlayers}`,
          );
          server.maxPlayers = configUpdates.maxPlayers;
        }

        if (configUpdates.gameMode) {
          properties = properties.replace(
            /gamemode=\w+/,
            `gamemode=${configUpdates.gameMode}`,
          );
        }

        if (configUpdates.difficulty) {
          properties = properties.replace(
            /difficulty=\w+/,
            `difficulty=${configUpdates.difficulty}`,
          );
        }

        fs.writeFileSync(propertiesPath, properties);
      }

      // Update server status in memory and database
      this.serverRegistry.set(serverId, server);
      await this.saveServerStatus(server);

      // Restart server if it was running
      if (wasRunning) {
        await this.startServer(serverId);
      }

      this.logger.log(`Updated configuration for server ${serverId}`);
      return server;
    } catch (error) {
      this.logger.error(`Failed to update server config ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Install plugins on a server
   */
  async installPlugins(
    serverId: string,
    pluginNames: string[],
  ): Promise<string[]> {
    const server = this.serverRegistry.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    try {
      const serverPath = this.getServerPath(server.userId, serverId);

      // Stop server if running
      const wasRunning = server.status === 'running';
      if (wasRunning) {
        await this.stopServer(serverId);
      }

      // Install plugins
      await this.installUserPlugins(server.userId, serverPath, pluginNames);

      // Restart server if it was running
      if (wasRunning) {
        await this.startServer(serverId);
      }

      this.logger.log(
        `Installed plugins ${pluginNames.join(', ')} on server ${serverId}`,
      );
      return pluginNames;
    } catch (error) {
      this.logger.error(
        `Failed to install plugins on server ${serverId}:`,
        error,
      );
      throw error;
    }
  } /**
   * Get server metrics and performance data
   */
  async getServerMetrics(serverId: string): Promise<any> {
    const server = this.serverRegistry.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    try {
      const metrics: any = {
        serverId: server.id,
        status: server.status,
        playerCount: server.playerCount,
        maxPlayers: server.maxPlayers,
        uptime: server.uptime,
        lastSeen: server.lastSeen,
      };

      // Get container stats if available
      if (server.containerId && server.status === 'running') {
        try {
          // Use Docker API to get container stats
          const container = this.docker.getContainer(server.containerId);
          const statsStream = await container.stats({ stream: false });

          if (statsStream) {
            // Parse Docker stats
            metrics.cpuUsage = this.calculateCpuUsage(statsStream);
            metrics.memoryUsage = this.formatMemoryUsage(
              statsStream.memory_stats,
            );
            metrics.networkIO = this.formatNetworkIO(statsStream.networks);
            metrics.blockIO = this.formatBlockIO(statsStream.blkio_stats);
          }
        } catch (dockerError) {
          this.logger.warn(
            `Failed to get Docker stats for ${serverId}: ${dockerError}`,
          );
          // Fallback to shell command if Docker API fails
          try {
            const { stdout } = await execPromise(
              `docker stats ${server.containerId} --no-stream --format "table {{.CPUPerc}}\\t{{.MemUsage}}\\t{{.NetIO}}\\t{{.BlockIO}}"`,
            );
            const lines = stdout.trim().split('\n');
            if (lines.length > 1) {
              const stats = lines[1].split('\t');
              metrics.cpuUsage = stats[0];
              metrics.memoryUsage = stats[1];
              metrics.networkIO = stats[2];
              metrics.blockIO = stats[3];
            }
          } catch (fallbackError) {
            this.logger.warn(
              `Fallback stats collection also failed: ${fallbackError}`,
            );
          }
        }

        // Get player list
        try {
          const playerList = await this.executeCommand(serverId, 'list');
          metrics.onlinePlayers = playerList;
        } catch (rconError) {
          this.logger.warn(
            `Failed to get player list for ${serverId}: ${rconError}`,
          );
        }
      }

      return metrics;
    } catch (error) {
      this.logger.error(`Failed to get metrics for server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Get status of all servers
   */
  async getAllServerStatuses(): Promise<ServerStatus[]> {
    return await this.getAllServers();
  }

  /**
   * Monitor player activity and update server status
   */
  async monitorPlayerActivity(serverId: string): Promise<void> {
    const server = this.serverRegistry.get(serverId);
    if (!server || server.status !== 'running') {
      return;
    }

    try {
      // Get current player list
      const playerList = await this.getOnlinePlayers(serverId);
      const previousPlayerCount = server.playerCount;

      server.playerCount = playerList.length;
      server.onlinePlayers = playerList;

      // Update last player activity if players are online
      if (server.playerCount > 0) {
        server.lastPlayerActivity = new Date();
      }

      // Update server status
      server.lastSeen = new Date();
      this.serverRegistry.set(serverId, server);
      await this.saveServerStatus(server);

      // Log player changes
      if (previousPlayerCount !== server.playerCount) {
        this.logger.log(
          `Server ${serverId} player count changed: ${previousPlayerCount} → ${server.playerCount}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to monitor player activity for server ${serverId}: ${error}`,
      );
    }
  }

  /**
   * Monitor all running servers for player activity
   */
  private async monitorAllServerActivity(): Promise<void> {
    const runningServers = Array.from(this.serverRegistry.values()).filter(
      (server) => server.status === 'running',
    );

    for (const server of runningServers) {
      try {
        await this.monitorPlayerActivity(server.id);
      } catch (error) {
        this.logger.warn(`Failed to monitor server ${server.id}: ${error}`);
      }
    }
  }

  /**
   * Get list of online players
   */
  async getOnlinePlayers(serverId: string): Promise<string[]> {
    const server = this.serverRegistry.get(serverId);
    if (!server || server.status !== 'running') {
      return [];
    }

    try {
      const result = await this.sendRconCommand(server.port, 'list');
      // Parse player list from RCON response
      // Example response: "There are 2 of a max of 20 players online: player1, player2"
      const match = result.match(/players online:\s*(.+)$/);
      if (match && match[1].trim() !== '') {
        return match[1].split(',').map((name) => name.trim());
      }
      return [];
    } catch (error) {
      this.logger.warn(
        `Failed to get player list for server ${serverId}: ${error}`,
      );
      return [];
    }
  }

  /**
   * Update server auto-shutdown settings
   */
  async updateAutoShutdownSettings(
    serverId: string,
    enabled: boolean,
    inactiveMinutes: number = 10,
  ): Promise<void> {
    const server = this.serverRegistry.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    server.autoShutdown = enabled;
    server.inactiveShutdownMinutes = inactiveMinutes;

    this.serverRegistry.set(serverId, server);
    await this.saveServerStatus(server);

    this.logger.log(
      `Updated auto-shutdown for server ${serverId}: enabled=${enabled}, minutes=${inactiveMinutes}`,
    );
  }

  // Private helper methods

  private async initializeDatabase(): Promise<void> {
    // Database functionality disabled - using in-memory storage only
    this.logger.log(
      'Minecraft server database initialization skipped (in-memory mode)',
    );
  }

  private async validateServerConfig(
    config: MinecraftServerConfig,
  ): Promise<void> {
    if (!config.userId || !config.serverName) {
      throw new Error('User ID and server name are required');
    }

    if (!config.port || config.port < 25565 || config.port > 65535) {
      throw new Error('Port must be between 25565 and 65535');
    }

    // Check if port is already in use
    const existingServer = Array.from(this.serverRegistry.values()).find(
      (s) => s.port === config.port && s.status !== 'stopped',
    );

    if (existingServer) {
      throw new Error(
        `Port ${config.port} is already in use by server ${existingServer.id}`,
      );
    }
  }

  private async createServerStructure(
    config: MinecraftServerConfig,
  ): Promise<string> {
    // New unified structure: generated/{userId}/server/
    const serverPath = this.getServerPath(config.userId, config.serverName);

    // Create directory structure
    const dirs = [
      serverPath,
      path.join(serverPath, 'plugins'),
      path.join(serverPath, 'world'),
      path.join(serverPath, 'logs'),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.logger.log(`Created server structure at: ${serverPath}`);
    return serverPath;
  }

  private getServerPath(userId: string, serverId: string): string {
    // New unified directory structure: generated/{userId}/server/
    return path.join(process.cwd(), 'generated', userId, 'server');
  }

  private async installUserPlugins(
    userId: string,
    serverPath: string,
    specificPlugins?: string[],
  ): Promise<void> {
    // New unified structure: plugins are in generated/{userId}/{pluginName}/
    const userGeneratedPath = path.join(process.cwd(), 'generated', userId);
    const serverPluginsPath = path.join(serverPath, 'plugins');

    if (!fs.existsSync(userGeneratedPath)) {
      this.logger.warn(`No generated directory found for user ${userId}`);
      return;
    }

    // Get all available plugins (directories that are not 'server')
    const availablePlugins = fs
      .readdirSync(userGeneratedPath)
      .filter((item) => {
        const itemPath = path.join(userGeneratedPath, item);
        return fs.statSync(itemPath).isDirectory() && item !== 'server';
      });

    const pluginsToInstall = specificPlugins || availablePlugins;

    for (const pluginName of pluginsToInstall) {
      const pluginSourcePath = path.join(userGeneratedPath, pluginName);
      const jarPath = path.join(pluginSourcePath, 'target');

      if (fs.existsSync(jarPath)) {
        const jarFiles = fs
          .readdirSync(jarPath)
          .filter(
            (file) => file.endsWith('.jar') && !file.includes('original'),
          );

        if (jarFiles.length > 0) {
          const sourceJar = path.join(jarPath, jarFiles[0]);
          const destJar = path.join(serverPluginsPath, jarFiles[0]);

          fs.copyFileSync(sourceJar, destJar);
          this.logger.log(`Installed plugin: ${jarFiles[0]} to server`);
        } else {
          this.logger.warn(`No compiled JAR found for plugin: ${pluginName}`);
        }
      } else {
        this.logger.warn(
          `Target directory not found for plugin: ${pluginName}`,
        );
      }
    }

    this.logger.log(`Plugin installation completed for user ${userId}`);
  }

  private async generateServerConfig(
    config: MinecraftServerConfig,
    serverPath: string,
  ): Promise<void> {
    // Generate server.properties
    const serverProperties = `
# Minecraft server properties
server-port=${config.port}
max-players=${config.maxPlayers || 20}
gamemode=${config.gameMode || 'survival'}
difficulty=${config.difficulty || 'normal'}
white-list=${config.enableWhitelist || false}
online-mode=true
enable-rcon=true
rcon.port=${config.port + 1000}
rcon.password=pegasus_${config.userId}
motd=§6Pegasus Nest Server - ${config.serverName}
enable-command-block=true
spawn-protection=16
level-name=world
level-type=default
`.trim();

    fs.writeFileSync(
      path.join(serverPath, 'server.properties'),
      serverProperties,
    );

    // Generate EULA acceptance
    fs.writeFileSync(path.join(serverPath, 'eula.txt'), 'eula=true\n');

    // Generate startup script
    const memoryLimit = config.memoryLimit || '2G';
    const javaArgs = config.javaArgs || [
      '-XX:+UseG1GC',
      '-XX:+UnlockExperimentalVMOptions',
    ];

    const startScript = `#!/bin/bash
java -Xmx${memoryLimit} -Xms${memoryLimit} ${javaArgs.join(' ')} -jar server.jar nogui
`;
    fs.writeFileSync(path.join(serverPath, 'start.sh'), startScript);
    await this.makeFileExecutable(path.join(serverPath, 'start.sh'));
  }
  private async createServerContainer(
    config: MinecraftServerConfig,
    serverPath: string,
  ): Promise<string> {
    const containerName = `minecraft-${config.userId}-${config.serverName}`;
    const memoryLimit = config.memoryLimit || '2G';

    // Download Minecraft server jar if not exists
    const serverJarPath = path.join(serverPath, 'server.jar');
    if (!fs.existsSync(serverJarPath)) {
      await this.downloadMinecraftServer(serverJarPath);
    }

    try {
      // Use Docker API to create container
      const memoryBytes = this.parseMemoryLimit(memoryLimit);

      const containerConfig = {
        Image: 'openjdk:17-jdk-slim',
        name: containerName,
        ExposedPorts: {
          [`${config.port}/tcp`]: {},
          [`${config.port + 1000}/tcp`]: {},
        },
        HostConfig: {
          PortBindings: {
            [`${config.port}/tcp`]: [{ HostPort: config.port.toString() }],
            [`${config.port + 1000}/tcp`]: [
              { HostPort: (config.port + 1000).toString() },
            ],
          },
          Binds: [`${serverPath}:/minecraft`],
          WorkingDir: '/minecraft',
          Memory: memoryBytes,
          MemorySwap: memoryBytes,
          RestartPolicy: {
            Name: 'unless-stopped',
          },
        },
        Cmd: [
          'bash',
          '-c',
          `java -Xmx${memoryLimit} -Xms${memoryLimit} -jar server.jar nogui`,
        ],
      };

      const container = await this.docker.createContainer(containerConfig);
      const containerId = container.id;

      this.logger.log(
        `Created container ${containerId} for server ${config.serverName}`,
      );
      return containerId;
    } catch (error) {
      this.logger.error(
        `Failed to create container for ${config.serverName}: ${error}`,
      );
      throw error;
    }
  }

  private async downloadMinecraftServer(jarPath: string): Promise<void> {
    // Download latest Paper server (recommended for plugins)
    const downloadUrl =
      'https://api.papermc.io/v2/projects/paper/versions/1.20.4/builds/497/downloads/paper-1.20.4-497.jar';

    this.logger.log('Downloading Minecraft server jar...');
    await execPromise(`curl -L -o "${jarPath}" "${downloadUrl}"`);
    this.logger.log('Minecraft server jar downloaded successfully');
  }

  private async waitForServerReady(
    port: number,
    timeout: number = 60000,
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        // Try to connect to server port
        await execPromise(`timeout 1 bash -c "</dev/tcp/localhost/${port}"`);
        return; // Server is ready
      } catch {
        // Server not ready yet, wait and retry
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    throw new Error(`Server failed to start within ${timeout}ms`);
  }

  private async sendRconCommand(
    port: number,
    command: string,
  ): Promise<string> {
    // This would require an RCON client implementation
    // For now, we'll use a simple approach
    try {
      const { stdout } = await execPromise(
        `echo "${command}" | nc localhost ${port + 1000}`,
      );
      return stdout;
    } catch (error) {
      throw new Error(`Failed to send RCON command: ${error}`);
    }
  }

  private async saveServerStatus(server: ServerStatus): Promise<void> {
    // Store server status in memory registry
    this.serverRegistry.set(server.id, server);
    this.logger.debug(`Server status saved for ${server.id}`);
  }

  private async loadServerStatus(
    serverId: string,
  ): Promise<ServerStatus | null> {
    // Load server status from memory registry
    return this.serverRegistry.get(serverId) || null;
  }

  private async loadUserServers(userId: string): Promise<ServerStatus[]> {
    // Load user servers from memory registry
    const userServers: ServerStatus[] = [];
    for (const server of this.serverRegistry.values()) {
      if (server.userId === userId) {
        userServers.push(server);
      }
    }
    return userServers;
  }

  private async deleteServerFromDB(serverId: string): Promise<void> {
    // Remove server from memory registry
    this.serverRegistry.delete(serverId);
    this.logger.debug(`Server ${serverId} deleted from registry`);
  }

  private async loadAllServers(): Promise<ServerStatus[]> {
    // Load all servers from memory registry
    return Array.from(this.serverRegistry.values());
  }

  private async cleanupInactiveServers(): Promise<void> {
    const now = Date.now();
    const inactiveThreshold = 24 * 60 * 60 * 1000; // 24 hours

    for (const [serverId, server] of this.serverRegistry) {
      try {
        // Check if server has auto-shutdown enabled and has been empty for too long
        if (server.status === 'running' && server.autoShutdown) {
          const timeSinceLastPlayer = now - server.lastPlayerActivity.getTime();
          const shutdownThreshold = server.inactiveShutdownMinutes * 60 * 1000;

          if (
            server.playerCount === 0 &&
            timeSinceLastPlayer > shutdownThreshold
          ) {
            this.logger.log(
              `Auto-stopping empty server: ${serverId} (empty for ${Math.round(timeSinceLastPlayer / 60000)} minutes)`,
            );
            await this.stopServer(serverId);
            continue;
          }
        } // Clean up old stopped servers
        if (
          now - server.lastSeen.getTime() > inactiveThreshold &&
          server.status === 'stopped'
        ) {
          // Remove container using Docker API
          if (server.containerId) {
            try {
              const container = this.docker.getContainer(server.containerId);
              await container.remove({ force: true });
            } catch (removeError) {
              this.logger.warn(
                `Failed to remove container ${server.containerId}: ${removeError}`,
              );
            }
          }

          // Remove from registry
          this.serverRegistry.delete(serverId);

          this.logger.log(`Cleaned up inactive server: ${serverId}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to cleanup server ${serverId}: ${error}`);
      }
    }
  }
  private async stopAllServers(): Promise<void> {
    const promises = Array.from(this.serverRegistry.keys()).map((serverId) =>
      this.stopServer(serverId).catch((error) =>
        this.logger.warn(`Failed to stop server ${serverId}: ${error}`),
      ),
    );

    await Promise.all(promises);
  }

  /**
   * Helper method to parse memory limit string to bytes
   */
  private parseMemoryLimit(memoryStr: string): number {
    const match = memoryStr.match(/^(\d+)([GMK]?)$/i);
    if (!match) {
      throw new Error(`Invalid memory format: ${memoryStr}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2]?.toUpperCase() || '';

    switch (unit) {
      case 'G':
        return value * 1024 * 1024 * 1024;
      case 'M':
        return value * 1024 * 1024;
      case 'K':
        return value * 1024;
      default:
        return value;
    }
  }

  /**
   * Calculate CPU usage percentage from Docker stats
   */
  private calculateCpuUsage(stats: any): string {
    if (!stats.cpu_stats || !stats.precpu_stats) {
      return '0%';
    }

    const cpuDelta =
      stats.cpu_stats.cpu_usage.total_usage -
      stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta =
      stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuCount = stats.cpu_stats.cpu_usage.percpu_usage?.length || 1;

    if (systemDelta > 0 && cpuDelta > 0) {
      const cpuPercent = (cpuDelta / systemDelta) * cpuCount * 100;
      return `${cpuPercent.toFixed(2)}%`;
    }

    return '0%';
  }

  /**
   * Format memory usage from Docker stats
   */
  private formatMemoryUsage(memStats: any): string {
    if (!memStats) {
      return '0B / 0B';
    }

    const usage = memStats.usage || 0;
    const limit = memStats.limit || 0;

    return `${this.formatBytes(usage)} / ${this.formatBytes(limit)}`;
  }

  /**
   * Format network I/O from Docker stats
   */
  private formatNetworkIO(networks: any): string {
    if (!networks) {
      return '0B / 0B';
    }

    let rxBytes = 0;
    let txBytes = 0;

    Object.values(networks).forEach((network: any) => {
      rxBytes += network.rx_bytes || 0;
      txBytes += network.tx_bytes || 0;
    });

    return `${this.formatBytes(rxBytes)} / ${this.formatBytes(txBytes)}`;
  }

  /**
   * Format block I/O from Docker stats
   */
  private formatBlockIO(blkioStats: any): string {
    if (!blkioStats || !blkioStats.io_service_bytes_recursive) {
      return '0B / 0B';
    }

    let readBytes = 0;
    let writeBytes = 0;

    blkioStats.io_service_bytes_recursive.forEach((stat: any) => {
      if (stat.op === 'Read') {
        readBytes += stat.value || 0;
      } else if (stat.op === 'Write') {
        writeBytes += stat.value || 0;
      }
    });

    return `${this.formatBytes(readBytes)} / ${this.formatBytes(writeBytes)}`;
  }

  /**
   * Helper method to format bytes into human-readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))}${sizes[i]}`;
  }

  /**
   * Automatically provision a server for a user if they don't have one
   * This is called when a user creates their first plugin
   */
  async autoProvisionUserServer(userId: string): Promise<ServerStatus | null> {
    try {
      // Check if user already has a server
      const existingServers = await this.getUserServers(userId);
      if (existingServers.length > 0) {
        this.logger.log(`User ${userId} already has a server`);
        return existingServers[0]; // Return the first server
      }

      this.logger.log(`Auto-provisioning server for user ${userId}`);

      // Get next available port
      const port = await this.getNextAvailablePort();

      // Create server configuration
      const serverConfig: MinecraftServerConfig = {
        userId: userId,
        serverName: `${userId}_server`,
        port: port,
        maxPlayers: 20,
        gameMode: 'survival',
        difficulty: 'normal',
        enableWhitelist: false,
        memoryLimit: '2G',
        javaArgs: ['-XX:+UseG1GC', '-XX:+UnlockExperimentalVMOptions'],
        plugins: [], // Will be populated by installUserPlugins
      };

      // Create the server
      const serverStatus = await this.createUserServer(serverConfig);

      this.logger.log(
        `Auto-provisioned server ${serverStatus.id} for user ${userId}`,
      );
      return serverStatus;
    } catch (error) {
      this.logger.error(
        `Failed to auto-provision server for user ${userId}:`,
        error,
      );
      return null; // Don't throw error, just log and return null
    }
  }

  /**
   * Get next available port for server creation
   */
  private async getNextAvailablePort(): Promise<number> {
    const startPort = 25565;
    const maxPort = 25665;

    for (let port = startPort; port <= maxPort; port++) {
      let isPortUsed = false;

      // Check if port is already used by any server
      for (const [_, server] of this.serverRegistry) {
        if (server.port === port) {
          isPortUsed = true;
          break;
        }
      }

      if (!isPortUsed) {
        return port;
      }
    }

    throw new Error(
      `No available ports found between ${startPort} and ${maxPort}`,
    );
  }

  /**
   * Check container health and status
   */
  private async checkContainerHealth(containerId: string): Promise<boolean> {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();

      return info.State.Running && !info.State.Paused && !info.State.Restarting;
    } catch (error) {
      this.logger.warn(
        `Failed to check container health ${containerId}: ${error}`,
      );
      return false;
    }
  }

  /**
   * Get detailed container information
   */
  private async getContainerInfo(containerId: string): Promise<any> {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();

      return {
        id: info.Id,
        name: info.Name,
        state: info.State,
        created: info.Created,
        image: info.Config.Image,
        ports: info.NetworkSettings.Ports,
        mounts: info.Mounts,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get container info ${containerId}: ${error}`,
      );
      return null;
    }
  }

  /**
   * Sync server registry with actual Docker containers
   */
  private async syncRegistryWithContainers(): Promise<void> {
    try {
      const containers = await this.docker.listContainers({ all: true });

      for (const containerInfo of containers) {
        const serverName = this.extractServerNameFromContainer(containerInfo);
        if (serverName) {
          await this.updateServerStatusFromContainer(serverName, containerInfo);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to sync registry with containers: ${error}`);
    }
  }

  /**
   * Extract server name from container information
   */
  private extractServerNameFromContainer(containerInfo: any): string | null {
    try {
      const containerName = containerInfo.Names[0]?.replace('/', '');
      if (containerName && containerName.startsWith('minecraft-')) {
        // Expected format: minecraft-{userId}-{serverName}
        const parts = containerName.split('-');
        if (parts.length >= 3) {
          const userId = parts[1];
          const serverName = parts.slice(2).join('-');
          return `${userId}_${serverName}`;
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update server status based on container information
   */
  private async updateServerStatusFromContainer(
    serverId: string,
    containerInfo: any,
  ): Promise<void> {
    try {
      let server = this.serverRegistry.get(serverId);

      if (!server) {
        // Create server entry if it doesn't exist in registry
        const containerName = containerInfo.Names[0]?.replace('/', '');
        const parts = containerName.split('-');
        if (parts.length >= 3) {
          const userId = parts[1];
          const serverName = parts.slice(2).join('-');

          server = {
            id: serverId,
            userId: userId,
            status: 'stopped',
            port: 25565, // Default, should be extracted from container config
            playerCount: 0,
            maxPlayers: 20,
            uptime: 0,
            lastSeen: new Date(),
            lastPlayerActivity: new Date(),
            autoShutdown: true,
            inactiveShutdownMinutes: 10,
            containerId: containerInfo.Id,
            serverName: serverName,
          };
        } else {
          return;
        }
      }

      // Update status based on container state
      switch (containerInfo.State) {
        case 'running':
          server.status = 'running';
          server.lastSeen = new Date();
          break;
        case 'exited':
        case 'stopped':
          server.status = 'stopped';
          break;
        case 'paused':
          server.status = 'stopped';
          break;
        case 'restarting':
          server.status = 'starting';
          break;
        default:
          server.status = 'error';
      }

      server.containerId = containerInfo.Id;
      this.serverRegistry.set(serverId, server);
      await this.saveServerStatus(server);
    } catch (error) {
      this.logger.error(
        `Failed to update server status from container: ${error}`,
      );
    }
  }

  /**
   * Monitor container health for all registered servers
   */
  private async monitorContainerHealth(): Promise<void> {
    for (const [serverId, server] of this.serverRegistry) {
      if (server.containerId && server.status === 'running') {
        const isHealthy = await this.checkContainerHealth(server.containerId);

        if (!isHealthy) {
          this.logger.warn(
            `Container health check failed for server ${serverId}`,
          );
          server.status = 'error';
          server.error = 'Container health check failed';
          this.serverRegistry.set(serverId, server);
          await this.saveServerStatus(server);
        }
      }
    }
  }

  /**
   * Cross-platform method to make a file executable
   */
  private async makeFileExecutable(filePath: string): Promise<void> {
    try {
      if (os.platform() === 'win32') {
        // On Windows, we don't need to set execute permissions
        // The file will be executable based on its content
        this.logger.debug(`Skipping chmod on Windows for: ${filePath}`);
        return;
      } else {
        // On Unix-like systems (Linux, macOS), use chmod
        await execPromise(`chmod +x "${filePath}"`);
        this.logger.debug(`Made file executable: ${filePath}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to make file executable ${filePath}: ${error}`);
      // Don't throw error as this is not critical for Docker deployment
    }
  }
}
