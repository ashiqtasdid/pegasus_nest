// Debug script to test Better Auth configuration
require('dotenv').config({ path: '.env.local' });

const { betterAuth } = require('better-auth');
const { mongodbAdapter } = require('better-auth/adapters/mongodb');
const { MongoClient } = require('mongodb');

async function debugAuthConfig() {
  console.log('🔍 Debugging Better Auth Configuration...\n');
  
  // Check environment variables
  console.log('1. Environment Variables:');
  console.log('   - GitHub Client ID:', process.env.GITHUB_CLIENT_ID || 'NOT SET');
  console.log('   - GitHub Client Secret:', process.env.GITHUB_CLIENT_SECRET ? 'SET (40 chars)' : 'NOT SET');
  console.log('   - Better Auth Secret:', process.env.BETTER_AUTH_SECRET ? 'SET' : 'NOT SET');
  console.log('   - MongoDB URL:', process.env.MONGODB_URL ? 'SET' : 'NOT SET');
  console.log('');

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

    console.log('2. Creating Better Auth instance...');
    
    // Create auth instance with different socialProviders syntax
    const auth = betterAuth({
      database: mongodbAdapter(mongoClient.db('pegasus_auth')),
      secret: process.env.BETTER_AUTH_SECRET || 'test-secret-key',
      baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3003',
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
      },
      socialProviders: {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          enabled: true,
        },
      },
      session: {
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
      },
    });

    console.log('   ✅ Better Auth instance created successfully');
    
    // Check if the auth instance has the expected methods/properties
    console.log('\n3. Auth Instance Analysis:');
    console.log('   - Type:', typeof auth);
    console.log('   - Has handler:', typeof auth.handler === 'function');
    console.log('   - Has api:', typeof auth.api === 'object');
    
    // Try to get routes/endpoints
    if (auth.api) {
      console.log('   - API keys:', Object.keys(auth.api));
    }
    
    // Test with different syntax approaches
    console.log('\n4. Testing Alternative Configurations...');
    
    // Alternative 1: Array syntax
    try {
      const auth2 = betterAuth({
        database: mongodbAdapter(mongoClient.db('pegasus_auth')),
        secret: process.env.BETTER_AUTH_SECRET || 'test-secret-key',
        baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3003',
        emailAndPassword: {
          enabled: true,
        },
        socialProviders: [
          {
            id: 'github',
            name: 'GitHub',
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          }
        ],
      });
      console.log('   ✅ Array syntax works');
    } catch (error) {
      console.log('   ❌ Array syntax failed:', error.message);
    }
    
    // Alternative 2: plugins approach
    try {
      const auth3 = betterAuth({
        database: mongodbAdapter(mongoClient.db('pegasus_auth')),
        secret: process.env.BETTER_AUTH_SECRET || 'test-secret-key',
        baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3003',
        emailAndPassword: {
          enabled: true,
        },
        plugins: [
          {
            id: 'github-oauth',
            socialProviders: {
              github: {
                clientId: process.env.GITHUB_CLIENT_ID,
                clientSecret: process.env.GITHUB_CLIENT_SECRET,
              }
            }
          }
        ],
      });
      console.log('   ✅ Plugins syntax works');
    } catch (error) {
      console.log('   ❌ Plugins syntax failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error creating auth instance:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugAuthConfig().catch(console.error);
