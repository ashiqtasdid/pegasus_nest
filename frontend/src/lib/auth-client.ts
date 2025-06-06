import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  // The base URL is optional when running on the same domain
  // but we specify it for development clarity
  baseURL:
    typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3003',
});

// Export auth methods for convenience (as recommended in docs)
export const { signIn, signUp, useSession, signOut, getSession } = authClient;
