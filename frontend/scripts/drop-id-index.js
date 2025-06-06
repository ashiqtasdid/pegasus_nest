// Fix MongoDB indexes - drop problematic unique index on id
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function fixIndexes() {
  console.log('🔧 Fixing MongoDB indexes...');
  
  const client = new MongoClient(process.env.MONGODB_URL);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = client.db('pegasus_auth');
    
    // List current indexes
    console.log('📋 Current indexes on user collection:');
    const indexes = await db.collection('user').indexes();
    indexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)} ${index.unique ? '(unique)' : ''}`);
    });
    
    // Drop the problematic id_1 index if it exists
    try {
      await db.collection('user').dropIndex('id_1');
      console.log('✅ Dropped problematic id_1 index');
    } catch (error) {
      console.log('ℹ️ id_1 index does not exist or already dropped');
    }
    
    // List indexes after dropping
    console.log('📋 Indexes after cleanup:');
    const newIndexes = await db.collection('user').indexes();
    newIndexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)} ${index.unique ? '(unique)' : ''}`);
    });
    
    console.log('🎉 Index fix complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

fixIndexes();
