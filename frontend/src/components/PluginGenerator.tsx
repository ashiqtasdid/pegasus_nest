'use client';

import React, { useState } from 'react';
import { usePlugin } from '../context/PluginContext';
import { apiService, type PluginGenerationRequest } from '../services/api';

interface PluginForm {
  name: string;
  description: string;
}

export default function PluginGenerator() {
  const { currentPlugin, setCurrentPlugin, addActivity } = usePlugin();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const [form, setForm] = useState<PluginForm>({
    name: '',
    description: '',
  });

  const handleInputChange = (field: keyof PluginForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const generatePlugin = async () => {
    if (!form.name.trim() || !form.description.trim()) {
      addActivity(
        'Generation Error',
        'Plugin name and description are required',
        'error',
      );
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setDownloadUrl(null);

    try {
      // Prepare the API request
      const request: PluginGenerationRequest = {
        name: form.name.trim(),
        prompt: form.description.trim(),
        features: [],
        minecraftVersion: '1.20.1',
        advancedMode: false,
      };

      addActivity(
        'Plugin Generation Started',
        `Generating ${form.name}`,
        'generation',
      );

      console.log('Starting plugin generation...');

      // Generate the plugin
      const response = await apiService.generatePlugin(request);

      if (!response) {
        throw new Error('Plugin generation failed to start');
      }

      // Set up download URL
      const downloadUrl = `/create/download/${form.name}`;
      setDownloadUrl(downloadUrl);

      setCurrentPlugin({
        name: form.name,
        description: form.description,
        status: 'success',
        downloadUrl: downloadUrl,
      });

      addActivity(
        'Plugin Generated Successfully',
        `${form.name} is ready for download`,
        'success',
      );

      setIsGenerating(false);
    } catch (error) {
      console.error('Plugin generation failed:', error);
      setGenerationError(
        error instanceof Error ? error.message : 'Unknown error occurred',
      );

      setCurrentPlugin({
        name: form.name,
        description: form.description,
        status: 'error',
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });

      addActivity(
        'Plugin Generation Failed',
        error instanceof Error ? error.message : 'Unknown error occurred',
        'error',
      );

      setIsGenerating(false);
    }
  };

  const downloadPlugin = async () => {
    if (!currentPlugin?.name) return;

    try {
      const blob = await apiService.downloadPlugin(currentPlugin.name);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${currentPlugin.name}.jar`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      addActivity(
        'Plugin Downloaded',
        `${currentPlugin.name}.jar downloaded successfully`,
        'success',
      );
    } catch (error) {
      console.error('Download failed:', error);
      addActivity('Download Failed', 'Failed to download plugin', 'error');
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.description) {
      addActivity(
        'Validation Error',
        'Please fill in required fields',
        'error',
      );
      return;
    }

    await generatePlugin();
  };

  return (
    <div className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Plugin Generator</h2>
        <div className="flex items-center gap-2">
          {isGenerating ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 text-yellow-300 text-sm rounded">
              <span className="w-1.5 h-1.5 bg-yellow-300 rounded-full animate-pulse"></span>
              Generating
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-300 text-sm rounded">
              <span className="w-1.5 h-1.5 bg-green-300 rounded-full"></span>
              Ready
            </div>
          )}
        </div>
      </div>{' '}
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Plugin Configuration Form */}
        <div className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Configuration</h3>
          </div>

          <form onSubmit={handleGenerate} className="space-y-4">
            {/* Basic Configuration */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300">
                Plugin Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 text-white placeholder-slate-400 text-sm rounded focus:outline-none focus:border-blue-400 transition-colors"
                placeholder="e.g., MyAwesomePlugin"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-300">
                Description *
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  handleInputChange('description', e.target.value)
                }
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600/50 text-white placeholder-slate-400 text-sm rounded focus:outline-none focus:border-blue-400 transition-colors resize-none"
                placeholder="Describe what your plugin does..."
                rows={4}
                required
              />
            </div>

            {/* Generate Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isGenerating}
                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium text-sm rounded transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Generating
                  </>
                ) : (
                  <>Generate Plugin</>
                )}
              </button>
            </div>
          </form>
        </div>{' '}
        {/* Generation Status */}
        <div className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-white mb-4">Status</h3>

          {isGenerating && (
            <div className="mb-4">
              <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
                <div className="text-blue-300 font-medium text-sm">
                  Generating plugin...
                </div>
              </div>
            </div>
          )}

          {generationError && (
            <div className="mb-4">
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <span className="text-red-400">✗</span>
                <div className="text-red-300 font-medium text-sm">
                  {generationError}
                </div>
              </div>
            </div>
          )}

          {!isGenerating &&
            !generationError &&
            currentPlugin?.status === 'success' && (
              <div className="space-y-3">
                <div className="text-center p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="text-green-300 font-medium text-sm">
                    Plugin Ready for Download!
                  </div>
                </div>
                <button
                  onClick={downloadPlugin}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium text-sm rounded transition-colors flex items-center justify-center gap-2"
                >
                  Download Plugin
                </button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
