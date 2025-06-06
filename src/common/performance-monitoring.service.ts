import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as os from 'os';

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  requestCount: number;
  responseTime: {
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  timestamp: number;
  cpuUsage: number;
  memoryUsage: number;
}

/**
 * Performance alert interface
 */
export interface PerformanceAlert {
  type: 'slow_endpoint' | 'high_error_rate' | 'memory_leak' | 'cpu_spike';
  message: string;
  metrics: any;
  timestamp: number;
  severity: 'warning' | 'critical';
}

/**
 * Endpoint trace entry
 */
interface EndpointTrace {
  endpoint: string;
  method: string;
  startTime: number;
  endTime?: number;
  success?: boolean;
  error?: string;
  correlationId?: string;
  userId?: string;
}

/**
 * Performance data for endpoint
 */
interface EndpointPerformance {
  endpoint: string;
  method: string;
  requestCount: number;
  errorCount: number;
  responseTimes: number[];
  lastUpdated: number;
}

/**
 * Performance monitoring service to track system performance
 */
@Injectable()
export class PerformanceMonitoringService {
  private readonly logger = new Logger(PerformanceMonitoringService.name);
  private readonly endpointTraces = new Map<string, EndpointTrace>();
  private readonly endpointPerformance = new Map<string, EndpointPerformance>();
  private readonly METRICS_RETENTION_PERIOD = 24 * 60 * 60 * 1000; // 24 hours
  private readonly ALERT_THRESHOLDS = {
    slowResponseTime: 2000, // 2 seconds
    highErrorRate: 0.05, // 5%
    cpuSpike: 0.8, // 80%
    memoryLeak: 0.85, // 85%
  };
  private metricsInterval: NodeJS.Timeout;

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.startMetricsCollection();
    this.logger.log('Performance monitoring service initialized');
  }

  /**
   * Start request tracing
   */
  startRequest(
    endpoint: string,
    method: string,
    correlationId?: string,
    userId?: string,
  ): string {
    const traceId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    this.endpointTraces.set(traceId, {
      endpoint,
      method,
      startTime: Date.now(),
      correlationId,
      userId,
    });

    return traceId;
  }

  /**
   * End request tracing and record metrics
   */
  endRequest(traceId: string, success: boolean, error?: string): void {
    const trace = this.endpointTraces.get(traceId);
    if (!trace) {
      return;
    }

    trace.endTime = Date.now();
    trace.success = success;
    trace.error = error;

    this.recordRequestMetrics(trace);
    this.endpointTraces.delete(traceId);
  }

  /**
   * Get performance metrics for all endpoints
   */
  getPerformanceMetrics(): PerformanceMetrics[] {
    const metrics: PerformanceMetrics[] = [];
    const now = Date.now();

    for (const [key, data] of this.endpointPerformance.entries()) {
      // Skip endpoints with no recent activity
      if (now - data.lastUpdated > this.METRICS_RETENTION_PERIOD) {
        continue;
      }

      // Calculate percentiles
      const sortedTimes = [...data.responseTimes].sort((a, b) => a - b);
      const p95Index = Math.floor(sortedTimes.length * 0.95);
      const p99Index = Math.floor(sortedTimes.length * 0.99);

      metrics.push({
        endpoint: data.endpoint,
        method: data.method,
        requestCount: data.requestCount,
        responseTime: {
          min: Math.min(...data.responseTimes),
          max: Math.max(...data.responseTimes),
          avg:
            data.responseTimes.reduce((sum, time) => sum + time, 0) /
            data.responseTimes.length,
          p95: sortedTimes[p95Index] || 0,
          p99: sortedTimes[p99Index] || 0,
        },
        errorRate:
          data.requestCount > 0 ? data.errorCount / data.requestCount : 0,
        timestamp: now,
        cpuUsage: this.getCpuUsage(),
        memoryUsage: this.getMemoryUsage(),
      });
    }

    return metrics;
  }

  /**
   * Get metrics for a specific endpoint
   */
  getEndpointMetrics(
    endpoint: string,
    method: string,
  ): PerformanceMetrics | null {
    const key = `${method}:${endpoint}`;
    const data = this.endpointPerformance.get(key);

    if (!data || data.responseTimes.length === 0) {
      return null;
    }

    const sortedTimes = [...data.responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);

    return {
      endpoint: data.endpoint,
      method: data.method,
      requestCount: data.requestCount,
      responseTime: {
        min: Math.min(...data.responseTimes),
        max: Math.max(...data.responseTimes),
        avg:
          data.responseTimes.reduce((sum, time) => sum + time, 0) /
          data.responseTimes.length,
        p95: sortedTimes[p95Index] || 0,
        p99: sortedTimes[p99Index] || 0,
      },
      errorRate:
        data.requestCount > 0 ? data.errorCount / data.requestCount : 0,
      timestamp: Date.now(),
      cpuUsage: this.getCpuUsage(),
      memoryUsage: this.getMemoryUsage(),
    };
  }

  /**
   * Clear old metrics data
   */
  clearOldMetrics(): void {
    const cutoffTime = Date.now() - this.METRICS_RETENTION_PERIOD;

    // Clear old endpoint traces
    for (const [traceId, trace] of this.endpointTraces.entries()) {
      if (trace.startTime < cutoffTime) {
        this.endpointTraces.delete(traceId);
      }
    }

    // Clear old performance data
    for (const [key, data] of this.endpointPerformance.entries()) {
      if (data.lastUpdated < cutoffTime) {
        this.endpointPerformance.delete(key);
      }
    }
  }

  /**
   * Start metrics collection at regular intervals
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.checkForAlerts();
      this.clearOldMetrics();
    }, 60000); // Every minute
  }

  /**
   * Record request metrics
   */
  private recordRequestMetrics(trace: EndpointTrace): void {
    if (!trace.endTime) {
      return;
    }

    const responseTime = trace.endTime - trace.startTime;
    const key = `${trace.method}:${trace.endpoint}`;

    let data = this.endpointPerformance.get(key);
    if (!data) {
      data = {
        endpoint: trace.endpoint,
        method: trace.method,
        requestCount: 0,
        errorCount: 0,
        responseTimes: [],
        lastUpdated: Date.now(),
      };
      this.endpointPerformance.set(key, data);
    }

    data.requestCount++;
    data.responseTimes.push(responseTime);
    data.lastUpdated = Date.now();

    if (!trace.success) {
      data.errorCount++;
    }

    // Limit the number of response times stored
    if (data.responseTimes.length > 100) {
      data.responseTimes = data.responseTimes.slice(-100);
    }

    // Check for slow response
    if (responseTime > this.ALERT_THRESHOLDS.slowResponseTime) {
      this.emitSlowResponseAlert(trace, responseTime);
    }
  }

  /**
   * Check for performance alerts
   */
  private checkForAlerts(): void {
    const metrics = this.getPerformanceMetrics();

    // Check for high error rates
    for (const metric of metrics) {
      if (metric.errorRate > this.ALERT_THRESHOLDS.highErrorRate) {
        this.emitHighErrorRateAlert(metric);
      }
    }

    // Check for system-wide issues
    const cpuUsage = this.getCpuUsage();
    if (cpuUsage > this.ALERT_THRESHOLDS.cpuSpike) {
      this.emitCpuSpikeAlert(cpuUsage);
    }

    const memoryUsage = this.getMemoryUsage();
    if (memoryUsage > this.ALERT_THRESHOLDS.memoryLeak) {
      this.emitMemoryLeakAlert(memoryUsage);
    }
  }

  /**
   * Emit slow response alert
   */
  private emitSlowResponseAlert(
    trace: EndpointTrace,
    responseTime: number,
  ): void {
    const alert: PerformanceAlert = {
      type: 'slow_endpoint',
      message: `Slow response on ${trace.method} ${trace.endpoint}: ${responseTime}ms`,
      metrics: {
        endpoint: trace.endpoint,
        method: trace.method,
        responseTime,
        correlationId: trace.correlationId,
        userId: trace.userId,
      },
      timestamp: Date.now(),
      severity:
        responseTime > this.ALERT_THRESHOLDS.slowResponseTime * 2
          ? 'critical'
          : 'warning',
    };

    this.eventEmitter.emit('performance.alert', alert);
    this.logger.warn(`Performance alert: ${alert.message}`, {
      alert,
      correlationId: trace.correlationId,
    });
  }

  /**
   * Emit high error rate alert
   */
  private emitHighErrorRateAlert(metrics: PerformanceMetrics): void {
    const alert: PerformanceAlert = {
      type: 'high_error_rate',
      message: `High error rate on ${metrics.method} ${metrics.endpoint}: ${(metrics.errorRate * 100).toFixed(2)}%`,
      metrics,
      timestamp: Date.now(),
      severity:
        metrics.errorRate > this.ALERT_THRESHOLDS.highErrorRate * 2
          ? 'critical'
          : 'warning',
    };

    this.eventEmitter.emit('performance.alert', alert);
    this.logger.warn(`Performance alert: ${alert.message}`, { alert });
  }

  /**
   * Emit CPU spike alert
   */
  private emitCpuSpikeAlert(cpuUsage: number): void {
    const alert: PerformanceAlert = {
      type: 'cpu_spike',
      message: `High CPU usage detected: ${(cpuUsage * 100).toFixed(2)}%`,
      metrics: {
        cpuUsage,
        system: this.getSystemInfo(),
      },
      timestamp: Date.now(),
      severity:
        cpuUsage > this.ALERT_THRESHOLDS.cpuSpike * 1.5
          ? 'critical'
          : 'warning',
    };

    this.eventEmitter.emit('performance.alert', alert);
    this.logger.warn(`Performance alert: ${alert.message}`, { alert });
  }

  /**
   * Emit memory leak alert
   */
  private emitMemoryLeakAlert(memoryUsage: number): void {
    const alert: PerformanceAlert = {
      type: 'memory_leak',
      message: `High memory usage detected: ${(memoryUsage * 100).toFixed(2)}%`,
      metrics: {
        memoryUsage,
        memory: process.memoryUsage(),
        system: this.getSystemInfo(),
      },
      timestamp: Date.now(),
      severity:
        memoryUsage > this.ALERT_THRESHOLDS.memoryLeak * 1.5
          ? 'critical'
          : 'warning',
    };

    this.eventEmitter.emit('performance.alert', alert);
    this.logger.warn(`Performance alert: ${alert.message}`, { alert });
  }

  /**
   * Get CPU usage as a value between 0 and 1
   */
  private getCpuUsage(): number {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
      idle += cpu.times.idle;
      total +=
        cpu.times.user +
        cpu.times.nice +
        cpu.times.sys +
        cpu.times.idle +
        cpu.times.irq;
    }

    return 1 - idle / total;
  }

  /**
   * Get memory usage as a value between 0 and 1
   */
  private getMemoryUsage(): number {
    const { heapUsed, heapTotal } = process.memoryUsage();
    return heapUsed / heapTotal;
  }

  /**
   * Get system information
   */
  private getSystemInfo(): any {
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
    };
  }

  /**
   * Clean up resources on application shutdown
   */
  onApplicationShutdown(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
  }
}
