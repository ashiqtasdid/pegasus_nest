// Test Better Auth configuration directly
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { nanoid } = require('nanoid');

async function testBetterAuthConfig() {
  console.log('🔧 Testing Better Auth MongoDB configuration...');
  
  const client = new MongoClient(process.env.MONGODB_URL);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('pegasus_auth');
    const userCollection = db.collection('user');
    
    // Test manual user creation with proper ID
    const testUser = {
      id: nanoid(),
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    console.log('📝 Creating test user manually:', testUser);
    
    const result = await userCollection.insertOne(testUser);
    console.log('✅ Manual user creation successful:', result.insertedId);
    
    // Verify the user was created
    const createdUser = await userCollection.findOne({ id: testUser.id });
    console.log('👤 Created user:', createdUser);
    
    // Clean up
    await userCollection.deleteOne({ id: testUser.id });
    console.log('🧹 Cleaned up test user');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

testBetterAuthConfig();
