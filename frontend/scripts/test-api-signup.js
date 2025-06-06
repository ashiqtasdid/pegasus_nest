// Test Better Auth signup directly through API
require('dotenv').config({ path: '.env.local' });

async function testSignup() {
  console.log('🧪 Testing Better Auth signup...');
  console.log('📍 Testing at:', 'http://localhost:3003/api/auth/sign-up');
  
  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'Test123!@#';
  
  try {
    const response = await fetch('http://localhost:3003/api/auth/sign-up/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: 'Test User'
      }),
    });
    
    console.log('📋 Response status:', response.status);
    console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📋 Response body:', responseText);
    
    if (response.ok) {
      console.log('✅ Signup successful!');
      try {
        const data = JSON.parse(responseText);
        console.log('👤 User data:', data);
      } catch (e) {
        console.log('⚠️ Response is not JSON');
      }
    } else {
      console.log('❌ Signup failed');
    }
      } catch (error) {
    console.error('❌ Error testing signup:', error);
  }
}

console.log('🚀 Starting signup test...');
testSignup().then(() => {
  console.log('✅ Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
