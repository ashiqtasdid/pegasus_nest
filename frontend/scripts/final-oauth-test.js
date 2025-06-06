// Final GitHub OAuth test - check if it's working
console.log('🔍 Final GitHub OAuth Configuration Test\n');

// Test from client side approach
async function testClientSideOAuth() {
  console.log('Testing client-side OAuth configuration...');
  
  try {
    // Import the auth client
    const { createAuthClient } = require('better-auth/react');
    
    const authClient = createAuthClient({
      baseURL: 'http://localhost:3003',
    });
    
    console.log('✅ Auth client created successfully');
    console.log('Client methods:', Object.keys(authClient));
    
    // Check if signIn method exists and has social
    if (authClient.signIn && typeof authClient.signIn === 'object') {
      console.log('SignIn methods:', Object.keys(authClient.signIn));
      
      if (authClient.signIn.social) {
        console.log('✅ signIn.social method found!');
        console.log('Method type:', typeof authClient.signIn.social);
        
        // Try to inspect the method (without calling it)
        const socialMethod = authClient.signIn.social;
        console.log('Social method details:', {
          length: socialMethod.length,
          name: socialMethod.name,
        });
        
        return true;
      } else {
        console.log('❌ signIn.social method not found');
        return false;
      }
    } else {
      console.log('❌ signIn method not found or not an object');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error testing client-side OAuth:', error.message);
    return false;
  }
}

// Test server-side configuration
async function testServerSideOAuth() {
  console.log('\nTesting server-side OAuth configuration...');
  
  try {
    require('dotenv').config({ path: '.env.local' });
    
    const { betterAuth } = require('better-auth');
    const { mongodbAdapter } = require('better-auth/adapters/mongodb');
    const { github } = require('better-auth/social-providers');
    const { MongoClient } = require('mongodb');
    
    // Create the same configuration as the main auth file
    const mongoClient = new MongoClient(
      process.env.MONGODB_URL || 'mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/pegasus_auth?retryWrites=true&w=majority',
      {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }
    );
    
    const auth = betterAuth({
      database: mongodbAdapter(mongoClient.db('pegasus_auth')),
      secret: process.env.BETTER_AUTH_SECRET || 'test-secret',
      baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3003',
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
      },
      plugins: [
        github({
          clientId: process.env.GITHUB_CLIENT_ID || '',
          clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        }),
      ],
      session: {
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
      },
    });
    
    console.log('✅ Server auth instance created');
    console.log('Auth instance type:', typeof auth);
    console.log('Has handler:', typeof auth.handler === 'function');
    
    // Check if we can find social auth capabilities
    if (auth.api) {
      console.log('API methods:', Object.keys(auth.api));
      
      // Look for social-related methods
      const socialMethods = Object.keys(auth.api).filter(key => 
        key.toLowerCase().includes('social') || 
        key.toLowerCase().includes('github') ||
        key.toLowerCase().includes('signin')
      );
      
      if (socialMethods.length > 0) {
        console.log('✅ Social-related methods found:', socialMethods);
      } else {
        console.log('⚠️ No obvious social methods found in API');
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error testing server-side OAuth:', error.message);
    return false;
  }
}

// Run tests
async function runAllTests() {
  console.log('='.repeat(60));
  
  const clientOK = await testClientSideOAuth();
  const serverOK = await testServerSideOAuth();
  
  console.log('\n' + '='.repeat(60));
  console.log('FINAL RESULTS:');
  console.log(`Client OAuth Support: ${clientOK ? '✅' : '❌'}`);
  console.log(`Server OAuth Support: ${serverOK ? '✅' : '❌'}`);
  
  if (clientOK && serverOK) {
    console.log('\n🎉 GitHub OAuth should be working!');
    console.log('💡 Try clicking the "Continue with GitHub" button');
  } else {
    console.log('\n⚠️ GitHub OAuth may have configuration issues');
    console.log('💡 Check the logs above for specific problems');
  }
  
  console.log('\n📋 Environment Status:');
  console.log(`GITHUB_CLIENT_ID: ${process.env.GITHUB_CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`GITHUB_CLIENT_SECRET: ${process.env.GITHUB_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
}

runAllTests().catch(console.error);
