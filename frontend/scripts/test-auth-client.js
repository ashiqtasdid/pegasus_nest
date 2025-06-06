// Test if the social sign-in method is available
const { createAuthClient } = require('better-auth/react');

// Test the auth client configuration
const authClient = createAuthClient({
  baseURL: 'http://localhost:3003',
});

console.log('🔍 Testing Auth Client Methods...\n');
console.log('Available methods:', Object.keys(authClient));

// Check if signIn has social method
if (authClient.signIn) {
  console.log('signIn methods:', Object.keys(authClient.signIn));
  
  if (authClient.signIn.social) {
    console.log('✅ signIn.social method is available');
    console.log('signIn.social type:', typeof authClient.signIn.social);
  } else {
    console.log('❌ signIn.social method is NOT available');
  }
} else {
  console.log('❌ signIn method is NOT available');
}

// Also check destructured methods
const { signIn, signUp, useSession, signOut, getSession } = authClient;
console.log('\nDestructured methods:');
console.log('- signIn:', typeof signIn);
console.log('- signUp:', typeof signUp);
console.log('- useSession:', typeof useSession);
console.log('- signOut:', typeof signOut);
console.log('- getSession:', typeof getSession);

if (signIn && typeof signIn === 'object') {
  console.log('signIn sub-methods:', Object.keys(signIn));
}
