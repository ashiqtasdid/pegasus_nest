// Test script to find the correct Better Auth v1.2.8 syntax
require('dotenv').config({ path: '.env.local' });

const { betterAuth } = require('better-auth');
const { mongodbAdapter } = require('better-auth/adapters/mongodb');
const { github } = require('better-auth/social-providers');
const { MongoClient } = require('mongodb');

async function testCorrectSyntax() {
  console.log('🧪 Testing Better Auth v1.2.8 Social Providers Syntax...\n');
  
  try {
    const mongoClient = new MongoClient(
      process.env.MONGODB_URL,
      {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }
    );

    console.log('1. Testing socialProviders object syntax...');
    try {
      const auth1 = betterAuth({
        database: mongodbAdapter(mongoClient.db('pegasus_auth')),
        secret: process.env.BETTER_AUTH_SECRET,
        baseURL: 'http://localhost:3003',
        emailAndPassword: {
          enabled: true,
          requireEmailVerification: false,
        },
        socialProviders: {
          github: github({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          }),
        },
      });
      console.log('   ✅ socialProviders object syntax works!');
      console.log('   - Has signInSocial:', typeof auth1.api.signInSocial === 'function');
      return auth1;
    } catch (error) {
      console.log('   ❌ socialProviders object syntax failed:', error.message);
    }

    console.log('\n2. Testing plugins array syntax...');
    try {
      const auth2 = betterAuth({
        database: mongodbAdapter(mongoClient.db('pegasus_auth')),
        secret: process.env.BETTER_AUTH_SECRET,
        baseURL: 'http://localhost:3003',
        emailAndPassword: {
          enabled: true,
          requireEmailVerification: false,
        },
        plugins: [
          github({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          })
        ],
      });
      console.log('   ✅ plugins array syntax works!');
      console.log('   - Has signInSocial:', typeof auth2.api.signInSocial === 'function');
      return auth2;
    } catch (error) {
      console.log('   ❌ plugins array syntax failed:', error.message);
    }

    console.log('\n3. Testing direct provider call...');
    const githubProvider = github({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    });
    console.log('   - GitHub provider created:', typeof githubProvider);
    console.log('   - Provider ID:', githubProvider.id);
    console.log('   - Provider name:', githubProvider.name);

  } catch (error) {
    console.error('❌ Overall test failed:', error.message);
  }
}

testCorrectSyntax().catch(console.error);
