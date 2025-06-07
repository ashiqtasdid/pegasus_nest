# 🚀 Pegasus Nest API Routes - Comprehensive Documentation

[![API Version](https://img.shields.io/badge/API-v1.0.0-blue.svg)](https://github.com/your-repo)
[![Status](https://img.shields.io/badge/Status-Active-green.svg)](https://status.pegasus-nest.dev)

> **Complete API reference for the Pegasus Nest Minecraft Plugin Generator**

## 📋 Table of Contents

- [🔥 Quick Start](#-quick-start)
- [🛠️ Plugin Management](#%EF%B8%8F-plugin-management)
- [💬 Chat System](#-chat-system)
- [🩺 Health Monitoring](#-health-monitoring)
- [⚙️ System Optimization](#%EF%B8%8F-system-optimization)
- [📊 Response Formats](#-response-formats)
- [⚠️ Error Handling](#%EF%B8%8F-error-handling)
- [🔧 Testing](#-testing)
- [📱 Integration Examples](#-integration-examples)

---

## 🔥 Quick Start

```bash
# Base URL
BASE_URL="http://localhost:3000"

# Health check
curl $BASE_URL/health

# Create a plugin
curl -X POST $BASE_URL/create \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A plugin that gives diamond swords", "name": "DiamondGiver", "userId": "user123"}'

# List plugins
curl $BASE_URL/create/plugins?userId=user123

# Download plugin
curl -O $BASE_URL/create/download/DiamondGiver?userId=user123
```

---

## 🛠️ Plugin Management

### 1. Create Plugin

**Generate a new Minecraft plugin from natural language description**

```http
POST /create
```

**Headers:**

```
Content-Type: application/json
```

**Request Body:**

```typescript
{
  prompt: string; // Required: Description of plugin functionality
  name: string; // Required: Plugin name (alphanumeric, underscores)
  userId: string; // Required: User identifier for file organization
}
```

**Example Request:**

```bash
curl -X POST http://localhost:3000/create \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a plugin that teleports players to spawn when they type /home",
    "name": "HomePlugin",
    "userId": "user123"
  }'
```

**Response Format:**

```typescript
string; // Success/error message with creation details
```

**Example Responses:**

```json
// Success
"Project created successfully at /path/to/plugin. AI processing complete with 3 file operations. JAR: HomePlugin.jar"

// Error
"Error: Plugin name contains invalid characters. Please use only letters, numbers, and underscores."
```

---

### 2. List User Plugins

**Get all plugins created by a specific user**

```http
GET /create/plugins?userId={userId}
```

**Query Parameters:**

- `userId` (string, optional): Filter plugins by user ID

**Example Request:**

```bash
curl "http://localhost:3000/create/plugins?userId=user123"
```

**Response Format:**

```typescript
{
  plugins: string[];    // Array of plugin names
  count: number;        // Total number of plugins
  userId?: string;      // User ID if provided
}
```

**Example Response:**

```json
{
  "plugins": ["HomePlugin", "DiamondGiver", "AdminTools"],
  "count": 3,
  "userId": "user123"
}
```

---

### 3. Download Plugin

**Download a compiled plugin JAR file**

```http
GET /create/download/:pluginName?userId={userId}
```

**Path Parameters:**

- `pluginName` (string): Name of the plugin to download

**Query Parameters:**

- `userId` (string): User identifier who owns the plugin

**Example Request:**

```bash
curl -O "http://localhost:3000/create/download/HomePlugin?userId=user123"
```

**Response:**

- **Content-Type:** `application/java-archive`
- **Content-Disposition:** `attachment; filename="HomePlugin.jar"`
- **Body:** Binary JAR file data

**Error Responses:**

```json
// Plugin not found (404)
{
  "statusCode": 404,
  "message": "Plugin 'HomePlugin' not found for user 'user123'"
}

// Plugin not compiled (404)
{
  "statusCode": 404,
  "message": "Plugin 'HomePlugin' has not been compiled yet"
}
```

---

## 💬 Chat System

### Chat with Plugin AI

**Interactive AI conversation about plugins for modifications and questions**

```http
POST /create/chat
```

**Headers:**

```
Content-Type: application/json
```

**Request Body:**

```typescript
{
  message: string; // Required: Your question or modification request
  pluginName: string; // Required: Name of existing plugin to discuss
}
```

**Example Requests:**

**Information Request:**

```bash
curl -X POST http://localhost:3000/create/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What does the HomePlugin do?",
    "pluginName": "HomePlugin"
  }'
```

**Modification Request:**

```bash
curl -X POST http://localhost:3000/create/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Add a cooldown of 30 seconds to the /home command",
    "pluginName": "HomePlugin"
  }'
```

**Response Format:**

```typescript
{
  success: boolean;
  response?: string;    // AI response message (if success)
  error?: string;       // Error message (if not success)
}
```

**Example Responses:**

```json
// Success
{
  "success": true,
  "response": "The HomePlugin allows players to teleport to spawn using the /home command. I can add a 30-second cooldown - would you like me to implement that feature?"
}

// Error
{
  "success": false,
  "error": "Plugin 'HomePlugin' not found. Please create the plugin first."
}
```

**Common Errors:**
| Error Condition | Response | Status Code |
|----------------|----------|-------------|
| Missing `pluginName` | `{"success": false, "error": "Plugin name is required"}` | 400 |
| Non-existent plugin | `{"success": false, "error": "Plugin 'PluginName' not found. Please create the plugin first."}` | 404 |
| Server error | `{"success": false, "error": "An unexpected error occurred"}` | 500 |

---

## 🩺 Health Monitoring

### 1. Basic Health Check

**Simple endpoint to verify API availability**

```http
GET /health
```

**Example Request:**

```bash
curl http://localhost:3000/health
```

**Response Format:**

```typescript
{
  status: string; // "ok", "degraded", or "unhealthy"
  message: string; // Status description
  timestamp: string; // ISO timestamp
}
```

**Example Response:**

```json
{
  "status": "ok",
  "message": "Pegasus Nest API is healthy",
  "timestamp": "2024-12-06T10:30:00.000Z"
}
```

---

### 2. Detailed Health Check

**Comprehensive health information including service dependencies**

```http
GET /health/detailed
```

**Example Request:**

```bash
curl http://localhost:3000/health/detailed
```

**Response Format:**

```typescript
{
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  services: Array<{
    name: string;
    status: 'up' | 'down';
    responseTime: number; // in milliseconds
    errors?: string[];
  }>;
  uptime: number; // in seconds
  memory: {
    used: number; // in bytes
    total: number; // in bytes
    percentage: number; // 0-100
  }
  version: string;
  environment: string;
}
```

---

### 3. System Metrics

**Get system performance metrics and statistics**

```http
GET /health/metrics
```

**Example Request:**

```bash
curl http://localhost:3000/health/metrics
```

**Response Format:**

```typescript
{
  metrics: {
    cpu: {
      usage: number;          // CPU usage percentage
      loadAverage: number[];  // Load average [1m, 5m, 15m]
    };
    memory: {
      used: number;           // Used memory in bytes
      total: number;          // Total memory in bytes
      free: number;           // Free memory in bytes
      percentage: number;     // Usage percentage
    };
    disk: {
      used: number;           // Used disk space in bytes
      total: number;          // Total disk space in bytes
      free: number;           // Free disk space in bytes
      percentage: number;     // Usage percentage
    };
  };
  health: object;             // Additional health information
  timestamp: string;
}
```

---

### 4. Circuit Breaker Status

**Monitor circuit breaker states for service resilience**

```http
GET /health/circuit-breakers
```

**Example Request:**

```bash
curl http://localhost:3000/health/circuit-breakers
```

**Response Format:**

```typescript
{
  total: number;
  open: number;
  halfOpen: number;
  closed: number;
  details: Array<{
    name: string;
    state: 'OPEN' | 'HALF_OPEN' | 'CLOSED';
    failureCount: number;
    lastFailureTime?: string;
  }>;
  timestamp: string;
}
```

---

### 5. Service Health Trends

**Get health trends for a specific service**

```http
GET /health/trends/:serviceName
```

**Path Parameters:**

- `serviceName` (string): Name of the service (e.g., "gemini", "compiler")

**Example Request:**

```bash
curl http://localhost:3000/health/trends/gemini
```

**Response Format:**

```typescript
{
  serviceName: string;
  trend: string; // "improving", "stable", "degrading"
  historyCount: number;
  recentHistory: Array<{
    timestamp: string;
    status: 'up' | 'down';
    responseTime: number;
    errorCount: number;
  }>;
  timestamp: string;
}
```

---

### 6. Readiness Check

**Kubernetes readiness probe endpoint**

```http
GET /health/ready
```

**Example Request:**

```bash
curl http://localhost:3000/health/ready
```

**Response Format:**

```typescript
{
  ready: boolean;
  message: string;
  criticalBreakers?: string[];  // Only present if not ready
  timestamp: string;
}
```

---

### 7. Liveness Check

**Kubernetes liveness probe endpoint**

```http
GET /health/live
```

**Example Request:**

```bash
curl http://localhost:3000/health/live
```

**Response Format:**

```typescript
{
  alive: boolean;
  message: string;
  uptime: number; // Process uptime in seconds
  timestamp: string;
}
```

---

### 8. Ping Endpoint

**Simple ping endpoint for basic connectivity checks**

```http
GET /health/ping
```

**Example Request:**

```bash
curl http://localhost:3000/health/ping
```

**Response Format:**

```typescript
{
  status: string; // "pong"
  timestamp: string;
}
```

---

### 9. System Health

**System-level health information**

```http
GET /health/system
```

**Example Request:**

```bash
curl http://localhost:3000/health/system
```

**Response Format:**

```typescript
{
  status: string;
  timestamp: string;
  servicesStatus: Array<{
    name: string;
    status: string;
    lastChecked: string;
    responseTime: number;
  }>;
  metrics: object;
  recommendations: string[];
}
```

---

### 10. Health Trends (All Services)

**Get health trends for all monitored services**

```http
GET /health/trends
```

**Example Request:**

```bash
curl http://localhost:3000/health/trends
```

**Response Format:**

```typescript
{
  timestamp: string;
  trends: {
    [serviceName: string]: {
      uptime: number;           // Percentage uptime
      avgResponseTime: number;  // Average response time
      errorRate: number;        // Error rate percentage
      lastStatus: 'up' | 'down';
    };
  };
}
```

---

## ⚙️ System Optimization

### 1. Optimization Statistics

**Get API optimization and performance statistics**

```http
GET /api/optimization-stats
```

**Example Request:**

```bash
curl http://localhost:3000/api/optimization-stats
```

**Response Format:**

```typescript
{
  message: string;
  timestamp: string;
  performance: {
    totalRequests: number;
    totalTokens: number;
    averageTokensPerRequest: number;
    cacheHitRate: string; // e.g., "85.2%"
    cacheSize: number;
    compressionSavings: string; // e.g., "1024 characters saved"
  }
  savings: {
    cacheHits: number;
    cacheMisses: number;
    estimatedTokensSaved: number;
    estimatedCostSavings: string; // e.g., "$0.0032"
  }
  status: string; // "Optimization Active" or "Waiting for requests"
}
```

**Example Response:**

```json
{
  "message": "🚀 Pegasus Nest API Optimization Statistics",
  "timestamp": "2024-12-06T10:30:00.000Z",
  "performance": {
    "totalRequests": 1234,
    "totalTokens": 567890,
    "averageTokensPerRequest": 460,
    "cacheHitRate": "87.3%",
    "cacheSize": 45,
    "compressionSavings": "2048 characters saved"
  },
  "savings": {
    "cacheHits": 892,
    "cacheMisses": 342,
    "estimatedTokensSaved": 89200,
    "estimatedCostSavings": "$0.1784"
  },
  "status": "Optimization Active"
}
```

---

### 2. Clear Optimization Cache

**Clear the API optimization cache**

```http
GET /api/clear-cache
```

**Example Request:**

```bash
curl http://localhost:3000/api/clear-cache
```

**Response Format:**

```typescript
{
  message: string;
  timestamp: string;
}
```

**Example Response:**

```json
{
  "message": "🧹 Optimization cache cleared successfully",
  "timestamp": "2024-12-06T10:30:00.000Z"
}
```

---

## 📊 Response Formats

### Success Responses

All successful responses follow consistent patterns:

```typescript
// Plugin Creation Success
string // Descriptive success message

// Data Retrieval Success
{
  data: any;              // The requested data
  timestamp?: string;     // Optional timestamp
  metadata?: object;      // Optional metadata
}

// Operation Success
{
  success: boolean;       // Always true for success
  message?: string;       // Optional success message
  timestamp: string;      // Operation timestamp
}
```

### Pagination (Future Enhancement)

For endpoints that may return large datasets:

```typescript
{
  data: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}
```

---

## ⚠️ Error Handling

### Standard Error Format

All error responses follow this consistent format:

```typescript
{
  statusCode: number;       // HTTP status code
  message: string;          // Human-readable error message
  error?: string;           // Error type (optional)
  timestamp?: string;       // ISO timestamp (optional)
  details?: object;         // Additional error details (optional)
}
```

### HTTP Status Codes

| Code  | Meaning               | When It Occurs                             |
| ----- | --------------------- | ------------------------------------------ |
| `200` | OK                    | Successful request                         |
| `201` | Created               | Resource created successfully              |
| `400` | Bad Request           | Invalid request data or parameters         |
| `404` | Not Found             | Plugin or resource doesn't exist           |
| `429` | Too Many Requests     | Rate limit exceeded                        |
| `500` | Internal Server Error | Server-side error occurred                 |
| `503` | Service Unavailable   | External service (AI/Compiler) unavailable |

### Error Examples

```json
// Bad Request (400)
{
  "statusCode": 400,
  "message": "Plugin name is required and cannot be empty",
  "error": "Bad Request",
  "timestamp": "2024-12-06T10:30:00.000Z"
}

// Not Found (404)
{
  "statusCode": 404,
  "message": "Plugin 'NonExistentPlugin' not found for user 'user123'",
  "error": "Not Found",
  "timestamp": "2024-12-06T10:30:00.000Z"
}

// Service Unavailable (503)
{
  "statusCode": 503,
  "message": "AI service temporarily unavailable",
  "error": "Service Unavailable",
  "details": {
    "service": "gemini",
    "retryAfter": 30
  },
  "timestamp": "2024-12-06T10:30:00.000Z"
}
```

---

## 🔧 Testing

### Using cURL

```bash
# Test basic connectivity
curl -w "\nResponse Time: %{time_total}s\n" http://localhost:3000/health

# Test plugin creation with error handling
curl -X POST http://localhost:3000/create \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Test plugin","name":"TestPlugin","userId":"testuser"}' \
  -w "\nStatus: %{http_code}\n"

# Test plugin listing
curl -s http://localhost:3000/create/plugins?userId=testuser | jq .

# Test chat functionality
curl -X POST http://localhost:3000/create/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What does this plugin do?","pluginName":"TestPlugin"}' \
  | jq .
```

### Using HTTPie

```bash
# Health check
http GET localhost:3000/health

# Create plugin with pretty output
http --json POST localhost:3000/create \
  prompt="A simple greeting plugin" \
  name="GreeterPlugin" \
  userId="user123"

# Chat with plugin
http --json POST localhost:3000/create/chat \
  message="How do I modify the greeting message?" \
  pluginName="GreeterPlugin"

# Download plugin
http --download GET localhost:3000/create/download/GreeterPlugin userId==user123
```

### Integration Testing

```bash
#!/bin/bash
# Basic integration test script

BASE_URL="http://localhost:3000"
USER_ID="test-$(date +%s)"
PLUGIN_NAME="TestPlugin$(date +%s)"

echo "🧪 Running API Integration Tests..."

# 1. Health check
echo "1️⃣ Testing health endpoint..."
curl -s $BASE_URL/health | jq .status

# 2. Create plugin
echo "2️⃣ Creating test plugin..."
RESPONSE=$(curl -s -X POST $BASE_URL/create \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"A simple test plugin\",\"name\":\"$PLUGIN_NAME\",\"userId\":\"$USER_ID\"}")
echo "Creation response: $RESPONSE"

# 3. List plugins
echo "3️⃣ Listing plugins..."
curl -s "$BASE_URL/create/plugins?userId=$USER_ID" | jq .

# 4. Chat with plugin
echo "4️⃣ Testing chat..."
curl -s -X POST $BASE_URL/create/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"What does this plugin do?\",\"pluginName\":\"$PLUGIN_NAME\"}" | jq .

echo "✅ Integration tests completed!"
```

---

## 📱 Integration Examples

### React/Next.js Hook

```typescript
import { useState, useCallback } from 'react';

interface UsePluginAPIResult {
  createPlugin: (data: CreatePluginRequest) => Promise<string>;
  listPlugins: (userId: string) => Promise<PluginListResponse>;
  chatWithPlugin: (
    message: string,
    pluginName: string,
  ) => Promise<ChatResponse>;
  downloadPlugin: (pluginName: string, userId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

interface CreatePluginRequest {
  prompt: string;
  name: string;
  userId: string;
}

interface PluginListResponse {
  plugins: string[];
  count: number;
  userId?: string;
}

interface ChatResponse {
  success: boolean;
  response?: string;
  error?: string;
}

export const usePluginAPI = (baseUrl = '/api'): UsePluginAPIResult => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = useCallback(
    async <T>(request: () => Promise<Response>): Promise<T> => {
      setLoading(true);
      setError(null);

      try {
        const response = await request();

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Request failed');
        }

        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return await response.json();
        } else {
          return (await response.text()) as unknown as T;
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const createPlugin = useCallback(
    async (data: CreatePluginRequest): Promise<string> => {
      return handleRequest(() =>
        fetch(`${baseUrl}/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }),
      );
    },
    [baseUrl, handleRequest],
  );

  const listPlugins = useCallback(
    async (userId: string): Promise<PluginListResponse> => {
      return handleRequest(() =>
        fetch(`${baseUrl}/create/plugins?userId=${encodeURIComponent(userId)}`),
      );
    },
    [baseUrl, handleRequest],
  );

  const chatWithPlugin = useCallback(
    async (message: string, pluginName: string): Promise<ChatResponse> => {
      return handleRequest(() =>
        fetch(`${baseUrl}/create/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, pluginName }),
        }),
      );
    },
    [baseUrl, handleRequest],
  );

  const downloadPlugin = useCallback(
    async (pluginName: string, userId: string): Promise<void> => {
      const response = await fetch(
        `${baseUrl}/create/download/${encodeURIComponent(pluginName)}?userId=${encodeURIComponent(userId)}`,
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${pluginName}.jar`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    [baseUrl],
  );

  return {
    createPlugin,
    listPlugins,
    chatWithPlugin,
    downloadPlugin,
    loading,
    error,
  };
};
```

### Python SDK

```python
import requests
from typing import Dict, List, Optional, Any
import json

class PegasusNestAPI:
    """Python SDK for Pegasus Nest API"""

    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'PegasusNest-Python-SDK/1.0.0'
        })

    def _handle_response(self, response: requests.Response) -> Any:
        """Handle API response and error cases"""
        try:
            response.raise_for_status()
            content_type = response.headers.get('content-type', '')

            if 'application/json' in content_type:
                return response.json()
            else:
                return response.text

        except requests.HTTPError as e:
            try:
                error_data = response.json()
                raise Exception(f"API Error {response.status_code}: {error_data.get('message', str(e))}")
            except json.JSONDecodeError:
                raise Exception(f"HTTP Error {response.status_code}: {response.text}")

    def create_plugin(self, prompt: str, name: str, user_id: str) -> str:
        """Create a new Minecraft plugin"""
        data = {
            "prompt": prompt,
            "name": name,
            "userId": user_id
        }
        response = self.session.post(f"{self.base_url}/create", json=data)
        return self._handle_response(response)

    def list_plugins(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """List all plugins for a user"""
        params = {}
        if user_id:
            params['userId'] = user_id

        response = self.session.get(f"{self.base_url}/create/plugins", params=params)
        return self._handle_response(response)

    def chat_with_plugin(self, message: str, plugin_name: str) -> Dict[str, Any]:
        """Chat with AI about a plugin"""
        data = {
            "message": message,
            "pluginName": plugin_name
        }
        response = self.session.post(f"{self.base_url}/create/chat", json=data)
        return self._handle_response(response)

    def download_plugin(self, plugin_name: str, user_id: str, save_path: Optional[str] = None) -> str:
        """Download a plugin JAR file"""
        params = {"userId": user_id}
        response = self.session.get(
            f"{self.base_url}/create/download/{plugin_name}",
            params=params,
            stream=True
        )

        if response.status_code != 200:
            return self._handle_response(response)

        filename = save_path or f"{plugin_name}.jar"

        with open(filename, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        return filename

    def health_check(self) -> Dict[str, Any]:
        """Basic health check"""
        response = self.session.get(f"{self.base_url}/health")
        return self._handle_response(response)

    def detailed_health(self) -> Dict[str, Any]:
        """Detailed health information"""
        response = self.session.get(f"{self.base_url}/health/detailed")
        return self._handle_response(response)

    def get_optimization_stats(self) -> Dict[str, Any]:
        """Get optimization statistics"""
        response = self.session.get(f"{self.base_url}/api/optimization-stats")
        return self._handle_response(response)

# Usage example
if __name__ == "__main__":
    api = PegasusNestAPI()

    # Health check
    health = api.health_check()
    print(f"API Status: {health['status']}")

    # Create a plugin
    try:
        result = api.create_plugin(
            prompt="A plugin that gives players a diamond sword when they join",
            name="WelcomeSword",
            user_id="python_user"
        )
        print(f"Plugin created: {result}")

        # List plugins
        plugins = api.list_plugins("python_user")
        print(f"Available plugins: {plugins['plugins']}")

        # Chat about the plugin
        chat_response = api.chat_with_plugin(
            "Can you add enchantments to the sword?",
            "WelcomeSword"
        )
        print(f"AI Response: {chat_response['response']}")

    except Exception as e:
        print(f"Error: {e}")
```

### Node.js/Express Middleware

```javascript
const axios = require('axios');

class PegasusNestClient {
  constructor(baseURL = 'http://localhost:3000') {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(
          `📡 API Request: ${config.method?.toUpperCase()} ${config.url}`,
        );
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(
          `✅ API Response: ${response.status} ${response.config.url}`,
        );
        return response;
      },
      (error) => {
        const status = error.response?.status || 'Unknown';
        const message = error.response?.data?.message || error.message;
        console.error(`❌ API Error: ${status} - ${message}`);
        return Promise.reject(error);
      },
    );
  }

  async createPlugin(prompt, name, userId) {
    const response = await this.client.post('/create', {
      prompt,
      name,
      userId,
    });
    return response.data;
  }

  async listPlugins(userId) {
    const response = await this.client.get('/create/plugins', {
      params: { userId },
    });
    return response.data;
  }

  async chatWithPlugin(message, pluginName) {
    const response = await this.client.post('/create/chat', {
      message,
      pluginName,
    });
    return response.data;
  }

  async downloadPlugin(pluginName, userId) {
    const response = await this.client.get(`/create/download/${pluginName}`, {
      params: { userId },
      responseType: 'stream',
    });
    return response.data;
  }

  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }

  async getOptimizationStats() {
    const response = await this.client.get('/api/optimization-stats');
    return response.data;
  }
}

// Express middleware for plugin management
function createPluginMiddleware(pegasusClient) {
  return {
    // Create plugin endpoint
    createPlugin: async (req, res, next) => {
      try {
        const { prompt, name, userId } = req.body;

        if (!prompt || !name || !userId) {
          return res.status(400).json({
            error: 'Missing required fields: prompt, name, userId',
          });
        }

        const result = await pegasusClient.createPlugin(prompt, name, userId);
        res.json({ success: true, message: result });
      } catch (error) {
        next(error);
      }
    },

    // List plugins endpoint
    listPlugins: async (req, res, next) => {
      try {
        const { userId } = req.query;
        const result = await pegasusClient.listPlugins(userId);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },

    // Chat endpoint
    chat: async (req, res, next) => {
      try {
        const { message, pluginName } = req.body;

        if (!message || !pluginName) {
          return res.status(400).json({
            error: 'Missing required fields: message, pluginName',
          });
        }

        const result = await pegasusClient.chatWithPlugin(message, pluginName);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },

    // Download endpoint
    downloadPlugin: async (req, res, next) => {
      try {
        const { pluginName } = req.params;
        const { userId } = req.query;

        if (!userId) {
          return res.status(400).json({
            error: 'userId query parameter is required',
          });
        }

        const stream = await pegasusClient.downloadPlugin(pluginName, userId);

        res.setHeader('Content-Type', 'application/java-archive');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${pluginName}.jar"`,
        );

        stream.pipe(res);
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = { PegasusNestClient, createPluginMiddleware };
```

---

## 🔗 CORS and Headers

### CORS Policy

The API supports cross-origin requests from all origins in development. In production, configure allowed origins appropriately.

### Common Response Headers

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Content-Type: application/json
```

### Rate Limiting Headers

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1717668600
```

---

## 📝 Rate Limiting

| Endpoint                 | Limit        | Window     |
| ------------------------ | ------------ | ---------- |
| `POST /create`           | 10 requests  | per minute |
| `POST /create/chat`      | 30 requests  | per minute |
| `GET /create/plugins`    | 100 requests | per minute |
| `GET /create/download/*` | 50 requests  | per minute |
| `GET /health*`           | No limit     | -          |
| `GET /api/*`             | 50 requests  | per minute |

---

## 🔮 Future Enhancements

- **WebSocket Support**: Real-time plugin compilation status
- **Webhook Notifications**: Plugin completion callbacks
- **Bulk Operations**: Create multiple plugins in one request
- **Advanced Filtering**: Search plugins by features, complexity
- **Plugin Analytics**: Usage statistics and performance metrics
- **Template System**: Predefined plugin templates
- **Version Control**: Plugin versioning and rollback

---

## 📞 Support

- **Documentation**: [Full API Docs](https://docs.pegasus-nest.dev)
- **GitHub**: [Pegasus Nest Repository](https://github.com/pegasus-nest/api)
- **Discord**: [Join our community](https://discord.gg/pegasus-nest)
- **Email**: support@pegasus-nest.dev

---

## 📄 License

This API documentation is licensed under [MIT License](LICENSE).

---

**Last Updated:** December 6, 2024  
**API Version:** 1.0.0  
**Documentation Version:** 1.2.0

---

> 🚀 **Ready to build amazing Minecraft plugins?** Start with our [Quick Start](#-quick-start) guide and create your first plugin in minutes!
