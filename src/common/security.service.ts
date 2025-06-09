import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Create rate limiting middleware for API endpoints
   */
  createRateLimit(
    options: {
      windowMs?: number;
      max?: number;
      message?: string;
      keyGenerator?: (req: any) => string;
    } = {},
  ) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    };

    return rateLimit({ ...defaultOptions, ...options });
  }

  /**
   * Create API-specific rate limiting
   */
  createApiRateLimit() {
    return this.createRateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 30, // 30 requests per minute
      message:
        'API rate limit exceeded. Please wait before making more requests.',
    });
  }

  /**
   * Create rate limiting for plugin compilation
   */
  createCompilationRateLimit() {
    return this.createRateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 3, // 3 compilation requests per 5 minutes
      message:
        'Compilation rate limit exceeded. Please wait before submitting another compilation request.',
    });
  }

  /**
   * Create rate limiting for chat functionality
   */
  createChatRateLimit() {
    return this.createRateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 20, // 20 chat messages per minute
      message: 'Chat rate limit exceeded. Please slow down your message rate.',
    });
  }

  /**
   * Get security middleware configuration
   */
  getSecurityMiddleware(): any {
    return {
      helmet: helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              'https://cdnjs.cloudflare.com',
            ],
            scriptSrc: [
              "'self'",
              'https://cdnjs.cloudflare.com',
              'https://cdn.socket.io',
            ],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: [
              "'self'",
              'ws://localhost:3000',
              'http://localhost:3000',
            ],
          },
        },
        crossOriginEmbedderPolicy: false,
      }),
      compression: compression(),
      rateLimits: {
        api: this.createApiRateLimit(),
        compilation: this.createCompilationRateLimit(),
        chat: this.createChatRateLimit(),
      },
    };
  }

  /**
   * Validate request security
   */
  validateRequest(req: any): { isValid: boolean; errors?: string[] } {
    const errors: string[] = [];

    // Check for common injection attempts
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\(/i,
      /document\./i,
      /window\./i,
    ];

    const checkString = (str: string, fieldName: string) => {
      if (dangerousPatterns.some((pattern) => pattern.test(str))) {
        errors.push(`Potentially dangerous content detected in ${fieldName}`);
      }
    };

    // Check request body
    if (req.body) {
      Object.entries(req.body).forEach(([key, value]) => {
        if (typeof value === 'string') {
          checkString(value, key);
        }
      });
    }

    // Check query parameters
    if (req.query) {
      Object.entries(req.query).forEach(([key, value]) => {
        if (typeof value === 'string') {
          checkString(value, key);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Log security event
   */
  logSecurityEvent(event: {
    type: 'rate_limit' | 'injection_attempt' | 'invalid_request';
    ip?: string;
    userAgent?: string;
    details?: any;
  }) {
    this.logger.warn(`Security Event: ${event.type}`, {
      ip: event.ip,
      userAgent: event.userAgent,
      details: event.details,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Configure security middleware for the application
   */
  configureSecurityMiddleware(app: any) {
    const middleware = this.getSecurityMiddleware();

    // Apply helmet for security headers
    app.use(middleware.helmet);

    // Apply compression
    app.use(middleware.compression);

    // Apply rate limiting to different routes
    app.use('/api', middleware.rateLimits.api);
    app.use('/compile', middleware.rateLimits.compilation);
    app.use('/chat', middleware.rateLimits.chat);

    this.logger.log('Security middleware configured successfully');
  }
}
