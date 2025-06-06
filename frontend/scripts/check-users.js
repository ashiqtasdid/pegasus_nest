const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function checkDatabase() {
  const uri = process.env.MONGODB_URL;
  console.log('MongoDB URI:', uri ? 'Found' : 'Missing');

  if (!uri) {
    console.error('MONGODB_URL environment variable not found');
    return;
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');

    const db = client.db();
    const users = await db.collection('user').find({}).toArray();

    console.log('Users in database:', users.length);
    users.forEach((user) => {
      console.log(`- ${user.email} (${user.name}) - ID: ${user.id}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkDatabase();
