'use client';

import { useState, useEffect } from 'react';

export default function Hero() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className="relative py-12 px-6">
      {/* Hero content */}
      <div className="max-w-4xl mx-auto text-center">
        {/* Simplified hero title */}
        <h1
          className={`text-4xl md:text-6xl font-bold mb-4 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            Pegasus Nest
          </span>
        </h1>

        {/* Clean subtitle */}
        <p
          className={`text-lg md:text-xl text-slate-400 mb-8 max-w-2xl mx-auto transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          AI-powered Minecraft plugin generator. Transform your ideas into code
          instantly.
        </p>

        {/* Simple feature badges */}
        <div
          className={`flex flex-wrap justify-center gap-4 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <span className="px-3 py-1 bg-slate-800/50 border border-slate-700 rounded-full text-sm text-slate-300">
            Lightning Fast
          </span>
          <span className="px-3 py-1 bg-slate-800/50 border border-slate-700 rounded-full text-sm text-slate-300">
            AI-Powered
          </span>
          <span className="px-3 py-1 bg-slate-800/50 border border-slate-700 rounded-full text-sm text-slate-300">
            Production Ready
          </span>
        </div>
      </div>
    </section>
  );
}
