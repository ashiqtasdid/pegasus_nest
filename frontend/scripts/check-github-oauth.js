// Check GitHub OAuth configuration
require('dotenv').config({ path: '.env.local' });

function checkGitHubOAuthConfig() {
  console.log('🔍 Checking GitHub OAuth Configuration');
  console.log('=' .repeat(50));
  
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  
  console.log(`GITHUB_CLIENT_ID: ${clientId ? '✅ Set' : '❌ Missing'}`);
  console.log(`GITHUB_CLIENT_SECRET: ${clientSecret ? '✅ Set' : '❌ Missing'}`);
  
  if (clientId && clientSecret) {
    console.log('✅ GitHub OAuth is properly configured');
    console.log(`Client ID: ${clientId.substring(0, 10)}...`);
    return true;
  } else {
    console.log('⚠️ GitHub OAuth needs configuration');
    console.log('\nTo set up GitHub OAuth:');
    console.log('1. Go to GitHub Settings > Developer settings > OAuth Apps');
    console.log('2. Create a new OAuth App');
    console.log('3. Set Authorization callback URL to: http://localhost:3003/api/auth/callback/github');
    console.log('4. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to .env.local');
    return false;
  }
}

checkGitHubOAuthConfig();
