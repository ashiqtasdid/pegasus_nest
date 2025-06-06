import { Controller, Get } from '@nestjs/common';
import { HealthMonitoringService } from '../common/health-monitoring.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthMonitoringService: HealthMonitoringService,
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
    const memoryUsage = process.memoryUsage();

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
          rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
          external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB',
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
}
