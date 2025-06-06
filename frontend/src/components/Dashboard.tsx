'use client';

import React, { useEffect, useState } from 'react';
import { usePlugin } from '../context/PluginContext';
import {
  apiService,
  type OptimizationStats,
  type HealthData,
} from '../services/api';

interface SystemMetric {
  label: string;
  value: string;
  status: 'good' | 'warning' | 'critical';
  icon: string;
}

export default function Dashboard() {
  const { activities, addActivity } = usePlugin();
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);
  const [optimizationStats, setOptimizationStats] =
    useState<OptimizationStats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchSystemData = async () => {
    try {
      const [health, stats] = await Promise.all([
        apiService.getDetailedHealth(),
        apiService.getOptimizationStats(),
      ]);

      setOptimizationStats(stats);
      setLastUpdated(new Date().toLocaleTimeString());

      const newMetrics: SystemMetric[] = [
        {
          label: 'API Status',
          value: health.status === 'ok' ? 'Online' : 'Offline',
          status: health.status === 'ok' ? 'good' : 'critical',
          icon: '🌐',
        },
        {
          label: 'Cache Hit Rate',
          value: stats.performance.cacheHitRate,
          status:
            parseFloat(stats.performance.cacheHitRate) > 80
              ? 'good'
              : 'warning',
          icon: '💽',
        },
        {
          label: 'Total Requests',
          value: stats.performance.totalRequests.toString(),
          status: 'good',
          icon: '📋',
        },
        {
          label: 'Uptime',
          value: apiService.formatUptime(health.uptime),
          status: 'good',
          icon: '⏱️',
        },
      ];

      setMetrics(newMetrics);
    } catch (error) {
      console.error('Failed to fetch system data:', error);
      addActivity('System Error', 'Failed to fetch system metrics', 'error');
    }
  };

  const clearCache = async () => {
    try {
      await apiService.clearCache();
      addActivity(
        'Cache Cleared',
        'Optimization cache successfully cleared',
        'success',
      );
      await fetchSystemData();
    } catch (error) {
      console.error('Failed to clear cache:', error);
      addActivity('Cache Error', 'Failed to clear optimization cache', 'error');
    }
  };

  useEffect(() => {
    fetchSystemData();
    const interval = setInterval(fetchSystemData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'text-green-400';
      case 'warning':
        return 'text-yellow-400';
      case 'critical':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="space-y-6">
      {/* Clean header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Dashboard</h2>
        <div className="text-xs text-slate-400">
          {lastUpdated && `Updated ${lastUpdated}`}
        </div>
      </div>

      {/* Compact metrics cards */}
      <div className="grid grid-cols-1 gap-4">
        {metrics.slice(0, 4).map((metric, index) => (
          <div
            key={index}
            className="bg-slate-800/50 border border-slate-700 rounded-lg p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400 mb-1">
                  {metric.label}
                </div>
                <div
                  className={`text-lg font-semibold ${getStatusColor(metric.status)}`}
                >
                  {metric.value}
                </div>
              </div>
              <div className="text-xl opacity-60">{metric.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick stats */}
      {optimizationStats && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-white mb-3">Performance</h3>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-blue-400">
                {optimizationStats.performance.totalTokens.toLocaleString()}
              </div>
              <div className="text-xs text-slate-400">Total Tokens</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-400">
                {optimizationStats.performance.cacheHitRate}
              </div>
              <div className="text-xs text-slate-400">Cache Hit Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent activity - simplified */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white">Recent Activity</h3>
          <span className="text-xs text-slate-400">
            {activities.length} events
          </span>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {activities.slice(0, 5).map((activity, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-2 bg-slate-900/50 rounded text-sm"
            >
              <div className="text-sm">
                {activity.type === 'generation' && '🔧'}
                {activity.type === 'success' && '✅'}
                {activity.type === 'error' && '❌'}
                {activity.type === 'info' && 'ℹ️'}
              </div>
              <div className="flex-1">
                <div className="text-white font-medium">{activity.title}</div>
                <div className="text-xs text-slate-400">
                  {activity.description}
                </div>
              </div>
              <div className="text-xs text-slate-500">
                {formatTime(activity.timestamp)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <button
          onClick={() => fetchSystemData()}
          className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
        >
          Refresh
        </button>
        <button
          onClick={() => clearCache()}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
        >
          Clear Cache
        </button>
      </div>
    </div>
  );
}
