# Pegasus Nest Minecraft Server Setup Script for Windows PowerShell
# This script installs and configures server dependencies using pnpm

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerId,
    
    [Parameter(Mandatory=$true)]
    [string]$UserId,
    
    [Parameter(Mandatory=$true)]
    [string]$ServerName
)

# Colors for output
$Red = [System.ConsoleColor]::Red
$Green = [System.ConsoleColor]::Green
$Yellow = [System.ConsoleColor]::Yellow
$Blue = [System.ConsoleColor]::Blue

function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] WARNING: $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERROR: $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] INFO: $Message" -ForegroundColor Blue
}

# Configuration
$ScriptDir = $PSScriptRoot
$ProjectRoot = Split-Path -Parent $ScriptDir
$PnpmVersion = "latest"

Write-Log "Starting Minecraft server setup for: $ServerName"
Write-Log "Server ID: $ServerId"
Write-Log "User ID: $UserId"

# Check if pnpm is installed
try {
    $pnpmVersion = pnpm --version 2>$null
    Write-Log "pnpm is already installed: $pnpmVersion"
} catch {
    Write-Log "Installing pnpm..."
    npm install -g pnpm@$PnpmVersion
    if ($LASTEXITCODE -eq 0) {
        Write-Log "pnpm installed successfully"
    } else {
        Write-Error "Failed to install pnpm"
        exit 1
    }
}

# Create server directory structure
$ServerDir = Join-Path $ProjectRoot "minecraft-servers\$UserId\$ServerName"
$PluginsDir = Join-Path $ServerDir "plugins"
$BackupsDir = Join-Path $ServerDir "backups"
$LogsDir = Join-Path $ServerDir "logs"
$ConfigDir = Join-Path $ServerDir "config"
$ScriptsDir = Join-Path $ServerDir "scripts"

Write-Log "Creating server directory structure..."
New-Item -ItemType Directory -Force -Path @($ServerDir, $PluginsDir, $BackupsDir, $LogsDir, $ConfigDir, $ScriptsDir) | Out-Null

# Create package.json for server-specific dependencies
Write-Log "Creating package.json for server dependencies..."
$PackageJson = @{
    name = "minecraft-server-$UserId-$ServerName"
    version = "1.0.0"
    description = "Minecraft server dependencies for $ServerName"
    private = $true
    scripts = @{
        "start" = "node scripts/start-server.js"
        "stop" = "node scripts/stop-server.js"
        "restart" = "node scripts/restart-server.js"
        "backup" = "node scripts/backup-server.js"
        "monitor" = "node scripts/monitor-server.js"
        "install-plugin" = "node scripts/install-plugin.js"
        "update-server" = "node scripts/update-server.js"
        "health-check" = "node scripts/health-check.js"
    }
    dependencies = @{
        "axios" = "^1.9.0"
        "ws" = "^8.18.0"
        "minecraft-protocol" = "^1.47.0"
        "rcon" = "^1.0.3"
        "node-cron" = "^3.0.3"
        "fs-extra" = "^11.2.0"
        "archiver" = "^7.0.1"
        "extract-zip" = "^2.0.1"
        "semver" = "^7.6.3"
        "chalk" = "^4.1.2"
        "ora" = "^5.4.1"
        "inquirer" = "^8.2.6"
        "commander" = "^12.1.0"
        "dotenv" = "^16.5.0"
        "joi" = "^17.13.3"
        "lodash" = "^4.17.21"
        "moment" = "^2.30.1"
        "uuid" = "^11.1.0"
    }
    devDependencies = @{
        "@types/node" = "^22.10.7"
        "nodemon" = "^3.1.9"
        "typescript" = "^5.7.3"
    }
    engines = @{
        "node" = ">=18.0.0"
        "pnpm" = ">=8.0.0"
    }
    keywords = @("minecraft", "server", "pegasus-nest", "automation")
    author = "Pegasus Nest"
    license = "MIT"
}

$PackageJsonPath = Join-Path $ServerDir "package.json"
$PackageJson | ConvertTo-Json -Depth 10 | Set-Content -Path $PackageJsonPath -Encoding UTF8

# Install server dependencies using pnpm
Write-Log "Installing server dependencies with pnpm..."
Push-Location $ServerDir
try {
    pnpm install --frozen-lockfile --prefer-offline
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Server dependencies installed successfully"
    } else {
        Write-Error "Failed to install server dependencies"
        exit 1
    }
} finally {
    Pop-Location
}

# Create server management scripts
Write-Log "Creating server management scripts..."

# Start server script
$StartServerScript = @'
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
        const command = process.platform === 'win32' 
            ? `docker-compose -f "${composeFile}" up -d`
            : `docker-compose -f ${composeFile} up -d`;
            
        exec(command, (error, stdout, stderr) => {
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
'@

Set-Content -Path (Join-Path $ScriptsDir "start-server.js") -Value $StartServerScript -Encoding UTF8

# Stop server script
$StopServerScript = @'
#!/usr/bin/env node
const { exec } = require('child_process');
const path = require('path');

const serverDir = path.dirname(__dirname);

function stopServer() {
    console.log('Stopping Minecraft server...');
    
    const composeFile = path.join(serverDir, 'docker-compose.yml');
    const command = process.platform === 'win32' 
        ? `docker-compose -f "${composeFile}" down`
        : `docker-compose -f ${composeFile} down`;
        
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error stopping server: ${error.message}`);
            process.exit(1);
        }
        console.log('Server stopped successfully');
        console.log(stdout);
    });
}

stopServer();
'@

Set-Content -Path (Join-Path $ScriptsDir "stop-server.js") -Value $StopServerScript -Encoding UTF8

# Health check script
$HealthCheckScript = @'
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
'@

Set-Content -Path (Join-Path $ScriptsDir "health-check.js") -Value $HealthCheckScript -Encoding UTF8

# Create server configuration
Write-Log "Creating server configuration..."
$ServerConfig = @{
    serverId = $ServerId
    userId = $UserId
    serverName = $ServerName
    port = 25565
    rconPort = 25575
    maxPlayers = 20
    memory = "2G"
    gameMode = "survival"
    difficulty = "normal"
    autoStart = $true
    backupInterval = "4h"
    createdAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    paths = @{
        data = "./data"
        plugins = "./plugins"
        backups = "./backups"
        logs = "./logs"
    }
    docker = @{
        image = "itzg/minecraft-server:latest"
        network = "minecraft-network"
    }
    monitoring = @{
        enabled = $true
        healthCheckInterval = "30s"
        metricsCollection = $true
    }
}

$ConfigPath = Join-Path $ConfigDir "server.json"
$ServerConfig | ConvertTo-Json -Depth 10 | Set-Content -Path $ConfigPath -Encoding UTF8

# Create environment file
Write-Log "Creating environment configuration..."
$RconPassword = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([System.Guid]::NewGuid().ToString()))
$GrafanaPassword = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([System.Guid]::NewGuid().ToString().Substring(0, 16)))

$EnvContent = @"
# Minecraft Server Environment Configuration
SERVER_ID=$ServerId
USER_ID=$UserId
SERVER_NAME=$ServerName
SERVER_PORT=25565
RCON_PORT=25575
RCON_PASSWORD=$RconPassword
SERVER_MEMORY=2G
INIT_MEMORY=1G
MAX_PLAYERS=20
DIFFICULTY=normal
GAMEMODE=survival

# Container settings
CONTAINER_MEMORY_LIMIT=3G
CONTAINER_MEMORY_RESERVATION=2G

# Paths
DATA_DIR=$ServerDir\data
PLUGINS_DIR=$ServerDir\plugins
BACKUPS_DIR=$ServerDir\backups
MONITOR_DIR=$ServerDir\monitoring

# Monitoring (optional)
GRAFANA_PORT=3001
GRAFANA_PASSWORD=$GrafanaPassword

# Backup settings
BACKUP_RETENTION_DAYS=7
BACKUP_COMPRESSION=gzip

# Creation timestamp
CREATION_TIME=$((Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ"))
"@

Set-Content -Path (Join-Path $ConfigDir ".env") -Value $EnvContent -Encoding UTF8

# Install additional monitoring tools
Write-Log "Installing monitoring dependencies..."
Push-Location $ServerDir
try {
    pnpm add --save-dev @types/ws @types/lodash
} finally {
    Pop-Location
}

# Create startup script for the entire setup
Write-Log "Creating main startup script..."
$StartupScript = @"
@echo off
cd /d "%~dp0"

echo Starting Minecraft server: $ServerName
echo Server ID: $ServerId
echo User ID: $UserId

rem Ensure Docker network exists
docker network create minecraft-network 2>nul

rem Start the server using pnpm
pnpm run start

echo Server startup initiated. Check logs for status updates.
"@

Set-Content -Path (Join-Path $ServerDir "start.bat") -Value $StartupScript -Encoding UTF8

# Create stop script
$StopScript = @"
@echo off
cd /d "%~dp0"

echo Stopping Minecraft server: $ServerName
pnpm run stop
"@

Set-Content -Path (Join-Path $ServerDir "stop.bat") -Value $StopScript -Encoding UTF8

# Create update script for server dependencies
Write-Log "Creating update script..."
$UpdateScript = @"
@echo off
cd /d "%~dp0"

echo Updating server dependencies for: $ServerName

rem Update pnpm dependencies
pnpm update --latest

rem Update Docker images
docker-compose pull

echo Update completed for: $ServerName
"@

Set-Content -Path (Join-Path $ServerDir "update.bat") -Value $UpdateScript -Encoding UTF8

# Create installation completion marker
Set-Content -Path (Join-Path $ServerDir ".installation-complete") -Value (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ") -Encoding UTF8

Write-Log "✅ Minecraft server setup completed successfully!"
Write-Log "Server directory: $ServerDir"
Write-Log "To start the server: cd '$ServerDir' && .\start.bat"
Write-Log "To stop the server: cd '$ServerDir' && .\stop.bat"
Write-Log "To update dependencies: cd '$ServerDir' && .\update.bat"

Write-Info "Available pnpm scripts:"
Write-Info "  - pnpm run start        : Start the server"
Write-Info "  - pnpm run stop         : Stop the server"
Write-Info "  - pnpm run restart      : Restart the server"
Write-Info "  - pnpm run backup       : Create a backup"
Write-Info "  - pnpm run monitor      : Start monitoring"
Write-Info "  - pnpm run health-check : Check server health"

Write-Log "Setup complete! 🎮"
