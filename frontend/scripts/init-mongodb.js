// Initialize Better Auth collections in MongoDB Atlas
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function initializeDatabase() {
  console.log('MongoDB URL:', process.env.MONGODB_URL ? 'Found' : 'Not found');

  const client = new MongoClient(
    process.env.MONGODB_URL ||
      'mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/pegasus_auth?retryWrites=true&w=majority',
    {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  );

  try {
    console.log('Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');

    const db = client.db('pegasus_auth');

    // Create indexes for Better Auth collections
    console.log('Creating Better Auth collections and indexes...');

    // User collection indexes
    await db.collection('user').createIndex({ email: 1 }, { unique: true });
    await db.collection('user').createIndex({ id: 1 }, { unique: true });
    console.log('✅ User collection indexes created');

    // Session collection indexes
    await db.collection('session').createIndex({ id: 1 }, { unique: true });
    await db.collection('session').createIndex({ userId: 1 });
    await db
      .collection('session')
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    console.log('✅ Session collection indexes created');

    // Account collection indexes (for OAuth)
    await db.collection('account').createIndex({ userId: 1 });
    await db
      .collection('account')
      .createIndex({ providerId: 1, providerUserId: 1 }, { unique: true });
    console.log('✅ Account collection indexes created');

    // Verification collection indexes (for email verification)
    await db
      .collection('verification')
      .createIndex({ id: 1 }, { unique: true });
    await db.collection('verification').createIndex({ email: 1 });
    await db
      .collection('verification')
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    console.log('✅ Verification collection indexes created');

    console.log('🎉 Better Auth database initialization complete!');

    // List all collections to confirm
    const collections = await db.listCollections().toArray();
    console.log(
      'Available collections:',
      collections.map((c) => c.name),
    );
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
    if (error.message.includes('authentication failed')) {
      console.log('💡 Check your MongoDB Atlas credentials in MONGODB_URL');
    } else if (error.message.includes('serverSelectionTimeoutMS')) {
      console.log(
        '💡 Check your network connection and MongoDB Atlas network access settings',
      );
    }
  } finally {
    await client.close();
    console.log('Connection closed');
  }
}

initializeDatabase();
