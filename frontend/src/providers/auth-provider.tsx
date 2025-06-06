'use client';

import { useSession } from '@/lib/auth-client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // List of public routes that don't require authentication
  const publicRoutes = ['/auth'];
  const isPublicRoute = publicRoutes.includes(pathname);

  useEffect(() => {
    // Only redirect if we're not on a public route and not authenticated
    if (!isPending && !session && !isPublicRoute) {
      router.push('/auth');
    }
  }, [session, isPending, router, isPublicRoute]);

  // Show loading state while checking session on protected routes
  if (isPending && !isPublicRoute) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show nothing if no session on protected route (redirect will happen)
  if (!session && !isPublicRoute && !isPending) {
    return null;
  }

  // Render children
  return <>{children}</>;
}
