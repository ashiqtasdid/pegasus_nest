// Check and fix MongoDB ID generation issue
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const mongoUrl = process.env.MONGODB_URL;
console.log('MongoDB URL loaded:', mongoUrl ? 'Found' : 'Not found');

async function fixIdGeneration() {
  console.log('🔍 Checking MongoDB ID generation issue...');

  const client = new MongoClient(mongoUrl);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');

    const db = client.db('pegasus_auth');
    const userCollection = db.collection('user');

    // Check for users with null IDs
    const nullIdUsers = await userCollection.find({ id: null }).toArray();
    console.log(`📊 Users with null ID: ${nullIdUsers.length}`);

    if (nullIdUsers.length > 0) {
      console.log('🧹 Cleaning up users with null IDs...');
      const deleteResult = await userCollection.deleteMany({ id: null });
      console.log(
        `🗑️ Deleted ${deleteResult.deletedCount} users with null IDs`,
      );
    }

    // Check all users
    const allUsers = await userCollection.find({}).toArray();
    console.log(`📋 Total users after cleanup: ${allUsers.length}`);

    allUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} - ID: ${user.id || 'NULL'}`);
    });

    // Check indexes
    const indexes = await userCollection.indexes();
    console.log('📑 Current indexes:');
    indexes.forEach((index) => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
    });
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

fixIdGeneration();
