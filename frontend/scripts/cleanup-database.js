// Clean up database and fix null ID issue
console.log('🚀 Starting database cleanup script...');
require('dotenv').config({ path: '.env.local' });
console.log('📋 Environment loaded');

const { MongoClient } = require('mongodb');
console.log('📦 MongoDB client loaded');

async function cleanupDatabase() {
  console.log('🧹 Cleaning up MongoDB database...');

  const client = new MongoClient(process.env.MONGODB_URL);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');

    const db = client.db('pegasus_auth');

    // Clean up users with null or missing IDs
    console.log('🗑️ Removing users with null/missing IDs...');
    const userCollection = db.collection('user');
    const deleteResult = await userCollection.deleteMany({
      $or: [{ id: null }, { id: { $exists: false } }, { id: '' }],
    });
    console.log(`   Deleted ${deleteResult.deletedCount} problematic users`);

    // Clean up orphaned sessions
    console.log('🗑️ Removing orphaned sessions...');
    const sessionCollection = db.collection('session');
    const sessionDeleteResult = await sessionCollection.deleteMany({
      $or: [{ userId: null }, { userId: { $exists: false } }, { userId: '' }],
    });
    console.log(
      `   Deleted ${sessionDeleteResult.deletedCount} orphaned sessions`,
    );

    // Clean up orphaned accounts
    console.log('🗑️ Removing orphaned accounts...');
    const accountCollection = db.collection('account');
    const accountDeleteResult = await accountCollection.deleteMany({
      $or: [{ userId: null }, { userId: { $exists: false } }, { userId: '' }],
    });
    console.log(
      `   Deleted ${accountDeleteResult.deletedCount} orphaned accounts`,
    );

    // Show final state
    const remainingUsers = await userCollection.countDocuments();
    console.log(`📊 Remaining users: ${remainingUsers}`);

    if (remainingUsers > 0) {
      const users = await userCollection.find({}).toArray();
      users.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} - ID: ${user.id}`);
      });
    }

    console.log('✅ Database cleanup complete!');
  } catch (error) {
    console.error('💥 Error during cleanup:', error);
  } finally {
    await client.close();
  }
}

cleanupDatabase();
