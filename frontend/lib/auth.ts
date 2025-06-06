import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { github } from 'better-auth/social-providers';
import { MongoClient } from 'mongodb';
import { nanoid } from 'nanoid';
import { nextCookies } from 'better-auth/next-js';

// MongoDB Atlas connection with proper error handling
let mongoClient: MongoClient;

try {
  mongoClient = new MongoClient(
    process.env.MONGODB_URL ||
      'mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/pegasus_auth?retryWrites=true&w=majority',
    {
      // Connection options for Atlas
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
  );
} catch (error) {
  console.error('Failed to create MongoDB client:', error);
  throw error;
}

// Create a better-auth instance with MongoDB adapter
export const auth = betterAuth({
  // Use MongoDB adapter - pass the database instance, not the client
  database: mongodbAdapter(mongoClient.db('pegasus_auth')),

  // Secret for JWT signing (required)
  secret:
    process.env.BETTER_AUTH_SECRET ||
    'your-secret-key-here-change-in-production',

  // Base URL for the auth service
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3003',

  // Enable email and password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true if you want email verification
  },
  // Configure providers
  providers: [
    github({
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    }),
  ],

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },

  // Add plugins
  plugins: [
    nextCookies(), // This should be last in the array
  ],
});

// Debug logging
console.log(
  '✅ Better Auth configured with providers:',
  auth.options?.providers?.map((p) => p.id) || 'none',
);
