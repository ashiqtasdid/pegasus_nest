// Verify GitHub OAuth Configuration
require('dotenv').config({ path: '.env.local' });

console.log('🔍 GitHub OAuth Configuration Verification');
console.log('=' .repeat(50));

const clientId = process.env.GITHUB_CLIENT_ID;
const clientSecret = process.env.GITHUB_CLIENT_SECRET;

console.log(`GITHUB_CLIENT_ID: ${clientId || 'Not set'}`);
console.log(`GITHUB_CLIENT_SECRET: ${clientSecret ? 'Set (length: ' + clientSecret.length + ')' : 'Not set'}`);

// Check if still using placeholder values
const isPlaceholder = 
  clientId === 'your-github-client-id' || 
  clientId === 'your_actual_client_id_here' ||
  clientSecret === 'your-github-client-secret' ||
  clientSecret === 'your_actual_client_secret_here';

if (!clientId || !clientSecret) {
  console.log('\n❌ GitHub OAuth is not configured');
  console.log('📝 Missing environment variables');
} else if (isPlaceholder) {
  console.log('\n⚠️ GitHub OAuth is using placeholder values');
  console.log('📝 Please update .env.local with real GitHub OAuth credentials');
} else {
  console.log('\n✅ GitHub OAuth appears to be configured with real credentials');
  console.log('🎉 Ready to test GitHub authentication!');
}

console.log('\n📋 Next Steps:');
if (!clientId || !clientSecret || isPlaceholder) {
  console.log('1. Go to: https://github.com/settings/applications/new');
  console.log('2. Create OAuth App with callback: http://localhost:3003/api/auth/callback/github');
  console.log('3. Copy Client ID and Client Secret');
  console.log('4. Update .env.local with real values');
  console.log('5. Restart development server');
} else {
  console.log('1. Restart development server (if not done already)');
  console.log('2. Go to: http://localhost:3003/auth');
  console.log('3. Click "Continue with GitHub"');
  console.log('4. Test the OAuth flow');
}
