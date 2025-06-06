'use client';

import { ReactNode } from 'react';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Better Auth doesn't require a provider wrapper like other auth libraries
  // The client instance handles everything internally
  return <>{children}</>;
}
