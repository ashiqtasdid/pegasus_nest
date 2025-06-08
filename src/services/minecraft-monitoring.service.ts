import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MinecraftServerService } from './minecraft-server.service';
import { UserManagementService } from './user-management.service';
import { MinecraftStatusGateway } from '../gateways/minecraft-status.gateway';
import Docker from 'dockerode';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ServerHealthMetrics {
  userId: string;
  containerId: string;
  status: 'healthy' | 'unhealthy' | 'starting' | 'stopped';
  uptime: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  playerCount: number;
  lastPlayerActivity: Date;
  responseTime: number;
  errors: string[];
  warnings: string[];
  timestamp: Date;
}

interface SystemMetrics {
  totalServers: number;
  activeServers: number;
  totalUsers: number;
  systemCpuUsage: number;
  systemMemoryUsage: number;
  systemDiskUsage: number;
  averageResponseTime: number;
  errorCount: number;
  warningCount: number;
  timestamp: Date;
}

@Injectable()
export class MinecraftMonitoringService {
  private readonly logger = new Logger(MinecraftMonitoringService.name);
  private docker: Docker;
  private healthMetrics = new Map<string, ServerHealthMetrics>();
  private systemMetrics: SystemMetrics | null = null;

  constructor(
    private readonly minecraftServerService: MinecraftServerService,
    private readonly userManagementService: UserManagementService,
    private readonly eventEmitter: EventEmitter2,
    private readonly statusGateway: MinecraftStatusGateway,
  ) {
    this.docker = new Docker();
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async performHealthChecks() {
    try {
      this.logger.debug('Performing health checks...');
      const userResult = await this.userManagementService.getUsers();
      const users = userResult.users;

      for (const user of users) {
        if (user.hasMinecraftServer) {
          await this.checkServerHealth(user.id);
        }
      }

      await this.updateSystemMetrics();
    } catch (error) {
      this.logger.error('Error during health checks:', error);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async performDeepHealthChecks() {
    try {
      this.logger.debug('Performing deep health checks...');
      const userResult = await this.userManagementService.getUsers();
      const users = userResult.users;

      for (const user of users) {
        if (user.hasMinecraftServer) {
          await this.performDeepServerCheck(user.id);
        }
      }
    } catch (error) {
      this.logger.error('Error during deep health checks:', error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldMetrics() {
    try {
      this.logger.debug('Cleaning up old metrics...');
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

      for (const [userId, metrics] of this.healthMetrics.entries()) {
        if (metrics.timestamp < cutoffTime) {
          this.healthMetrics.delete(userId);
        }
      }
    } catch (error) {
      this.logger.error('Error during metrics cleanup:', error);
    }
  }

  private async checkServerHealth(userId: string): Promise<void> {
    try {
      const containerName = `minecraft-server-${userId}`;
      const container = this.docker.getContainer(containerName);

      const [containerInfo, stats] = await Promise.all([
        container.inspect().catch(() => null),
        this.getContainerStats(containerName).catch(() => null),
      ]);

      if (!containerInfo) {
        this.logger.warn(`Container not found for user ${userId}`);
        await this.handleMissingContainer(userId);
        return;
      }

      const userServers =
        await this.minecraftServerService.getUserServers(userId);
      const serverStatus = userServers.length > 0 ? userServers[0] : null;
      const responseTime = await this.measureResponseTime(userId);

      const metrics: ServerHealthMetrics = {
        userId,
        containerId: containerInfo.Id,
        status: this.determineHealthStatus(
          containerInfo,
          serverStatus,
          responseTime,
        ),
        uptime: this.calculateUptime(containerInfo.State.StartedAt),
        cpuUsage: stats?.cpuUsage || 0,
        memoryUsage: stats?.memoryUsage || 0,
        diskUsage: stats?.diskUsage || 0,
        playerCount: serverStatus?.playerCount || 0,
        lastPlayerActivity: serverStatus?.lastSeen || new Date(),
        responseTime,
        errors: await this.extractErrors(userId),
        warnings: await this.extractWarnings(userId),
        timestamp: new Date(),
      };

      const previousMetrics = this.healthMetrics.get(userId);
      this.healthMetrics.set(userId, metrics);

      // Check for status changes
      if (previousMetrics && previousMetrics.status !== metrics.status) {
        await this.handleStatusChange(
          userId,
          previousMetrics.status,
          metrics.status,
        );
      }

      // Check for performance issues
      await this.checkPerformanceIssues(userId, metrics);

      // Broadcast metrics to connected clients
      await this.statusGateway.broadcastSystemMetrics(userId, metrics);

      this.logger.debug(
        `Health check completed for user ${userId}: ${metrics.status}`,
      );
    } catch (error) {
      this.logger.error(`Health check failed for user ${userId}:`, error);
    }
  }

  private async performDeepServerCheck(userId: string): Promise<void> {
    try {
      // Check disk space
      const diskUsage = await this.checkDiskUsage(userId);
      if (diskUsage > 90) {
        this.logger.warn(`High disk usage for user ${userId}: ${diskUsage}%`);
        await this.eventEmitter.emitAsync('server.disk.warning', {
          userId,
          diskUsage,
        });
      }

      // Check log file size
      const logSize = await this.checkLogFileSize(userId);
      if (logSize > 100 * 1024 * 1024) {
        // 100MB
        this.logger.warn(`Large log file for user ${userId}: ${logSize} bytes`);
        await this.rotateLogFile(userId);
      }

      // Check backup status
      await this.checkBackupStatus(userId);

      // Check plugin status
      await this.checkPluginStatus(userId);

      // Check world corruption
      await this.checkWorldIntegrity(userId);
    } catch (error) {
      this.logger.error(`Deep health check failed for user ${userId}:`, error);
    }
  }

  private async getContainerStats(containerName: string): Promise<any> {
    try {
      const container = this.docker.getContainer(containerName);
      const stats = await container.stats({ stream: false });

      // Calculate CPU usage percentage
      const cpuDelta =
        stats.cpu_stats.cpu_usage.total_usage -
        stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta =
        stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuUsage =
        (cpuDelta / systemDelta) *
        stats.cpu_stats.cpu_usage.percpu_usage.length *
        100;

      // Calculate memory usage percentage
      const memoryUsage =
        (stats.memory_stats.usage / stats.memory_stats.limit) * 100;

      return {
        cpuUsage: Math.round(cpuUsage * 100) / 100,
        memoryUsage: Math.round(memoryUsage * 100) / 100,
        diskUsage: 0, // Will be calculated separately
      };
    } catch (error) {
      this.logger.error(
        `Failed to get container stats for ${containerName}:`,
        error,
      );
      return null;
    }
  }

  private async measureResponseTime(userId: string): Promise<number> {
    const startTime = Date.now();
    try {
      await this.minecraftServerService.executeCommand(userId, 'list');
      return Date.now() - startTime;
    } catch (error) {
      return -1; // Indicates server is not responding
    }
  }

  private determineHealthStatus(
    containerInfo: any,
    serverStatus: any,
    responseTime: number,
  ): 'healthy' | 'unhealthy' | 'starting' | 'stopped' {
    if (!containerInfo.State.Running) {
      return 'stopped';
    }

    if (containerInfo.State.Health?.Status === 'starting') {
      return 'starting';
    }

    if (responseTime === -1 || responseTime > 10000) {
      return 'unhealthy';
    }

    return 'healthy';
  }

  private calculateUptime(startedAt: string): number {
    const startTime = new Date(startedAt);
    return Math.floor((Date.now() - startTime.getTime()) / 1000);
  }

  private async extractErrors(userId: string): Promise<string[]> {
    try {
      const logs = await this.minecraftServerService.getServerLogs(userId, 100);
      return logs
        .filter(
          (line) =>
            line.toLowerCase().includes('error') ||
            line.toLowerCase().includes('exception'),
        )
        .slice(-5); // Last 5 errors
    } catch (error) {
      return [];
    }
  }

  private async extractWarnings(userId: string): Promise<string[]> {
    try {
      const logs = await this.minecraftServerService.getServerLogs(userId, 100);
      return logs
        .filter((line) => line.toLowerCase().includes('warn'))
        .slice(-5); // Last 5 warnings
    } catch (error) {
      return [];
    }
  }

  private async handleMissingContainer(userId: string): Promise<void> {
    this.logger.warn(
      `Container missing for user ${userId}, attempting to recreate...`,
    );
    try {
      await this.minecraftServerService.startServer(userId);
      await this.eventEmitter.emitAsync('server.recreated', { userId });
    } catch (error) {
      this.logger.error(
        `Failed to recreate container for user ${userId}:`,
        error,
      );
      await this.eventEmitter.emitAsync('server.recreation.failed', {
        userId,
        error: error.message,
      });
    }
  }

  private async handleStatusChange(
    userId: string,
    previousStatus: string,
    newStatus: string,
  ): Promise<void> {
    this.logger.log(
      `Server status changed for user ${userId}: ${previousStatus} -> ${newStatus}`,
    );

    await this.eventEmitter.emitAsync('server.status.changed', {
      userId,
      previousStatus,
      newStatus,
      timestamp: new Date(),
    });

    await this.statusGateway.broadcastServerEvent(userId, 'status-change', {
      previousStatus,
      newStatus,
    });
  }

  private async checkPerformanceIssues(
    userId: string,
    metrics: ServerHealthMetrics,
  ): Promise<void> {
    // Check CPU usage
    if (metrics.cpuUsage > 80) {
      this.logger.warn(
        `High CPU usage for user ${userId}: ${metrics.cpuUsage}%`,
      );
      await this.eventEmitter.emitAsync('server.performance.cpu.warning', {
        userId,
        cpuUsage: metrics.cpuUsage,
      });
    }

    // Check memory usage
    if (metrics.memoryUsage > 85) {
      this.logger.warn(
        `High memory usage for user ${userId}: ${metrics.memoryUsage}%`,
      );
      await this.eventEmitter.emitAsync('server.performance.memory.warning', {
        userId,
        memoryUsage: metrics.memoryUsage,
      });
    }

    // Check response time
    if (metrics.responseTime > 5000) {
      this.logger.warn(
        `Slow response time for user ${userId}: ${metrics.responseTime}ms`,
      );
      await this.eventEmitter.emitAsync('server.performance.response.warning', {
        userId,
        responseTime: metrics.responseTime,
      });
    }
  }

  private async checkDiskUsage(userId: string): Promise<number> {
    try {
      const serverPath = path.join(
        process.cwd(),
        'data',
        'minecraft-servers',
        userId,
      );
      const stats = await fs.stat(serverPath);
      // This is a simplified calculation - you might want to use a more accurate method
      return 50; // Placeholder
    } catch (error) {
      return 0;
    }
  }

  private async checkLogFileSize(userId: string): Promise<number> {
    try {
      const logPath = path.join(
        process.cwd(),
        'data',
        'minecraft-servers',
        userId,
        'logs',
        'latest.log',
      );
      const stats = await fs.stat(logPath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  private async rotateLogFile(userId: string): Promise<void> {
    try {
      const logDir = path.join(
        process.cwd(),
        'data',
        'minecraft-servers',
        userId,
        'logs',
      );
      const logPath = path.join(logDir, 'latest.log');
      const rotatedPath = path.join(logDir, `latest-${Date.now()}.log`);

      await fs.rename(logPath, rotatedPath);
      this.logger.log(`Log file rotated for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to rotate log file for user ${userId}:`, error);
    }
  }

  private async checkBackupStatus(userId: string): Promise<void> {
    // Check if backup is recent (within last 24 hours)
    try {
      const backupPath = path.join(
        process.cwd(),
        'data',
        'minecraft-servers',
        userId,
        'backups',
      );
      const files = await fs.readdir(backupPath);

      if (files.length === 0) {
        await this.eventEmitter.emitAsync('server.backup.missing', { userId });
        return;
      }

      const fileStats = await Promise.all(
        files.map(async (file) => ({
          name: file,
          time: await fs.stat(path.join(backupPath, file)),
        })),
      );

      const latestBackup = fileStats.sort(
        (a, b) => b.time.mtime.getTime() - a.time.mtime.getTime(),
      )[0];

      const backupAge = Date.now() - latestBackup.time.mtime.getTime();
      if (backupAge > 24 * 60 * 60 * 1000) {
        // 24 hours
        await this.eventEmitter.emitAsync('server.backup.stale', {
          userId,
          age: backupAge,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to check backup status for user ${userId}:`,
        error,
      );
    }
  }

  private async checkPluginStatus(userId: string): Promise<void> {
    try {
      const pluginInfo = await this.minecraftServerService.executeCommand(
        userId,
        'plugins',
      );
      // Parse plugin information and check for issues
      // This is a simplified implementation
    } catch (error) {
      this.logger.error(
        `Failed to check plugin status for user ${userId}:`,
        error,
      );
    }
  }

  private async checkWorldIntegrity(userId: string): Promise<void> {
    try {
      const worldPath = path.join(
        process.cwd(),
        'data',
        'minecraft-servers',
        userId,
        'world',
      );

      // Check if essential world files exist
      const essentialFiles = ['level.dat', 'region'];
      for (const file of essentialFiles) {
        const filePath = path.join(worldPath, file);
        try {
          await fs.access(filePath);
        } catch (error) {
          await this.eventEmitter.emitAsync('server.world.corruption', {
            userId,
            missingFile: file,
          });
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to check world integrity for user ${userId}:`,
        error,
      );
    }
  }

  private async updateSystemMetrics(): Promise<void> {
    try {
      const userResult = await this.userManagementService.getUsers();
      const users = userResult.users || [];
      const activeServers = Array.from(this.healthMetrics.values()).filter(
        (m) => m.status === 'healthy',
      ).length;

      this.systemMetrics = {
        totalServers: users.filter((u) => u.hasMinecraftServer).length,
        activeServers,
        totalUsers: users.length,
        systemCpuUsage: 0, // Would need system-level monitoring
        systemMemoryUsage: 0, // Would need system-level monitoring
        systemDiskUsage: 0, // Would need system-level monitoring
        averageResponseTime: this.calculateAverageResponseTime(),
        errorCount: this.countTotalErrors(),
        warningCount: this.countTotalWarnings(),
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to update system metrics:', error);
    }
  }

  private calculateAverageResponseTime(): number {
    const metrics = Array.from(this.healthMetrics.values());
    if (metrics.length === 0) return 0;

    const validResponseTimes = metrics.filter((m) => m.responseTime > 0);
    if (validResponseTimes.length === 0) return 0;

    return (
      validResponseTimes.reduce((sum, m) => sum + m.responseTime, 0) /
      validResponseTimes.length
    );
  }

  private countTotalErrors(): number {
    return Array.from(this.healthMetrics.values()).reduce(
      (sum, m) => sum + m.errors.length,
      0,
    );
  }

  private countTotalWarnings(): number {
    return Array.from(this.healthMetrics.values()).reduce(
      (sum, m) => sum + m.warnings.length,
      0,
    );
  }

  // Public methods for external access
  public getServerMetrics(userId: string): ServerHealthMetrics | null {
    return this.healthMetrics.get(userId) || null;
  }

  public getAllServerMetrics(): ServerHealthMetrics[] {
    return Array.from(this.healthMetrics.values());
  }

  public getSystemMetrics(): SystemMetrics | null {
    return this.systemMetrics;
  }

  public async forceHealthCheck(
    userId: string,
  ): Promise<ServerHealthMetrics | null> {
    await this.checkServerHealth(userId);
    return this.getServerMetrics(userId);
  }
}
