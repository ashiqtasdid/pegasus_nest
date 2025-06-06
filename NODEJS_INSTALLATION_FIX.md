# Fix for Node.js Installation Conflict on VPS

## Error Description

When deploying the Pegasus Nest application, the following error occurs during Node.js installation:

```
dpkg: error processing archive /var/cache/apt/archives/nodejs_20.19.2-1nodesource1_amd64.deb (--unpack):
 trying to overwrite '/usr/include/node/common.gypi', which is also in package libnode-dev 12.22.9~dfsg-1ubuntu3.6
```

This error happens because the new Node.js 20 package conflicts with the existing `libnode-dev` package on the VPS.

## Quick Fix Instructions

### Option 1: Using the Fix Script

1. SSH into your VPS:

   ```
   ssh root@37.114.41.124
   ```

2. Download the fix script:

   ```
   cd /opt/pegasus-nest
   curl -O https://raw.githubusercontent.com/ashiqtasdid/pegasus_nest/main/fix-nodejs-conflict.sh
   chmod +x fix-nodejs-conflict.sh
   ```

3. Run the script:
   ```
   ./fix-nodejs-conflict.sh
   ```

### Option 2: Manual Fix

If you prefer to fix the issue manually, follow these steps:

1. SSH into your VPS:

   ```
   ssh root@37.114.41.124
   ```

2. Stop any running containers:

   ```
   cd /opt/pegasus-nest
   docker-compose -f docker-compose.simple.yml down
   ```

3. Remove the conflicting packages:

   ```
   apt-get remove -y libnode-dev
   apt-get remove -y nodejs
   apt-get autoremove -y
   apt-get update
   ```

4. Install Node.js 20:

   ```
   curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
   apt-get install -y nodejs
   ```

5. Verify the installation:

   ```
   node -v  # Should show v20.x.x
   npm -v   # Should show v10.x.x
   ```

6. Install pnpm:

   ```
   npm install -g pnpm@8.15.8
   pnpm -v  # Should show 8.15.8
   ```

7. Restart the application:

   ```
   docker-compose -f docker-compose.simple.yml up -d
   ```

8. Check the container status:
   ```
   docker-compose -f docker-compose.simple.yml ps
   ```

## Verification

After applying the fix, verify that the application is running correctly:

1. Check if all containers are running:

   ```
   docker-compose -f docker-compose.simple.yml ps
   ```

2. Check the application logs:

   ```
   docker-compose -f docker-compose.simple.yml logs
   ```

3. Test the endpoints in your browser:

   - Main application: http://37.114.41.124
   - Health endpoint: http://37.114.41.124/health
   - Auth session: http://37.114.41.124/api/auth/get-session

4. Test GitHub OAuth login:
   - Visit: http://37.114.41.124/api/auth/sign-in/github

## Why This Works

The fix works by:

1. Removing the conflicting `libnode-dev` package that contains files that overlap with the new Node.js package
2. Cleaning up any other related packages with `autoremove`
3. Installing Node.js 20 from the official NodeSource repository
4. Installing the correct version of pnpm (8.15.8) that's compatible with our Docker setup

This ensures that the VPS has the exact same Node.js and pnpm versions as specified in our Dockerfiles, preventing version incompatibility issues.
