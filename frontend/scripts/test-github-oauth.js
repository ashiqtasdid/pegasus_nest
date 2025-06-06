// Test GitHub OAuth Endpoint
const fetch = require('node-fetch');

async function testGitHubOAuth() {
  console.log('🧪 Testing GitHub OAuth Endpoint');
  console.log('=' .repeat(40));
  
  try {
    const response = await fetch('http://localhost:3003/api/auth/sign-in/github', {
      method: 'GET',
      redirect: 'manual' // Don't follow redirects
    });
    
    console.log(`📊 Status: ${response.status}`);
    console.log(`📍 Status Text: ${response.statusText}`);
    
    if (response.status === 302) {
      const location = response.headers.get('location');
      console.log('✅ GitHub OAuth is working!');
      console.log(`🔗 Redirect URL: ${location ? location.substring(0, 100) + '...' : 'Not found'}`);
      
      if (location && location.includes('github.com')) {
        console.log('✅ Proper redirect to GitHub OAuth');
        console.log('🎉 GitHub OAuth is fully functional!');
      } else {
        console.log('⚠️ Unexpected redirect destination');
      }
    } else {
      console.log('⚠️ Unexpected response status');
      const text = await response.text();
      console.log('Response:', text.substring(0, 200));
    }
    
  } catch (error) {
    console.log('❌ Error testing GitHub OAuth:', error.message);
  }
}

testGitHubOAuth();
