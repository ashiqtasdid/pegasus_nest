// Fix duplicate key error in verification collection
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function fixVerificationCollection() {
  const client = new MongoClient(process.env.MONGODB_URL);

  try {
    console.log('Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Connected');

    const db = client.db('pegasus_auth');

    // Drop the problematic verification collection
    console.log(
      'Dropping verification collection to fix duplicate key issue...',
    );
    await db
      .collection('verification')
      .drop()
      .catch(() => {
        console.log('Collection already dropped or does not exist');
      });

    // Recreate with proper indexes
    console.log('Recreating verification collection with proper indexes...');
    await db
      .collection('verification')
      .createIndex({ id: 1 }, { unique: true, sparse: true });
    await db.collection('verification').createIndex({ email: 1 });
    await db
      .collection('verification')
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    console.log('✅ Verification collection fixed!');
  } catch (error) {
    console.error('❌ Error fixing verification collection:', error.message);
  } finally {
    await client.close();
  }
}

fixVerificationCollection();
