// Comprehensive authentication testing suite
require('dotenv').config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3003';

// Helper function to make API requests
async function makeRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  console.log(`🌐 ${options.method || 'GET'} ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    data: await response.text(),
  };
}

// Test 1: Email/Password Sign Up
async function testEmailSignUp() {
  console.log('\n🧪 Test 1: Email/Password Sign Up');
  console.log('=' .repeat(50));
  
  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  const testName = 'Test User';
  
  try {
    const result = await makeRequest('/api/auth/sign-up/email', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: testName,
      }),
    });
    
    console.log(`📊 Status: ${result.status}`);
    console.log(`📋 Response: ${result.data.substring(0, 200)}...`);
    
    if (result.status === 200) {
      const userData = JSON.parse(result.data);
      console.log('✅ Sign up successful');
      console.log(`👤 User ID: ${userData.user?.id}`);
      console.log(`📧 Email: ${userData.user?.email}`);
      console.log(`🎫 Token: ${userData.token?.substring(0, 20)}...`);
      return { success: true, data: userData, testEmail, testPassword };
    } else {
      console.log('❌ Sign up failed');
      return { success: false, error: result.data };
    }
  } catch (error) {
    console.log('❌ Sign up error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 2: Email/Password Sign In
async function testEmailSignIn(credentials) {
  console.log('\n🧪 Test 2: Email/Password Sign In');
  console.log('=' .repeat(50));
  
  if (!credentials?.testEmail) {
    console.log('⚠️ Skipping - no credentials from sign up test');
    return { success: false, error: 'No credentials' };
  }
  
  try {
    const result = await makeRequest('/api/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({
        email: credentials.testEmail,
        password: credentials.testPassword,
      }),
    });
    
    console.log(`📊 Status: ${result.status}`);
    console.log(`📋 Response: ${result.data.substring(0, 200)}...`);
    
    if (result.status === 200) {
      const userData = JSON.parse(result.data);
      console.log('✅ Sign in successful');
      console.log(`👤 User ID: ${userData.user?.id}`);
      console.log(`📧 Email: ${userData.user?.email}`);
      console.log(`🎫 Token: ${userData.token?.substring(0, 20)}...`);
      
      // Extract session token from headers
      const setCookie = result.headers['set-cookie'];
      let sessionToken = null;
      if (setCookie) {
        const match = setCookie.match(/better-auth\.session_token=([^;]+)/);
        sessionToken = match ? match[1] : null;
      }
      
      return { success: true, data: userData, sessionToken };
    } else {
      console.log('❌ Sign in failed');
      return { success: false, error: result.data };
    }
  } catch (error) {
    console.log('❌ Sign in error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 3: Session Validation
async function testSessionValidation(sessionToken) {
  console.log('\n🧪 Test 3: Session Validation');
  console.log('=' .repeat(50));
  
  if (!sessionToken) {
    console.log('⚠️ Skipping - no session token from sign in test');
    return { success: false, error: 'No session token' };
  }
  
  try {
    const result = await makeRequest('/api/auth/get-session', {
      method: 'GET',
      headers: {
        'Cookie': `better-auth.session_token=${sessionToken}`,
      },
    });
    
    console.log(`📊 Status: ${result.status}`);
    console.log(`📋 Response: ${result.data.substring(0, 200)}...`);
    
    if (result.status === 200) {
      const sessionData = JSON.parse(result.data);
      console.log('✅ Session validation successful');
      console.log(`👤 User: ${sessionData.user?.email || 'Unknown'}`);
      console.log(`🕒 Session valid: ${!!sessionData.session}`);
      return { success: true, data: sessionData };
    } else {
      console.log('❌ Session validation failed');
      return { success: false, error: result.data };
    }
  } catch (error) {
    console.log('❌ Session validation error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 4: Sign Out
async function testSignOut(sessionToken) {
  console.log('\n🧪 Test 4: Sign Out');
  console.log('=' .repeat(50));
  
  if (!sessionToken) {
    console.log('⚠️ Skipping - no session token');
    return { success: false, error: 'No session token' };
  }
  
  try {
    const result = await makeRequest('/api/auth/sign-out', {
      method: 'POST',
      headers: {
        'Cookie': `better-auth.session_token=${sessionToken}`,
      },
    });
    
    console.log(`📊 Status: ${result.status}`);
    console.log(`📋 Response: ${result.data}`);
    
    if (result.status === 200) {
      console.log('✅ Sign out successful');
      return { success: true };
    } else {
      console.log('❌ Sign out failed');
      return { success: false, error: result.data };
    }
  } catch (error) {
    console.log('❌ Sign out error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 5: GitHub OAuth Endpoints
async function testGitHubOAuth() {
  console.log('\n🧪 Test 5: GitHub OAuth Endpoints');
  console.log('=' .repeat(50));
  
  try {
    // Test OAuth initiation endpoint
    const result = await makeRequest('/api/auth/sign-in/github', {
      method: 'GET',
    });
    
    console.log(`📊 OAuth initiation status: ${result.status}`);
    
    if (result.status === 302 || result.status === 200) {
      console.log('✅ GitHub OAuth endpoint available');
      console.log('🔗 OAuth flow can be initiated');
      
      // Check if we're getting a redirect to GitHub
      const location = result.headers.location;
      if (location && location.includes('github.com')) {
        console.log('✅ Proper redirect to GitHub OAuth');
        console.log(`🌐 Redirect URL: ${location.substring(0, 100)}...`);
      }
      
      return { success: true, available: true };
    } else {
      console.log('⚠️ GitHub OAuth endpoint not properly configured');
      return { success: false, available: false, error: result.data };
    }
  } catch (error) {
    console.log('❌ GitHub OAuth test error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 6: Invalid Credentials
async function testInvalidCredentials() {
  console.log('\n🧪 Test 6: Invalid Credentials Handling');
  console.log('=' .repeat(50));
  
  try {
    const result = await makeRequest('/api/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
      }),
    });
    
    console.log(`📊 Status: ${result.status}`);
    console.log(`📋 Response: ${result.data}`);
    
    if (result.status === 401 || result.status === 400) {
      console.log('✅ Invalid credentials properly rejected');
      return { success: true };
    } else {
      console.log('⚠️ Invalid credentials not properly handled');
      return { success: false, error: 'Should have been rejected' };
    }
  } catch (error) {
    console.log('❌ Invalid credentials test error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 7: API Route Protection
async function testAPIRouteProtection() {
  console.log('\n🧪 Test 7: API Route Protection');
  console.log('=' .repeat(50));
  
  try {
    // Test accessing a protected endpoint without authentication
    const result = await makeRequest('/api/auth/get-session', {
      method: 'GET',
      // No authentication headers
    });
    
    console.log(`📊 Status: ${result.status}`);
    console.log(`📋 Response: ${result.data}`);
    
    // Session endpoint should return 200 but with null session
    if (result.status === 200) {
      const data = JSON.parse(result.data);
      if (!data.session) {
        console.log('✅ Protected route properly handles unauthenticated requests');
        return { success: true };
      } else {
        console.log('⚠️ Route returned session without authentication');
        return { success: false, error: 'Unexpected session data' };
      }
    } else {
      console.log('⚠️ Unexpected response from protected route');
      return { success: false, error: result.data };
    }
  } catch (error) {
    console.log('❌ Route protection test error:', error.message);
    return { success: false, error: error.message };
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 COMPREHENSIVE AUTHENTICATION TEST SUITE');
  console.log('=' .repeat(60));
  console.log(`🌐 Testing server at: ${BASE_URL}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  
  const results = {};
  
  // Wait a moment for server to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Run tests sequentially
  results.signUp = await testEmailSignUp();
  results.signIn = await testEmailSignIn(results.signUp.success ? results.signUp : null);
  results.sessionValidation = await testSessionValidation(results.signIn.success ? results.signIn.sessionToken : null);
  results.signOut = await testSignOut(results.signIn.success ? results.signIn.sessionToken : null);
  results.githubOAuth = await testGitHubOAuth();
  results.invalidCredentials = await testInvalidCredentials();
  results.routeProtection = await testAPIRouteProtection();
  
  // Summary
  console.log('\n🏁 TEST SUMMARY');
  console.log('=' .repeat(60));
  
  const tests = [
    { name: 'Email Sign Up', result: results.signUp },
    { name: 'Email Sign In', result: results.signIn },
    { name: 'Session Validation', result: results.sessionValidation },
    { name: 'Sign Out', result: results.signOut },
    { name: 'GitHub OAuth', result: results.githubOAuth },
    { name: 'Invalid Credentials', result: results.invalidCredentials },
    { name: 'Route Protection', result: results.routeProtection },
  ];
  
  let passed = 0;
  let total = tests.length;
  
  tests.forEach(test => {
    const status = test.result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test.name}`);
    if (test.result.success) passed++;
    if (!test.result.success && test.result.error) {
      console.log(`    └─ Error: ${test.result.error}`);
    }
  });
  
  console.log('\n📊 OVERALL RESULTS:');
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);
  console.log(`📈 Success Rate: ${Math.round((passed / total) * 100)}%`);
  
  if (passed === total) {
    console.log('\n🎉 ALL AUTHENTICATION FEATURES WORKING PERFECTLY!');
  } else {
    console.log('\n⚠️ Some authentication features need attention.');
  }
  
  return { passed, total, results };
}

// Run the tests
runAllTests().then(() => {
  console.log('\n🏁 Test suite completed');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Test suite failed:', error);
  process.exit(1);
});
