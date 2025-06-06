'use client';

import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { usePlugin } from '@/context/PluginContext';
import { useSession, signIn, signOut } from '@/lib/auth-client';

const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { systemStats } = usePlugin();
  const { data, isPending, error } = useSession();
  const user = data?.user;

  return (
    <header className="px-6 py-6 border-b border-slate-800">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          {/* Simplified logo */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Pegasus Nest</h1>
            </div>
          </div>

          {/* Clean status indicator + auth */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div
                className={`w-2 h-2 rounded-full ${systemStats.apiStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`}
              ></div>
              <span className="text-sm text-slate-400">
                {systemStats.apiStatus === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Auth section */}
            {isPending ? (
              <span className="text-slate-400 text-sm">Loading...</span>
            ) : user ? (
              <div className="flex items-center space-x-2">
                <span className="text-slate-200 text-sm">
                  {user.email || user.name}
                </span>
                <button
                  onClick={() => signOut()}
                  className="px-3 py-1 bg-slate-700 text-white rounded hover:bg-slate-600 text-xs"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={
                  () =>
                    signIn.social({
                      provider: 'github',
                    }) /* TODO: support multiple providers */
                }
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 text-xs"
              >
                Sign in with GitHub
              </button>
            )}

            {/* Simple theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Toggle dark mode"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
