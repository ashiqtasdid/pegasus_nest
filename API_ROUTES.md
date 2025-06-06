# Pegasus Nest API Routes Reference

A comprehensive reference guide for all available API endpoints in the Pegasus Nest system.

## 🚀 Quick Reference

| Method | Endpoint                       | Description                                             | Status    |
| ------ | ------------------------------ | ------------------------------------------------------- | --------- |
| `POST` | `/create`                      | Generate a new Minecraft plugin                         | ✅ Active |
| `POST` | `/create/chat`                 | Chat with AI about plugin modifications                 | ✅ Active |
| `GET`  | `/create/plugins`              | List all generated plugins                              | ✅ Active |
| `GET`  | `/create/download/:pluginName` | Download compiled plugin JAR                            | ✅ Active |
| `GET`  | `/health`                      | Basic health check ⚠️ **Dual Controllers**              | ✅ Active |
| `GET`  | `/health/detailed`             | Detailed health information ⚠️ **Dual Controllers**     | ✅ Active |
| `GET`  | `/health/ping`                 | Simple ping endpoint                                    | ✅ Active |
| `GET`  | `/health/system`               | System-level health information ⚠️ **Dual Controllers** | ✅ Active |
| `GET`  | `/health/trends`               | All services health trends                              | ✅ Active |
| `GET`  | `/health/trends/:serviceName`  | Specific service health trends                          | ✅ Active |
| `GET`  | `/health/metrics`              | System metrics and performance data                     | ✅ Active |
| `GET`  | `/health/circuit-breakers`     | Circuit breaker status                                  | ✅ Active |
| `GET`  | `/health/ready`                | Kubernetes readiness probe                              | ✅ Active |
| `GET`  | `/health/live`                 | Kubernetes liveness probe                               | ✅ Active |
| `GET`  | `/api/optimization-stats`      | API optimization statistics                             | ✅ Active |
| `GET`  | `/api/clear-cache`             | Clear optimization cache                                | ✅ Active |

---

⚠️ **Important Note about Health Endpoints**: There are two health controllers in the system:

- `/src/health/health.controller.ts` - Original health controller
- `/src/controllers/health.controller.ts` - Additional health controller with advanced features

Some endpoints like `/health`, `/health/detailed`, and `/health/system` exist in both controllers and may return different response formats. The advanced controller includes circuit breaker monitoring and robustness features.

## 📚 Detailed Endpoint Documentation

### 🔧 Plugin Creation & Management

#### 1. Create Plugin

Generate a new Minecraft plugin from a natural language description.

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
  name: string; // Required: Plugin name
}
```

**Example Request:**

```bash
curl -X POST http://localhost:3000/create \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a plugin that gives players a diamond sword when they type /sword",
    "name": "DiamondSwordGiver"
  }'
```

**Response Format:**

```typescript
// Success Response (200)
string; // Success message with plugin creation details

// Error Response (400/500)
string; // Error message describing what went wrong
```

**Example Responses:**

```json
// Success
"Plugin 'DiamondSwordGiver' created successfully! Files generated and compiled. Ready for download."

// Error
"Error: Plugin name contains invalid characters. Please use only letters, numbers, and underscores."
```

---

#### 2. Chat with Plugin

Interactive AI chat for plugin modifications and questions.

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
  message: string; // Required: Your message/question about the plugin
  name: string; // Required: Name of the plugin to discuss
}
```

**Example Request:**

```bash
curl -X POST http://localhost:3000/create/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Can you add enchantments to the sword?",
    "name": "DiamondSwordGiver"
  }'
```

**Response Format:**

```typescript
{
  success: boolean;
  response?: string;        // AI response message
  error?: string;          // Error message if success is false
}
```

**Example Responses:**

```json
// Success
{
  "success": true,
  "response": "I can definitely add enchantments to the sword! I'll modify the plugin to include Sharpness V and Unbreaking III. Would you like me to make these changes and regenerate the plugin?"
}

// Error
{
  "success": false,
  "error": "Plugin 'DiamondSwordGiver' not found. Please create the plugin first."
}
```

---

#### 3. List Plugins

Get a list of all generated plugins.

```http
GET /create/plugins
```

**Query Parameters:**
None currently supported.

**Example Request:**

```bash
curl http://localhost:3000/create/plugins
```

**Response Format:**

```typescript
string[] // Array of plugin names
```

**Example Response:**

```json
["DiamondSwordGiver", "WelcomeGreeter", "AdminTools", "TeleportPlugin"]
```

---

#### 4. Download Plugin

Download a compiled plugin JAR file.

```http
GET /create/download/:pluginName
```

**Path Parameters:**

- `pluginName` (string): Name of the plugin to download

**Example Request:**

```bash
curl -O http://localhost:3000/create/download/DiamondSwordGiver
```

**Response:**

- **Content-Type:** `application/java-archive`
- **Content-Disposition:** `attachment; filename="[pluginName].jar"`
- **Body:** Binary JAR file data

**Error Responses:**

```json
// Plugin not found (404)
{
  "statusCode": 404,
  "message": "Plugin 'DiamondSwordGiver' not found"
}

// Plugin not compiled (404)
{
  "statusCode": 404,
  "message": "Plugin 'DiamondSwordGiver' has not been compiled yet"
}
```

---

### 🩺 Health Monitoring

#### 5. Basic Health Check

Simple endpoint to verify API availability.

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
  status: string; // "ok" or error status
  timestamp: string; // ISO timestamp
}
```

**Example Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-06-06T10:30:00.000Z"
}
```

---

#### 6. Detailed Health Check

Comprehensive health information including service dependencies.

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
  services: {
    geminiAI: {
      status: 'up' | 'down';
      responseTime: number; // in milliseconds
    }
    compiler: {
      status: 'up' | 'down';
      jdkVersion: string;
    }
    fileSystem: {
      status: 'up' | 'down';
      freeSpace: number; // in bytes
    }
  }
  uptime: number; // in seconds
  memory: {
    used: number; // in bytes
    total: number; // in bytes
    percentage: number; // 0-100
  }
  version: string;
}
```

**Example Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-06-06T10:30:00.000Z",
  "services": {
    "geminiAI": {
      "status": "up",
      "responseTime": 250
    },
    "compiler": {
      "status": "up",
      "jdkVersion": "17.0.2"
    },
    "fileSystem": {
      "status": "up",
      "freeSpace": 5368709120
    }
  },
  "uptime": 86400,
  "memory": {
    "used": 134217728,
    "total": 536870912,
    "percentage": 25
  },
  "version": "1.0.0"
}
```

---

#### 7. System Metrics

Get system performance metrics and statistics.

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
  timestamp: string;
}
```

---

#### 8. Circuit Breaker Status

Monitor circuit breaker states for service resilience.

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

#### 9. All Services Health Trends

Get health trends for all monitored services.

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

**Example Response:**

```json
{
  "timestamp": "2024-06-06T10:30:00.000Z",
  "trends": {
    "RobustnessService": {
      "uptime": 99.5,
      "avgResponseTime": 45,
      "errorRate": 0.5,
      "lastStatus": "up"
    },
    "GeminiService": {
      "uptime": 98.2,
      "avgResponseTime": 250,
      "errorRate": 1.8,
      "lastStatus": "up"
    }
  }
}
```

---

#### 10. Service Health Trends

Get health trends for a specific service.

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
  trends: Array<{
    timestamp: string;
    status: 'up' | 'down';
    responseTime: number;
    errorCount: number;
  }>;
  summary: {
    uptime: number; // Percentage uptime
    avgResponseTime: number; // Average response time
    errorRate: number; // Error rate percentage
  }
}
```

---

#### 11. Readiness Check

Kubernetes readiness probe endpoint.

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
  criticalBreakers?: string[]; // Only present if not ready
  timestamp: string;
}
```

---

#### 12. Liveness Check

Kubernetes liveness probe endpoint.

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
  timestamp: string;
}
```

---

#### 13. Ping Endpoint

Simple ping endpoint for basic connectivity checks.

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
  message: string; // "pong"
  timestamp: string;
}
```

---

#### 14. System Health

System-level health information.

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
  system: {
    platform: string; // Operating system
    arch: string; // System architecture
    nodeVersion: string; // Node.js version
    uptime: number; // System uptime in seconds
  }
  process: {
    pid: number; // Process ID
    uptime: number; // Process uptime in seconds
    memoryUsage: {
      rss: number; // Resident set size
      heapTotal: number; // Total heap size
      heapUsed: number; // Used heap size
      external: number; // External memory usage
    }
  }
  timestamp: string;
}
```

---

### 🔧 Additional API Endpoints

#### 15. Optimization Statistics

Get API optimization and performance statistics.

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
  cacheHits: number;
  cacheMisses: number;
  totalRequests: number;
  avgResponseTime: number;
  optimizationLevel: string;
  timestamp: string;
}
```

---

#### 16. Clear Optimization Cache

Clear the API optimization cache.

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
  success: boolean;
  message: string;
  timestamp: string;
}
```

---

## 🔄 HTTP Status Codes

| Code  | Meaning               | When It Occurs                             |
| ----- | --------------------- | ------------------------------------------ |
| `200` | OK                    | Successful request                         |
| `201` | Created               | Resource created successfully              |
| `400` | Bad Request           | Invalid request data or parameters         |
| `404` | Not Found             | Plugin or resource doesn't exist           |
| `429` | Too Many Requests     | Rate limit exceeded                        |
| `500` | Internal Server Error | Server-side error occurred                 |
| `503` | Service Unavailable   | External service (AI/Compiler) unavailable |

---

## ⚠️ Error Response Format

All error responses follow this consistent format:

```typescript
{
  statusCode: number;       // HTTP status code
  message: string;          // Human-readable error message
  error?: string;           // Error type (optional)
  timestamp?: string;       // ISO timestamp (optional)
}
```

**Example Error Response:**

```json
{
  "statusCode": 400,
  "message": "Plugin name is required and cannot be empty",
  "error": "Bad Request",
  "timestamp": "2024-06-06T10:30:00.000Z"
}
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

---

## 📝 Rate Limiting

| Endpoint                 | Limit        | Window     |
| ------------------------ | ------------ | ---------- |
| `POST /create`           | 10 requests  | per minute |
| `POST /create/chat`      | 30 requests  | per minute |
| `GET /create/plugins`    | 100 requests | per minute |
| `GET /create/download/*` | 50 requests  | per minute |
| `GET /health*`           | No limit     | -          |

**Rate Limit Headers:**

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1717668600
```

---

## 🛠️ Development Testing

### Using curl

```bash
# Health check
curl http://localhost:3000/health

# Create a plugin
curl -X POST http://localhost:3000/create \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A simple greeting plugin", "name": "GreeterPlugin"}'

# List plugins
curl http://localhost:3000/create/plugins

# Chat about a plugin
curl -X POST http://localhost:3000/create/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I modify the greeting message?", "name": "GreeterPlugin"}'

# Download plugin
curl -O http://localhost:3000/create/download/GreeterPlugin
```

### Using HTTPie

```bash
# Health check
http GET localhost:3000/health

# Create a plugin
http POST localhost:3000/create prompt="A simple greeting plugin" name="GreeterPlugin"

# List plugins
http GET localhost:3000/create/plugins

# Chat about a plugin
http POST localhost:3000/create/chat message="How do I modify the greeting message?" name="GreeterPlugin"

# Download plugin
http --download localhost:3000/create/download/GreeterPlugin
```

---

## 🔌 WebSocket Support

Currently, the API does not support WebSocket connections. For real-time updates, implement polling:

```javascript
// Poll plugin compilation status
const pollStatus = async (pluginName) => {
  const response = await fetch(`/create/plugins`);
  const plugins = await response.json();
  const plugin = plugins.find((p) => p === pluginName);
  return plugin ? 'completed' : 'not_found';
};

// Poll every 2 seconds
setInterval(() => pollStatus('MyPlugin'), 2000);
```

---

## 📱 Mobile & Client Integration

### React/Next.js Example

```typescript
const usePluginAPI = () => {
  const createPlugin = async (data: CreatePluginRequest) => {
    const response = await fetch('/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.text();
  };

  const listPlugins = async () => {
    const response = await fetch('/create/plugins');
    return response.json();
  };

  return { createPlugin, listPlugins };
};
```

### Python Example

```python
import requests

class PegasusNestAPI:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url

    def create_plugin(self, prompt, name=None):
        data = {"prompt": prompt}
        if name:
            data["name"] = name
        response = requests.post(f"{self.base_url}/create", json=data)
        return response.text

    def list_plugins(self):
        response = requests.get(f"{self.base_url}/create/plugins")
        return response.json()

    def download_plugin(self, plugin_name):
        response = requests.get(f"{self.base_url}/create/download/{plugin_name}")
        with open(f"{plugin_name}.jar", "wb") as f:
            f.write(response.content)
```

---

_Last updated: June 6, 2025_
_API Version: 1.0.0_
