# Advanced Docker Deployment Script for Pegasus Nest API
# Supports development and production environments with health checks

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("dev", "prod", "development", "production")]
    [string]$Environment = "dev",
    
    [switch]$Clean,
    [switch]$NoBuild,
    [switch]$Logs,
    [switch]$Monitor
)

$ErrorActionPreference = "Stop"

# Configuration
$AppName = "pegasus-nest"
$ImageName = "$AppName-api"
$ContainerName = "$AppName-container"

Write-Host "🐳 Advanced Docker Deployment for Pegasus Nest API" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow

# Clean up if requested
if ($Clean) {
    Write-Host "🧹 Cleaning up existing containers and images..." -ForegroundColor Yellow
    
    # Stop and remove container
    try { docker stop $ContainerName; docker rm $ContainerName } catch { }
    
    # Remove image
    try { docker rmi $ImageName } catch { }
    
    # Clean up dangling images
    docker image prune -f
    
    Write-Host "✅ Cleanup complete" -ForegroundColor Green
}

# Build image if not skipped
if (!$NoBuild) {
    Write-Host "🔨 Building Docker image..." -ForegroundColor Green
    
    $BuildArgs = @()
    if ($Environment -eq "prod" -or $Environment -eq "production") {
        $BuildArgs += "--build-arg", "NODE_ENV=production"
    }
    
    $BuildCommand = @("docker", "build") + $BuildArgs + @("-t", $ImageName, ".")
    
    try {
        & $BuildCommand[0] $BuildCommand[1..($BuildCommand.Length-1)]
        Write-Host "✅ Image built successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Build failed: $_" -ForegroundColor Red
        exit 1
    }
}

# Determine environment file and port
$EnvFile = if ($Environment -eq "prod" -or $Environment -eq "production") { 
    ".env.production" 
} else { 
    ".env" 
}

$Port = if ($Environment -eq "prod" -or $Environment -eq "production") { 
    "3000:3000" 
} else { 
    "3001:3000" 
}

# Check environment file
if (!(Test-Path $EnvFile)) {
    Write-Host "❌ Environment file '$EnvFile' not found!" -ForegroundColor Red
    exit 1
}

# Stop existing container
try {
    docker stop $ContainerName
    docker rm $ContainerName
} catch {
    Write-Host "⚠️ No existing container to stop" -ForegroundColor Yellow
}

# Run container
Write-Host "🚀 Starting container..." -ForegroundColor Green

$RunArgs = @(
    "docker", "run", "-d",
    "--name", $ContainerName,
    "-p", $Port,
    "--env-file", $EnvFile,
    "-v", "$(pwd)/generated:/app/generated",
    "-v", "$(pwd)/public:/app/public",
    "--restart", "unless-stopped"
)

if ($Environment -eq "prod" -or $Environment -eq "production") {
    $RunArgs += "-e", "NODE_ENV=production"
}

$RunArgs += $ImageName

try {
    & $RunArgs[0] $RunArgs[1..($RunArgs.Length-1)]
    Write-Host "✅ Container started successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to start container: $_" -ForegroundColor Red
    exit 1
}

# Wait for startup
Write-Host "⏳ Waiting for application to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Health check
$HealthUrl = "http://localhost:$($Port.Split(':')[0])/health"
$MaxRetries = 12
$RetryCount = 0

do {
    try {
        $Response = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 5
        if ($Response.status -eq "ok") {
            Write-Host "✅ Health check passed!" -ForegroundColor Green
            break
        }
    } catch {
        $RetryCount++
        if ($RetryCount -eq $MaxRetries) {
            Write-Host "❌ Health check failed after $MaxRetries attempts" -ForegroundColor Red
            docker logs $ContainerName
            exit 1
        }
        Write-Host "⏳ Health check attempt $RetryCount/$MaxRetries..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
} while ($RetryCount -lt $MaxRetries)

# Show status
Write-Host ""
Write-Host "🎉 Deployment complete!" -ForegroundColor Green
Write-Host "🌐 API URL: http://localhost:$($Port.Split(':')[0])" -ForegroundColor Cyan
Write-Host "📊 Health: $HealthUrl" -ForegroundColor Cyan
Write-Host "🎛️ Admin UI: http://localhost:$($Port.Split(':')[0])/ui" -ForegroundColor Cyan

# Show container info
Write-Host ""
Write-Host "📋 Container Information:" -ForegroundColor Yellow
docker ps --filter "name=$ContainerName" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Show logs if requested
if ($Logs) {
    Write-Host ""
    Write-Host "📝 Container logs:" -ForegroundColor Yellow
    docker logs -f $ContainerName
}

# Monitor if requested
if ($Monitor) {
    Write-Host ""
    Write-Host "📊 Monitoring container (Press Ctrl+C to exit)..." -ForegroundColor Yellow
    try {
        while ($true) {
            $Stats = docker stats $ContainerName --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
            Clear-Host
            Write-Host "🐳 Container Stats - $(Get-Date)" -ForegroundColor Cyan
            Write-Host $Stats
            Start-Sleep -Seconds 2
        }
    } catch {
        Write-Host "Monitoring stopped" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "📝 Management commands:" -ForegroundColor Yellow
Write-Host "  View logs: docker logs -f $ContainerName" -ForegroundColor White
Write-Host "  Stop: docker stop $ContainerName" -ForegroundColor White
Write-Host "  Restart: docker restart $ContainerName" -ForegroundColor White
Write-Host "  Remove: docker rm -f $ContainerName" -ForegroundColor White