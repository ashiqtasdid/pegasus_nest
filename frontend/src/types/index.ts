// Types for Pegasus Nest Frontend Application

export interface PluginGenerationRequest {
  name: string;
  description: string;
  features: string[];
  minecraftVersion: string;
  bukkitVersion: string;
}

export interface PluginGenerationResponse {
  success: boolean;
  message: string;
  downloadUrl?: string;
  error?: string;
}

export interface SystemMetrics {
  cpu: string;
  memory: string;
  uptime: string;
  requests: number;
  cacheHitRate: string;
}

export interface ActivityLogEntry {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isTyping?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
