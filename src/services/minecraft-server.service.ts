import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { RobustnessService } from '../common/robustness.service';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

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

  constructor(private readonly robustnessService: RobustnessService) {
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

    this.logger.log('Minecraft Server Service initialized');
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
        await execPromise(`docker start ${server.containerId}`);

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

        // Force stop container if still running
        await execPromise(`docker stop ${server.containerId}`);
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

      // Remove container
      if (server.containerId) {
        await execPromise(`docker rm -f ${server.containerId}`).catch(() => {});
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
        const { stdout } = await execPromise(
          `docker logs --tail ${lines} ${server.containerId}`,
        );
        return stdout.split('\n').filter((line) => line.trim() !== '');
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
  }

  /**
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
        } catch (dockerError) {
          this.logger.warn(
            `Failed to get Docker stats for ${serverId}: ${dockerError}`,
          );
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
    const serverPath = this.getServerPath(
      config.userId,
      `${config.userId}_${config.serverName}`,
    );

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

    return serverPath;
  }

  private getServerPath(userId: string, serverId: string): string {
    return path.join(process.cwd(), 'minecraft_servers', userId, serverId);
  }

  private async installUserPlugins(
    userId: string,
    serverPath: string,
    specificPlugins?: string[],
  ): Promise<void> {
    const userPluginsPath = path.join(process.cwd(), 'generated', userId);
    const serverPluginsPath = path.join(serverPath, 'plugins');

    if (!fs.existsSync(userPluginsPath)) {
      this.logger.warn(`No plugins found for user ${userId}`);
      return;
    }

    const availablePlugins = fs
      .readdirSync(userPluginsPath)
      .filter((item) =>
        fs.statSync(path.join(userPluginsPath, item)).isDirectory(),
      );

    const pluginsToInstall = specificPlugins || availablePlugins;

    for (const pluginName of pluginsToInstall) {
      const pluginSourcePath = path.join(userPluginsPath, pluginName);
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
          this.logger.log(`Installed plugin: ${jarFiles[0]}`);
        }
      }
    }
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
    await execPromise(`chmod +x ${path.join(serverPath, 'start.sh')}`);
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

    // Create Docker command
    const dockerCmd = `
      docker run -d 
      --name ${containerName}
      --restart unless-stopped
      -p ${config.port}:${config.port}
      -p ${config.port + 1000}:${config.port + 1000}
      -v "${serverPath}:/minecraft"
      -w /minecraft
      -m ${memoryLimit}
      --memory-swap ${memoryLimit}
      openjdk:17-jdk-slim
      bash -c "java -Xmx${memoryLimit} -Xms${memoryLimit} -jar server.jar nogui"
    `
      .replace(/\s+/g, ' ')
      .trim();

    const { stdout } = await execPromise(dockerCmd);
    const containerId = stdout.trim();

    this.logger.log(
      `Created container ${containerId} for server ${config.serverName}`,
    );
    return containerId;
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
        }

        // Clean up old stopped servers
        if (
          now - server.lastSeen.getTime() > inactiveThreshold &&
          server.status === 'stopped'
        ) {
          // Remove container
          if (server.containerId) {
            await execPromise(`docker rm -f ${server.containerId}`).catch(
              () => {},
            );
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
}
