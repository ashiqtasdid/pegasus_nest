// Test script to verify auth endpoints and configuration
require('dotenv').config({ path: '.env.local' });

const { betterAuth } = require('better-auth');
const { mongodbAdapter } = require('better-auth/adapters/mongodb');
const { github } = require('better-auth/social-providers');
const { MongoClient } = require('mongodb');

async function testAuthEndpoints() {
  console.log('🔍 Testing Auth Configuration and Endpoints...\n');
  
  try {
    // Create MongoDB client
    const mongoClient = new MongoClient(
      process.env.MONGODB_URL || 'mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/pegasus_auth?retryWrites=true&w=majority',
      {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }
    );

    // Create auth instance exactly like in the main config
    const auth = betterAuth({
      database: mongodbAdapter(mongoClient.db('pegasus_auth')),
      secret: process.env.BETTER_AUTH_SECRET || 'your-secret-key-here-change-in-production',
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

    console.log('✅ Auth instance created successfully\n');

    // Test the handler function
    console.log('📋 Auth Instance Properties:');
    console.log('   - Has handler:', typeof auth.handler === 'function');
    console.log('   - Has api:', !!auth.api);
    console.log('   - Handler type:', typeof auth.handler);
    
    if (auth.api) {
      console.log('   - API methods:', Object.keys(auth.api));
      
      // Check for social auth methods
      if (auth.api.signInSocial) {
        console.log('   - Has signInSocial:', typeof auth.api.signInSocial);
      }
    }

    // Test a request to the GitHub endpoint
    console.log('\n🌐 Testing GitHub OAuth Endpoint...');
    
    // Create a mock request object
    const mockRequest = {
      method: 'GET',
      url: 'http://localhost:3003/api/auth/sign-in/github',
      headers: new Headers(),
    };

    try {
      // Test the handler directly
      const response = await auth.handler(mockRequest);
      console.log('   - Handler response status:', response?.status);
      console.log('   - Handler response type:', typeof response);
      
      if (response && response.headers) {
        const location = response.headers.get('location');
        if (location) {
          console.log('   - Redirect location:', location);
          console.log('   - Contains github.com:', location.includes('github.com'));
        }
      }
    } catch (error) {
      console.log('   - Handler error:', error.message);
    }

    // Test what routes are available
    console.log('\n📍 Available Routes Test:');
    
    // Try to get all available routes/paths
    const testPaths = [
      '/sign-in/github',
      '/auth/sign-in/github',
      '/api/auth/sign-in/github',
      '/sign-in/social/github',
      '/oauth/github',
    ];

    for (const path of testPaths) {
      const testReq = {
        method: 'GET',
        url: `http://localhost:3003${path}`,
        headers: new Headers(),
      };
      
      try {
        const response = await auth.handler(testReq);
        if (response && response.status !== 404) {
          console.log(`   ✅ ${path} -> Status: ${response.status}`);
        } else {
          console.log(`   ❌ ${path} -> 404`);
        }
      } catch (error) {
        console.log(`   ❌ ${path} -> Error: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAuthEndpoints().catch(console.error);
