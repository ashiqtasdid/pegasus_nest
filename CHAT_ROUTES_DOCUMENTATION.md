# Chat Routes Documentation

## Overview

This document outlines the available chat routes, their required parameters, and proper usage patterns for the Pegasus Nest Minecraft Plugin Generator API. The chat system enables users to request information about plugins or make modifications to existing plugins.

## Available Chat Routes

| Method | Endpoint       | Description                 | Status    |
| ------ | -------------- | --------------------------- | --------- |
| `POST` | `/create/chat` | Chat with AI about a plugin | ✅ Active |

## Detailed Endpoint Documentation

### POST `/create/chat`

Enables users to interact with the AI to get information about a plugin or request modifications.

#### Request Requirements

##### Headers

```
Content-Type: application/json
```

##### Request Body

```json
{
  "message": "string", // Required: Your message/question about the plugin
  "pluginName": "string" // Required: The exact name of an existing plugin
}
```

> ⚠️ **IMPORTANT**: The `pluginName` field is mandatory and must reference an existing plugin. Using an undefined or non-existent plugin name will result in an error.

#### Response Format

```json
{
  "success": boolean,
  "response": "string",     // Present if success is true
  "error": "string"         // Present if success is false
}
```

#### Example Requests

**Information Request:**

```json
{
  "message": "What does the TestPlugin do?",
  "pluginName": "TestPlugin"
}
```

**Modification Request:**

```json
{
  "message": "Change the welcome message to also show the player their game mode",
  "pluginName": "TestPlugin"
}
```

#### Error Responses

| Error Condition      | Response                                                                                        | Status Code |
| -------------------- | ----------------------------------------------------------------------------------------------- | ----------- |
| Missing `pluginName` | `{"success": false, "error": "Plugin name is required"}`                                        | 400         |
| Non-existent plugin  | `{"success": false, "error": "Plugin 'PluginName' not found. Please create the plugin first."}` | 404         |
| Server error         | `{"success": false, "error": "An unexpected error occurred"}`                                   | 500         |

## Common Issues & Solutions

### 1. "Plugin: undefined" Error

**Problem**: The API returns an error about "plugin: undefined"

**Causes**:

- The `pluginName` field is missing in the request body
- The `pluginName` field is null or undefined in the request body
- The property name is misspelled (e.g., "name" instead of "pluginName")

**Solution**:

- Ensure the request body includes a valid `pluginName` field
- Check for correct property name spelling (must be exactly `pluginName`)
- Verify the plugin name exists in your system (use `/create/plugins` to list available plugins)

**Correct Usage**:

```javascript
// Incorrect ❌
fetch('/create/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'What does this plugin do?',
    // Missing pluginName!
  }),
});

// Incorrect ❌
fetch('/create/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'What does this plugin do?',
    name: 'TestPlugin', // Wrong property name!
  }),
});

// Correct ✅
fetch('/create/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'What does this plugin do?',
    pluginName: 'TestPlugin', // Correct!
  }),
});
```

### 2. Plugin Not Found Error

**Problem**: The API returns "Plugin not found" error

**Causes**:

- The plugin with the specified name doesn't exist in the system
- The plugin name is misspelled or has incorrect capitalization

**Solution**:

- List all available plugins using the `/create/plugins` endpoint
- Create the plugin first if it doesn't exist using the `/create` endpoint
- Use the exact name as returned by the plugin listing endpoint

## Client-Side Implementation

### JavaScript/TypeScript Example

```typescript
interface ChatRequest {
  message: string;
  pluginName: string;
}

interface ChatResponse {
  success: boolean;
  response?: string;
  error?: string;
}

async function sendChatMessage(
  message: string,
  pluginName: string,
): Promise<ChatResponse> {
  try {
    // Validate inputs
    if (!message) throw new Error('Message is required');
    if (!pluginName) throw new Error('Plugin name is required');

    const response = await fetch('/create/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        pluginName, // Make sure this property name is exactly "pluginName"
      }),
    });

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Usage example
sendChatMessage('What does this plugin do?', 'TestPlugin').then((response) => {
  if (response.success) {
    console.log(response.response);
  } else {
    console.error('Error:', response.error);
  }
});
```

### React Component Example

```tsx
import React, { useState } from 'react';

interface ChatProps {
  availablePlugins: string[];
}

export const PluginChat: React.FC<ChatProps> = ({ availablePlugins }) => {
  const [message, setMessage] = useState('');
  const [selectedPlugin, setSelectedPlugin] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate inputs
      if (!message.trim()) {
        throw new Error('Please enter a message');
      }
      if (!selectedPlugin) {
        throw new Error('Please select a plugin');
      }

      const response = await fetch('/create/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          pluginName: selectedPlugin, // Correct property name
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResponse(data.response);
      } else {
        setError(data.error || 'Unknown error occurred');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="plugin-chat">
      <h2>Chat with Plugin</h2>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="plugin-select">Select Plugin:</label>
          <select
            id="plugin-select"
            value={selectedPlugin}
            onChange={(e) => setSelectedPlugin(e.target.value)}
            required
          >
            <option value="">-- Select a Plugin --</option>
            {availablePlugins.map((plugin) => (
              <option key={plugin} value={plugin}>
                {plugin}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="message-input">Your Message:</label>
          <textarea
            id="message-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            required
            placeholder="Ask a question or request a modification..."
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send Message'}
        </button>
      </form>

      {response && (
        <div className="response">
          <h3>Response:</h3>
          <div className="response-content">{response}</div>
        </div>
      )}
    </div>
  );
};
```

## Testing Chat Routes

### Using curl

```bash
# Get list of available plugins first
curl http://localhost:3000/create/plugins

# Chat with a specific plugin (correct usage)
curl -X POST http://localhost:3000/create/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What does this plugin do?", "pluginName": "TestPlugin"}'

# Example of incorrect usage (will result in error)
curl -X POST http://localhost:3000/create/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What does this plugin do?"}'
```

### Using httpie

```bash
# Get list of available plugins first
http GET localhost:3000/create/plugins

# Chat with a specific plugin (correct usage)
http POST localhost:3000/create/chat \
  message="What does this plugin do?" \
  pluginName="TestPlugin"

# Example of incorrect usage (will result in error)
http POST localhost:3000/create/chat \
  message="What does this plugin do?"
```

## Troubleshooting

If you encounter issues with the chat system, try the following:

1. **Verify Plugin Existence**: Check if the plugin exists with `/create/plugins`
2. **Create Plugin First**: If the plugin doesn't exist, create it first
3. **Check Property Names**: Ensure you're using `pluginName` (not `name`)
4. **Check Server Logs**: Look for error messages in the server logs
5. **Test with curl**: Try a simple curl request to isolate client vs. server issues

## Flow Diagram

```
Client Request
    │
    ▼
Validate Request Parameters
    │
    ├── Missing pluginName? ──► Return Error (400)
    │
    ▼
Check if Plugin Exists
    │
    ├── Plugin not found? ──► Return Error (404)
    │
    ▼
Classify Intent (info/modification)
    │
    ├── Classification error? ──► Use fallback classification
    │
    ▼
Process Request Based on Intent
    │
    ├── Processing error? ──► Return Error (500)
    │
    ▼
Return Response
```

## Best Practices

1. **Always Validate Input**: Check that both `message` and `pluginName` are provided
2. **List Plugins First**: Get available plugins first to ensure correct plugin names
3. **Handle Errors Gracefully**: Always check for and display error messages to users
4. **Use a Selection Dropdown**: Offer users a dropdown of available plugins instead of free-form text
5. **Provide Clear Feedback**: Show loading states and clear error messages

By following these guidelines, you can effectively use the chat system to interact with your Minecraft plugins.
