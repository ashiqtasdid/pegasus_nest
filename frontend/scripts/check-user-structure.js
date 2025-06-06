// Check actual user documents structure in MongoDB
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkUserStructure() {
  console.log('🔍 Checking user document structure...');
  
  const client = new MongoClient(process.env.MONGODB_URL);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    const db = client.db('pegasus_auth');
    
    // Get all users with all fields
    const users = await db.collection('user').find({}).toArray();
    console.log(`📋 Found ${users.length} users:`);
    
    users.forEach((user, index) => {
      console.log(`\n👤 User ${index + 1}:`);
      console.log('   Full document:', JSON.stringify(user, null, 2));
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkUserStructure();
