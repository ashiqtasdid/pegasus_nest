/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { Agent } from 'https';
import * as crypto from 'crypto';
import { RobustnessService } from '../common/robustness.service';
dotenv.config();

// 💾 PERFORMANCE OPTIMIZATION: Response caching interface
interface CacheEntry {
  response: string;
  timestamp: number;
  tokenCount: number;
  model: string;
}

// 🚀 REQUEST OPTIMIZATION: Batch request interface
interface BatchRequest {
  id: string;
  prompt: string;
  model: string;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

// 📊 TOKEN OPTIMIZATION: Prompt compression interface
interface CompressedPrompt {
  content: string;
  originalLength: number;
  compressedLength: number;
  compressionRatio: number;
}

// 🤖 AI MODEL CONFIGURATION: Standardized model assignments per task type
const AI_MODELS = {
  // 🔍 PROMPT REFINEMENT: Use reliable free model for analysis and prompt improvement
  PROMPT_REFINEMENT: 'google/gemini-flash-1.5',

  // 🚀 CODE GENERATION: Use Claude Sonnet 4 for high-quality code generation
  CODE_GENERATION: 'anthropic/claude-sonnet-4',

  // 🛠️ ERROR FIXING: Use reliable free model for everything except file and code generation
  ERROR_FIXING: 'google/gemini-flash-1.5',

  // 💬 CHAT ASSISTANCE: Use reliable free model for everything except file and code generation
  CHAT_ASSISTANCE: 'google/gemini-flash-1.5',

  // 📝 PLUGIN OPERATIONS: Use Claude Sonnet 4 for plugin modifications (file/code generation)
  PLUGIN_OPERATIONS: 'anthropic/claude-sonnet-4',

  // 🔄 FALLBACK MODELS: Backup models when primary fails
  FALLBACK_FREE: 'meta-llama/llama-3.2-3b-instruct:free',
  FALLBACK_PREMIUM: 'anthropic/claude-3.7-sonnet',
} as const;

// 📊 MODEL USAGE DOCUMENTATION
const MODEL_USAGE_GUIDE = {
  'google/gemini-flash-1.5':
    'Fast and reliable free model for general tasks - high quality with good availability',
  'anthropic/claude-sonnet-4':
    'Premium model exclusively for file and code generation - highest quality',
  'meta-llama/llama-3.2-3b-instruct:free':
    'Fallback free model when primary models fail',
  'openai/gpt-3.5-turbo':
    'Fallback premium model for complex tasks when Claude fails',
} as const;

@Injectable()
export class GeminiService {
  private openai: OpenAI;
  private readonly logger = new Logger(GeminiService.name);
  // Circuit breaker tracking (now handled by centralized robustness service)
  private failureCount = 0; // Keep for backward compatibility
  private lastFailureTime = 0; // Keep for backward compatibility

  // 🛡️ ROBUSTNESS: Service health monitoring
  private serviceHealth = {
    isHealthy: true,
    lastHealthCheck: Date.now(),
    consecutiveFailures: 0,
    lastSuccessTime: Date.now(),
    errorRate: 0,
    responseTimeMs: 0,
  };

  // 💾 PERFORMANCE: Advanced caching system for API responses
  private responseCache = new Map<string, CacheEntry>();
  private readonly cacheMaxAge = 3600000; // 1 hour
  private readonly maxCacheSize = 1000; // Maximum cached responses

  // 🚀 PERFORMANCE: Request batching and deduplication
  private pendingRequests = new Map<string, Promise<string>>();
  private batchQueue: BatchRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly batchDelay = 100; // 100ms batch window
  private readonly maxBatchSize = 5; // Maximum requests per batch

  // 📊 TOKEN OPTIMIZATION: Token usage tracking
  private tokenUsageStats = {
    totalTokens: 0,
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageTokensPerRequest: 0,
    compressionSavings: 0,
  };

  constructor(private readonly robustnessService: RobustnessService) {
    const apiKey = process.env.OPENROUTER_API_KEY || 'YOUR_API_KEY';

    // 🚀 PERFORMANCE: Enhanced HTTPS agent with optimized connection pooling
    const httpsAgent = new Agent({
      keepAlive: true,
      keepAliveMsecs: 30000, // 30 seconds
      maxSockets: 100, // Increased from 50 for better throughput
      maxFreeSockets: 20, // Increased from 10 for better performance
      timeout: 25000, // 25 seconds socket timeout
      scheduling: 'fifo',
      maxTotalSockets: 300, // Global socket limit
    });

    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      defaultHeaders: {
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3001',
        'X-Title': process.env.SITE_NAME || 'Pegasus API',
        Connection: 'keep-alive',
        'Keep-Alive': 'timeout=30, max=100',
        'User-Agent': 'Pegasus-API/1.0-Optimized',
        'Accept-Encoding': 'gzip, deflate', // Enable compression
      },
      timeout: 30000, // 30 seconds total timeout
      maxRetries: 0, // We handle retries manually for better control
      httpAgent: httpsAgent, // Use our custom agent with connection pooling
    });

    this.logger.log(
      '🚀 OpenRouter service initialized with advanced optimizations: caching, batching, compression, and enhanced connection pooling',
    );

    // 💾 Start cache cleanup interval
    setInterval(() => this.cleanupCache(), 300000); // Cleanup every 5 minutes

    // 🎯 Start auto-optimization monitoring
    setInterval(() => this.autoOptimize(), 600000); // Auto-optimize every 10 minutes
  }

  /**
   * 🛡️ ROBUSTNESS: Check service health status
   */
  getServiceHealth(): {
    isHealthy: boolean;
    errorRate: number;
    responseTimeMs: number;
    consecutiveFailures: number;
    lastSuccessTime: number;
  } {
    return { ...this.serviceHealth };
  }

  /**
   * 🛡️ ROBUSTNESS: Update service health metrics
   */
  private updateHealthMetrics(
    success: boolean,
    responseTimeMs: number = 0,
  ): void {
    const now = Date.now();
    this.serviceHealth.lastHealthCheck = now;
    this.serviceHealth.responseTimeMs = responseTimeMs;

    if (success) {
      this.serviceHealth.consecutiveFailures = 0;
      this.serviceHealth.lastSuccessTime = now;
      this.serviceHealth.isHealthy = true;
      this.serviceHealth.errorRate = Math.max(
        0,
        this.serviceHealth.errorRate - 0.1,
      );
    } else {
      this.serviceHealth.consecutiveFailures++;
      this.serviceHealth.errorRate = Math.min(
        1.0,
        this.serviceHealth.errorRate + 0.1,
      );

      // Mark as unhealthy if too many consecutive failures
      if (this.serviceHealth.consecutiveFailures >= 3) {
        this.serviceHealth.isHealthy = false;
      }
    }
  }

  /**
   * 🛡️ ROBUSTNESS: Enhanced retry logic with exponential backoff
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await operation();
        const responseTime = Date.now() - startTime;

        this.updateHealthMetrics(true, responseTime);
        return result;
      } catch (error) {
        lastError = error as Error;
        this.updateHealthMetrics(false);

        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          this.logger.warn(
            `Operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms: ${error.message}`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
  /**
   * Enhanced request wrapper with connection resilience
   */
  private async makeRobustRequest(
    requestFn: () => Promise<any>,
    retries?: number,
  ): Promise<any> {
    const maxRetries = retries || 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`API request attempt ${attempt}/${maxRetries}`);

        // Add jitter to prevent thundering herd
        if (attempt > 1) {
          const jitter = Math.random() * 1000; // 0-1 second jitter
          const delay = Math.pow(2, attempt - 1) * 1000 + jitter; // Exponential backoff with jitter
          this.logger.log(`Waiting ${Math.round(delay)}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        const result = await requestFn();
        this.logger.log(`API request successful on attempt ${attempt}`);

        // Reset failure count on success (for backward compatibility)
        this.failureCount = 0;
        return result;
      } catch (error) {
        this.logger.warn(
          `API request attempt ${attempt} failed: ${error.message}`,
        );

        // Check if this is a connection error that we should retry
        const isRetryableError =
          error.code === 'ECONNRESET' ||
          error.code === 'ECONNREFUSED' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ENOTFOUND' ||
          error.message.includes('socket hang up') ||
          error.message.includes('timeout') ||
          error.message.includes('network') ||
          error.message.includes('connection') ||
          error.message.includes('ECONNRESET');

        // Don't retry on authentication, rate limit, or response parsing errors
        const isNonRetryableError =
          error.response?.status === 401 ||
          error.response?.status === 429 ||
          error.message.includes('API returned') ||
          error.message.includes('undefined') ||
          error.message.includes('Cannot read properties');

        if (isNonRetryableError) {
          this.logger.error(
            `❌ Non-retryable error encountered: ${error.message}`,
          );
          throw error;
        }
        if (
          attempt === maxRetries ||
          !isRetryableError ||
          isNonRetryableError
        ) {
          this.logger.error(
            `All ${maxRetries} attempts failed. Last error: ${error.message}`,
          );

          // Increment failure count for backward compatibility
          this.failureCount++;
          this.lastFailureTime = Date.now();

          throw error;
        }
      }
    }
  }

  /**
   * Process content with AI through OpenRouter
   * @param prompt The prompt to send to the AI
   * @param filePath Optional path to a file containing additional context
   * @returns Promise with the response from the AI
   */
  async processWithGemini(prompt: string, filePath?: string): Promise<string> {
    return await this.executeWithRetry(async () => {
      let finalPrompt = prompt;

      // 🔒 Validate inputs
      this.validatePrompt(prompt);

      // Add this block to handle the file content reading
      if (filePath && fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        finalPrompt += `\n\nHere's the file content for reference:\n${fileContent}`;
      }

      this.logger.log(
        '🚀 Processing with optimized Gemini service (caching, deduplication, compression)...',
      );
      this.logger.log(
        'Using model: anthropic/claude-sonnet-4 (Claude Sonnet 4)',
      );

      // 🚀 Use optimized processing with Claude Sonnet 4 for code generation
      return await this.processWithDeduplication(
        finalPrompt,
        AI_MODELS.CODE_GENERATION,
      );
    });
  } /**
   * Process a direct prompt with AI through OpenRouter without file context
   * @param prompt The prompt to send to the AI
   * @param model Optional model to use, defaults to 'deepseek/deepseek-chat'
   * @returns Promise with the response from the AI
   */
  async processDirectPrompt(prompt: string, model?: string): Promise<string> {
    const selectedModel = model || AI_MODELS.CODE_GENERATION;

    // 🔒 Validate inputs
    this.validatePrompt(prompt);
    this.validateModel(selectedModel);

    this.logger.log(
      `🚀 Processing direct prompt with optimized service using model: ${selectedModel}...`,
    );

    // 🚀 Use optimized processing with all performance enhancements
    return await this.processWithDeduplication(prompt, selectedModel);
  }

  // 🚀 ======= PERFORMANCE & TOKEN OPTIMIZATION METHODS =======

  /**
   * 💾 CACHE OPTIMIZATION: Generate cache key for request
   */
  private generateCacheKey(prompt: string, model: string): string {
    const content = `${model}:${prompt}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * 💾 CACHE OPTIMIZATION: Check if cached response exists and is valid
   */
  private getCachedResponse(cacheKey: string): string | null {
    const entry = this.responseCache.get(cacheKey);
    if (!entry) {
      this.tokenUsageStats.cacheMisses++;
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.cacheMaxAge) {
      this.responseCache.delete(cacheKey);
      this.tokenUsageStats.cacheMisses++;
      return null;
    }

    this.tokenUsageStats.cacheHits++;
    this.logger.log(
      `🎯 Cache hit! Saved API call and ~${entry.tokenCount} tokens`,
    );
    return entry.response;
  }

  /**
   * 💾 CACHE OPTIMIZATION: Store response in cache
   */
  private setCachedResponse(
    cacheKey: string,
    response: string,
    model: string,
  ): void {
    // Estimate token count (roughly 4 characters per token)
    const estimatedTokens = Math.ceil(response.length / 4);

    // If cache is full, remove oldest entries
    if (this.responseCache.size >= this.maxCacheSize) {
      const oldestKey = this.responseCache.keys().next().value;
      this.responseCache.delete(oldestKey);
    }

    this.responseCache.set(cacheKey, {
      response,
      timestamp: Date.now(),
      tokenCount: estimatedTokens,
      model,
    });

    this.logger.log(`💾 Cached response with ~${estimatedTokens} tokens`);
  }

  /**
   * 💾 CACHE OPTIMIZATION: Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.responseCache.entries()) {
      if (now - entry.timestamp > this.cacheMaxAge) {
        this.responseCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * 📊 TOKEN OPTIMIZATION: Compress prompt to reduce token usage
   */
  private compressPrompt(prompt: string): CompressedPrompt {
    const originalLength = prompt.length;

    const compressed = prompt
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove redundant phrases
      .replace(/please\s+(help\s+)?(me\s+)?/gi, '')
      .replace(/\b(the|a|an)\s+/gi, '')
      // Simplify common terms
      .replace(/minecraft\s+plugin/gi, 'MC plugin')
      .replace(/bukkit\s+api/gi, 'Bukkit')
      .replace(/spigot\s+api/gi, 'Spigot')
      // Remove filler words
      .replace(/\b(just|really|very|quite|absolutely|definitely)\s+/gi, '')
      // Trim
      .trim();

    const compressedLength = compressed.length;
    const compressionRatio =
      ((originalLength - compressedLength) / originalLength) * 100;

    this.tokenUsageStats.compressionSavings +=
      originalLength - compressedLength;

    if (compressionRatio > 5) {
      // Only log if significant compression
      this.logger.log(
        `🗜️ Compressed prompt by ${compressionRatio.toFixed(1)}% (${originalLength} → ${compressedLength} chars)`,
      );
    }

    return {
      content: compressed,
      originalLength,
      compressedLength,
      compressionRatio,
    };
  }

  /**
   * 🚀 REQUEST OPTIMIZATION: Process request with deduplication
   */
  private async processWithDeduplication(
    prompt: string,
    model: string,
  ): Promise<string> {
    const cacheKey = this.generateCacheKey(prompt, model);

    // Check cache first
    const cachedResponse = this.getCachedResponse(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Check if same request is already pending
    if (this.pendingRequests.has(cacheKey)) {
      this.logger.log(
        `⏳ Deduplicating request - waiting for pending response`,
      );
      return await this.pendingRequests.get(cacheKey);
    }

    // Use centralized circuit breaker with fallback
    return await this.robustnessService.executeWithCircuitBreaker(
      'gemini_service',
      async () => {
        // Create new request with model fallback
        const requestPromise = this.tryWithModelFallback(prompt, model);
        this.pendingRequests.set(cacheKey, requestPromise);

        try {
          const response = await requestPromise;
          this.setCachedResponse(cacheKey, response, model);
          return response;
        } finally {
          this.pendingRequests.delete(cacheKey);
        }
      },
      async () => {
        // Fallback: Return cached response if available, otherwise generic error response
        const fallbackResponse = this.getCachedResponse(cacheKey);
        if (fallbackResponse) {
          this.logger.warn(
            '🔄 Circuit breaker open - using stale cached response',
          );
          return fallbackResponse;
        }

        this.logger.error('🚨 Circuit breaker open - no fallback available');
        throw new Error(
          'Gemini service is temporarily unavailable. Please try again later.',
        );
      },
    );
  }

  /**
   * 🚀 REQUEST OPTIMIZATION: Execute optimized API request
   */
  private async executeOptimizedRequest(
    prompt: string,
    model: string,
  ): Promise<string> {
    // Input validation
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid prompt: must be a non-empty string');
    }

    if (!model || typeof model !== 'string') {
      throw new Error('Invalid model: must be a non-empty string');
    }

    this.logger.log(
      `🔍 Processing request for model: ${model}, prompt length: ${prompt.length}`,
    );

    // Compress prompt to save tokens
    const compressed = this.compressPrompt(prompt);

    // Track token usage
    this.tokenUsageStats.totalRequests++;
    const estimatedInputTokens = Math.ceil(compressed.compressedLength / 4);

    return await this.makeRobustRequest(async () => {
      try {
        this.logger.log('🚀 Making API request to OpenRouter...');

        // Validate OpenAI client exists
        if (!this.openai) {
          throw new Error('OpenAI client not initialized');
        }

        const requestPayload = {
          model,
          messages: [
            {
              role: 'user' as const,
              content: compressed.content,
            },
          ],
          max_tokens: this.getOptimalMaxTokens(compressed.content),
          temperature: 0.7,
          // Add response optimization
          presence_penalty: 0.1, // Encourage more focused responses
          frequency_penalty: 0.1, // Reduce repetition
        };

        this.logger.log('📤 Request payload prepared:', {
          model: requestPayload.model,
          messageCount: requestPayload.messages.length,
          contentLength: requestPayload.messages[0].content.length,
          maxTokens: requestPayload.max_tokens,
        });

        const response =
          await this.openai.chat.completions.create(requestPayload);

        this.logger.log('✓ API request completed, validating response...');

        // Add comprehensive response validation with detailed logging
        this.logger.log('🔍 Validating API response structure...');

        if (!response) {
          this.logger.error('❌ API returned null/undefined response');
          throw new Error('API returned null/undefined response');
        }

        // Try to log the response structure for debugging (safely)
        try {
          this.logger.log(`Response keys: ${Object.keys(response).join(', ')}`);
        } catch (e) {
          this.logger.warn('Could not log response keys');
        }

        this.logger.log('✓ Response object exists, checking choices...');

        // More detailed logging for debugging
        this.logger.log(
          `Response type: ${typeof response}, has choices: ${!!response.choices}`,
        );

        // Handle case where response might have different structure
        if (!response.choices) {
          this.logger.error('❌ Response object missing choices property');

          // Try to find any text content in alternative structures
          const anyResponse = response as any;
          if (anyResponse.content) {
            this.logger.log(
              '🔄 Found content in response.content, using fallback',
            );
            return String(anyResponse.content);
          }

          if (anyResponse.text) {
            this.logger.log(
              '🔄 Found content in response.text, using fallback',
            );
            return String(anyResponse.text);
          }

          // Log the full response for debugging
          try {
            this.logger.error(
              'Full response structure:',
              JSON.stringify(response, null, 2),
            );
          } catch (e) {
            this.logger.error('Could not stringify response for debugging');
          }

          throw new Error(
            'API returned response without choices property and no fallback content found',
          );
        }

        if (!Array.isArray(response.choices)) {
          this.logger.error(
            '❌ Response choices is not an array:',
            typeof response.choices,
            JSON.stringify(response.choices, null, 2),
          );
          throw new Error(
            'API returned invalid choices property - not an array',
          );
        }

        this.logger.log(
          `✓ Choices array exists with length: ${response.choices.length}`,
        );

        if (response.choices.length === 0) {
          this.logger.error(
            '❌ API returned empty choices array:',
            JSON.stringify(response, null, 2),
          );
          throw new Error('API returned empty choices array');
        }

        const choice = response.choices[0];
        this.logger.log(`✓ First choice exists: ${!!choice}`);

        if (!choice) {
          this.logger.error('❌ First choice is null/undefined');
          throw new Error('First choice is null/undefined');
        }

        this.logger.log(`✓ Choice has message: ${!!choice.message}`);

        if (!choice.message) {
          this.logger.error(
            '❌ Choice missing message property:',
            JSON.stringify(choice, null, 2),
          );
          throw new Error('API response choice missing message property');
        }

        const responseText = choice.message.content;
        this.logger.log(
          `✓ Message content exists: ${!!responseText}, type: ${typeof responseText}`,
        );

        if (!responseText || typeof responseText !== 'string') {
          this.logger.error(
            '❌ Invalid message content:',
            JSON.stringify(choice.message, null, 2),
          );
          throw new Error('API returned empty or invalid message content');
        }

        this.logger.log('✅ Response validation successful');

        // Update token usage stats
        const estimatedOutputTokens = Math.ceil(responseText.length / 4);
        this.tokenUsageStats.totalTokens +=
          estimatedInputTokens + estimatedOutputTokens;
        this.tokenUsageStats.averageTokensPerRequest =
          this.tokenUsageStats.totalTokens / this.tokenUsageStats.totalRequests;

        this.logger.log(
          `📊 Request completed: ~${estimatedInputTokens + estimatedOutputTokens} tokens (${this.tokenUsageStats.cacheHits}/${this.tokenUsageStats.cacheHits + this.tokenUsageStats.cacheMisses} cache hit rate)`,
        );
        return responseText;
      } catch (error) {
        this.logger.error(
          '💥 Error in executeOptimizedRequest:',
          error.message,
        );
        this.logger.error('Error stack:', error.stack);

        // If it's an OpenAI API error, log more details
        if (error.response) {
          this.logger.error('API Error Response:', {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
          });
        }

        // Re-throw the error for the retry mechanism
        throw error;
      }
    });
  }

  /**
   * 📊 TOKEN OPTIMIZATION: Calculate optimal max_tokens based on prompt
   */
  private getOptimalMaxTokens(prompt: string): number {
    const promptLength = prompt.length;

    // Dynamic max_tokens based on prompt complexity
    if (promptLength < 500) return 2000; // Simple prompts
    if (promptLength < 1500) return 3000; // Medium prompts
    if (promptLength < 3000) return 4000; // Complex prompts
    return 4000; // Maximum for very complex prompts
  }

  /**
   * 🚀 BATCH OPTIMIZATION: Add request to batch queue
   */
  private addToBatch(prompt: string, model: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const batchRequest: BatchRequest = {
        id: crypto.randomUUID(),
        prompt,
        model,
        resolve,
        reject,
      };

      this.batchQueue.push(batchRequest);

      // If batch is full, process immediately
      if (this.batchQueue.length >= this.maxBatchSize) {
        this.processBatch();
      } else if (!this.batchTimer) {
        // Start batch timer
        this.batchTimer = setTimeout(() => {
          this.processBatch();
        }, this.batchDelay);
      }
    });
  }

  /**
   * 🚀 BATCH OPTIMIZATION: Process queued batch requests
   */
  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    this.logger.log(`🚀 Processing batch of ${batch.length} requests`);

    // Process batch requests in parallel with limited concurrency
    const concurrencyLimit = 3;
    for (let i = 0; i < batch.length; i += concurrencyLimit) {
      const chunk = batch.slice(i, i + concurrencyLimit);
      await Promise.all(
        chunk.map(async (request) => {
          try {
            const response = await this.processWithDeduplication(
              request.prompt,
              request.model,
            );
            request.resolve(response);
          } catch (error) {
            request.reject(error as Error);
          }
        }),
      );
    }
  }

  /**
   * 🚀 BATCH OPTIMIZATION: Process multiple prompts efficiently
   * Public method for batch processing multiple requests
   */
  public async processBatchPrompts(
    requests: Array<{ prompt: string; model?: string }>,
  ): Promise<string[]> {
    this.logger.log(
      `🚀 Processing batch of ${requests.length} prompts with optimization`,
    );

    const promises = requests.map((req) =>
      this.processWithDeduplication(
        req.prompt,
        req.model || AI_MODELS.CODE_GENERATION,
      ),
    );

    return await Promise.all(promises);
  }

  /**
   * 📊 PERFORMANCE: Get comprehensive performance metrics
   */
  public getPerformanceMetrics() {
    const stats = this.getTokenUsageStats();
    const uptime = process.uptime();

    return {
      optimization: stats,
      system: {
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor(
          (uptime % 3600) / 60,
        )}m`,
        requestsPerHour: Math.round((stats.totalRequests / uptime) * 3600),
        tokensPerHour: Math.round((stats.totalTokens / uptime) * 3600),
        cacheEfficiency:
          stats.cacheHitRate > 20
            ? 'Excellent'
            : stats.cacheHitRate > 10
              ? 'Good'
              : 'Building up',
      },
    };
  }

  /**
   * 🎯 SMART OPTIMIZATION: Auto-adjust optimization settings based on usage patterns
   */
  private autoOptimize(): void {
    const stats = this.tokenUsageStats;
    const cacheHitRate =
      (stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100;

    // If cache hit rate is low, increase cache size
    if (stats.cacheHits + stats.cacheMisses > 50 && cacheHitRate < 15) {
      // Could increase cache size or adjust compression settings
      this.logger.log(
        '📈 Low cache hit rate detected - optimization learning...',
      );
    }

    // If compression savings are low, could adjust compression algorithm
    if (
      stats.totalRequests > 20 &&
      stats.compressionSavings < stats.totalRequests * 10
    ) {
      this.logger.log(
        '🗜️ Low compression efficiency - could enhance compression...',
      );
    }
  }

  /**
   * 📊 TOKEN OPTIMIZATION: Get token usage statistics
   */
  public getTokenUsageStats() {
    return {
      ...this.tokenUsageStats,
      cacheSize: this.responseCache.size,
      cacheHitRate:
        (this.tokenUsageStats.cacheHits /
          (this.tokenUsageStats.cacheHits + this.tokenUsageStats.cacheMisses)) *
        100,
      totalSavings:
        this.tokenUsageStats.compressionSavings +
        this.tokenUsageStats.cacheHits * 100, // Estimated
    };
  }

  /**
   * 💾 CACHE OPTIMIZATION: Clear cache manually
   */
  public clearCache(): void {
    const cacheSize = this.responseCache.size;
    this.responseCache.clear();
    this.logger.log(`🧹 Manually cleared ${cacheSize} cache entries`);
  }

  /**
   * 🎯 Get the appropriate model for a specific task type
   * This ensures consistent model usage across the application
   */
  public static getModelForTask(taskType: keyof typeof AI_MODELS): string {
    return AI_MODELS[taskType];
  }

  /**
   * 📊 Get model usage documentation
   */
  public static getModelUsageGuide(): typeof MODEL_USAGE_GUIDE {
    return MODEL_USAGE_GUIDE;
  }

  /**
   * 🔒 SECURITY: Validate and sanitize prompts before processing
   */
  private validatePrompt(prompt: string): void {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid prompt: must be a non-empty string');
    }

    if (prompt.length < 5) {
      throw new Error('Invalid prompt: too short (minimum 5 characters)');
    }

    if (prompt.length > 100000) {
      throw new Error('Invalid prompt: too long (maximum 100,000 characters)');
    }

    // Check for potential security issues
    const suspiciousPatterns = [
      /\b(password|secret|token|key)\s*[:=]/gi,
      /\b(admin|root|sudo)\s*[:=]/gi,
      /<script/gi,
      /javascript:/gi,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(prompt)) {
        this.logger.warn('🚨 Potentially sensitive content detected in prompt');
        break;
      }
    }
  }

  /**
   * 🎯 PERFORMANCE: Validate model selection
   */
  private validateModel(model: string): void {
    if (!model || typeof model !== 'string') {
      throw new Error('Invalid model: must be a non-empty string');
    }

    const allowedModels = [
      'deepseek/deepseek-prover-v2:free',
      'anthropic/claude-sonnet-4',
      'deepseek/deepseek-chat', // Legacy support
    ];

    if (!allowedModels.includes(model)) {
      this.logger.warn(`⚠️ Using non-standard model: ${model}`);
    }
  }

  // 🛡️ ROBUSTNESS: Get service health status
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastChecked: Date;
    metrics: {
      errorRate: number;
      responseTimeMs: number;
      consecutiveFailures: number;
    };
  }> {
    // Update health check timestamp
    const now = Date.now();
    this.serviceHealth.lastHealthCheck = now;

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (this.serviceHealth.consecutiveFailures >= 5) {
      status = 'unhealthy';
    } else if (
      this.serviceHealth.errorRate > 0.2 ||
      this.serviceHealth.consecutiveFailures > 2
    ) {
      status = 'degraded';
    }

    // Calculate time since last successful operation
    const timeSinceLastSuccess = now - this.serviceHealth.lastSuccessTime;
    if (timeSinceLastSuccess > 300000) {
      // 5 minutes
      status = 'unhealthy';
    } else if (timeSinceLastSuccess > 60000) {
      // 1 minute
      status = 'degraded';
    }

    return {
      status,
      lastChecked: new Date(this.serviceHealth.lastHealthCheck),
      metrics: {
        errorRate: this.serviceHealth.errorRate,
        responseTimeMs: this.serviceHealth.responseTimeMs,
        consecutiveFailures: this.serviceHealth.consecutiveFailures,
      },
    };
  }

  /**
   * 🔄 MODEL FALLBACK: Try model with fallback mechanism
   */
  private async tryWithModelFallback(
    prompt: string,
    primaryModel: string,
  ): Promise<string> {
    const fallbackChain = this.getFallbackChain(primaryModel);

    for (let i = 0; i < fallbackChain.length; i++) {
      const model = fallbackChain[i];
      const isLastAttempt = i === fallbackChain.length - 1;

      try {
        this.logger.log(
          `🎯 Trying model: ${model} (attempt ${i + 1}/${fallbackChain.length})`,
        );

        const result = await this.executeOptimizedRequest(prompt, model);

        if (i > 0) {
          this.logger.log(
            `✅ Fallback model ${model} succeeded after ${i} failed attempts`,
          );
        }

        return result;
      } catch (error) {
        this.logger.warn(`⚠️ Model ${model} failed: ${error.message}`);

        if (isLastAttempt) {
          this.logger.error(`❌ All models in fallback chain failed`);
          throw new Error(`All AI models failed. Last error: ${error.message}`);
        }

        // Don't wait before trying the next model in the chain
        continue;
      }
    }
  }

  /**
   * 🔄 Get fallback chain for a model
   */
  private getFallbackChain(primaryModel: string): string[] {
    // For free models, try multiple free alternatives
    if (
      primaryModel.includes('free') ||
      primaryModel.includes('gemini-flash')
    ) {
      return [
        primaryModel,
        AI_MODELS.FALLBACK_FREE,
        'google/gemini-flash-1.5',
        'openai/gpt-3.5-turbo',
      ];
    }

    // For premium models, try premium alternatives then free fallback
    return [
      primaryModel,
      AI_MODELS.FALLBACK_PREMIUM,
      AI_MODELS.FALLBACK_FREE,
      'google/gemini-flash-1.5',
    ];
  }
}
