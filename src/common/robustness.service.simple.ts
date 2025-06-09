import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * 🛡️ SIMPLIFIED ROBUSTNESS SERVICE
 * Essential robustness features for the Pegasus Nest application
 *
 * Features:
 * - Basic error tracking
 * - Circuit breaker pattern
 * - Graceful shutdown handling
 * - Simple health monitoring
 */

export interface CircuitBreakerState {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  errorCount: number;
  circuitBreakers: number;
}

@Injectable()
export class RobustnessService {
  private readonly logger = new Logger(RobustnessService.name);
  private readonly startTime = Date.now();
  private readonly circuitBreakers = new Map<string, CircuitBreakerState>();
  private isShuttingDown = false;
  private errorCount = 0;

  // Configuration
  private readonly MAX_FAILURES = 5;
  private readonly TIMEOUT_DURATION = 60000; // 1 minute

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.initializeService();
  }

  /**
   * Initialize the service with basic setup
   */
  private initializeService(): void {
    this.logger.log('🛡️ Initializing simplified robustness service...');
    this.initializeDefaultCircuitBreakers();
    this.logger.log('✅ Robustness service initialized');
  }

  /**
   * Initialize essential circuit breakers
   */
  private initializeDefaultCircuitBreakers(): void {
    const defaultBreakers = [
      'ai_service',
      'gemini_service',
      'file_operations',
      'compilation_service',
    ];

    defaultBreakers.forEach((name) => {
      this.createCircuitBreaker(name);
    });
  }

  /**
   * Create a new circuit breaker
   */
  createCircuitBreaker(name: string): void {
    if (this.circuitBreakers.has(name)) {
      return;
    }

    this.circuitBreakers.set(name, {
      name,
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
    });

    this.logger.log(`🔧 Circuit breaker created: ${name}`);
  }

  /**
   * Check if circuit breaker allows requests
   */
  isCircuitBreakerOpen(name: string): boolean {
    const breaker = this.circuitBreakers.get(name);
    if (!breaker) {
      this.createCircuitBreaker(name);
      return false;
    }

    const now = Date.now();

    switch (breaker.state) {
      case 'OPEN':
        if (now > breaker.nextAttemptTime) {
          breaker.state = 'HALF_OPEN';
          this.logger.log(`🔄 Circuit breaker ${name} moved to HALF_OPEN`);
          return false;
        }
        return true;

      case 'HALF_OPEN':
      case 'CLOSED':
        return false;

      default:
        return false;
    }
  }

  /**
   * Record a successful operation
   */
  recordSuccess(circuitBreakerName: string): void {
    const breaker = this.circuitBreakers.get(circuitBreakerName);
    if (!breaker) return;

    if (breaker.state === 'HALF_OPEN') {
      breaker.state = 'CLOSED';
      breaker.failureCount = 0;
      this.logger.log(`✅ Circuit breaker ${circuitBreakerName} closed`);
    }
  }

  /**
   * Record a failure
   */
  recordFailure(circuitBreakerName: string, error?: Error): void {
    const breaker = this.circuitBreakers.get(circuitBreakerName);
    if (!breaker) {
      this.createCircuitBreaker(circuitBreakerName);
      return this.recordFailure(circuitBreakerName, error);
    }

    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();

    if (breaker.failureCount >= this.MAX_FAILURES) {
      breaker.state = 'OPEN';
      breaker.nextAttemptTime = Date.now() + this.TIMEOUT_DURATION;

      this.logger.warn(
        `⚠️ Circuit breaker ${circuitBreakerName} opened due to ${breaker.failureCount} failures`,
      );

      this.eventEmitter.emit('circuit_breaker.opened', {
        name: circuitBreakerName,
        failureCount: breaker.failureCount,
        error: error?.message,
      });
    }

    this.recordError('circuit_breaker', error);
  }

  /**
   * Record system error
   */
  recordError(type: string, error: Error | any): void {
    this.errorCount++;

    this.logger.error(
      `🚨 Error recorded [${type}]: ${error?.message || error}`,
      {
        type,
        timestamp: new Date().toISOString(),
      },
    );

    this.eventEmitter.emit('system.error', {
      type,
      error: error?.message || error,
      timestamp: Date.now(),
    });
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async executeWithCircuitBreaker<T>(
    name: string,
    operation: () => Promise<T>,
    fallback?: () => Promise<T>,
  ): Promise<T> {
    if (this.isCircuitBreakerOpen(name)) {
      if (fallback) {
        this.logger.warn(`🔄 Circuit breaker ${name} is open, using fallback`);
        return await fallback();
      } else {
        throw new Error(`Service ${name} is temporarily unavailable`);
      }
    }

    try {
      const result = await operation();
      this.recordSuccess(name);
      return result;
    } catch (error) {
      this.recordFailure(name, error);
      throw error;
    }
  }

  /**
   * Get simple system health status
   */
  getSystemHealth(): SystemHealth {
    const openBreakers = Array.from(this.circuitBreakers.values()).filter(
      (breaker) => breaker.state === 'OPEN',
    );

    let status: 'healthy' | 'degraded' | 'unhealthy';

    if (openBreakers.length === 0 && this.errorCount < 10) {
      status = 'healthy';
    } else if (openBreakers.length <= 2 && this.errorCount < 50) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      uptime: Date.now() - this.startTime,
      errorCount: this.errorCount,
      circuitBreakers: this.circuitBreakers.size,
    };
  }

  /**
   * Get circuit breaker states
   */
  getCircuitBreakerStates(): CircuitBreakerState[] {
    return Array.from(this.circuitBreakers.values());
  }

  /**
   * Setup graceful shutdown handling
   */
  public setupGracefulShutdown(): void {
    const shutdownSignals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    shutdownSignals.forEach((signal) => {
      process.on(signal, () => {
        this.logger.warn(
          `🚨 Received ${signal}, initiating graceful shutdown...`,
        );
        this.gracefulShutdown();
      });
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('🚨 Uncaught Exception:', error);
      this.recordError('uncaught_exception', error);
      this.gracefulShutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('🚨 Unhandled Promise Rejection:', reason);
      this.recordError('unhandled_rejection', reason as Error);
    });
  }

  /**
   * Perform graceful shutdown
   */
  private async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.log('🔄 Starting graceful shutdown...');

    try {
      this.eventEmitter.emit('system.shutdown.start');

      // Give ongoing operations time to complete
      await new Promise((resolve) => setTimeout(resolve, 3000));

      this.eventEmitter.emit('system.shutdown.complete');
      this.logger.log('✅ Graceful shutdown completed');

      process.exit(0);
    } catch (error) {
      this.logger.error('❌ Error during graceful shutdown:', error);
      setTimeout(() => {
        this.logger.error('🚨 Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    }
  }
}
