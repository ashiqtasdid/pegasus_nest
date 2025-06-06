// Fix the account collection duplicate key error
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function fixAccountCollection() {
  console.log('🔧 Fixing account collection duplicate key error...');

  const client = new MongoClient(process.env.MONGODB_URL);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');

    const db = client.db('pegasus_auth');
    const accountCollection = db.collection('account');

    // Check for problematic accounts
    const problematicAccounts = await accountCollection.find({
      providerId: 'credential',
      providerUserId: null
    }).toArray();

    console.log(`📊 Found ${problematicAccounts.length} problematic credential accounts`);

    if (problematicAccounts.length > 0) {
      // Delete accounts with null providerUserId for credential provider
      const deleteResult = await accountCollection.deleteMany({
        providerId: 'credential',
        providerUserId: null
      });
      console.log(`🗑️ Deleted ${deleteResult.deletedCount} problematic accounts`);
    }

    // Drop and recreate the problematic index
    console.log('🔄 Recreating account collection indexes...');
    
    try {
      await accountCollection.dropIndex('providerId_1_providerUserId_1');
      console.log('✅ Dropped old index');
    } catch (error) {
      console.log('⚠️ Index might not exist, continuing...');
    }

    // Create new index that handles null values better
    await accountCollection.createIndex(
      { providerId: 1, providerUserId: 1 }, 
      { 
        unique: true, 
        sparse: true, // This allows null values
        partialFilterExpression: { 
          providerUserId: { $exists: true, $ne: null } 
        }
      }
    );
    console.log('✅ Created new sparse index for account collection');

    // Also create a simple userId index for better performance
    await accountCollection.createIndex({ userId: 1 });
    console.log('✅ Created userId index');

    // Check final state
    const remainingAccounts = await accountCollection.countDocuments();
    console.log(`📊 Remaining accounts: ${remainingAccounts}`);

    const indexes = await accountCollection.indexes();
    console.log('📑 Current indexes:');
    indexes.forEach((index) => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('🎉 Account collection fixed!');

  } catch (error) {
    console.error('❌ Failed to fix account collection:', error.message);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

fixAccountCollection();
