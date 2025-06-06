// Test auth configuration
require('dotenv').config({ path: '.env.local' });

async function testAuthConfig() {
  try {
    console.log('Testing auth configuration...');
    
    // Test environment variables
    console.log('Environment variables:');
    console.log('GITHUB_CLIENT_ID:', process.env.GITHUB_CLIENT_ID ? 'SET' : 'NOT SET');
    console.log('GITHUB_CLIENT_SECRET:', process.env.GITHUB_CLIENT_SECRET ? 'SET' : 'NOT SET');
    
    // Try to import the auth configuration
    const { auth } = await import('./lib/auth.ts');
    console.log('Auth config loaded successfully');
    
    // Check auth instance properties
    console.log('Auth instance created');
    console.log('Auth config object keys:', Object.keys(auth.config || {}));
    
    if (auth.config) {
      console.log('Providers:', auth.config.providers?.length || 0);
      console.log('Social providers keys:', Object.keys(auth.config.socialProviders || {}));
    }
    
  } catch (error) {
    console.error('Error testing auth config:', error.message);
    console.error(error.stack);
  }
}

testAuthConfig();
