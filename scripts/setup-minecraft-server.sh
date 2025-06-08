#!/bin/bash

# Pegasus Nest Minecraft Server Setup Script
# This script installs and configures server dependencies using pnpm

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PNPM_VERSION="latest"

# Server configuration
SERVER_ID="$1"
USER_ID="$2"
SERVER_NAME="$3"

if [[ -z "$SERVER_ID" || -z "$USER_ID" || -z "$SERVER_NAME" ]]; then
    error "Usage: $0 <server_id> <user_id> <server_name>"
    error "Example: $0 user123_MyServer user123 MyServer"
    exit 1
fi

log "Starting Minecraft server setup for: $SERVER_NAME"
log "Server ID: $SERVER_ID"
log "User ID: $USER_ID"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    log "Installing pnpm..."
    npm install -g pnpm@$PNPM_VERSION
    if [ $? -eq 0 ]; then
        log "pnpm installed successfully"
    else
        error "Failed to install pnpm"
        exit 1
    fi
else
    log "pnpm is already installed: $(pnpm --version)"
fi

# Create server directory structure
SERVER_DIR="$PROJECT_ROOT/minecraft-servers/$USER_ID/$SERVER_NAME"
PLUGINS_DIR="$SERVER_DIR/plugins"
BACKUPS_DIR="$SERVER_DIR/backups"
LOGS_DIR="$SERVER_DIR/logs"
CONFIG_DIR="$SERVER_DIR/config"
SCRIPTS_DIR="$SERVER_DIR/scripts"

log "Creating server directory structure..."
mkdir -p "$SERVER_DIR" "$PLUGINS_DIR" "$BACKUPS_DIR" "$LOGS_DIR" "$CONFIG_DIR" "$SCRIPTS_DIR"

# Create package.json for server-specific dependencies
log "Creating package.json for server dependencies..."
cat > "$SERVER_DIR/package.json" << EOF
{
  "name": "minecraft-server-$USER_ID-$SERVER_NAME",
  "version": "1.0.0",
  "description": "Minecraft server dependencies for $SERVER_NAME",
  "private": true,
  "scripts": {
    "start": "node scripts/start-server.js",
    "stop": "node scripts/stop-server.js",
    "restart": "node scripts/restart-server.js",
    "backup": "node scripts/backup-server.js",
    "monitor": "node scripts/monitor-server.js",
    "install-plugin": "node scripts/install-plugin.js",
    "update-server": "node scripts/update-server.js",
    "health-check": "node scripts/health-check.js"
  },
  "dependencies": {
    "axios": "^1.9.0",
    "ws": "^8.18.0",
    "minecraft-protocol": "^1.47.0",
    "rcon": "^1.0.3",
    "node-cron": "^3.0.3",
    "fs-extra": "^11.2.0",
    "archiver": "^7.0.1",
    "extract-zip": "^2.0.1",
    "semver": "^7.6.3",
    "chalk": "^4.1.2",
    "ora": "^5.4.1",
    "inquirer": "^8.2.6",
    "commander": "^12.1.0",
    "dotenv": "^16.5.0",
    "joi": "^17.13.3",
    "lodash": "^4.17.21",
    "moment": "^2.30.1",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.7",
    "nodemon": "^3.1.9",
    "typescript": "^5.7.3"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  },
  "keywords": [
    "minecraft",
    "server",
    "pegasus-nest",
    "automation"
  ],
  "author": "Pegasus Nest",
  "license": "MIT"
}
EOF

# Install server dependencies using pnpm
log "Installing server dependencies with pnpm..."
cd "$SERVER_DIR"
pnpm install --frozen-lockfile --prefer-offline

if [ $? -eq 0 ]; then
    log "Server dependencies installed successfully"
else
    error "Failed to install server dependencies"
    exit 1
fi

# Create server management scripts
log "Creating server management scripts..."

# Start server script
cat > "$SCRIPTS_DIR/start-server.js" << 'EOF'
#!/usr/bin/env node
const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

const serverDir = path.dirname(__dirname);
const configFile = path.join(serverDir, 'config', 'server.json');

async function startServer() {
    try {
        if (!await fs.pathExists(configFile)) {
            throw new Error('Server configuration not found');
        }

        const config = await fs.readJson(configFile);
        console.log(`Starting Minecraft server: ${config.serverName}`);
        
        // Use Docker Compose to start the server
        const composeFile = path.join(serverDir, 'docker-compose.yml');
        exec(`docker-compose -f ${composeFile} up -d`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error starting server: ${error.message}`);
                process.exit(1);
            }
            console.log('Server started successfully');
            console.log(stdout);
        });
    } catch (error) {
        console.error(`Failed to start server: ${error.message}`);
        process.exit(1);
    }
}

startServer();
EOF

# Stop server script
cat > "$SCRIPTS_DIR/stop-server.js" << 'EOF'
#!/usr/bin/env node
const { exec } = require('child_process');
const path = require('path');

const serverDir = path.dirname(__dirname);

function stopServer() {
    console.log('Stopping Minecraft server...');
    
    const composeFile = path.join(serverDir, 'docker-compose.yml');
    exec(`docker-compose -f ${composeFile} down`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error stopping server: ${error.message}`);
            process.exit(1);
        }
        console.log('Server stopped successfully');
        console.log(stdout);
    });
}

stopServer();
EOF

# Backup server script
cat > "$SCRIPTS_DIR/backup-server.js" << 'EOF'
#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const moment = require('moment');

const serverDir = path.dirname(__dirname);
const backupsDir = path.join(serverDir, 'backups');
const dataDir = path.join(serverDir, 'data');

async function backupServer() {
    try {
        await fs.ensureDir(backupsDir);
        
        const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
        const backupName = `server-backup-${timestamp}.zip`;
        const backupPath = path.join(backupsDir, backupName);
        
        console.log(`Creating backup: ${backupName}`);
        
        const output = fs.createWriteStream(backupPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        output.on('close', () => {
            console.log(`Backup created successfully: ${backupPath}`);
            console.log(`Backup size: ${archive.pointer()} bytes`);
        });
        
        archive.on('error', (err) => {
            throw err;
        });
        
        archive.pipe(output);
        archive.directory(dataDir, false);
        await archive.finalize();
        
    } catch (error) {
        console.error(`Backup failed: ${error.message}`);
        process.exit(1);
    }
}

backupServer();
EOF

# Health check script
cat > "$SCRIPTS_DIR/health-check.js" << 'EOF'
#!/usr/bin/env node
const { ping } = require('minecraft-protocol');

async function healthCheck() {
    try {
        const config = require('../config/server.json');
        
        console.log(`Checking server health: ${config.serverName}`);
        
        const response = await ping({
            host: 'localhost',
            port: config.port || 25565
        });
        
        console.log('Server Status:', {
            online: true,
            players: response.players,
            version: response.version,
            motd: response.description,
            latency: response.latency
        });
        
    } catch (error) {
        console.log('Server Status:', {
            online: false,
            error: error.message
        });
        process.exit(1);
    }
}

healthCheck();
EOF

# Make scripts executable
chmod +x "$SCRIPTS_DIR"/*.js

# Create server configuration
log "Creating server configuration..."
cat > "$CONFIG_DIR/server.json" << EOF
{
  "serverId": "$SERVER_ID",
  "userId": "$USER_ID",
  "serverName": "$SERVER_NAME",
  "port": 25565,
  "rconPort": 25575,
  "maxPlayers": 20,
  "memory": "2G",
  "gameMode": "survival",
  "difficulty": "normal",
  "autoStart": true,
  "backupInterval": "4h",
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
  "paths": {
    "data": "./data",
    "plugins": "./plugins",
    "backups": "./backups",
    "logs": "./logs"
  },
  "docker": {
    "image": "itzg/minecraft-server:latest",
    "network": "minecraft-network"
  },
  "monitoring": {
    "enabled": true,
    "healthCheckInterval": "30s",
    "metricsCollection": true
  }
}
EOF

# Create environment file
log "Creating environment configuration..."
cat > "$CONFIG_DIR/.env" << EOF
# Minecraft Server Environment Configuration
SERVER_ID=$SERVER_ID
USER_ID=$USER_ID
SERVER_NAME=$SERVER_NAME
SERVER_PORT=25565
RCON_PORT=25575
RCON_PASSWORD=$(openssl rand -base64 32)
SERVER_MEMORY=2G
INIT_MEMORY=1G
MAX_PLAYERS=20
DIFFICULTY=normal
GAMEMODE=survival

# Container settings
CONTAINER_MEMORY_LIMIT=3G
CONTAINER_MEMORY_RESERVATION=2G

# Paths
DATA_DIR=$SERVER_DIR/data
PLUGINS_DIR=$SERVER_DIR/plugins
BACKUPS_DIR=$SERVER_DIR/backups
MONITOR_DIR=$SERVER_DIR/monitoring

# Monitoring (optional)
GRAFANA_PORT=3001
GRAFANA_PASSWORD=$(openssl rand -base64 16)

# Webhook for notifications (optional)
# WEBHOOK_URL=

# Backup settings
BACKUP_RETENTION_DAYS=7
BACKUP_COMPRESSION=gzip

# Creation timestamp
CREATION_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
EOF

# Install additional monitoring tools
log "Installing monitoring dependencies..."
pnpm add --save-dev @types/ws @types/lodash

# Create monitoring script
cat > "$SCRIPTS_DIR/monitor-server.js" << 'EOF'
#!/usr/bin/env node
const WebSocket = require('ws');
const fs = require('fs-extra');
const path = require('path');

class ServerMonitor {
    constructor() {
        this.config = require('../config/server.json');
        this.metrics = {
            uptime: 0,
            playerCount: 0,
            memory: { used: 0, max: 0 },
            tps: 20.0,
            lastCheck: new Date()
        };
    }

    async start() {
        console.log(`Starting monitor for ${this.config.serverName}`);
        
        // Start monitoring loop
        setInterval(() => {
            this.collectMetrics();
        }, 30000); // Every 30 seconds
        
        // Start WebSocket server for real-time updates
        this.startWebSocketServer();
    }

    async collectMetrics() {
        try {
            // Collect server metrics here
            // This would integrate with RCON and Docker stats
            console.log('Collecting metrics...', new Date().toISOString());
            
            // Save metrics to file
            const metricsFile = path.join(__dirname, '../logs/metrics.json');
            await fs.writeJson(metricsFile, this.metrics, { spaces: 2 });
            
        } catch (error) {
            console.error('Error collecting metrics:', error.message);
        }
    }

    startWebSocketServer() {
        const wss = new WebSocket.Server({ port: 8080 });
        console.log('WebSocket server started on port 8080');
        
        wss.on('connection', (ws) => {
            console.log('Client connected to monitoring');
            
            // Send current metrics
            ws.send(JSON.stringify({ type: 'metrics', data: this.metrics }));
            
            // Send periodic updates
            const interval = setInterval(() => {
                ws.send(JSON.stringify({ type: 'metrics', data: this.metrics }));
            }, 5000);
            
            ws.on('close', () => {
                clearInterval(interval);
                console.log('Client disconnected from monitoring');
            });
        });
    }
}

if (require.main === module) {
    const monitor = new ServerMonitor();
    monitor.start().catch(console.error);
}

module.exports = ServerMonitor;
EOF

# Create startup script for the entire setup
log "Creating main startup script..."
cat > "$SERVER_DIR/start.sh" << EOF
#!/bin/bash
cd "$(dirname "\$0")"

echo "Starting Minecraft server: $SERVER_NAME"
echo "Server ID: $SERVER_ID"
echo "User ID: $USER_ID"

# Load environment variables
set -a
source config/.env
set +a

# Ensure Docker network exists
docker network create minecraft-network 2>/dev/null || true

# Start the server using pnpm
pnpm run start

echo "Server startup initiated. Check logs for status updates."
EOF

chmod +x "$SERVER_DIR/start.sh"

# Create stop script
cat > "$SERVER_DIR/stop.sh" << EOF
#!/bin/bash
cd "$(dirname "\$0")"

echo "Stopping Minecraft server: $SERVER_NAME"
pnpm run stop
EOF

chmod +x "$SERVER_DIR/stop.sh"

# Create update script for server dependencies
log "Creating update script..."
cat > "$SERVER_DIR/update.sh" << EOF
#!/bin/bash
cd "$(dirname "\$0")"

echo "Updating server dependencies for: $SERVER_NAME"

# Update pnpm dependencies
pnpm update --latest

# Update Docker images
docker-compose pull

echo "Update completed for: $SERVER_NAME"
EOF

chmod +x "$SERVER_DIR/update.sh"

# Install global monitoring tools
log "Installing global monitoring tools..."
cd "$PROJECT_ROOT"
if [ ! -f "package.json" ]; then
    log "Installing global monitoring package..."
    cat > "monitoring-package.json" << EOF
{
  "name": "pegasus-nest-monitoring",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "prometheus-client": "^15.1.3",
    "express": "^4.21.2",
    "ws": "^8.18.0",
    "redis": "^4.7.0"
  }
}
EOF
    pnpm install --frozen-lockfile
fi

# Create installation completion marker
echo "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")" > "$SERVER_DIR/.installation-complete"

log "✅ Minecraft server setup completed successfully!"
log "Server directory: $SERVER_DIR"
log "To start the server: cd '$SERVER_DIR' && ./start.sh"
log "To stop the server: cd '$SERVER_DIR' && ./stop.sh"
log "To update dependencies: cd '$SERVER_DIR' && ./update.sh"

info "Available pnpm scripts:"
info "  - pnpm run start        : Start the server"
info "  - pnpm run stop         : Stop the server"
info "  - pnpm run restart      : Restart the server"
info "  - pnpm run backup       : Create a backup"
info "  - pnpm run monitor      : Start monitoring"
info "  - pnpm run health-check : Check server health"

log "Setup complete! 🎮"
