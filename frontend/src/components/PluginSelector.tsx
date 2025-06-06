'use client';

import React, { useState, useEffect } from 'react';
import { usePlugin } from '../context/PluginContext';
import { apiService } from '../services/api';

interface PluginSelectorProps {
  onPluginSelected: (pluginName: string) => void;
  onCancel?: () => void;
}

export default function PluginSelector({
  onPluginSelected,
  onCancel,
}: PluginSelectorProps) {
  const { addActivity } = usePlugin();
  const [availablePlugins, setAvailablePlugins] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAvailablePlugins();
  }, []);

  const loadAvailablePlugins = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const plugins = await apiService.getAvailablePlugins();
      setAvailablePlugins(plugins);
      addActivity(
        '🔍 Plugin Search',
        `Found ${plugins.length} available plugins`,
        'info',
      );
    } catch (error) {
      console.error('Failed to load plugins:', error);
      setError('Failed to load available plugins. Please try again.');
      addActivity(
        '❌ Plugin Search Failed',
        'Could not retrieve plugin list',
        'error',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePluginSelect = (pluginName: string) => {
    addActivity(
      '✅ Plugin Selected',
      `Selected ${pluginName} for chat`,
      'success',
    );
    onPluginSelected(pluginName);
  };

  const formatPluginName = (name: string) => {
    return name
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (isLoading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            Select Plugin for Chat
          </h2>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-slate-300">Loading available plugins...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            Select Plugin for Chat
          </h2>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-400">⚠️</span>
            <h3 className="text-red-400 font-medium">Error Loading Plugins</h3>
          </div>
          <p className="text-red-300 text-sm">{error}</p>
        </div>

        <button
          onClick={loadAvailablePlugins}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          🔄 Try Again
        </button>
      </div>
    );
  }

  if (availablePlugins.length === 0) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            Select Plugin for Chat
          </h2>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-400">📦</span>
            <h3 className="text-yellow-400 font-medium">No Plugins Found</h3>
          </div>
          <p className="text-yellow-300 text-sm">
            No plugins are available for chat. Please generate a plugin first
            using the Plugin Generator.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={loadAvailablePlugins}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            🔄 Refresh
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-slate-600 text-slate-300 rounded hover:bg-slate-500 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Select Plugin for Chat
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Choose an existing plugin to chat about
          </p>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {availablePlugins.map((plugin) => (
          <div
            key={plugin}
            onClick={() => handlePluginSelect(plugin)}
            className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4 cursor-pointer hover:bg-slate-600/40 hover:border-blue-500/50 transition-all group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                {plugin.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium group-hover:text-blue-300 transition-colors">
                  {formatPluginName(plugin)}
                </h3>
                <p className="text-slate-400 text-xs">Plugin Name: {plugin}</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-green-400 text-xs">Available</span>
              </div>
              <div className="text-blue-400 group-hover:text-blue-300 transition-colors">
                💬
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-600/50">
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-sm">
            {availablePlugins.length} plugin
            {availablePlugins.length !== 1 ? 's' : ''} available
          </p>
          <button
            onClick={loadAvailablePlugins}
            className="text-blue-400 hover:text-blue-300 text-sm transition-colors flex items-center gap-1"
          >
            🔄 Refresh List
          </button>
        </div>
      </div>
    </div>
  );
}
