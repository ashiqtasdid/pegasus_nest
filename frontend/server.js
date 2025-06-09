/**
 * Simple HTTP Server for Agent Feedback Dashboard
 * Serves the frontend files with proper MIME types and CORS headers
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

class FrontendServer {
  constructor(port = 8080, frontendDir = __dirname) {
    this.port = port;
    this.frontendDir = frontendDir;
    this.mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject',
    };
  }

  /**
   * Start the HTTP server
   */
  start() {
    const server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    server.listen(this.port, () => {
      console.log('\n🚀 Agent Feedback Dashboard Server Started!');
      console.log(`📍 URL: http://localhost:${this.port}`);
      console.log(`📁 Serving: ${this.frontendDir}`);
      console.log(`🔗 Backend: Make sure Pegasus Nest is running on port 3000`);
      console.log('\n✨ Features:');
      console.log('   • Real-time WebSocket connection to /agent-feedback');
      console.log('   • VS Code-inspired dark theme');
      console.log('   • Live progress tracking for plugin creation');
      console.log('   • Phase-by-phase monitoring with task details');
      console.log('   • Interactive error handling and notifications');
      console.log('\n📖 Usage:');
      console.log('   1. Enter your User ID');
      console.log('   2. Describe your Minecraft plugin');
      console.log('   3. Select accuracy level');
      console.log('   4. Click "Create Plugin" and watch the magic happen!');
      console.log('\n🛑 To stop: Press Ctrl+C');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(
          `❌ Port ${this.port} is already in use. Try a different port:`,
        );
        console.error(`   node server.js --port 8081`);
      } else {
        console.error('❌ Server error:', error.message);
      }
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Shutting down Agent Feedback Dashboard...');
      server.close(() => {
        console.log('✅ Server stopped successfully');
        process.exit(0);
      });
    });

    return server;
  }

  /**
   * Handle incoming HTTP requests
   */
  handleRequest(req, res) {
    try {
      const parsedUrl = url.parse(req.url, true);
      let pathname = parsedUrl.pathname;

      // Default to index.html for root requests
      if (pathname === '/') {
        pathname = '/index.html';
      }

      // Security: prevent directory traversal
      if (pathname.includes('..')) {
        this.sendError(res, 403, 'Forbidden');
        return;
      }

      const filePath = path.join(this.frontendDir, pathname);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        this.sendError(res, 404, 'File not found');
        return;
      }

      // Check if it's a file (not directory)
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        this.sendError(res, 404, 'Not a file');
        return;
      }

      // Get file extension and MIME type
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = this.mimeTypes[ext] || 'application/octet-stream';

      // Set CORS headers for API requests
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS',
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization',
      );

      // Handle OPTIONS preflight requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Set content type
      res.setHeader('Content-Type', mimeType);

      // Add caching headers for static assets
      if (
        [
          '.css',
          '.js',
          '.png',
          '.jpg',
          '.gif',
          '.svg',
          '.ico',
          '.woff',
          '.woff2',
        ].includes(ext)
      ) {
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
      }

      // Read and serve file
      const fileContent = fs.readFileSync(filePath);
      res.writeHead(200);
      res.end(fileContent);

      // Log request
      console.log(`📄 ${req.method} ${pathname} - ${mimeType}`);
    } catch (error) {
      console.error('❌ Request error:', error.message);
      this.sendError(res, 500, 'Internal Server Error');
    }
  }

  /**
   * Send error response
   */
  sendError(res, statusCode, message) {
    res.writeHead(statusCode, {
      'Content-Type': 'text/html',
      'Access-Control-Allow-Origin': '*',
    });

    const errorPage = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Error ${statusCode}</title>
                <style>
                    body { 
                        font-family: 'Consolas', monospace; 
                        background: #1e1e1e; 
                        color: #cccccc; 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        height: 100vh; 
                        margin: 0;
                    }
                    .error-container { 
                        text-align: center; 
                        background: #252526; 
                        padding: 2rem; 
                        border-radius: 8px; 
                        border: 1px solid #3e3e42;
                    }
                    .error-code { 
                        font-size: 3rem; 
                        color: #f44747; 
                        margin-bottom: 1rem; 
                    }
                    .error-message { 
                        font-size: 1.2rem; 
                        margin-bottom: 1rem; 
                    }
                    .back-link { 
                        color: #007acc; 
                        text-decoration: none; 
                    }
                    .back-link:hover { 
                        text-decoration: underline; 
                    }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <div class="error-code">${statusCode}</div>
                    <div class="error-message">${message}</div>
                    <a href="/" class="back-link">← Back to Dashboard</a>
                </div>
            </body>
            </html>
        `;

    res.end(errorPage);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let port = 8080;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    port = parseInt(args[i + 1]);
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error('❌ Invalid port number. Using default port 8080.');
      port = 8080;
    }
  }
  if (args[i] === '--help' || args[i] === '-h') {
    console.log('\n🤖 Agent Feedback Dashboard Server');
    console.log('\nUsage: node server.js [options]');
    console.log('\nOptions:');
    console.log('  --port <number>  Port to run the server (default: 8080)');
    console.log('  --help, -h       Show this help message');
    console.log('\nExamples:');
    console.log('  node server.js                # Start on port 8080');
    console.log('  node server.js --port 3001    # Start on port 3001');
    console.log('');
    process.exit(0);
  }
}

// Start server
if (require.main === module) {
  const server = new FrontendServer(port);
  server.start();
}

module.exports = FrontendServer;
