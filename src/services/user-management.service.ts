import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MinecraftServerService } from './minecraft-server.service';
import { v4 as uuidv4 } from 'uuid';

export interface UserConfig {
  id: string;
  username: string;
  minecraftUsername?: string; // Minecraft-specific username
  email?: string;
  serverName?: string;
  maxPlayers?: number;
  serverPort?: number;
  autoStartServer?: boolean;
  serverMemory?: string;
  gameMode?: 'survival' | 'creative' | 'adventure' | 'spectator';
  difficulty?: 'peaceful' | 'easy' | 'normal' | 'hard';
  plugins?: string[];
  hasMinecraftServer?: boolean; // Whether user has a Minecraft server
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserRequest {
  username: string;
  email?: string;
  serverName?: string;
  serverConfig?: {
    maxPlayers?: number;
    gameMode?: 'survival' | 'creative' | 'adventure' | 'spectator';
    difficulty?: 'peaceful' | 'easy' | 'normal' | 'hard';
    autoStartServer?: boolean;
    serverMemory?: string;
  };
}

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);

  // In-memory storage (replaces database)
  private readonly users = new Map<string, UserConfig>();
  private readonly usersByUsername = new Map<string, UserConfig>();
  private usedPorts = new Set<number>();

  constructor(
    private readonly minecraftServerService: MinecraftServerService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.log(
      'User Management Service initialized (in-memory mode - database features disabled)',
    );
    // Initialize some default ports as used (common Minecraft ports)
    for (let port = 25565; port <= 25570; port++) {
      this.usedPorts.add(port);
    }
  }

  /**
   * Create a new user and automatically provision their Minecraft server
   */
  async createUser(request: CreateUserRequest): Promise<UserConfig> {
    try {
      this.logger.log(`Creating new user: ${request.username}`);

      // Check if username already exists
      if (this.usersByUsername.has(request.username)) {
        throw new Error(`Username ${request.username} already exists`);
      }

      const userId = uuidv4();
      const serverName = request.serverName || `${request.username}Server`;
      const now = new Date();

      // Create user configuration
      const userConfig: UserConfig = {
        id: userId,
        username: request.username,
        email: request.email,
        serverName,
        maxPlayers: request.serverConfig?.maxPlayers || 20,
        serverPort: await this.getNextAvailablePort(),
        autoStartServer: request.serverConfig?.autoStartServer ?? true,
        serverMemory: request.serverConfig?.serverMemory || '2G',
        gameMode: request.serverConfig?.gameMode || 'survival',
        difficulty: request.serverConfig?.difficulty || 'normal',
        plugins: [],
        hasMinecraftServer: true,
        createdAt: now,
        updatedAt: now,
      };

      // Save user to memory
      this.saveUser(userConfig);

      // Emit user created event
      this.eventEmitter.emit('user.created', userConfig);

      // Automatically provision Minecraft server if enabled
      if (userConfig.autoStartServer) {
        await this.provisionMinecraftServer(userConfig);
      }

      this.logger.log(`User created successfully: ${userId}`);
      return userConfig;
    } catch (error) {
      this.logger.error(`Failed to create user ${request.username}:`, error);
      throw error;
    }
  }

  /**
   * Provision a Minecraft server for a user
   */
  async provisionMinecraftServer(userConfig: UserConfig): Promise<void> {
    try {
      this.logger.log(
        `Provisioning Minecraft server for user ${userConfig.id}`,
      );

      // Get user's plugins
      const userPlugins = await this.getUserPlugins(userConfig.id);

      // Create server configuration
      const serverConfig = {
        userId: userConfig.id,
        serverName: userConfig.serverName || `${userConfig.username}Server`,
        port: userConfig.serverPort || (await this.getNextAvailablePort()),
        maxPlayers: userConfig.maxPlayers || 20,
        memory: userConfig.serverMemory || '2G',
        gameMode: userConfig.gameMode || 'survival',
        difficulty: userConfig.difficulty || 'normal',
        plugins: userPlugins,
        autoStart: userConfig.autoStartServer ?? true,
      };

      // Create and deploy the server
      const serverStatus =
        await this.minecraftServerService.createUserServer(serverConfig);

      // Update user with server information
      this.updateUserServerInfo(userConfig.id, {
        serverPort: serverStatus.port,
        serverId: serverStatus.id,
      });

      // Emit server provisioned event
      this.eventEmitter.emit('user.server.provisioned', {
        userId: userConfig.id,
        serverStatus,
      });

      this.logger.log(
        `Minecraft server provisioned successfully for user ${userConfig.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to provision server for user ${userConfig.id}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserConfig | null> {
    try {
      return this.users.get(userId) || null;
    } catch (error) {
      this.logger.error(`Failed to get user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<UserConfig | null> {
    try {
      return this.usersByUsername.get(username) || null;
    } catch (error) {
      this.logger.error(`Failed to get user by username ${username}:`, error);
      throw error;
    }
  }

  /**
   * Update user configuration
   */
  async updateUser(
    userId: string,
    updates: Partial<UserConfig>,
  ): Promise<UserConfig> {
    try {
      const existingUser = this.users.get(userId);
      if (!existingUser) {
        throw new Error(`User not found: ${userId}`);
      }

      const updatedUser = {
        ...existingUser,
        ...updates,
        updatedAt: new Date(),
      };

      this.saveUser(updatedUser);

      // Emit user updated event
      this.eventEmitter.emit('user.updated', { userId, updates });

      return updatedUser;
    } catch (error) {
      this.logger.error(`Failed to update user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Delete user and cleanup their resources
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      this.logger.log(`Deleting user: ${userId}`);

      const user = this.users.get(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Stop and remove user's Minecraft server
      try {
        await this.minecraftServerService.stopServer(
          `${userId}_${user.serverName}`,
        );
        await this.minecraftServerService.removeServer(
          `${userId}_${user.serverName}`,
        );
      } catch (serverError) {
        this.logger.warn(
          `Failed to cleanup server for user ${userId}:`,
          serverError,
        );
      }

      // Remove user from memory
      this.users.delete(userId);
      this.usersByUsername.delete(user.username);

      // Free up the port
      if (user.serverPort) {
        this.usedPorts.delete(user.serverPort);
      }

      // Emit user deleted event
      this.eventEmitter.emit('user.deleted', { userId, user });

      this.logger.log(`User deleted successfully: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to delete user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user's generated plugins
   */
  private async getUserPlugins(userId: string): Promise<string[]> {
    try {
      const fs = require('fs');
      const path = require('path');

      const userPluginsPath = path.join(process.cwd(), 'generated', userId);

      if (!fs.existsSync(userPluginsPath)) {
        return [];
      }

      const pluginDirs = fs
        .readdirSync(userPluginsPath)
        .filter((item: string) => {
          const itemPath = path.join(userPluginsPath, item);
          return fs.statSync(itemPath).isDirectory();
        });

      return pluginDirs;
    } catch (error) {
      this.logger.warn(`Failed to get plugins for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get next available port for server
   */
  private async getNextAvailablePort(): Promise<number> {
    const basePort = 25565;
    const maxPort = 25665;

    for (let port = basePort; port <= maxPort; port++) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port);
        return port;
      }
    }

    throw new Error('No available ports for Minecraft server');
  }

  /**
   * Save user to memory
   */
  private saveUser(userConfig: UserConfig): void {
    this.users.set(userConfig.id, userConfig);
    this.usersByUsername.set(userConfig.username, userConfig);
  }

  /**
   * Update user server information
   */
  private updateUserServerInfo(
    userId: string,
    serverInfo: { serverPort?: number; serverId?: string },
  ): void {
    const user = this.users.get(userId);
    if (user && serverInfo.serverPort !== undefined) {
      user.serverPort = serverInfo.serverPort;
      user.updatedAt = new Date();
      this.saveUser(user);
    }
  }

  /**
   * Get all users with pagination
   */
  async getUsers(
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    users: UserConfig[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const allUsers = Array.from(this.users.values());
      const total = allUsers.length;
      const offset = (page - 1) * limit;

      // Sort by creation date (newest first)
      allUsers.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const users = allUsers.slice(offset, offset + limit);

      return {
        users,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error('Failed to get users:', error);
      throw error;
    }
  }

  /**
   * Get user events (simplified - returns empty array since no database)
   */
  async getUserEvents(userId: string, limit: number = 50): Promise<any[]> {
    this.logger.warn(
      `getUserEvents called for user ${userId} but database features are disabled`,
    );
    return [];
  }
}
