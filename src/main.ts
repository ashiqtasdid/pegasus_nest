/* eslint-disable @typescript-eslint/no-floating-promises */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SecurityService } from './common/security.service';
import { RobustnessService } from './common/robustness.service';
import { Logger } from '@nestjs/common';
import compression = require('compression');

async function bootstrap() {
  // Optimize V8 garbage collection for production and Docker
  if (process.env.NODE_ENV === 'production') {
    // Docker-optimized memory settings
    if (!process.env.NODE_OPTIONS) {
      process.env.NODE_OPTIONS =
        '--max-old-space-size=1024 --optimize-for-size';
    }
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn']
        : ['log', 'error', 'warn', 'debug', 'verbose'],
    bufferLogs: true,
    cors: process.env.NODE_ENV === 'production' ? false : true, // Handle CORS manually in production
  });

  // Enable compression for better performance
  app.use(
    compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      threshold: 1024, // Only compress responses larger than 1KB
    }),
  );

  // Get security and robustness services
  const securityService = app.get(SecurityService);
  const robustnessService = app.get(RobustnessService);

  // Apply security middleware
  securityService.configureSecurityMiddleware(app);

  // Setup graceful shutdown
  robustnessService.setupGracefulShutdown();

  // Configure CORS with specific origins for production
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000']
        : true,
    credentials: true,
  });

  // Docker and PM2 ready signal
  if (process.send) {
    process.send('ready');
  }

  // Graceful shutdown handlers for Docker
  process.on('SIGTERM', async () => {
    Logger.log('SIGTERM received, shutting down gracefully...', 'Bootstrap');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    Logger.log('SIGINT received, shutting down gracefully...', 'Bootstrap');
    await app.close();
    process.exit(0);
  });

  // Handle Docker stop signals
  process.on('SIGUSR2', async () => {
    Logger.log('SIGUSR2 received, graceful reload...', 'Bootstrap');
    await app.close();
    process.exit(0);
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  Logger.log(
    `🚀 Pegasus Nest API is running on http://localhost:${port}`,
    'Bootstrap',
  );
  Logger.log(`🛡️ Security and robustness features are active`, 'Bootstrap');
  Logger.log(`⚡ Performance optimizations enabled`, 'Bootstrap');
}
bootstrap();
