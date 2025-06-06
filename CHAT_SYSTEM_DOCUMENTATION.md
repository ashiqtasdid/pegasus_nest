# Chat System Documentation

## Overview

The Pegasus Nest Minecraft Plugin Generator includes an intelligent chat system that classifies user requests and routes them appropriately. The system determines whether user requests are for **information** (asking questions about plugins) or **modification** (requesting changes to plugin code) and handles each type differently.

## Architecture

### Core Components

1. **ChatClassificationService** - Classifies user intent using hybrid local + AI approach
2. **PluginChatService** - Main chat service that handles routing and responses
3. **GeminiService** - AI service supporting multiple models including DeepSeek
4. **CreateController** - Handles plugin creation and modification requests
5. **Supporting Services** - File operations, compilation, validation, etc.

### Classification Flow

```
User Input → ChatClassificationService → Intent Classification → Route to Handler
    ↓
[Local Quick Classification]
    ↓
[AI Classification if needed (DeepSeek)]
    ↓
[Route: "info" or "modification"]
```

## API Endpoints

### Chat Endpoint

**POST** `/create/chat`

#### Request Body

```json
{
  "message": "string",
  "pluginName": "string",
  "previousContext": "string (optional)"
}
```

#### Response Format

```json
{
  "response": "string",
  "pluginName": "string",
  "operations": [
    {
      "type": "create" | "modify" | "delete",
      "file": "string",
      "content": "string"
    }
  ],
  "compilationResult": {
    "success": boolean,
    "output": "string",
    "errors": "string[]"
  }
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

## Classification System

### Intent Types

1. **"info"** - User is asking for information about plugins
   - Examples: "What does this plugin do?", "How does the command work?", "Explain the configuration"
2. **"modification"** - User wants to modify plugin code
   - Examples: "Add a new command", "Change the welcome message", "Fix the bug in the teleport feature"

### Classification Process

#### 1. Quick Local Classification

- **Keyword Analysis**: Checks for modification keywords (add, change, fix, create, etc.)
- **Question Detection**: Identifies question patterns (what, how, why, etc.)
- **Linguistic Features**: Analyzes sentence structure and intent markers
- **Confidence Scoring**: Returns confidence level (0.0 - 1.0)

#### 2. AI Classification (Fallback)

- Uses **DeepSeek free model** for cost-effective classification
- Provides detailed analysis when local classification is uncertain
- Returns structured response with intent and confidence

### Classification Examples

```typescript
// High confidence local classification
"Add a new command called /heal" → "modification" (confidence: 0.9)
"What commands does this plugin have?" → "info" (confidence: 0.9)

// Requires AI classification
"I think there might be an issue with the player data" → AI → "modification" (confidence: 0.7)
```

## Request Handling

### Information Requests

When classified as "info":

1. **Context Gathering**: Reads existing plugin files and documentation
2. **AI Response Generation**: Uses AI to provide detailed, contextual answers
3. **Response Formatting**: Returns informational response without file operations

#### Info Response Flow

```
Info Request → Read Plugin Files → Generate AI Response → Return Info
```

### Modification Requests

When classified as "modification":

1. **Enhanced Processing**: Uses existing plugin creation/modification system
2. **File Operations**: Creates, modifies, or deletes files as needed
3. **Compilation**: Automatically compiles plugin after changes
4. **Documentation**: Updates plugin documentation

#### Modification Response Flow

```
Modification Request → Process Enhancement → File Operations → Compile → Return Results
```

## File Structure

### Generated Plugin Structure

```
generated/
  {PluginName}/
    src/
      main/
        java/
          com/
            example/
              {pluginname}/
                {PluginName}.java
        resources/
          plugin.yml
          config.yml
    docs/
      {PluginName}_documentation.txt
```

### Key Services Location

```
src/
  services/
    chat-classification.service.ts    # Intent classification
    plugin-chat.service.ts           # Main chat handler
    gemini.service.ts                # AI service
    create.service.ts                # Plugin creation logic
    file-compiler.service.ts         # File operations
    code-compiler.service.ts         # Java compilation
```

## Model Selection Strategy

The chat system uses a strategic approach to AI model selection for optimal cost-effectiveness and performance:

### Model Usage by Request Type

#### **Modification Requests** → Claude Sonnet 4

- **Model**: `anthropic/claude-sonnet-4`
- **Purpose**: High-quality code generation and file modifications
- **Why**: Superior coding capabilities, better understanding of complex requirements
- **Cost**: Premium model, used only for actual code generation

#### **Information Requests** → DeepSeek Free Prover v2

- **Model**: `deepseek/deepseek-prover-v2:free`
- **Purpose**: Answering questions about plugins, providing documentation
- **Why**: Cost-effective, good for explanatory responses
- **Cost**: Free model, ideal for informational queries

#### **Intent Classification** → DeepSeek Free Prover v2

- **Model**: `deepseek/deepseek-prover-v2:free`
- **Purpose**: Determining whether user wants info or modification
- **Why**: Classification doesn't require premium coding capabilities
- **Cost**: Free model, keeps classification costs minimal

### Cost Optimization Benefits

1. **80% Cost Reduction**: Using free models for classification and info requests
2. **Premium Quality**: Claude Sonnet 4 only for actual code generation
3. **Smart Routing**: Local classification first, AI only when needed
4. **Efficient Processing**: Quick responses for simple questions

## Configuration

### Environment Variables

```bash
# AI Service Configuration
OPENROUTER_API_KEY=your_openrouter_api_key  # For Claude Sonnet 4 and DeepSeek models

# Model Configuration
DEFAULT_MODEL=anthropic/claude-sonnet-4     # High-quality model for modifications
CLASSIFICATION_MODEL=deepseek/deepseek-prover-v2:free  # Free model for classification and info
```

### Supported AI Models

- **anthropic/claude-sonnet-4** (High-quality modification requests and code generation)
- **deepseek/deepseek-prover-v2:free** (Free model for info requests and classification)
- **deepseek/deepseek-chat** (Alternative free model for classification)
- **gemini-1.5-flash** (Legacy support)
- **gemini-1.5-pro** (Legacy support)

## Error Handling

### Classification Errors

- **Fallback to AI**: If local classification fails, uses AI classification
- **Default to Modification**: If all classification fails, assumes modification intent
- **User-Friendly Messages**: Provides helpful error messages to users

### Processing Errors

- **Compilation Errors**: Returns detailed error information with suggestions
- **File Operation Errors**: Handles file system errors gracefully
- **AI Service Errors**: Falls back to alternative models or cached responses

## Performance Features

### Optimization Strategies

1. **Local Classification First**: Avoids AI calls for obvious cases
2. **Caching**: Caches classification results for similar requests
3. **Free Model Usage**: Uses DeepSeek free model for classification to minimize costs
4. **Batch Operations**: Groups file operations for efficiency

### Monitoring

- **Response Times**: Tracks classification and processing times
- **Success Rates**: Monitors classification accuracy
- **Error Rates**: Tracks and logs errors for debugging

## Development Guidelines

### Adding New Intent Types

1. Update `ChatClassificationService.classifyUserIntent()`
2. Add keywords to quick classification
3. Create new handler method in `PluginChatService`
4. Update routing logic

### Testing Classification

```typescript
// Test in your development environment
const result = await chatClassificationService.classifyUserIntent(
  'your test message',
  'TestPlugin',
);
console.log(result); // { intent: "info" | "modification", confidence: number }
```

### Debugging

- Check logs in `/logs/` directory
- Enable debug mode in services
- Use health monitoring endpoints

## Frontend Integration Guide

### WebSocket Support (Future)

Currently uses REST API, but designed to support WebSocket upgrades:

```typescript
// Future WebSocket event structure
{
  type: 'chat_message',
  data: {
    message: string,
    pluginName: string,
    timestamp: string
  }
}
```

### State Management

Recommended state structure for frontend:

```typescript
interface ChatState {
  messages: ChatMessage[];
  currentPlugin: string;
  isLoading: boolean;
  error: string | null;
}

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  operations?: FileOperation[];
  compilationResult?: CompilationResult;
}
```

### API Integration Example

```typescript
// Frontend API call example
const sendChatMessage = async (message: string, pluginName: string) => {
  const response = await fetch('/create/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, pluginName }),
  });

  return await response.json();
};
```

## Security Considerations

- **Input Validation**: All inputs are validated and sanitized
- **File System Security**: Restricted file operations within plugin directories
- **AI Safety**: Content filtering and safety checks on AI responses
- **Rate Limiting**: API rate limiting to prevent abuse

## Future Enhancements

### Planned Features

1. **Multi-turn Conversations**: Context-aware conversation threading
2. **Plugin Templates**: Pre-built plugin templates for common use cases
3. **Real-time Collaboration**: Multiple users working on same plugin
4. **Advanced Classification**: Support for more granular intent types
5. **Plugin Marketplace Integration**: Connect with plugin sharing platforms

### Extensibility Points

- **Custom Classifiers**: Add domain-specific classification logic
- **New AI Models**: Easy integration of new AI providers
- **Custom File Operations**: Extend file operation types
- **Plugin Hooks**: Event-driven plugin modification hooks

## Conclusion

The chat system provides an intelligent, cost-effective way to interact with the Minecraft plugin generator. It combines local processing for efficiency with AI-powered classification and response generation for accuracy. The system is designed to be robust, scalable, and easy to extend for future requirements.

For frontend development, focus on creating an intuitive chat interface that can handle both informational responses and file operation results. The API is designed to be straightforward while providing all necessary information for rich user experiences.
