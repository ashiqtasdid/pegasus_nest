# Pegasus Nest API Documentation

A comprehensive guide for integrating with the Pegasus Nest API - an AI-powered Minecraft plugin generation service.

## Table of Contents

1. [Overview](#overview)
2. [Base URL & Authentication](#base-url--authentication)
3. [API Endpoints](#api-endpoints)
4. [Data Models](#data-models)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Next.js Integration Examples](#nextjs-integration-examples)
8. [WebSocket Support](#websocket-support)
9. [Best Practices](#best-practices)

## Overview

The Pegasus Nest API is a RESTful service that allows developers to generate, modify, and compile Minecraft plugins using AI. The API is built with NestJS and integrates with Google's Gemini AI for intelligent plugin creation.

### Key Features

- AI-powered plugin generation from natural language descriptions
- Interactive chat system for plugin modifications
- Automatic Java code compilation
- Plugin download functionality
- Health monitoring and status checks

## Base URL & Authentication

### Base URL

```
Production: https://your-production-domain.com
Development: http://localhost:3000
```

### Authentication

Currently, the API does not require authentication, but it's recommended to implement API key authentication for production usage.

## API Endpoints

### 1. Plugin Generation

#### Generate New Plugin

Creates a new Minecraft plugin based on a natural language description.

```http
POST /create/plugin
```

**Request Body:**

```typescript
{
  prompt: string;           // Description of the plugin functionality
  pluginName: string;       // Name for the plugin (optional)
  description?: string;     // Additional description (optional)
  author?: string;          // Plugin author (optional)
  version?: string;         // Plugin version (optional)
  mainClass?: string;       // Main class name (optional)
}
```

**Example Request:**

```json
{
  "prompt": "Create a plugin that gives players a diamond sword when they type /sword",
  "pluginName": "DiamondSwordGiver",
  "description": "A simple plugin for giving diamond swords",
  "author": "YourName",
  "version": "1.0.0"
}
```

**Response:**

```typescript
{
  success: boolean;
  message: string;
  data: {
    pluginName: string;
    generatedCode: string;
    compilationStatus: 'pending' | 'compiling' | 'success' | 'failed';
    downloadUrl?: string;
    errors?: string[];
  }
}
```

**Example Response:**

```json
{
  "success": true,
  "message": "Plugin generated successfully",
  "data": {
    "pluginName": "DiamondSwordGiver",
    "generatedCode": "package com.example.diamondswordgiver;\n\nimport org.bukkit.plugin.java.JavaPlugin;\n...",
    "compilationStatus": "success",
    "downloadUrl": "/create/download/DiamondSwordGiver"
  }
}
```

### 2. Plugin Chat

#### Chat with Plugin

Interact with the AI to modify or discuss the generated plugin.

```http
POST /create/chat
```

**Request Body:**

```typescript
{
  message: string;          // Your message/question about the plugin
  pluginName: string;       // Name of the plugin to discuss
  conversationId?: string;  // Optional conversation ID for context
}
```

**Example Request:**

```json
{
  "message": "Can you add enchantments to the sword?",
  "pluginName": "DiamondSwordGiver",
  "conversationId": "conv_12345"
}
```

**Response:**

```typescript
{
  success: boolean;
  message: string;
  data: {
    response: string;
    conversationId: string;
    suggestedChanges?: string;
    updatedCode?: string;
  }
}
```

### 3. Plugin Management

#### List Available Plugins

Get a list of all generated plugins.

```http
GET /create/plugins
```

**Query Parameters:**

- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of items per page (default: 10)
- `author` (optional): Filter by author

**Response:**

```typescript
{
  success: boolean;
  data: {
    plugins: Array<{
      name: string;
      description: string;
      author: string;
      version: string;
      createdAt: string;
      compilationStatus: string;
      downloadUrl: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    }
  }
}
```

#### Download Plugin

Download a compiled plugin JAR file.

```http
GET /create/download/:pluginName
```

**Path Parameters:**

- `pluginName`: Name of the plugin to download

**Response:**

- Content-Type: `application/java-archive`
- File download of the compiled .jar file

### 4. Health Monitoring

#### Basic Health Check

Check if the API is running.

```http
GET /health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Detailed Health Check

Get detailed health information including dependencies.

```http
GET /health/detailed
```

**Response:**

```typescript
{
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  services: {
    database: {
      status: 'up' | 'down';
      responseTime: number;
    }
    geminiAI: {
      status: 'up' | 'down';
      responseTime: number;
    }
    compiler: {
      status: 'up' | 'down';
      jdkVersion: string;
    }
  }
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  }
}
```

## Data Models

### Plugin Model

```typescript
interface Plugin {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  mainClass: string;
  sourceCode: string;
  compilationStatus: 'pending' | 'compiling' | 'success' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  downloadUrl?: string;
  errors?: string[];
}
```

### Chat Message Model

```typescript
interface ChatMessage {
  id: string;
  conversationId: string;
  message: string;
  response: string;
  timestamp: Date;
  pluginName: string;
}
```

### Error Model

```typescript
interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
}
```

## Error Handling

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable

### Error Response Format

```typescript
{
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  }
}
```

### Common Error Codes

- `INVALID_PROMPT` - The provided prompt is invalid or empty
- `PLUGIN_NOT_FOUND` - Requested plugin does not exist
- `COMPILATION_FAILED` - Plugin compilation failed
- `AI_SERVICE_UNAVAILABLE` - Gemini AI service is not available
- `RATE_LIMIT_EXCEEDED` - Too many requests in a short time
- `INVALID_PLUGIN_NAME` - Plugin name contains invalid characters

## Rate Limiting

### Current Limits

- Plugin Generation: 10 requests per minute per IP
- Chat Requests: 30 requests per minute per IP
- Plugin Downloads: 100 requests per minute per IP
- Health Checks: No limit

### Rate Limit Headers

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1642234567
```

## Next.js Integration Examples

### 1. Plugin Generation Hook

```typescript
// hooks/usePluginGeneration.ts
import { useState } from 'react';

interface GeneratePluginRequest {
  prompt: string;
  pluginName: string;
  description?: string;
  author?: string;
  version?: string;
}

export const usePluginGeneration = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePlugin = async (data: GeneratePluginRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/create/plugin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { generatePlugin, loading, error };
};
```

### 2. Plugin Chat Component

```typescript
// components/PluginChat.tsx
'use client';

import { useState } from 'react';

interface ChatMessage {
  id: string;
  message: string;
  response: string;
  timestamp: Date;
}

interface PluginChatProps {
  pluginName: string;
}

export const PluginChat: React.FC<PluginChatProps> = ({ pluginName }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!currentMessage.trim()) return;

    setLoading(true);

    try {
      const response = await fetch('/api/create/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentMessage,
          pluginName,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          message: currentMessage,
          response: result.data.response,
          timestamp: new Date(),
        }]);
        setCurrentMessage('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="plugin-chat">
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id} className="message-pair">
            <div className="user-message">{msg.message}</div>
            <div className="ai-response">{msg.response}</div>
          </div>
        ))}
      </div>
      <div className="input-area">
        <input
          type="text"
          value={currentMessage}
          onChange={(e) => setCurrentMessage(e.target.value)}
          placeholder="Ask about your plugin..."
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !currentMessage.trim()}>
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};
```

### 3. API Route Handler (Next.js App Router)

```typescript
// app/api/create/plugin/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${process.env.API_BASE_URL}/create/plugin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
```

### 4. Plugin Download Handler

```typescript
// utils/downloadPlugin.ts
export const downloadPlugin = async (pluginName: string) => {
  try {
    const response = await fetch(`/api/create/download/${pluginName}`);

    if (!response.ok) {
      throw new Error('Download failed');
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
  } catch (error) {
    console.error('Download failed:', error);
    throw error;
  }
};
```

## WebSocket Support

Currently, the API does not support WebSocket connections. However, for real-time updates on plugin compilation status, you can implement polling:

```typescript
// utils/pollCompilationStatus.ts
export const pollCompilationStatus = (
  pluginName: string,
  onUpdate: (status: string) => void,
  interval = 2000,
) => {
  const poll = async () => {
    try {
      const response = await fetch(`/api/create/plugins?name=${pluginName}`);
      const result = await response.json();

      if (result.success && result.data.plugins.length > 0) {
        const plugin = result.data.plugins[0];
        onUpdate(plugin.compilationStatus);

        if (
          plugin.compilationStatus === 'success' ||
          plugin.compilationStatus === 'failed'
        ) {
          return; // Stop polling
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    }

    setTimeout(poll, interval);
  };

  poll();
};
```

## Best Practices

### 1. Error Handling

Always wrap API calls in try-catch blocks and provide meaningful error messages to users.

### 2. Loading States

Implement proper loading states for better user experience, especially for plugin generation which can take time.

### 3. Caching

Consider implementing client-side caching for plugin lists and chat conversations.

### 4. File Downloads

Handle file downloads gracefully with proper error handling and progress indicators.

### 5. Form Validation

Validate plugin names and prompts on the client side before sending to the API.

### 6. Environment Variables

Use environment variables for API base URLs:

```typescript
// .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

### 7. TypeScript Types

Create shared type definitions for consistent data structures across your application.

## Support

For questions or issues with the API, please refer to the main project repository or contact the development team.

---

_This documentation is for Pegasus Nest API v1.0.0. Please check for updates regularly._
