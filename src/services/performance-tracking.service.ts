import { Injectable, Logger } from '@nestjs/common';

export interface PerformanceMetric {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: Date;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  userAgent?: string;
  userId?: string;
}

export interface PerformanceStats {
  avgResponseTime: number;
  totalRequests: number;
  errorRate: number;
  slowQueries: PerformanceMetric[];
  topEndpoints: { endpoint: string; count: number; avgTime: number }[];
  memoryTrend: { timestamp: Date; heapUsed: number }[];
}

@Injectable()
export class PerformanceTrackingService {
  private readonly logger = new Logger(PerformanceTrackingService.name);
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS = 10000;
  private readonly SLOW_QUERY_THRESHOLD = 5000;

  recordMetric(
    endpoint: string,
    method: string,
    responseTime: number,
    statusCode: number,
    userAgent?: string,
    userId?: string,
  ): void {
    const memoryUsage = process.memoryUsage();

    const metric: PerformanceMetric = {
      endpoint,
      method,
      responseTime,
      statusCode,
      timestamp: new Date(),
      memoryUsage: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
      },
      userAgent,
      userId,
    };

    this.metrics.push(metric);

    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    if (responseTime > this.SLOW_QUERY_THRESHOLD) {
      this.logger.warn(
        `Slow query: ${method} ${endpoint} took ${responseTime}ms`,
      );
    }
  }

  getPerformanceStats(hours = 24): PerformanceStats {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentMetrics = this.metrics.filter((m) => m.timestamp >= cutoff);

    if (recentMetrics.length === 0) {
      return {
        avgResponseTime: 0,
        totalRequests: 0,
        errorRate: 0,
        slowQueries: [],
        topEndpoints: [],
        memoryTrend: [],
      };
    }

    const totalRequests = recentMetrics.length;
    const errorRequests = recentMetrics.filter(
      (m) => m.statusCode >= 400,
    ).length;
    const avgResponseTime =
      recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests;
    const errorRate = (errorRequests / totalRequests) * 100;

    const slowQueries = recentMetrics
      .filter((m) => m.responseTime > this.SLOW_QUERY_THRESHOLD)
      .sort((a, b) => b.responseTime - a.responseTime)
      .slice(0, 10);

    const endpointStats = new Map<
      string,
      { count: number; totalTime: number }
    >();
    recentMetrics.forEach((m) => {
      const key = `${m.method} ${m.endpoint}`;
      if (!endpointStats.has(key)) {
        endpointStats.set(key, { count: 0, totalTime: 0 });
      }
      const stats = endpointStats.get(key)!;
      stats.count++;
      stats.totalTime += m.responseTime;
    });

    const topEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        count: stats.count,
        avgTime: stats.totalTime / stats.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const memoryTrend = recentMetrics
      .filter(
        (_, index) =>
          index % Math.max(1, Math.floor(recentMetrics.length / 24)) === 0,
      )
      .map((m) => ({
        timestamp: m.timestamp,
        heapUsed: m.memoryUsage.heapUsed,
      }))
      .slice(-24);

    return {
      avgResponseTime,
      totalRequests,
      errorRate,
      slowQueries,
      topEndpoints,
      memoryTrend,
    };
  }

  getEndpointMetrics(endpoint: string, hours = 24): PerformanceMetric[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metrics
      .filter((m) => m.endpoint === endpoint && m.timestamp >= cutoff)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getUserMetrics(userId: string, hours = 24): PerformanceMetric[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metrics
      .filter((m) => m.userId === userId && m.timestamp >= cutoff)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getPerformanceReport(hours = 24): any {
    const stats = this.getPerformanceStats(hours);
    const recommendations: string[] = [];

    if (stats.avgResponseTime > 2000) {
      recommendations.push(
        'Average response time is high (>2s). Consider optimization.',
      );
    }

    if (stats.errorRate > 5) {
      recommendations.push(
        `Error rate is ${stats.errorRate.toFixed(1)}%. Investigate failing requests.`,
      );
    }

    if (stats.slowQueries.length > 0) {
      recommendations.push(
        `${stats.slowQueries.length} slow queries detected. Consider optimization.`,
      );
    }

    const currentMemory = process.memoryUsage();
    if (currentMemory.heapUsed / currentMemory.heapTotal > 0.8) {
      recommendations.push(
        'Memory usage is high (>80%). Consider garbage collection or optimization.',
      );
    }

    return {
      summary: {
        totalRequests: stats.totalRequests,
        avgResponseTime: Math.round(stats.avgResponseTime),
        errorRate: Math.round(stats.errorRate * 100) / 100,
        slowQueriesCount: stats.slowQueries.length,
      },
      topEndpoints: stats.topEndpoints,
      slowQueries: stats.slowQueries.slice(0, 5),
      memoryTrend: stats.memoryTrend,
      recommendations,
      generatedAt: new Date().toISOString(),
    };
  }

  clearOldMetrics(hours = 72): number {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const initialCount = this.metrics.length;
    this.metrics = this.metrics.filter((m) => m.timestamp >= cutoff);
    const cleared = initialCount - this.metrics.length;

    if (cleared > 0) {
      this.logger.log(`Cleared ${cleared} old performance metrics`);
    }

    return cleared;
  }

  getMetricsCount(): number {
    return this.metrics.length;
  }

  exportMetrics(hours = 24): PerformanceMetric[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metrics.filter((m) => m.timestamp >= cutoff);
  }
}
