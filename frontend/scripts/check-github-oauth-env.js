// Check GitHub OAuth Environment Variables
require('dotenv').config({ path: '.env.local' });

console.log('🔍 GitHub OAuth Environment Verification');
console.log('='.repeat(50));

// Function to check if value is a placeholder
function isPlaceholder(value) {
  if (!value) return true;

  const placeholders = [
    'your-github-client-id',
    'your_github_client_id',
    'your-github-client-secret',
    'your_github_client_secret',
    'your_actual_client_id_here',
    'your_actual_client_secret_here',
  ];

  return placeholders.some((placeholder) =>
    value.toLowerCase().includes(placeholder.toLowerCase()),
  );
}

// Check Better Auth environment variables
const envVars = {
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  MONGODB_URL: process.env.MONGODB_URL,
};

// Display and validate each variable
let hasIssues = false;
console.log('Environment Variables:');

Object.entries(envVars).forEach(([name, value]) => {
  const masked = value
    ? name.includes('SECRET') || name.includes('URL')
      ? `Set (length: ${value.length})`
      : value
    : 'Not set';

  const status = !value ? '❌' : isPlaceholder(value) ? '⚠️' : '✅';

  console.log(`${status} ${name}: ${masked}`);

  if (!value || isPlaceholder(value)) {
    hasIssues = true;
  }
});

// Output summary
console.log('\n📊 Summary:');
if (hasIssues) {
  console.log(
    '⚠️ Some environment variables are missing or using placeholder values',
  );
  console.log('  Please update your .env.local file with actual values');
} else {
  console.log(
    '✅ All Better Auth environment variables appear to be properly configured',
  );
}

// Provide specific advice for GitHub OAuth setup
if (
  !envVars.GITHUB_CLIENT_ID ||
  !envVars.GITHUB_CLIENT_SECRET ||
  isPlaceholder(envVars.GITHUB_CLIENT_ID) ||
  isPlaceholder(envVars.GITHUB_CLIENT_SECRET)
) {
  console.log('\n📝 GitHub OAuth Setup Instructions:');
  console.log('1. Go to: https://github.com/settings/developers');
  console.log('2. Create a new OAuth App or select an existing one');
  console.log('3. Set Authorization callback URL to:');
  console.log(`   - Local: http://localhost:3003/api/auth/callback/github`);
  console.log(`   - Production: http://37.114.41.124/api/auth/callback/github`);
  console.log('4. Copy the Client ID and Client Secret');
  console.log('5. Add them to your .env.local file');
  console.log(
    '6. For GitHub Actions deployment, add them as repository secrets with OAUTH_ prefix:',
  );
  console.log('   - OAUTH_GITHUB_CLIENT_ID');
  console.log('   - OAUTH_GITHUB_CLIENT_SECRET');
}

// Show note about GitHub Actions secrets naming
console.log('\n⚠️ Note for GitHub Actions Deployment:');
console.log('GitHub does not allow repository secrets to start with GITHUB_');
console.log(
  'Use OAUTH_GITHUB_CLIENT_ID and OAUTH_GITHUB_CLIENT_SECRET in GitHub repository secrets',
);
