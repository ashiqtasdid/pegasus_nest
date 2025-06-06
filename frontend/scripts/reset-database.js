// Reset MongoDB collections and indexes
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function resetDatabase() {
  console.log('🔄 Resetting MongoDB database for Better Auth...');

  const client = new MongoClient(process.env.MONGODB_URL);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');

    const db = client.db('pegasus_auth');

    // Drop all Better Auth collections to start fresh
    const collections = ['user', 'session', 'account', 'verification'];

    for (const collectionName of collections) {
      try {
        await db.collection(collectionName).drop();
        console.log(`🗑️ Dropped collection: ${collectionName}`);
      } catch (error) {
        if (error.code === 26) {
          // NamespaceNotFound
          console.log(
            `⚠️ Collection ${collectionName} doesn't exist, skipping`,
          );
        } else {
          console.error(`❌ Error dropping ${collectionName}:`, error.message);
        }
      }
    }

    // Create collections with proper indexes
    console.log('📝 Creating fresh collections...');

    // User collection
    const userCollection = db.collection('user');
    await userCollection.createIndex({ id: 1 }, { unique: true });
    await userCollection.createIndex({ email: 1 }, { unique: true });
    console.log('✅ Created user collection with indexes');

    // Session collection
    const sessionCollection = db.collection('session');
    await sessionCollection.createIndex({ id: 1 }, { unique: true });
    await sessionCollection.createIndex({ token: 1 }, { unique: true });
    await sessionCollection.createIndex({ userId: 1 });
    await sessionCollection.createIndex({ expiresAt: 1 });
    console.log('✅ Created session collection with indexes');

    // Account collection
    const accountCollection = db.collection('account');
    await accountCollection.createIndex({ id: 1 }, { unique: true });
    await accountCollection.createIndex({ userId: 1 });
    await accountCollection.createIndex(
      { providerId: 1, accountId: 1 },
      { unique: true },
    );
    console.log('✅ Created account collection with indexes');

    // Verification collection
    const verificationCollection = db.collection('verification');
    await verificationCollection.createIndex({ id: 1 }, { unique: true });
    await verificationCollection.createIndex(
      { identifier: 1, value: 1 },
      { unique: true },
    );
    await verificationCollection.createIndex({ expiresAt: 1 });
    console.log('✅ Created verification collection with indexes');

    console.log('🎉 Database reset complete! Ready for Better Auth.');
  } catch (error) {
    console.error('💥 Error during reset:', error);
  } finally {
    await client.close();
  }
}

resetDatabase();
