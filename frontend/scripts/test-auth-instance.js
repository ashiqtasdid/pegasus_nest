// Test Better Auth instance creation
require('dotenv').config({ path: '.env.local' });

console.log('🔧 Testing Better Auth Instance Creation');
console.log('=' .repeat(50));

// Check environment variables first
console.log('Environment Variables:');
console.log('MONGODB_URL:', process.env.MONGODB_URL ? 'Set' : 'Missing');
console.log('BETTER_AUTH_SECRET:', process.env.BETTER_AUTH_SECRET ? 'Set' : 'Missing');
console.log('BETTER_AUTH_URL:', process.env.BETTER_AUTH_URL);
console.log('GITHUB_CLIENT_ID:', process.env.GITHUB_CLIENT_ID);
console.log('GITHUB_CLIENT_SECRET:', process.env.GITHUB_CLIENT_SECRET ? 'Set' : 'Missing');

console.log('\n🏗️ Creating Auth Instance...');

try {
  // Import the auth instance
  const { auth } = require('./src/lib/auth');
  console.log('✅ Auth instance created successfully');
  console.log('🔍 Auth instance type:', typeof auth);
  
  // Check if auth has the expected methods
  if (auth && typeof auth === 'object') {
    console.log('📋 Available auth methods:', Object.keys(auth));
  }

  // Try to get the handler
  const { toNextJsHandler } = require('better-auth/next-js');
  const handlers = toNextJsHandler(auth);
  console.log('✅ Next.js handlers created successfully');
  console.log('📋 Available handlers:', Object.keys(handlers));
  
} catch (error) {
  console.log('❌ Error creating auth instance:');
  console.log('Error message:', error.message);
  console.log('Stack trace:', error.stack);
}
