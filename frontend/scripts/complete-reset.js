// Complete MongoDB reset and proper index setup for Better Auth
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function completeReset() {
  console.log('🔄 Complete MongoDB reset for Better Auth...');
  console.log('Environment check:', !!process.env.MONGODB_URL);
  
  const client = new MongoClient(process.env.MONGODB_URL);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = client.db('pegasus_auth');
    
    // List collections first
    const collections = await db.listCollections().toArray();
    console.log('📋 Current collections:', collections.map(c => c.name));
    
    // Drop the entire database to start completely fresh
    console.log('🗑️ Dropping entire database...');
    await db.dropDatabase();
    console.log('✅ Database dropped completely');
    
    // Recreate collections with proper schemas (no problematic indexes)
    console.log('📝 Creating collections with minimal indexes...');
    
    // Create user collection with only email unique index
    await db.createCollection('user');
    await db.collection('user').createIndex({ email: 1 }, { unique: true });
    console.log('✅ Created user collection with email index only');
    
    // Create session collection
    await db.createCollection('session');
    await db.collection('session').createIndex({ token: 1 }, { unique: true });
    await db.collection('session').createIndex({ userId: 1 });
    console.log('✅ Created session collection');
    
    // Create account collection
    await db.createCollection('account');
    await db.collection('account').createIndex({ userId: 1 });
    await db.collection('account').createIndex({ providerId: 1, accountId: 1 }, { unique: true });
    console.log('✅ Created account collection');
    
    // Create verification collection
    await db.createCollection('verification');
    await db.collection('verification').createIndex({ identifier: 1, token: 1 }, { unique: true });
    console.log('✅ Created verification collection');
    
    console.log('🎉 Complete reset successful! Collections created without problematic id indexes.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

completeReset().then(() => {
  console.log('🏁 Script completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
