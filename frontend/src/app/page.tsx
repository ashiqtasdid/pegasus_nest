'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Dashboard from '@/components/Dashboard';
import PluginGenerator from '@/components/PluginGenerator';
import ChatSection from '@/components/ChatSection';
import Footer from '@/components/Footer';
import BackgroundDecorations from '@/components/BackgroundDecorations';
import { ThemeProvider } from '@/context/ThemeContext';
import { PluginProvider } from '@/context/PluginContext';

export default function Home() {
  return (
    <ThemeProvider>
      <PluginProvider>
        <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
          {/* Main container */}
          <div className="min-h-screen flex flex-col">
            <Header />

            {/* Hero Section - Simplified */}
            <Hero />

            {/* Main content area */}
            <main className="flex-1 px-6 py-12">
              <div className="max-w-6xl mx-auto">
                {/* Clean grid layout */}
                <div className="grid lg:grid-cols-3 gap-8">
                  {/* Dashboard - Compact sidebar */}
                  <aside className="lg:col-span-1">
                    <Dashboard />
                  </aside>

                  {/* Main content - Plugin Generator */}
                  <section className="lg:col-span-2 space-y-8">
                    <PluginGenerator />
                    <ChatSection />
                  </section>
                </div>
              </div>
            </main>

            <Footer />
          </div>
        </div>
      </PluginProvider>
    </ThemeProvider>
  );
}
