# PowerShell script to fix auth issues in the GitHub Actions workflow

# Print script header
Write-Host "🔧 Auth Configuration Fix Script" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

$workflowFile = ".github/workflows/deploy.yml"

# 1. Fix environment variables quoting issue
Write-Host "`nFixing environment variables in GitHub Actions workflow..." -ForegroundColor Yellow

# Read the workflow file
$content = Get-Content $workflowFile -Raw

# Replace the ENVEOF and FRONTENDEOF quotes to allow variable interpolation
$content = $content -replace "cat > .env << 'ENVEOF'", "cat > .env << ENVEOF"
$content = $content -replace "cat > frontend/.env.local << 'FRONTENDEOF'", "cat > frontend/.env.local << FRONTENDEOF"

# Save the changes
$content | Set-Content $workflowFile

Write-Host "✅ Environment variable interpolation fixed!" -ForegroundColor Green

# 2. Add GitHub OAuth configuration verification
Write-Host "`nAdding GitHub OAuth configuration verification..." -ForegroundColor Yellow

$verificationCode = @"
          # Verify GitHub OAuth configuration
          if grep -q "GITHUB_CLIENT_ID=" frontend/.env.local && grep -q "GITHUB_CLIENT_SECRET=" frontend/.env.local; then
            GITHUB_CLIENT_ID=$(grep "GITHUB_CLIENT_ID=" frontend/.env.local | cut -d '=' -f2)
            GITHUB_CLIENT_SECRET=$(grep "GITHUB_CLIENT_SECRET=" frontend/.env.local | cut -d '=' -f2)
            
            if [ "$GITHUB_CLIENT_ID" = "placeholder" ] || [ "$GITHUB_CLIENT_SECRET" = "placeholder" ] || [ -z "$GITHUB_CLIENT_ID" ] || [ -z "$GITHUB_CLIENT_SECRET" ]; then
              echo "⚠️ WARNING: GitHub OAuth credentials are set to placeholder values or empty"
            else
              echo "✅ GitHub OAuth credentials appear to be properly configured"
            fi
          else
            echo "⚠️ WARNING: GitHub OAuth environment variables missing from frontend/.env.local"
          fi
"@

# Add verification after the environment variables check
$content = $content -replace "grep -v ""SECRET\\\|CLIENT_SECRET\\\|MONGODB_URL"" frontend/.env.local \|\| echo ""Sensitive vars present""\n          EOF", "grep -v ""SECRET\\\|CLIENT_SECRET\\\|MONGODB_URL"" frontend/.env.local \|\| echo ""Sensitive vars present""`n`n$verificationCode`n          EOF"

# Save the changes
$content | Set-Content $workflowFile

Write-Host "✅ GitHub OAuth verification added!" -ForegroundColor Green

Write-Host "`n🎉 Auth configuration fix complete!" -ForegroundColor Green
Write-Host "You can now commit and push these changes to trigger a new deployment." -ForegroundColor Yellow
