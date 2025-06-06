// Simple authentication feature test
require('dotenv').config({ path: '.env.local' });

async function testBasicAuth() {
  console.log('🧪 Testing basic authentication...');
  
  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  
  try {
    // Test signup
    console.log('📝 Testing signup...');
    const signupResponse = await fetch('http://localhost:3003/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: 'Test User'
      }),
    });
    
    console.log(`Signup status: ${signupResponse.status}`);
    if (signupResponse.ok) {
      const signupData = await signupResponse.json();
      console.log('✅ Signup successful');
      console.log(`User ID: ${signupData.user?.id}`);
      
      // Test signin
      console.log('\n🔑 Testing signin...');
      const signinResponse = await fetch('http://localhost:3003/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });
      
      console.log(`Signin status: ${signinResponse.status}`);
      if (signinResponse.ok) {
        const signinData = await signinResponse.json();
        console.log('✅ Signin successful');
        console.log(`Token: ${signinData.token?.substring(0, 20)}...`);
        
        return { success: true, message: 'Basic auth working perfectly!' };
      } else {
        const error = await signinResponse.text();
        console.log('❌ Signin failed:', error);
        return { success: false, message: 'Signin failed' };
      }
    } else {
      const error = await signupResponse.text();
      console.log('❌ Signup failed:', error);
      return { success: false, message: 'Signup failed' };
    }
  } catch (error) {
    console.log('❌ Test error:', error.message);
    return { success: false, message: error.message };
  }
}

testBasicAuth().then(result => {
  console.log('\n🏁 Result:', result.message);
  process.exit(result.success ? 0 : 1);
});
