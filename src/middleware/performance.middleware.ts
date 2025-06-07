import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PerformanceTrackingService } from '../services/performance-tracking.service';

@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PerformanceMiddleware.name);

  constructor(
    private readonly performanceTrackingService: PerformanceTrackingService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const originalSend = res.send;

    // Extract user information if available
    const userId = this.extractUserId(req);
    const userAgent = req.get('User-Agent');

    // Store references for the closure
    const performanceService = this.performanceTrackingService;
    const logger = this.logger;

    // Override res.send to capture response details
    res.send = function (body: any) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      try {
        // Record the metric
        performanceService.recordMetric(
          req.route?.path || req.path,
          req.method,
          responseTime,
          res.statusCode,
          userAgent,
          userId,
        );

        // Log request details
        logger.log(
          `${req.method} ${req.path} - ${res.statusCode} - ${responseTime}ms${userId ? ` - User: ${userId}` : ''}`,
        );
      } catch (error) {
        logger.error('Failed to record performance metric', error);
      }

      // Call original send
      return originalSend.call(this, body);
    };

    next();
  }

  private extractUserId(req: Request): string | undefined {
    // Try multiple ways to extract user ID
    return (
      (req.query?.userId as string) ||
      (req.body?.userId as string) ||
      (req.params?.userId as string) ||
      (req.headers['x-user-id'] as string)
    );
  }
}
