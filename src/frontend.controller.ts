import { Controller, Get, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

@Controller()
export class FrontendController {
  private readonly logger = new Logger(FrontendController.name);
  private readonly isDevelopment = process.env.NODE_ENV !== 'production';

  private serveNextJsApp(@Res() res: Response) {
    // In development, suggest using the Next.js dev server
    if (this.isDevelopment) {
      const devMessage = `
        <html>
          <head><title>Pegasus Nest - Development Mode</title></head>
          <body style="font-family: system-ui; padding: 2rem; background: #f0f0f0;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <h1 style="color: #0066cc;">🚀 Pegasus Nest API</h1>
              <p>You're accessing the <strong>NestJS API server</strong> directly.</p>
              
              <div style="background: #e3f2fd; padding: 1rem; border-radius: 4px; margin: 1rem 0;">
                <h3>🔧 Development Mode Detected</h3>
                <p>For the best development experience with hot reload:</p>
                <ol>
                  <li>Run: <code style="background: #f5f5f5; padding: 2px 4px;">pnpm dev</code></li>
                  <li>Access frontend at: <a href="http://localhost:3001" target="_blank">http://localhost:3001</a></li>
                </ol>
              </div>

              <div style="background: #f3e5f5; padding: 1rem; border-radius: 4px; margin: 1rem 0;">
                <h3>📡 API Endpoints Available:</h3>
                <ul>
                  <li><a href="/health">/health</a> - Health check</li>
                  <li><a href="/api/optimization-stats">/api/optimization-stats</a> - Performance stats</li>
                  <li>POST /create - Plugin creation</li>
                </ul>
              </div>

              <p><small>To serve the production frontend from this server, run: <code style="background: #f5f5f5; padding: 2px 4px;">pnpm dev:prod</code></small></p>
            </div>
          </body>
        </html>
      `;
      res.setHeader('Content-Type', 'text/html');
      return res.send(devMessage);
    }

    // Production mode: serve the built Next.js app
    const filePath = join(
      process.cwd(),
      'frontend',
      '.next',
      'server',
      'app',
      'index.html',
    );

    if (!existsSync(filePath)) {
      this.logger.error('Frontend build not found. Run: pnpm build:all');
      return res.status(404).json({
        error: 'Frontend not built',
        message: 'Run `pnpm build:all` to build the frontend for production',
      });
    }

    try {
      const html = readFileSync(filePath, 'utf8');
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    } catch (error) {
      this.logger.error(`Error serving frontend: ${error.message}`);
      return res.status(500).json({ error: 'Error serving frontend' });
    }
  }

  @Get('/')
  serveRoot(@Res() res: Response) {
    return this.serveNextJsApp(res);
  }

  // Handle other common frontend routes
  @Get('/about')
  @Get('/dashboard')
  @Get('/plugins')
  @Get('/docs')
  serveFrontendRoutes(@Res() res: Response) {
    return this.serveNextJsApp(res);
  }

  // Catch-all route for any other paths (client-side routing)
  // Note: This should be the last route to avoid conflicting with API routes
  @Get('*')
  serveCatchAll(@Res() res: Response) {
    return this.serveNextJsApp(res);
  }
}
