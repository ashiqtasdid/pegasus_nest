'use client';

import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function Footer() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const currentYear = new Date().getFullYear();

  const links = {
    product: [
      { name: 'Features', href: '#features' },
      { name: 'Documentation', href: '#docs' },
      { name: 'API Reference', href: '#api' },
      { name: 'Examples', href: '#examples' },
    ],
    support: [
      { name: 'Help Center', href: '#help' },
      { name: 'Community', href: '#community' },
      { name: 'Contact Us', href: '#contact' },
      { name: 'Bug Reports', href: '#bugs' },
    ],
    company: [
      { name: 'About', href: '#about' },
      { name: 'Blog', href: '#blog' },
      { name: 'Careers', href: '#careers' },
      { name: 'Privacy', href: '#privacy' },
    ],
  };

  const socialLinks = [
    { name: 'GitHub', icon: '🐙', href: '#github' },
    { name: 'Discord', icon: '💬', href: '#discord' },
    { name: 'Twitter', icon: '🐦', href: '#twitter' },
    { name: 'YouTube', icon: '📺', href: '#youtube' },
  ];

  return (
    <footer className="relative overflow-hidden bg-slate-900 border-t border-slate-700/50 mt-auto">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
        {/* Main Footer */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8 mb-10">
          {/* Brand Section */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-2xl">🪶</span>
              <span className="text-lg font-bold text-slate-200">
                Pegasus Nest
              </span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              Empowering Minecraft developers with AI-powered plugin generation.
              Create sophisticated plugins effortlessly with our intelligent
              tools.
            </p>
            <div className="flex space-x-3">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  className="flex items-center justify-center w-8 h-8 bg-slate-800/70 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-lg transition-colors duration-200"
                  title={social.name}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="text-sm">{social.icon}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Links Sections */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h4 className="text-slate-200 font-medium text-sm mb-3">
                Product
              </h4>
              <ul className="space-y-2">
                {links.product.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-slate-400 hover:text-slate-200 transition-colors duration-200 text-sm"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-slate-200 font-medium text-sm mb-3">
                Support
              </h4>
              <ul className="space-y-2">
                {links.support.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-slate-400 hover:text-slate-200 transition-colors duration-200 text-sm"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-slate-200 font-medium text-sm mb-3">
                Company
              </h4>
              <ul className="space-y-2">
                {links.company.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-slate-400 hover:text-slate-200 transition-colors duration-200 text-sm"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Newsletter Section */}
          <div className="lg:col-span-1 space-y-3">
            <h4 className="text-slate-200 font-medium text-sm mb-3">
              Stay Updated
            </h4>
            <p className="text-slate-400 text-xs leading-relaxed mb-3">
              Get the latest updates on new features and plugin development
              tips.
            </p>
            <div className="flex flex-col gap-2 mb-2">
              <input
                type="email"
                placeholder="Enter your email"
                className="px-3 py-2 bg-slate-800/70 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors duration-200 text-sm"
              />
              <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors duration-200">
                📧 Subscribe
              </button>
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <span className="text-xs">🔒</span>
              We respect your privacy. Unsubscribe at any time.
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="border-t border-slate-700/50 pt-6 mb-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center space-y-1 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <span className="block text-lg font-bold text-slate-200">
                10K+
              </span>
              <span className="block text-xs text-slate-400">
                Plugins Generated
              </span>
            </div>
            <div className="text-center space-y-1 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <span className="block text-lg font-bold text-slate-200">
                500+
              </span>
              <span className="block text-xs text-slate-400">
                Active Developers
              </span>
            </div>
            <div className="text-center space-y-1 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <span className="block text-lg font-bold text-slate-200">
                99.9%
              </span>
              <span className="block text-xs text-slate-400">Uptime</span>
            </div>
            <div className="text-center space-y-1 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <span className="block text-lg font-bold text-slate-200">
                24/7
              </span>
              <span className="block text-xs text-slate-400">AI Support</span>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-slate-700/50 pt-6">
          <div className="flex flex-col lg:flex-row items-center justify-between space-y-3 lg:space-y-0">
            <div className="text-slate-400 text-sm">
              <span>© {currentYear} Pegasus Nest. All rights reserved.</span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <span className="flex items-center space-x-2 text-xs text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  All Systems Operational
                </span>
              </div>

              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <span className="px-2 py-1 bg-slate-800 rounded text-xs border border-slate-700">
                  v2.1.0
                </span>
                <span className="px-2 py-1 bg-slate-800/70 text-slate-300 rounded text-xs border border-slate-700">
                  API v3
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <a
                href="#terms"
                className="text-slate-400 hover:text-slate-200 transition-colors duration-200"
              >
                Terms of Service
              </a>
              <span className="text-slate-600">•</span>
              <a
                href="#privacy"
                className="text-slate-400 hover:text-slate-200 transition-colors duration-200"
              >
                Privacy Policy
              </a>
              <span className="text-slate-600">•</span>
              <a
                href="#cookies"
                className="text-slate-400 hover:text-slate-200 transition-colors duration-200"
              >
                Cookie Policy
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
