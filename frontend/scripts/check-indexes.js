// Check current MongoDB indexes
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkIndexes() {
  console.log('🔍 Checking MongoDB indexes...');
  
  const client = new MongoClient(process.env.MONGODB_URL);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = client.db('pegasus_auth');
    
    // Check if user collection exists
    const collections = await db.listCollections().toArray();
    console.log('📋 Collections:', collections.map(c => c.name));
    
    // Check indexes on user collection
    try {
      const indexes = await db.collection('user').indexes();
      console.log('📋 Current user collection indexes:');
      indexes.forEach(index => {
        console.log(`   - ${index.name}: ${JSON.stringify(index.key)} ${index.unique ? '(unique)' : ''} ${index.sparse ? '(sparse)' : ''}`);
      });
    } catch (error) {
      console.log('❌ User collection does not exist or error getting indexes:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkIndexes();
