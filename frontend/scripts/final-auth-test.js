// Final authentication verification test
const testEmail = `finaltest${Date.now()}@example.com`;
const testPassword = 'FinalTest123!';

console.log('🔐 FINAL AUTHENTICATION VERIFICATION');
console.log('=' .repeat(50));

async function verifyFeature(name, testFunction) {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    const result = await testFunction();
    if (result.success) {
      console.log(`✅ ${name}: WORKING`);
      return true;
    } else {
      console.log(`❌ ${name}: FAILED - ${result.error}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${name}: ERROR - ${error.message}`);
    return false;
  }
}

// Test 1: Sign Up
async function testSignUp() {
  const response = await fetch('http://localhost:3003/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      name: 'Final Test User'
    }),
  });
  
  if (response.ok) {
    const data = await response.json();
    return { 
      success: true, 
      data,
      sessionToken: response.headers.get('set-cookie')?.match(/better-auth\.session_token=([^;]+)/)?.[1]
    };
  }
  return { success: false, error: await response.text() };
}

// Test 2: Sign In
async function testSignIn() {
  const response = await fetch('http://localhost:3003/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  });
  
  if (response.ok) {
    const data = await response.json();
    return { 
      success: true, 
      data,
      sessionToken: response.headers.get('set-cookie')?.match(/better-auth\.session_token=([^;]+)/)?.[1]
    };
  }
  return { success: false, error: await response.text() };
}

// Test 3: Session Validation
async function testSession(sessionToken) {
  const response = await fetch('http://localhost:3003/api/auth/get-session', {
    method: 'GET',
    headers: {
      'Cookie': `better-auth.session_token=${sessionToken}`,
    },
  });
  
  if (response.ok) {
    const data = await response.json();
    return { success: !!data.session, data };
  }
  return { success: false, error: await response.text() };
}

// Test 4: Invalid Credentials
async function testInvalidLogin() {
  const response = await fetch('http://localhost:3003/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'invalid@example.com',
      password: 'wrongpassword',
    }),
  });
  
  // Should fail with 401
  return { success: response.status === 401 };
}

// Test 5: Sign Out
async function testSignOut(sessionToken) {
  const response = await fetch('http://localhost:3003/api/auth/sign-out', {
    method: 'POST',
    headers: {
      'Cookie': `better-auth.session_token=${sessionToken}`,
    },
  });
  
  return { success: response.ok };
}

// Run all tests
async function runVerification() {
  let passed = 0;
  let total = 0;
  let sessionToken = null;
  
  // Test signup
  total++;
  const signupResult = await verifyFeature('Email Sign Up', testSignUp);
  if (signupResult) {
    passed++;
    // Get session token from signup for other tests
    const signupData = await testSignUp();
    sessionToken = signupData.sessionToken;
  }
  
  // Test signin
  total++;
  if (await verifyFeature('Email Sign In', testSignIn)) {
    passed++;
    // Get fresh session token
    const signinData = await testSignIn();
    sessionToken = signinData.sessionToken || sessionToken;
  }
  
  // Test session validation
  total++;
  if (sessionToken && await verifyFeature('Session Validation', () => testSession(sessionToken))) {
    passed++;
  }
  
  // Test invalid credentials
  total++;
  if (await verifyFeature('Invalid Credentials Rejection', testInvalidLogin)) {
    passed++;
  }
  
  // Test sign out
  total++;
  if (sessionToken && await verifyFeature('Sign Out', () => testSignOut(sessionToken))) {
    passed++;
  }
  
  // Results
  console.log('\n🏁 VERIFICATION COMPLETE');
  console.log('=' .repeat(50));
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`📈 Success Rate: ${Math.round((passed/total)*100)}%`);
  
  if (passed === total) {
    console.log('\n🎉 ALL AUTHENTICATION FEATURES WORKING PERFECTLY!');
    console.log('✨ Your auth system is production-ready!');
  } else {
    console.log('\n⚠️ Some features need attention.');
  }
  
  return passed === total;
}

runVerification();
