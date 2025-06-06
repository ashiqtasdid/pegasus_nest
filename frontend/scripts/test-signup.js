// Test signup functionality to verify ID generation fix
require('dotenv').config({ path: '.env.local' });

async function testSignup() {
  console.log('🧪 Testing signup functionality...');
  
  const email = `test${Date.now()}@example.com`;
  const password = 'testpassword123';
  const name = 'Test User';
  
  try {
    console.log(`📧 Testing signup for: ${email}`);
    
    const response = await fetch('http://localhost:3003/api/auth/sign-up/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        name,
      }),
    });
    
    console.log(`📊 Response Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Signup successful!');
      console.log('📋 Response data:', JSON.stringify(data, null, 2));
      
      if (data.user && data.user.id) {
        console.log(`🎯 User ID generated: ${data.user.id}`);
        console.log('✅ ID generation working correctly!');
      } else {
        console.log('⚠️ No user ID in response');
      }
    } else {
      const errorText = await response.text();
      console.log('❌ Signup failed');
      console.log('📋 Error response:', errorText);
    }
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testSignup();