/* eslint-disable @typescript-eslint/no-floating-promises */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS
  app.enableCors();

  // Serve static files from the 'public' directory
  // Use absolute path to avoid resolution issues
  const publicPath = join(process.cwd(), 'public');
  console.log('Serving static files from:', publicPath);
  app.useStaticAssets(publicPath);

  // Use PORT environment variable or default to 3001
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Pegasus Nest API is running on http://localhost:${port}`);
}
bootstrap();
