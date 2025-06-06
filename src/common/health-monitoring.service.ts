import { Injectable, Logger } from '@nestjs/common';
import { RobustnessService } from './robustness.service';
import { FileCompilerService } from '../services/file-compiler.service';
import { CodeCompilerService } from '../services/code-compiler.service';
import { GeminiService } from '../services/gemini.service';
import { PluginChatService } from '../services/plugin-chat.service';
import { CreateService } from '../services/create.service';

export interface ServiceHealthStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastChecked: Date;
  responseTime?: number;
  details?: any;
  errors?: string[];
}

export interface SystemHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: ServiceHealthStatus[];
  systemMetrics: any;
  recommendations?: string[];
}

@Injectable()
export class HealthMonitoringService {
  private readonly logger = new Logger(HealthMonitoringService.name);
  private healthHistory: Map<string, ServiceHealthStatus[]> = new Map();
  private readonly HEALTH_HISTORY_LIMIT = 50;

  constructor(
    private readonly robustnessService: RobustnessService,
    private readonly fileCompilerService: FileCompilerService,
    private readonly codeCompilerService: CodeCompilerService,
    private readonly geminiService: GeminiService,
    private readonly pluginChatService: PluginChatService,
    private readonly createService: CreateService,
  ) {}

  /**
   * Perform comprehensive health check of all services
   */
  async performHealthCheck(): Promise<SystemHealthReport> {
    const startTime = Date.now();
    this.logger.log('Starting comprehensive health check');

    const serviceChecks = await Promise.allSettled([
      this.checkRobustnessService(),
      this.checkFileCompilerService(),
      this.checkCodeCompilerService(),
      this.checkGeminiService(),
      this.checkPluginChatService(),
      this.checkCreateService(),
    ]);

    const services: ServiceHealthStatus[] = serviceChecks.map(
      (result, index) => {
        const serviceNames = [
          'RobustnessService',
          'FileCompilerService',
          'CodeCompilerService',
          'GeminiService',
          'PluginChatService',
          'CreateService',
        ];

        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            name: serviceNames[index],
            status: 'unhealthy',
            lastChecked: new Date(),
            errors: [result.reason?.message || 'Unknown error'],
          };
        }
      },
    );

    // Get system metrics
    const systemMetrics = await this.robustnessService.getSystemMetrics();

    // Determine overall system health
    const overall = this.determineOverallHealth(services, systemMetrics);

    // Generate recommendations
    const recommendations = this.generateHealthRecommendations(
      services,
      systemMetrics,
    );

    const report: SystemHealthReport = {
      overall,
      timestamp: new Date(),
      services,
      systemMetrics,
      recommendations,
    };

    // Store health history
    this.storeHealthHistory(services);

    const checkDuration = Date.now() - startTime;
    this.logger.log(
      `Health check completed in ${checkDuration}ms - Overall status: ${overall}`,
    );

    return report;
  }

  /**
   * Check RobustnessService health
   */
  private async checkRobustnessService(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    try {
      const systemHealth = await this.robustnessService.getSystemHealth();
      const circuitBreakers = this.robustnessService.getCircuitBreakerStates();

      const openBreakers = circuitBreakers.filter((cb) => cb.state === 'OPEN');
      const status = openBreakers.length > 0 ? 'degraded' : 'healthy';

      return {
        name: 'RobustnessService',
        status,
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        details: {
          systemHealth,
          openCircuitBreakers: openBreakers.length,
          totalCircuitBreakers: circuitBreakers.length,
        },
      };
    } catch (error) {
      return {
        name: 'RobustnessService',
        status: 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        errors: [error.message],
      };
    }
  }

  /**
   * Check FileCompilerService health
   */
  private async checkFileCompilerService(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    try {
      const healthStatus = await this.fileCompilerService.getHealthStatus();

      return {
        name: 'FileCompilerService',
        status: 'healthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        details: healthStatus.metrics,
      };
    } catch (error) {
      return {
        name: 'FileCompilerService',
        status: 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        errors: [error.message],
      };
    }
  }

  /**
   * Check CodeCompilerService health
   */
  private async checkCodeCompilerService(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    try {
      const healthStatus = await this.codeCompilerService.getHealthStatus();

      return {
        name: 'CodeCompilerService',
        status: 'healthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        details: healthStatus.metrics,
      };
    } catch (error) {
      return {
        name: 'CodeCompilerService',
        status: 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        errors: [error.message],
      };
    }
  }

  /**
   * Check GeminiService health
   */
  private async checkGeminiService(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    try {
      const healthStatus = await this.geminiService.getHealthStatus();

      return {
        name: 'GeminiService',
        status: healthStatus.status === 'healthy' ? 'healthy' : 'degraded',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        details: healthStatus,
      };
    } catch (error) {
      return {
        name: 'GeminiService',
        status: 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        errors: [error.message],
      };
    }
  }

  /**
   * Check PluginChatService health (basic connectivity)
   */
  private async checkPluginChatService(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    try {
      // Basic health check - ensure service is responsive
      const isResponsive = this.pluginChatService !== undefined;

      return {
        name: 'PluginChatService',
        status: isResponsive ? 'healthy' : 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        details: {
          responsive: isResponsive,
        },
      };
    } catch (error) {
      return {
        name: 'PluginChatService',
        status: 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        errors: [error.message],
      };
    }
  }

  /**
   * Check CreateService health (basic connectivity)
   */
  private async checkCreateService(): Promise<ServiceHealthStatus> {
    const startTime = Date.now();

    try {
      // Basic health check - ensure service is responsive
      const isResponsive = this.createService !== undefined;

      return {
        name: 'CreateService',
        status: isResponsive ? 'healthy' : 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        details: {
          responsive: isResponsive,
        },
      };
    } catch (error) {
      return {
        name: 'CreateService',
        status: 'unhealthy',
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        errors: [error.message],
      };
    }
  }

  /**
   * Determine overall system health based on service statuses
   */
  private determineOverallHealth(
    services: ServiceHealthStatus[],
    systemMetrics: any,
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const unhealthyServices = services.filter((s) => s.status === 'unhealthy');
    const degradedServices = services.filter((s) => s.status === 'degraded');

    // Critical services that must be healthy
    const criticalServices = ['RobustnessService', 'GeminiService'];
    const criticalUnhealthy = unhealthyServices.some((s) =>
      criticalServices.includes(s.name),
    );

    if (criticalUnhealthy || unhealthyServices.length > 2) {
      return 'unhealthy';
    }

    if (unhealthyServices.length > 0 || degradedServices.length > 1) {
      return 'degraded';
    }

    // Check system resource thresholds
    if (
      systemMetrics.memoryUsage.heapUsed / systemMetrics.memoryUsage.heapTotal >
      0.9
    ) {
      return 'degraded';
    }

    if (systemMetrics.diskSpace.percentage > 90) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Generate health recommendations based on current status
   */
  private generateHealthRecommendations(
    services: ServiceHealthStatus[],
    systemMetrics: any,
  ): string[] {
    const recommendations: string[] = [];

    // Service-specific recommendations
    services.forEach((service) => {
      if (service.status === 'unhealthy') {
        recommendations.push(
          `Immediate attention required for ${service.name}: ${service.errors?.join(', ')}`,
        );
      } else if (service.status === 'degraded') {
        recommendations.push(
          `Monitor ${service.name} closely - performance degradation detected`,
        );
      }

      if (service.responseTime && service.responseTime > 5000) {
        recommendations.push(
          `${service.name} response time is slow (${service.responseTime}ms) - consider optimization`,
        );
      }
    });

    // System resource recommendations
    const memoryUsagePercent =
      (systemMetrics.memoryUsage.heapUsed /
        systemMetrics.memoryUsage.heapTotal) *
      100;
    if (memoryUsagePercent > 85) {
      recommendations.push(
        `High memory usage detected (${memoryUsagePercent.toFixed(1)}%) - consider memory optimization or scaling`,
      );
    }

    if (systemMetrics.diskSpace.percentage > 85) {
      recommendations.push(
        `Disk space running low (${systemMetrics.diskSpace.percentage}%) - cleanup or expansion needed`,
      );
    }

    // Circuit breaker recommendations
    const circuitBreakers = this.robustnessService.getCircuitBreakerStates();
    const openBreakers = circuitBreakers.filter((cb) => cb.state === 'OPEN');
    if (openBreakers.length > 0) {
      recommendations.push(
        `${openBreakers.length} circuit breakers are open - investigate underlying issues`,
      );
    }

    return recommendations;
  }

  /**
   * Store health check history for trend analysis
   */
  private storeHealthHistory(services: ServiceHealthStatus[]) {
    services.forEach((service) => {
      if (!this.healthHistory.has(service.name)) {
        this.healthHistory.set(service.name, []);
      }

      const history = this.healthHistory.get(service.name)!;
      history.push({ ...service });

      // Keep only recent history
      if (history.length > this.HEALTH_HISTORY_LIMIT) {
        history.shift();
      }
    });
  }

  /**
   * Get health trends for a specific service
   */
  getServiceHealthTrend(serviceName: string): {
    trend: 'improving' | 'stable' | 'degrading';
    history: ServiceHealthStatus[];
  } {
    const history = this.healthHistory.get(serviceName) || [];

    if (history.length < 3) {
      return { trend: 'stable', history };
    }

    const recentChecks = history.slice(-5);
    const healthyCount = recentChecks.filter(
      (h) => h.status === 'healthy',
    ).length;
    const unhealthyCount = recentChecks.filter(
      (h) => h.status === 'unhealthy',
    ).length;

    let trend: 'improving' | 'stable' | 'degrading' = 'stable';

    if (healthyCount > 3) {
      trend = 'improving';
    } else if (unhealthyCount > 2) {
      trend = 'degrading';
    }

    return { trend, history };
  }

  /**
   * Get quick health status (cached or recent)
   */
  async getQuickHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastChecked?: Date;
    summary: string;
  }> {
    try {
      // Check circuit breakers for quick assessment
      const circuitBreakers = this.robustnessService.getCircuitBreakerStates();
      const openBreakers = circuitBreakers.filter((cb) => cb.state === 'OPEN');

      if (openBreakers.length > 2) {
        return {
          status: 'unhealthy',
          summary: `${openBreakers.length} critical services are down`,
        };
      } else if (openBreakers.length > 0) {
        return {
          status: 'degraded',
          summary: `${openBreakers.length} services experiencing issues`,
        };
      }

      return {
        status: 'healthy',
        summary: 'All systems operational',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        summary: 'Health monitoring system error',
      };
    }
  }
}
