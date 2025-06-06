# VPS Deployment Fix Guide

This guide will help you fix the Node.js installation issue on the VPS and complete the deployment of the Pegasus Nest application.

## Issue Overview

The deployment is failing due to a Node.js installation conflict on the VPS. The error occurs when trying to install Node.js 20 while an older version and development packages are still installed.

Error message:

```
dpkg: error processing archive /var/cache/apt/archives/nodejs_20.19.2-1nodesource1_amd64.deb (--unpack):
 trying to overwrite '/usr/include/node/common.gypi', which is also in package libnode-dev 12.22.9~dfsg-1ubuntu3.6
```

## Fix Instructions

### Option 1: Using the Fix Script (Recommended)

1. SSH into your VPS:

   ```
   ssh root@37.114.41.124
   ```

2. Download the fix script from GitHub:

   ```
   cd /opt/pegasus-nest
   curl -O https://raw.githubusercontent.com/ashiqtasdid/pegasus_nest/main/fix-vps-nodejs.sh
   chmod +x fix-vps-nodejs.sh
   ```

3. Run the fix script:

   ```
   ./fix-vps-nodejs.sh
   ```

   The script will:

   - Stop any running containers
   - Remove the conflicting Node.js packages
   - Install Node.js 20
   - Install pnpm 8.15.8
   - Verify environment files exist
   - Start the containers again

4. Monitor the logs to ensure everything is working:
   ```
   docker-compose -f docker-compose.simple.yml logs -f
   ```

### Option 2: Manual Fix

If the script doesn't work, you can perform the following steps manually:

1. SSH into your VPS:

   ```
   ssh root@37.114.41.124
   ```

2. Stop existing containers:

   ```
   cd /opt/pegasus-nest
   docker-compose -f docker-compose.simple.yml down
   ```

3. Remove the conflicting Node.js packages:

   ```
   apt-get remove -y nodejs libnode-dev
   apt-get autoremove -y
   apt-get update
   ```

4. Install Node.js 20:

   ```
   curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
   apt-get install -y nodejs
   ```

5. Install pnpm 8.15.8:

   ```
   npm install -g pnpm@8.15.8
   ```

6. Verify environment files exist and are properly formatted:

   ```
   cat .env
   cat frontend/.env.local
   ```

7. Start the containers:

   ```
   docker-compose -f docker-compose.simple.yml up -d
   ```

8. Check container status:
   ```
   docker-compose -f docker-compose.simple.yml ps
   ```

## Verifying the Fix

After applying the fix, you can verify that the deployment is working:

1. Check container status:

   ```
   docker-compose -f docker-compose.simple.yml ps
   ```

2. Check the logs for any errors:

   ```
   docker-compose -f docker-compose.simple.yml logs
   ```

3. Test the application by visiting:

   - Main application: http://37.114.41.124
   - Health endpoint: http://37.114.41.124/health
   - Auth session: http://37.114.41.124/api/auth/get-session

4. Test GitHub OAuth login:
   - Visit: http://37.114.41.124/api/auth/sign-in/github

## Troubleshooting

If you still encounter issues after running the fix:

1. Check the environment variables in both `.env` and `frontend/.env.local`
2. Verify that all GitHub secrets are properly set in the GitHub repository
3. Check Docker logs for specific errors
4. Verify network connectivity and firewall rules on the VPS

## Need Help?

If you continue to have issues, please check the GitHub Actions logs and container logs for more specific error messages. These will help identify any remaining issues with the deployment.
