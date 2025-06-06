// API Service for Pegasus Nest Backend Integration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface OptimizationStats {
  message: string;
  timestamp: string;
  performance: {
    totalRequests: number;
    totalTokens: number;
    averageTokensPerRequest: number;
    cacheHitRate: string;
    cacheSize: number;
    compressionSavings: string;
  };
  savings: {
    cacheHits: number;
    cacheMisses: number;
    estimatedTokensSaved: number;
    estimatedCostSavings: string;
  };
  status: string;
}

export interface HealthData {
  status: string;
  message: string;
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  system?: {
    platform: string;
    arch: string;
    nodeVersion: string;
    pid: number;
  };
  memory?: {
    rss: string;
    heapTotal: string;
    heapUsed: string;
    external: string;
  };
  cpu?: {
    user: number;
    system: number;
  };
}

export interface PluginGenerationRequest {
  name: string;
  prompt: string;
  features?: string[];
  minecraftVersion?: string;
  advancedMode?: boolean;
}

export interface PluginGenerationResponse {
  success: boolean;
  message: string;
  pluginName?: string;
  downloadUrl?: string;
}

export interface ChatRequest {
  message: string;
  name: string;
}

export interface ChatResponse {
  success: boolean;
  response?: string;
  error?: string;
}

class ApiService {
  constructor() {
    console.log('ApiService initialized with base URL:', API_BASE_URL);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    try {
      const url = `${API_BASE_URL}${endpoint}`;
      console.log(`Making API request to: ${url}`);

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Health Monitoring APIs
  async getHealth(): Promise<HealthData> {
    return this.request<HealthData>('/health');
  }

  async getDetailedHealth(): Promise<HealthData> {
    return this.request<HealthData>('/health/detailed');
  }

  async ping(): Promise<{ status: string; timestamp: string }> {
    return this.request('/health/ping');
  }

  // Optimization APIs
  async getOptimizationStats(): Promise<OptimizationStats> {
    return this.request<OptimizationStats>('/api/proxy/optimization-stats');
  }

  async clearCache(): Promise<{ message: string; timestamp: string }> {
    return this.request('/api/proxy/clear-cache');
  }

  // Plugin Generation APIs
  async generatePlugin(
    request: PluginGenerationRequest,
  ): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      console.error('Plugin generation failed:', error);
      return null;
    }
  }

  async downloadPlugin(pluginName: string): Promise<Blob> {
    const response = await fetch(
      `${API_BASE_URL}/create/download/${pluginName}`,
    );
    if (!response.ok) {
      throw new Error(`Failed to download plugin: ${response.status}`);
    }
    return response.blob();
  }

  // Plugin Management APIs
  async getAvailablePlugins(): Promise<string[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/create/plugins`);
      if (!response.ok) {
        throw new Error(`Failed to fetch plugins: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch available plugins:', error);
      return [];
    }
  }

  // Chat APIs
  async sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/create/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Chat request failed: ${response.status}`,
        };
      }

      // Parse the JSON response from the backend
      const jsonResponse = (await response.json()) as ChatResponse;

      // Return the parsed response directly since it already has the correct structure
      return jsonResponse;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // Utility methods
  formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'ok':
      case 'online':
      case 'optimization active':
        return 'text-green-400';
      case 'warning':
        return 'text-yellow-400';
      case 'error':
      case 'offline':
      case 'critical':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  }
}

export const apiService = new ApiService();
export default apiService;
