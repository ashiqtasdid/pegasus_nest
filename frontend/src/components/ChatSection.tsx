'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatSection() {
  // Chat system is under construction
  const underConstructionMessage = `🚧 **Chat System Under Construction** 🚧

The chat system is currently being reworked and improved. This feature is temporarily unavailable while we enhance the user experience and add new capabilities.

**What's Coming:**
• Enhanced AI conversation capabilities
• Better plugin understanding and analysis
• Improved response accuracy and speed
• New interactive features

**Current Status:** Under Development
**Expected Return:** Soon™

Thank you for your patience! In the meantime, you can still generate new plugins using the main plugin creation form above.`;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-white">AI Assistant</h2>
          <div className="px-3 py-1 bg-orange-500/20 text-orange-300 rounded-lg text-sm border border-orange-500/30">
            🚧 Under Construction
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded text-xs bg-orange-500/20 text-orange-300">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-300"></div>
          Maintenance Mode
        </div>
      </div>

      {/* Construction Message Container */}
      <div className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-6">
        <div className="prose prose-sm prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-lg font-bold text-orange-300 mb-4 mt-0 text-center">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-base font-semibold text-orange-300 mb-3 mt-4">
                  {children}
                </h2>
              ),
              p: ({ children }) => (
                <p className="mb-3 text-slate-100 leading-relaxed text-center">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="list-none mb-4 space-y-2 text-slate-100">
                  {children}
                </ul>
              ),
              li: ({ children }) => (
                <li className="text-slate-100 flex items-center gap-2">
                  <span className="text-blue-400">▸</span>
                  {children}
                </li>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-white">{children}</strong>
              ),
            }}
          >
            {underConstructionMessage}
          </ReactMarkdown>
        </div>

        {/* Disabled Input Area */}
        <div className="mt-6 opacity-50">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Chat is temporarily disabled..."
              className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded text-white placeholder-slate-400 text-sm cursor-not-allowed"
              disabled
            />
            <button
              disabled
              className="px-4 py-2 bg-gray-600 text-gray-400 rounded cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
            >
              🚧 Disabled
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">
            Chat functionality will return with enhanced features soon!
          </p>
        </div>
      </div>

      {/* Alternative Actions */}
      <div className="mt-6 space-y-3">
        <h3 className="text-xs font-medium text-slate-400">
          While the chat is under construction, you can:
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            {
              text: 'Generate new plugins using the main form',
              icon: '⚡',
              disabled: false,
            },
            {
              text: 'Explore existing plugin templates',
              icon: '📚',
              disabled: false,
            },
            {
              text: 'Check the plugin documentation',
              icon: '📖',
              disabled: false,
            },
            {
              text: 'Review generated plugin code',
              icon: '👁️',
              disabled: false,
            },
          ].map((action, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-slate-600/30 text-slate-300 text-xs rounded border border-slate-600/20"
            >
              <span className="text-xs">{action.icon}</span>
              <span>{action.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
