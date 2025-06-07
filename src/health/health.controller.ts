import { Controller, Get, Query, Param, Post } from '@nestjs/common';
import { HealthMonitoringService } from '../common/health-monitoring.service';
import { MemoryMonitorService } from '../services/memory-monitor.service';
import { DatabasePoolService } from '../services/database-pool.service';
import { StreamingService } from '../services/streaming.service';
import { PerformanceTrackingService } from '../services/performance-tracking.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthMonitoringService: HealthMonitoringService,
    private readonly memoryMonitorService: MemoryMonitorService,
    private readonly databasePoolService: DatabasePoolService,
    private readonly streamingService: StreamingService,
    private readonly performanceTrackingService: PerformanceTrackingService,
  ) {}

  @Get()
  async checkHealth() {
    const quickHealth =
      await this.healthMonitoringService.getQuickHealthStatus();

    return {
      status: quickHealth.status,
      message: quickHealth.summary,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('ping')
  ping() {
    return {
      status: 'pong',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('detailed')
  async detailedHealth() {
    const fullHealthReport =
      await this.healthMonitoringService.performHealthCheck();
    const memoryStats = this.memoryMonitorService.getMemoryStats();

    return {
      status: fullHealthReport.overall,
      message:
        fullHealthReport.overall === 'healthy'
          ? 'Pegasus Nest API is healthy'
          : 'Pegasus Nest API is experiencing issues',
      timestamp: fullHealthReport.timestamp.toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: fullHealthReport.services.map((service) => ({
        name: service.name,
        status: service.status,
        responseTime: service.responseTime,
        errors: service.errors || [],
      })),
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        pid: process.pid,
        memory: {
          process: memoryStats.process,
          system: memoryStats.system,
          recommendations: this.getMemoryRecommendations(memoryStats),
        },
        metrics: fullHealthReport.systemMetrics,
      },
      recommendations: fullHealthReport.recommendations,
    };
  }

  @Get('system')
  async systemHealth() {
    // Get comprehensive system metrics and health data
    const systemMetrics =
      await this.healthMonitoringService.performHealthCheck();

    return {
      status: systemMetrics.overall,
      timestamp: systemMetrics.timestamp.toISOString(),
      servicesStatus: systemMetrics.services.map((service) => ({
        name: service.name,
        status: service.status,
        lastChecked: service.lastChecked.toISOString(),
        responseTime: service.responseTime || 0,
      })),
      metrics: systemMetrics.systemMetrics,
      recommendations: systemMetrics.recommendations || [],
    };
  }

  @Get('trends')
  async healthTrends() {
    // Get service health trends
    const services = [
      'RobustnessService',
      'GeminiService',
      'CodeCompilerService',
      'FileCompilerService',
      'PluginChatService',
      'CreateService',
    ];

    const trends = {};
    for (const service of services) {
      trends[service] =
        this.healthMonitoringService.getServiceHealthTrend(service);
    }

    return {
      timestamp: new Date().toISOString(),
      trends,
    };
  }

  @Get('memory')
  async memoryStats() {
    const memoryStats = this.memoryMonitorService.getMemoryStats();
    return {
      timestamp: new Date().toISOString(),
      memory: memoryStats,
      recommendations: this.getMemoryRecommendations(memoryStats),
    };
  }

  @Get('memory/gc')
  async forceGarbageCollection() {
    const result = this.memoryMonitorService.forceGarbageCollection();
    return {
      timestamp: new Date().toISOString(),
      ...result,
    };
  }

  @Get('database')
  async databaseStats() {
    const stats = this.databasePoolService.getPoolStats();
    const healthCheck = await this.databasePoolService.healthCheck();

    return {
      timestamp: new Date().toISOString(),
      stats,
      health: healthCheck,
    };
  }

  @Get('performance')
  async performanceOverview() {
    const memoryStats = this.memoryMonitorService.getMemoryStats();
    const databaseStats = this.databasePoolService.getPoolStats();
    const streamingStats = this.streamingService.getStreamingStats();
    const performanceStats =
      this.performanceTrackingService.getPerformanceStats(60);

    // Get process performance metrics
    const processMetrics = {
      uptime: process.uptime(),
      cpuUsage: process.cpuUsage(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      pid: process.pid,
    };

    return {
      timestamp: new Date().toISOString(),
      memory: memoryStats,
      database: databaseStats,
      streaming: streamingStats,
      requests: {
        totalRequests: performanceStats.totalRequests,
        avgResponseTime: performanceStats.avgResponseTime,
        errorRate: performanceStats.errorRate,
      },
      process: processMetrics,
      recommendations: [
        ...this.getMemoryRecommendations(memoryStats),
        ...this.getPerformanceRecommendations(memoryStats, processMetrics),
      ],
    };
  }

  @Get('metrics')
  async performanceMetrics(@Query('timeWindow') timeWindow?: number) {
    const windowMinutes = timeWindow ? parseInt(timeWindow.toString()) : 60;
    const stats =
      this.performanceTrackingService.getPerformanceStats(windowMinutes);

    return {
      timestamp: new Date().toISOString(),
      timeWindow: `${windowMinutes} minutes`,
      ...stats,
    };
  }

  @Get('metrics/report')
  async performanceReport(@Query('timeWindow') timeWindow?: number) {
    const windowHours = timeWindow ? parseInt(timeWindow.toString()) / 60 : 1;
    return this.performanceTrackingService.getPerformanceReport(windowHours);
  }

  @Get('metrics/endpoint/:endpoint')
  async endpointAnalytics(
    @Param('endpoint') endpoint: string,
    @Query('timeWindow') timeWindow?: number,
  ) {
    const windowHours = timeWindow ? parseInt(timeWindow.toString()) / 60 : 1;
    const metrics = this.performanceTrackingService.getEndpointMetrics(
      decodeURIComponent(endpoint),
      windowHours,
    );

    if (!metrics || metrics.length === 0) {
      return {
        message: 'No data found for this endpoint in the specified time window',
        endpoint: decodeURIComponent(endpoint),
        timeWindow: `${windowHours} hours`,
      };
    }

    return {
      endpoint: decodeURIComponent(endpoint),
      timeWindow: `${windowHours} hours`,
      totalRequests: metrics.length,
      metrics: metrics.slice(0, 50), // Limit to first 50 for response size
      avgResponseTime:
        metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length,
      errorRate:
        (metrics.filter((m) => m.statusCode >= 400).length / metrics.length) *
        100,
    };
  }

  @Get('metrics/users')
  async userAnalytics(@Query('timeWindow') timeWindow?: number) {
    const windowHours = timeWindow ? parseInt(timeWindow.toString()) / 60 : 1;
    // For now, return basic user metrics
    const stats =
      this.performanceTrackingService.getPerformanceStats(windowHours);
    return {
      timeWindow: `${windowHours} hours`,
      totalRequests: stats.totalRequests,
      topEndpoints: stats.topEndpoints,
    };
  }

  @Post('metrics/cleanup')
  async cleanupMetrics(@Query('olderThanHours') olderThanHours?: number) {
    const hours = olderThanHours ? parseInt(olderThanHours.toString()) : 24;
    const removedCount = this.performanceTrackingService.clearOldMetrics(hours);

    return {
      timestamp: new Date().toISOString(),
      removedCount,
      olderThanHours: hours,
    };
  }

  private getMemoryRecommendations(memoryStats: any): string[] {
    const recommendations: string[] = [];

    if (memoryStats.process.heapUsagePercent > 75) {
      recommendations.push(
        'Consider running garbage collection - heap usage is high',
      );
    }

    if (memoryStats.system.usagePercent > 80) {
      recommendations.push(
        'System memory usage is high - consider scaling or optimizing',
      );
    }

    if (memoryStats.process.externalMB > 100) {
      recommendations.push(
        'External memory usage is high - check for memory leaks',
      );
    }

    return recommendations;
  }

  private getPerformanceRecommendations(
    memoryStats: any,
    processMetrics: any,
  ): string[] {
    const recommendations: string[] = [];

    // Uptime recommendations
    if (processMetrics.uptime > 7 * 24 * 3600) {
      // 7 days
      recommendations.push(
        'Consider restarting the application - it has been running for over 7 days',
      );
    }

    // Memory growth detection
    if (memoryStats.process.heapUsagePercent > 85) {
      recommendations.push(
        'Memory usage is critically high - immediate attention required',
      );
    }

    // System recommendations
    if (memoryStats.system.usagePercent > 90) {
      recommendations.push(
        'System is under severe memory pressure - consider scaling up',
      );
    }

    return recommendations;
  }
}
