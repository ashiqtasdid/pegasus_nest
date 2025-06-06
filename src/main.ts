/* eslint-disable @typescript-eslint/no-floating-promises */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
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

  // Serve Next.js static files
  app.useStaticAssets(join(process.cwd(), 'frontend', '.next', 'static'), {
    prefix: '/_next/static/',
  });

  // Serve Next.js public files (images, favicon, etc.)
  app.useStaticAssets(join(process.cwd(), 'frontend', 'public'));

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Use PORT environment variable or default to 3000
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Pegasus Nest API is running on http://localhost:${port}`);
  console.log(`🎨 Next.js Frontend is now being served at the root`);
  console.log(`🛡️ Security and robustness features are active`);
}
bootstrap();
