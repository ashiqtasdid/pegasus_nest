/* eslint-disable @typescript-eslint/no-floating-promises */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SecurityService } from './common/security.service';
import { RobustnessService } from './common/robustness.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Get security and robustness services
  const securityService = app.get(SecurityService);
  const robustnessService = app.get(RobustnessService);

  // Apply security middleware
  securityService.configureSecurityMiddleware(app);

  // Setup graceful shutdown
  robustnessService.setupGracefulShutdown();

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Pegasus Nest API is running on http://localhost:${port}`);
  console.log(`🛡️ Security and robustness features are active`);
}
bootstrap();
