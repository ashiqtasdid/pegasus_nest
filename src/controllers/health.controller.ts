import {
  Controller,
  Get,
  HttpStatus,
  HttpException,
  Param,
} from '@nestjs/common';
import { HealthMonitoringService } from '../common/health-monitoring.service';
import { RobustnessService } from '../common/robustness.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthMonitoringService: HealthMonitoringService,
    private readonly robustnessService: RobustnessService,
  ) {}

  /**
   * Quick health check endpoint
   * GET /health
   */
  @Get()
  async getQuickHealth() {
    try {
      const healthStatus =
        await this.healthMonitoringService.getQuickHealthStatus();

      const statusCode =
        healthStatus.status === 'healthy'
          ? HttpStatus.OK
          : healthStatus.status === 'degraded'
            ? HttpStatus.PARTIAL_CONTENT
            : HttpStatus.SERVICE_UNAVAILABLE;

      if (healthStatus.status === 'unhealthy') {
        throw new HttpException(
          {
            status: healthStatus.status,
            message: healthStatus.summary,
            timestamp: new Date().toISOString(),
          },
          statusCode,
        );
      }

      return {
        status: healthStatus.status,
        message: healthStatus.summary,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'unhealthy',
          message: 'Health check failed',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Comprehensive health check endpoint
   * GET /health/detailed
   */
  @Get('detailed')
  async getDetailedHealth() {
    try {
      const healthReport =
        await this.healthMonitoringService.performHealthCheck();

      const statusCode =
        healthReport.overall === 'healthy'
          ? HttpStatus.OK
          : healthReport.overall === 'degraded'
            ? HttpStatus.PARTIAL_CONTENT
            : HttpStatus.SERVICE_UNAVAILABLE;

      if (healthReport.overall === 'unhealthy') {
        throw new HttpException(healthReport, statusCode);
      }

      return healthReport;
    } catch (error) {
      throw new HttpException(
        {
          overall: 'unhealthy',
          timestamp: new Date(),
          error: error.message,
          services: [],
          systemMetrics: null,
          recommendations: [
            'Health monitoring system failure - immediate investigation required',
          ],
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * System metrics endpoint
   * GET /health/metrics
   */
  @Get('metrics')
  async getSystemMetrics() {
    try {
      const systemMetrics = await this.robustnessService.getSystemMetrics();
      const systemHealth = await this.robustnessService.getSystemHealth();

      return {
        metrics: systemMetrics,
        health: systemHealth,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          error: 'Failed to retrieve system metrics',
          details: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Circuit breaker status endpoint
   * GET /health/circuit-breakers
   */
  @Get('circuit-breakers')
  async getCircuitBreakerStatus() {
    try {
      const circuitBreakers = this.robustnessService.getCircuitBreakerStates();
      const openBreakers = circuitBreakers.filter((cb) => cb.state === 'OPEN');
      const halfOpenBreakers = circuitBreakers.filter(
        (cb) => cb.state === 'HALF_OPEN',
      );

      return {
        total: circuitBreakers.length,
        open: openBreakers.length,
        halfOpen: halfOpenBreakers.length,
        closed:
          circuitBreakers.length -
          openBreakers.length -
          halfOpenBreakers.length,
        details: circuitBreakers,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          error: 'Failed to retrieve circuit breaker status',
          details: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Service health trends endpoint
   * GET /health/trends/:serviceName
   */
  @Get('trends/:serviceName')
  async getServiceTrends(@Param('serviceName') serviceName: string) {
    try {
      const trends =
        this.healthMonitoringService.getServiceHealthTrend(serviceName);

      return {
        serviceName,
        trend: trends.trend,
        historyCount: trends.history.length,
        recentHistory: trends.history.slice(-10), // Last 10 checks
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          error: `Failed to retrieve trends for service: ${serviceName}`,
          details: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Ready check endpoint (for Kubernetes readiness probes)
   * GET /health/ready
   */
  @Get('ready')
  async getReadinessCheck() {
    try {
      const circuitBreakers = this.robustnessService.getCircuitBreakerStates();
      const criticalBreakers = circuitBreakers.filter(
        (cb) =>
          ['gemini_service', 'plugin_creation'].includes(cb.name) &&
          cb.state === 'OPEN',
      );

      if (criticalBreakers.length > 0) {
        throw new HttpException(
          {
            ready: false,
            reason: 'Critical services unavailable',
            criticalBreakers: criticalBreakers.map((cb) => cb.name),
            timestamp: new Date().toISOString(),
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return {
        ready: true,
        message: 'Service is ready to accept requests',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          ready: false,
          reason: 'Readiness check failed',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Live check endpoint (for Kubernetes liveness probes)
   * GET /health/live
   */
  @Get('live')
  async getLivenessCheck() {
    try {
      // Basic liveness check - ensure the application is responding
      const systemHealth = await this.robustnessService.getSystemHealth();

      return {
        alive: true,
        message: 'Service is alive and responding',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        {
          alive: false,
          reason: 'Service is not responding properly',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Database health check endpoint
   * GET /health/database
   */
  @Get('database')
  async getDatabaseHealth() {
    return {
      healthy: true,
      message: 'Database services temporarily disabled',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
