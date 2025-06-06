// Test GitHub OAuth endpoints and configuration
require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch');

async function testGitHubOAuth() {
  console.log('🔍 Testing GitHub OAuth Configuration...\n');
  
  const baseURL = 'http://localhost:3003';
  
  // Test different potential GitHub OAuth endpoints
  const endpoints = [
    '/api/auth/sign-in/github',
    '/api/auth/signin/github',
    '/api/auth/github',
    '/api/auth/social/github',
    '/api/auth/oauth/github',
    '/api/auth/callback/github',
  ];
  
  console.log('📋 Testing Endpoints:');
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n   Testing: ${endpoint}`);
      const response = await fetch(`${baseURL}${endpoint}`, {
        method: 'GET',
        redirect: 'manual', // Don't follow redirects so we can see them
      });
      
      console.log(`   Status: ${response.status}`);
      
      if (response.status === 302 || response.status === 301) {
        const location = response.headers.get('location');
        console.log(`   Redirect to: ${location}`);
        
        if (location && location.includes('github.com')) {
          console.log('   ✅ GitHub OAuth redirect detected!');
        }
      } else if (response.status === 200) {
        console.log('   ✅ Endpoint responds successfully');
      } else if (response.status === 404) {
        console.log('   ❌ Not found');
      } else {
        console.log(`   ⚠️  Unexpected status: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  // Test the main auth endpoint to see what's available
  console.log('\n🌐 Testing Base Auth Endpoint:');
  try {
    const response = await fetch(`${baseURL}/api/auth`, {
      method: 'GET',
    });
    console.log(`   Status: ${response.status}`);
    
    if (response.ok) {
      const text = await response.text();
      console.log(`   Response: ${text.substring(0, 200)}...`);
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  
  // Check environment variables
  console.log('\n🔧 Environment Variables:');
  console.log(`   GitHub Client ID: ${process.env.GITHUB_CLIENT_ID || 'NOT SET'}`);
  console.log(`   GitHub Client Secret: ${process.env.GITHUB_CLIENT_SECRET ? 'SET (40 chars)' : 'NOT SET'}`);
  console.log(`   Better Auth Secret: ${process.env.BETTER_AUTH_SECRET ? 'SET' : 'NOT SET'}`);
  console.log(`   MongoDB URL: ${process.env.MONGODB_URL ? 'SET' : 'NOT SET'}`);
}

testGitHubOAuth().catch(console.error);
