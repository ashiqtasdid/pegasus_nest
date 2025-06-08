import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpException,
  Logger,
  Patch,
} from '@nestjs/common';
import {
  MinecraftServerService,
  MinecraftServerConfig,
  ServerStatus,
} from '../services/minecraft-server.service';
import {
  UserManagementService,
  CreateUserRequest,
  UserConfig,
} from '../services/user-management.service';

export interface CreateServerDto {
  userId: string;
  serverName: string;
  port?: number;
  maxPlayers?: number;
  memory?: string;
  gameMode?: 'survival' | 'creative' | 'adventure' | 'spectator';
  difficulty?: 'peaceful' | 'easy' | 'normal' | 'hard';
  plugins?: string[];
  autoStart?: boolean;
  autoShutdown?: boolean;
  inactiveShutdownMinutes?: number;
}

export interface UpdateServerDto {
  serverName?: string;
  maxPlayers?: number;
  gameMode?: 'survival' | 'creative' | 'adventure' | 'spectator';
  difficulty?: 'peaceful' | 'easy' | 'normal' | 'hard';
  memory?: string;
  pvp?: boolean;
  autoShutdown?: boolean;
  inactiveShutdownMinutes?: number;
}

export interface ServerCommandDto {
  command: string;
}

export interface AutoShutdownDto {
  enabled: boolean;
  inactiveMinutes: number;
}

export interface CreateUserDto extends CreateUserRequest {}

export interface ServerControlResponse {
  success: boolean;
  message: string;
  data?: any;
  timestamp: string;
}

@Controller('minecraft')
export class MinecraftServerController {
  private readonly logger = new Logger(MinecraftServerController.name);

  constructor(
    private readonly minecraftServerService: MinecraftServerService,
    private readonly userManagementService: UserManagementService,
  ) {}

  // =============================================================================
  // USER MANAGEMENT ENDPOINTS
  // =============================================================================

  /**
   * Create a new user with Minecraft server
   * POST /minecraft/users
   */
  @Post('users')
  async createUser(
    @Body() createUserDto: CreateUserDto,
  ): Promise<ServerControlResponse> {
    try {
      const user = await this.userManagementService.createUser(createUserDto);

      return {
        success: true,
        message: 'User created successfully',
        data: {
          user,
          serverInfo: user.hasMinecraftServer
            ? {
                port: user.serverPort,
                serverName: user.serverName,
              }
            : null,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to create user',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get user information
   * GET /minecraft/users/:userId
   */
  @Get('users/:userId')
  async getUser(
    @Param('userId') userId: string,
  ): Promise<ServerControlResponse> {
    try {
      const user = await this.userManagementService.getUserById(userId);

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      const servers = await this.minecraftServerService.getUserServers(userId);

      return {
        success: true,
        message: 'User retrieved successfully',
        data: {
          user,
          servers,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get user',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // =============================================================================
  // SERVER LIFECYCLE MANAGEMENT
  // =============================================================================

  /**
   * Create a new Minecraft server
   * POST /minecraft/servers
   */
  @Post('servers')
  async createServer(
    @Body() createServerDto: CreateServerDto,
  ): Promise<ServerControlResponse> {
    try {
      const config: MinecraftServerConfig = {
        userId: createServerDto.userId,
        serverName: createServerDto.serverName,
        port: createServerDto.port || 25565,
        maxPlayers: createServerDto.maxPlayers || 20,
        gameMode: createServerDto.gameMode || 'survival',
        difficulty: createServerDto.difficulty || 'normal',
        memoryLimit: createServerDto.memory || '2G',
        plugins: createServerDto.plugins || [],
      };

      const server = await this.minecraftServerService.createUserServer(config);

      // Set auto-shutdown if specified
      if (createServerDto.autoShutdown !== undefined) {
        await this.minecraftServerService.updateAutoShutdownSettings(
          server.id,
          createServerDto.autoShutdown,
          createServerDto.inactiveShutdownMinutes || 10,
        );
      }

      return {
        success: true,
        message: 'Server created successfully',
        data: { server },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to create server',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Start a server
   * POST /minecraft/servers/:serverId/start
   */
  @Post('servers/:serverId/start')
  async startServer(
    @Param('serverId') serverId: string,
  ): Promise<ServerControlResponse> {
    try {
      await this.minecraftServerService.startServer(serverId);

      return {
        success: true,
        message: 'Server started successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to start server',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Stop a server
   * POST /minecraft/servers/:serverId/stop
   */
  @Post('servers/:serverId/stop')
  async stopServer(
    @Param('serverId') serverId: string,
  ): Promise<ServerControlResponse> {
    try {
      await this.minecraftServerService.stopServer(serverId);

      return {
        success: true,
        message: 'Server stopped successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to stop server',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Restart a server
   * POST /minecraft/servers/:serverId/restart
   */
  @Post('servers/:serverId/restart')
  async restartServer(
    @Param('serverId') serverId: string,
  ): Promise<ServerControlResponse> {
    try {
      await this.minecraftServerService.restartServer(serverId);

      return {
        success: true,
        message: 'Server restarted successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to restart server',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Delete a server
   * DELETE /minecraft/servers/:serverId
   */
  @Delete('servers/:serverId')
  async deleteServer(
    @Param('serverId') serverId: string,
  ): Promise<ServerControlResponse> {
    try {
      await this.minecraftServerService.removeServer(serverId);

      return {
        success: true,
        message: 'Server deleted successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to delete server',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // =============================================================================
  // SERVER STATUS AND MONITORING
  // =============================================================================

  /**
   * Get server status
   * GET /minecraft/servers/:serverId
   */
  @Get('servers/:serverId')
  async getServerStatus(
    @Param('serverId') serverId: string,
  ): Promise<ServerControlResponse> {
    try {
      const server =
        await this.minecraftServerService.getServerStatus(serverId);

      if (!server) {
        throw new HttpException('Server not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        message: 'Server status retrieved successfully',
        data: { server },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get server status',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all servers for a user
   * GET /minecraft/users/:userId/servers
   */
  @Get('users/:userId/servers')
  async getUserServers(
    @Param('userId') userId: string,
  ): Promise<ServerControlResponse> {
    try {
      const servers = await this.minecraftServerService.getUserServers(userId);

      return {
        success: true,
        message: 'User servers retrieved successfully',
        data: { servers, count: servers.length },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get user servers',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all servers (admin endpoint)
   * GET /minecraft/servers
   */
  @Get('servers')
  async getAllServers(): Promise<ServerControlResponse> {
    try {
      const servers = await this.minecraftServerService.getAllServers();

      return {
        success: true,
        message: 'All servers retrieved successfully',
        data: { servers, count: servers.length },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get all servers',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get server metrics
   * GET /minecraft/servers/:serverId/metrics
   */
  @Get('servers/:serverId/metrics')
  async getServerMetrics(
    @Param('serverId') serverId: string,
  ): Promise<ServerControlResponse> {
    try {
      const metrics =
        await this.minecraftServerService.getServerMetrics(serverId);

      return {
        success: true,
        message: 'Server metrics retrieved successfully',
        data: { metrics },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get server metrics',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get server logs
   * GET /minecraft/servers/:serverId/logs
   */
  @Get('servers/:serverId/logs')
  async getServerLogs(
    @Param('serverId') serverId: string,
    @Query('lines') lines?: string,
  ): Promise<ServerControlResponse> {
    try {
      const logLines = parseInt(lines) || 100;
      const logs = await this.minecraftServerService.getServerLogs(
        serverId,
        logLines,
      );

      return {
        success: true,
        message: 'Server logs retrieved successfully',
        data: { logs, count: logs.length },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get server logs',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get online players
   * GET /minecraft/servers/:serverId/players
   */
  @Get('servers/:serverId/players')
  async getOnlinePlayers(
    @Param('serverId') serverId: string,
  ): Promise<ServerControlResponse> {
    try {
      const players =
        await this.minecraftServerService.getOnlinePlayers(serverId);

      return {
        success: true,
        message: 'Online players retrieved successfully',
        data: { players, count: players.length },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to get online players',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // =============================================================================
  // SERVER CONFIGURATION
  // =============================================================================

  /**
   * Update server configuration
   * PATCH /minecraft/servers/:serverId/config
   */
  @Patch('servers/:serverId/config')
  async updateServerConfig(
    @Param('serverId') serverId: string,
    @Body() updateDto: UpdateServerDto,
  ): Promise<ServerControlResponse> {
    try {
      const updatedServer =
        await this.minecraftServerService.updateServerConfig(
          serverId,
          updateDto,
        );

      return {
        success: true,
        message: 'Server configuration updated successfully',
        data: { server: updatedServer },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to update server configuration',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Update auto-shutdown settings
   * PATCH /minecraft/servers/:serverId/auto-shutdown
   */
  @Patch('servers/:serverId/auto-shutdown')
  async updateAutoShutdown(
    @Param('serverId') serverId: string,
    @Body() autoShutdownDto: AutoShutdownDto,
  ): Promise<ServerControlResponse> {
    try {
      await this.minecraftServerService.updateAutoShutdownSettings(
        serverId,
        autoShutdownDto.enabled,
        autoShutdownDto.inactiveMinutes,
      );

      return {
        success: true,
        message: 'Auto-shutdown settings updated successfully',
        data: {
          enabled: autoShutdownDto.enabled,
          inactiveMinutes: autoShutdownDto.inactiveMinutes,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to update auto-shutdown settings',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // =============================================================================
  // SERVER COMMANDS AND CONTROL
  // =============================================================================

  /**
   * Execute a command on the server
   * POST /minecraft/servers/:serverId/command
   */
  @Post('servers/:serverId/command')
  async executeCommand(
    @Param('serverId') serverId: string,
    @Body() commandDto: ServerCommandDto,
  ): Promise<ServerControlResponse> {
    try {
      const result = await this.minecraftServerService.executeCommand(
        serverId,
        commandDto.command,
      );

      return {
        success: true,
        message: 'Command executed successfully',
        data: { command: commandDto.command, result },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to execute command',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Install plugins on a server
   * POST /minecraft/servers/:serverId/plugins
   */
  @Post('servers/:serverId/plugins')
  async installPlugins(
    @Param('serverId') serverId: string,
    @Body() pluginsDto: { plugins: string[] },
  ): Promise<ServerControlResponse> {
    try {
      const installedPlugins = await this.minecraftServerService.installPlugins(
        serverId,
        pluginsDto.plugins,
      );

      return {
        success: true,
        message: 'Plugins installed successfully',
        data: { installedPlugins },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to install plugins',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Manually trigger player activity monitoring
   * POST /minecraft/servers/:serverId/monitor
   */
  @Post('servers/:serverId/monitor')
  async monitorServer(
    @Param('serverId') serverId: string,
  ): Promise<ServerControlResponse> {
    try {
      await this.minecraftServerService.monitorPlayerActivity(serverId);
      const server =
        await this.minecraftServerService.getServerStatus(serverId);

      return {
        success: true,
        message: 'Server monitoring triggered successfully',
        data: {
          playerCount: server?.playerCount,
          onlinePlayers: server?.onlinePlayers,
          lastPlayerActivity: server?.lastPlayerActivity,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to monitor server',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // =============================================================================
  // HEALTH AND DIAGNOSTICS
  // =============================================================================

  /**
   * Check if Minecraft service is healthy
   * GET /minecraft/health
   */
  @Get('health')
  async getServiceHealth(): Promise<ServerControlResponse> {
    try {
      const allServers = await this.minecraftServerService.getAllServers();
      const runningServers = allServers.filter((s) => s.status === 'running');
      const errorServers = allServers.filter((s) => s.status === 'error');

      return {
        success: true,
        message: 'Minecraft service is healthy',
        data: {
          totalServers: allServers.length,
          runningServers: runningServers.length,
          errorServers: errorServers.length,
          uptime: process.uptime(),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Minecraft service health check failed',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
