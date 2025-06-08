import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import {
  MinecraftServerService,
  ServerStatus,
} from '../services/minecraft-server.service';
import { UserManagementService } from '../services/user-management.service';

export interface DashboardStats {
  totalServers: number;
  runningServers: number;
  stoppedServers: number;
  errorServers: number;
  totalPlayers: number;
  totalUsers: number;
  systemUptime: number;
  timestamp: string;
}

export interface ServerSummary {
  id: string;
  userId: string;
  serverName: string;
  status: string;
  playerCount: number;
  maxPlayers: number;
  port: number;
  uptime: number;
  lastSeen: Date;
  autoShutdown: boolean;
  inactiveShutdownMinutes: number;
  gameMode?: string;
  difficulty?: string;
}

export interface UserServerDashboard {
  user: {
    id: string;
    username: string;
    email?: string;
  };
  servers: ServerSummary[];
  totalServers: number;
  activeServers: number;
  totalPlayersAcrossServers: number;
}

export interface QuickAction {
  action: 'start' | 'stop' | 'restart';
  serverId: string;
}

@Controller('dashboard')
export class ServerDashboardController {
  private readonly logger = new Logger(ServerDashboardController.name);

  constructor(
    private readonly minecraftServerService: MinecraftServerService,
    private readonly userManagementService: UserManagementService,
  ) {}

  /**
   * Get system-wide dashboard statistics
   * GET /dashboard/stats
   */
  @Get('stats')
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const allServers = await this.minecraftServerService.getAllServers();
      const runningServers = allServers.filter((s) => s.status === 'running');
      const stoppedServers = allServers.filter((s) => s.status === 'stopped');
      const errorServers = allServers.filter((s) => s.status === 'error');

      const totalPlayers = runningServers.reduce(
        (sum, server) => sum + server.playerCount,
        0,
      );

      // Get total users count (simplified - would normally come from user service)
      const userIds = new Set(allServers.map((s) => s.userId));

      return {
        totalServers: allServers.length,
        runningServers: runningServers.length,
        stoppedServers: stoppedServers.length,
        errorServers: errorServers.length,
        totalPlayers,
        totalUsers: userIds.size,
        systemUptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        'Failed to get dashboard statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get user-specific dashboard
   * GET /dashboard/users/:userId
   */
  @Get('users/:userId')
  async getUserDashboard(
    @Param('userId') userId: string,
  ): Promise<UserServerDashboard> {
    try {
      const user = await this.userManagementService.getUserById(userId);
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      const servers = await this.minecraftServerService.getUserServers(userId);
      const activeServers = servers.filter((s) => s.status === 'running');
      const totalPlayersAcrossServers = activeServers.reduce(
        (sum, server) => sum + server.playerCount,
        0,
      );

      const serverSummaries: ServerSummary[] = servers.map((server) => ({
        id: server.id,
        userId: server.userId,
        serverName: server.serverName || `Server ${server.id}`,
        status: server.status,
        playerCount: server.playerCount,
        maxPlayers: server.maxPlayers,
        port: server.port,
        uptime: server.uptime,
        lastSeen: server.lastSeen,
        autoShutdown: server.autoShutdown,
        inactiveShutdownMinutes: server.inactiveShutdownMinutes,
        gameMode: server.gameMode,
        difficulty: server.difficulty,
      }));

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
        servers: serverSummaries,
        totalServers: servers.length,
        activeServers: activeServers.length,
        totalPlayersAcrossServers,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to get user dashboard',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get server summary list with pagination
   * GET /dashboard/servers
   */
  @Get('servers')
  async getServerList(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ): Promise<{
    servers: ServerSummary[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      let allServers = await this.minecraftServerService.getAllServers();

      // Filter by status if provided
      if (status) {
        allServers = allServers.filter((s) => s.status === status);
      }

      // Filter by userId if provided
      if (userId) {
        allServers = allServers.filter((s) => s.userId === userId);
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedServers = allServers.slice(startIndex, endIndex);

      const serverSummaries: ServerSummary[] = paginatedServers.map(
        (server) => ({
          id: server.id,
          userId: server.userId,
          serverName: server.serverName || `Server ${server.id}`,
          status: server.status,
          playerCount: server.playerCount,
          maxPlayers: server.maxPlayers,
          port: server.port,
          uptime: server.uptime,
          lastSeen: server.lastSeen,
          autoShutdown: server.autoShutdown,
          inactiveShutdownMinutes: server.inactiveShutdownMinutes,
          gameMode: server.gameMode,
          difficulty: server.difficulty,
        }),
      );

      return {
        servers: serverSummaries,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: allServers.length,
          totalPages: Math.ceil(allServers.length / limitNum),
        },
      };
    } catch (error) {
      throw new HttpException(
        'Failed to get server list',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Execute quick actions on servers
   * POST /dashboard/quick-action
   */
  @Post('quick-action')
  async executeQuickAction(@Body() actionDto: QuickAction): Promise<{
    success: boolean;
    message: string;
    serverId: string;
    action: string;
  }> {
    try {
      const { action, serverId } = actionDto;

      switch (action) {
        case 'start':
          await this.minecraftServerService.startServer(serverId);
          break;
        case 'stop':
          await this.minecraftServerService.stopServer(serverId);
          break;
        case 'restart':
          await this.minecraftServerService.restartServer(serverId);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      return {
        success: true,
        message: `Server ${action} executed successfully`,
        serverId,
        action,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: `Failed to execute ${actionDto.action}`,
          error: error.message,
          serverId: actionDto.serverId,
          action: actionDto.action,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get real-time server status updates
   * GET /dashboard/servers/:serverId/live-status
   */
  @Get('servers/:serverId/live-status')
  async getLiveServerStatus(@Param('serverId') serverId: string): Promise<{
    server: ServerStatus;
    lastUpdate: string;
    nextCheck: string;
  }> {
    try {
      // Trigger immediate monitoring
      await this.minecraftServerService.monitorPlayerActivity(serverId);

      const server =
        await this.minecraftServerService.getServerStatus(serverId);
      if (!server) {
        throw new HttpException('Server not found', HttpStatus.NOT_FOUND);
      }

      const now = new Date();
      const nextCheck = new Date(now.getTime() + 2 * 60 * 1000); // Next check in 2 minutes

      return {
        server,
        lastUpdate: now.toISOString(),
        nextCheck: nextCheck.toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to get live server status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get activity summary for all servers
   * GET /dashboard/activity
   */
  @Get('activity')
  async getActivitySummary(): Promise<{
    recentlyActive: ServerSummary[];
    currentlyEmpty: ServerSummary[];
    autoShutdownEnabled: ServerSummary[];
    totalActivity: {
      serversWithPlayers: number;
      emptyServers: number;
      averagePlayersPerServer: number;
    };
  }> {
    try {
      const allServers = await this.minecraftServerService.getAllServers();
      const runningServers = allServers.filter((s) => s.status === 'running');

      const now = new Date();
      const recentThreshold = 30 * 60 * 1000; // 30 minutes

      const recentlyActive = runningServers
        .filter(
          (s) =>
            s.playerCount > 0 ||
            now.getTime() - s.lastPlayerActivity.getTime() < recentThreshold,
        )
        .map((server) => ({
          id: server.id,
          userId: server.userId,
          serverName: server.serverName || `Server ${server.id}`,
          status: server.status,
          playerCount: server.playerCount,
          maxPlayers: server.maxPlayers,
          port: server.port,
          uptime: server.uptime,
          lastSeen: server.lastSeen,
          autoShutdown: server.autoShutdown,
          inactiveShutdownMinutes: server.inactiveShutdownMinutes,
          gameMode: server.gameMode,
          difficulty: server.difficulty,
        }))
        .slice(0, 10); // Limit to 10 most recent

      const currentlyEmpty = runningServers
        .filter((s) => s.playerCount === 0)
        .map((server) => ({
          id: server.id,
          userId: server.userId,
          serverName: server.serverName || `Server ${server.id}`,
          status: server.status,
          playerCount: server.playerCount,
          maxPlayers: server.maxPlayers,
          port: server.port,
          uptime: server.uptime,
          lastSeen: server.lastSeen,
          autoShutdown: server.autoShutdown,
          inactiveShutdownMinutes: server.inactiveShutdownMinutes,
          gameMode: server.gameMode,
          difficulty: server.difficulty,
        }));

      const autoShutdownEnabled = allServers
        .filter((s) => s.autoShutdown)
        .map((server) => ({
          id: server.id,
          userId: server.userId,
          serverName: server.serverName || `Server ${server.id}`,
          status: server.status,
          playerCount: server.playerCount,
          maxPlayers: server.maxPlayers,
          port: server.port,
          uptime: server.uptime,
          lastSeen: server.lastSeen,
          autoShutdown: server.autoShutdown,
          inactiveShutdownMinutes: server.inactiveShutdownMinutes,
          gameMode: server.gameMode,
          difficulty: server.difficulty,
        }));

      const serversWithPlayers = runningServers.filter(
        (s) => s.playerCount > 0,
      ).length;
      const emptyServers = runningServers.filter(
        (s) => s.playerCount === 0,
      ).length;
      const totalPlayers = runningServers.reduce(
        (sum, s) => sum + s.playerCount,
        0,
      );
      const averagePlayersPerServer =
        runningServers.length > 0 ? totalPlayers / runningServers.length : 0;

      return {
        recentlyActive,
        currentlyEmpty,
        autoShutdownEnabled,
        totalActivity: {
          serversWithPlayers,
          emptyServers,
          averagePlayersPerServer:
            Math.round(averagePlayersPerServer * 100) / 100,
        },
      };
    } catch (error) {
      throw new HttpException(
        'Failed to get activity summary',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
