// Fix MongoDB indexes for Better Auth compatibility
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function fixMongoDBIndexes() {
  console.log('🔧 Fixing MongoDB indexes for Better Auth...');
  
  const client = new MongoClient(process.env.MONGODB_URL);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = client.db('pegasus_auth');
    
    // Drop the user collection entirely and recreate
    console.log('🗑️ Dropping user collection...');
    await db.collection('user').drop().catch(() => {
      console.log('Collection does not exist, continuing...');
    });
    
    // Create the user collection without the problematic unique index on id
    console.log('📝 Creating user collection with proper indexes...');
    
    // Create email unique index
    await db.collection('user').createIndex({ email: 1 }, { unique: true });
    console.log('✅ Created unique index on email');
    
    // Create sparse index on id (allows null values, but ensures uniqueness when present)
    await db.collection('user').createIndex({ id: 1 }, { 
      unique: true, 
      sparse: true,
      partialFilterExpression: { id: { $exists: true, $ne: null } }
    });
    console.log('✅ Created sparse unique index on id');
    
    // List current indexes
    const indexes = await db.collection('user').indexes();
    console.log('📋 Current indexes:');
    indexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    console.log('🎉 MongoDB indexes fixed!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

fixMongoDBIndexes();
