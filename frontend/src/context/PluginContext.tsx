'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface PluginData {
  name: string;
  description: string;
  status: 'idle' | 'generating' | 'success' | 'error';
  downloadUrl?: string;
  generatedCode?: string;
  error?: string;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'cache' | 'generation';
}

export interface SystemStats {
  cacheHitRate: string;
  tokensSaved: string;
  costSavings: string;
  requestsToday: number;
  uptime: string;
  memory: string;
  compression: string;
  apiStatus: 'online' | 'offline' | 'error';
  pluginsGenerated: number;
  chatMessages: number;
}

interface PluginContextType {
  // Plugin state
  currentPlugin: PluginData | null;
  setCurrentPlugin: (plugin: PluginData | null) => void;

  // Selected plugin for chat
  selectedPluginForChat: string | null;
  setSelectedPluginForChat: (pluginName: string | null) => void;

  // Activity log
  activities: Activity[];
  addActivity: (
    title: string,
    description: string,
    type?: Activity['type'],
  ) => void;

  // System stats
  systemStats: SystemStats;
  updateSystemStats: (stats: Partial<SystemStats>) => void;

  // Chat state
  chatVisible: boolean;
  setChatVisible: (visible: boolean) => void;
  chatMessages: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  clearChatMessages: () => void;
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: string;
}

const PluginContext = createContext<PluginContextType | undefined>(undefined);

export const usePlugin = () => {
  const context = useContext(PluginContext);
  if (context === undefined) {
    throw new Error('usePlugin must be used within a PluginProvider');
  }
  return context;
};

interface PluginProviderProps {
  children: ReactNode;
}

export const PluginProvider: React.FC<PluginProviderProps> = ({ children }) => {
  const [currentPlugin, setCurrentPlugin] = useState<PluginData | null>(null);
  const [selectedPluginForChat, setSelectedPluginForChat] = useState<
    string | null
  >(null);
  const [activities, setActivities] = useState<Activity[]>([
    {
      id: '1',
      title: '🚀 Dashboard Initialized',
      description: 'System ready for plugin generation',
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      type: 'info',
    },
  ]);

  const [systemStats, setSystemStats] = useState<SystemStats>({
    cacheHitRate: '--',
    tokensSaved: '--',
    costSavings: '--',
    requestsToday: 0,
    uptime: '--',
    memory: '--',
    compression: '--',
    apiStatus: 'online',
    pluginsGenerated: 0,
    chatMessages: 0,
  });

  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const addActivity = (
    title: string,
    description: string,
    type: Activity['type'] = 'info',
  ) => {
    const newActivity: Activity = {
      id: Date.now().toString(),
      title,
      description,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      type,
    };

    setActivities((prev) => [newActivity, ...(prev || []).slice(0, 9)]); // Keep only last 10 activities
  };

  const updateSystemStats = (stats: Partial<SystemStats>) => {
    setSystemStats((prev) => ({ ...prev, ...stats }));
  };

  const addChatMessage = (message: ChatMessage) => {
    setChatMessages((prev) => [...prev, message]);
  };

  const clearChatMessages = () => {
    setChatMessages([]);
  };

  const value: PluginContextType = {
    currentPlugin,
    setCurrentPlugin,
    selectedPluginForChat,
    setSelectedPluginForChat,
    activities,
    addActivity,
    systemStats,
    updateSystemStats,
    chatVisible,
    setChatVisible,
    chatMessages,
    addChatMessage,
    clearChatMessages,
  };

  return (
    <PluginContext.Provider value={value}>{children}</PluginContext.Provider>
  );
};
