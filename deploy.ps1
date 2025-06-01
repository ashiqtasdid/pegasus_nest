# Pegasus Nest API - Windows PowerShell Deployment Script
# This script builds and deploys the application using Docker

param(
    [switch]$Production,
    [string]$Environment = "development"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Pegasus Nest API deployment..." -ForegroundColor Green

# Determine which compose file to use
$ComposeFile = if ($Production) { "docker-compose.prod.yml" } else { "docker-compose.yml" }
$EnvFile = if ($Production) { ".env.production" } else { ".env" }

Write-Host "📋 Using configuration: $ComposeFile with $EnvFile" -ForegroundColor Yellow

# Check if environment file exists
if (!(Test-Path $EnvFile)) {
    Write-Host "❌ Environment file '$EnvFile' not found!" -ForegroundColor Red
    Write-Host "Please create $EnvFile with your environment variables" -ForegroundColor Red
    exit 1
}

# Check if OPENROUTER_API_KEY is set (basic check)
$EnvContent = Get-Content $EnvFile -Raw
if ($EnvContent -notmatch "OPENROUTER_API_KEY=") {
    Write-Host "❌ OPENROUTER_API_KEY not found in $EnvFile!" -ForegroundColor Red
    Write-Host "Please add your OpenRouter API key to $EnvFile" -ForegroundColor Red
    exit 1
}

# Stop existing containers
Write-Host "🛑 Stopping existing containers..." -ForegroundColor Yellow
try {
    docker-compose -f $ComposeFile down
} catch {
    Write-Host "⚠️ No existing containers to stop" -ForegroundColor Yellow
}

# Build and start new containers
Write-Host "🔨 Building and starting containers..." -ForegroundColor Green
try {
    docker-compose -f $ComposeFile --env-file $EnvFile up --build -d
} catch {
    Write-Host "❌ Failed to build/start containers!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

# Wait for containers to start
Write-Host "⏳ Waiting for containers to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check if containers are running
Write-Host "🔍 Checking container status..." -ForegroundColor Yellow
$ContainerStatus = docker-compose -f $ComposeFile ps

if ($ContainerStatus -match "Up") {
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    $Port = if ($Production) { "80" } else { "3000" }
    Write-Host "🌐 API is running at: http://localhost:$Port" -ForegroundColor Cyan
    Write-Host "📊 Health check: http://localhost:$Port/health" -ForegroundColor Cyan
    Write-Host "🎛️ Admin UI: http://localhost:$Port/ui" -ForegroundColor Cyan
    
    if ($Production) {
        Write-Host "🔒 Production mode: Using Nginx reverse proxy" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Container logs:" -ForegroundColor Red
    docker-compose -f $ComposeFile logs
    exit 1
}

Write-Host "🎉 Pegasus Nest API deployment complete!" -ForegroundColor Green

# Show useful commands
Write-Host ""
Write-Host "📝 Useful commands:" -ForegroundColor Yellow
Write-Host "  View logs: docker-compose -f $ComposeFile logs -f" -ForegroundColor White
Write-Host "  Stop: docker-compose -f $ComposeFile down" -ForegroundColor White
Write-Host "  Restart: docker-compose -f $ComposeFile restart" -ForegroundColor White