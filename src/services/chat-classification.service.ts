/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from './gemini.service';

// Chat classification types
export type ChatIntentType = 'info' | 'modification';

export interface ChatClassificationResult {
  intent: ChatIntentType;
  confidence: number;
  reasoning: string;
  extractedFeatures?: {
    hasActionWords: boolean;
    hasQuestionWords: boolean;
    hasModificationKeywords: boolean;
    hasInformationalKeywords: boolean;
  };
}

@Injectable()
export class ChatClassificationService {
  private readonly logger = new Logger(ChatClassificationService.name);

  constructor(private readonly geminiService: GeminiService) {}

  /**
   * Classifies a user's chat message to determine if they want information or modification
   * Uses DeepSeek free model for cost-effective classification
   */
  async classifyUserIntent(
    message: string,
    pluginName: string,
    pluginContext?: string,
  ): Promise<ChatClassificationResult> {
    this.logger.log(
      `Classifying user intent for plugin "${pluginName}": "${message.substring(0, 100)}..."`,
    );

    try {
      // First, do a quick local analysis for obvious cases
      const quickClassification = this.performQuickClassification(message);
      if (quickClassification.confidence > 0.8) {
        this.logger.log(
          `Quick classification succeeded with high confidence: ${quickClassification.intent}`,
        );
        return quickClassification;
      }

      // Use AI for more complex cases
      const aiClassification = await this.performAIClassification(
        message,
        pluginName,
        pluginContext,
      );

      this.logger.log(
        `Classification result: ${aiClassification.intent} (confidence: ${aiClassification.confidence})`,
      );

      return aiClassification;
    } catch (error) {
      this.logger.error(`Classification failed: ${error.message}`);

      // Fallback to safe default (info) when classification fails
      return {
        intent: 'info',
        confidence: 0.5,
        reasoning:
          'Classification failed, defaulting to informational response',
      };
    }
  }

  /**
   * Performs quick local classification based on keywords and patterns
   */
  private performQuickClassification(
    message: string,
  ): ChatClassificationResult {
    const lowerMessage = message.toLowerCase().trim();

    // Extract features
    const features = this.extractFeatures(lowerMessage);

    // Strong modification indicators
    const strongModificationWords = [
      'add',
      'remove',
      'delete',
      'change',
      'modify',
      'update',
      'fix',
      'create',
      'implement',
      'build',
      'make',
      'include',
      'exclude',
      'replace',
      'enhance',
      'improve',
      'optimize',
      'refactor',
      'extend',
      'customize',
      'configure',
      'enable',
      'disable',
      'toggle',
      'adjust',
      'tweak',
      'revise',
    ];

    // Strong informational indicators
    const strongInfoWords = [
      'what',
      'how',
      'why',
      'when',
      'where',
      'which',
      'who',
      'explain',
      'describe',
      'tell me',
      'show me',
      'list',
      'display',
      'view',
      'see',
      'check',
      'find',
      'search',
      'look',
      'help',
      'info',
      'information',
      'documentation',
      'guide',
      'tutorial',
      'example',
      'demo',
    ];

    // Check for strong indicators
    const hasStrongModification = strongModificationWords.some((word) =>
      lowerMessage.includes(word),
    );

    const hasStrongInfo = strongInfoWords.some((word) =>
      lowerMessage.includes(word),
    );

    // High confidence classification
    if (hasStrongModification && !hasStrongInfo) {
      return {
        intent: 'modification',
        confidence: 0.9,
        reasoning:
          'Contains strong modification keywords without informational keywords',
        extractedFeatures: features,
      };
    }

    if (hasStrongInfo && !hasStrongModification) {
      return {
        intent: 'info',
        confidence: 0.9,
        reasoning:
          'Contains strong informational keywords without modification keywords',
        extractedFeatures: features,
      };
    }

    // Medium confidence based on sentence structure
    if (lowerMessage.includes('?') && hasStrongInfo) {
      return {
        intent: 'info',
        confidence: 0.8,
        reasoning: 'Question format with informational keywords',
        extractedFeatures: features,
      };
    }

    // Patterns that suggest modification
    const modificationPatterns = [
      /can you (add|remove|change|modify|update|fix|create|implement|make)/,
      /i want to (add|remove|change|modify|update|fix|create|implement|make)/,
      /i need to (add|remove|change|modify|update|fix|create|implement|make)/,
      /please (add|remove|change|modify|update|fix|create|implement|make)/,
      /could you (add|remove|change|modify|update|fix|create|implement|make)/,
    ];

    for (const pattern of modificationPatterns) {
      if (pattern.test(lowerMessage)) {
        return {
          intent: 'modification',
          confidence: 0.85,
          reasoning: 'Matches modification request pattern',
          extractedFeatures: features,
        };
      }
    }

    // Default to lower confidence, requiring AI classification
    return {
      intent: features.hasModificationKeywords ? 'modification' : 'info',
      confidence: 0.4,
      reasoning: 'Unclear intent, requires AI analysis',
      extractedFeatures: features,
    };
  }

  /**
   * Extracts linguistic features from the message
   */
  private extractFeatures(message: string) {
    return {
      hasActionWords:
        /\b(add|remove|change|modify|update|fix|create|implement|make|include|exclude|replace|enhance|improve|optimize|refactor|extend|customize|configure|enable|disable|toggle|adjust|tweak|revise)\b/i.test(
          message,
        ),
      hasQuestionWords:
        /\b(what|how|why|when|where|which|who|can|could|would|should|is|are|does|do|did|will)\b/i.test(
          message,
        ),
      hasModificationKeywords:
        /\b(code|function|feature|command|event|listener|config|permission|yml|java|class|method|plugin\.yml|config\.yml)\b/i.test(
          message,
        ),
      hasInformationalKeywords:
        /\b(explain|describe|tell|show|list|display|view|see|check|find|search|look|help|info|information|documentation|guide|tutorial|example|demo|about|details)\b/i.test(
          message,
        ),
    };
  }

  /**
   * Uses AI to classify more complex or ambiguous messages
   */
  private async performAIClassification(
    message: string,
    pluginName: string,
    pluginContext?: string,
  ): Promise<ChatClassificationResult> {
    const classificationPrompt = this.createClassificationPrompt(
      message,
      pluginName,
      pluginContext,
    );

    try {
      // Use DeepSeek free model for classification
      const response = await this.geminiService.processDirectPrompt(
        classificationPrompt,
        'deepseek/deepseek-prover-v2:free',
      );

      return this.parseAIClassificationResponse(response);
    } catch (error) {
      this.logger.error(`AI classification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Creates a structured prompt for AI classification
   */
  private createClassificationPrompt(
    message: string,
    pluginName: string,
    pluginContext?: string,
  ): string {
    return `
You are an expert at understanding user intent for Minecraft plugin interactions. 

Your task is to classify whether the user wants:
1. "info" - They want information, explanations, or help about the plugin
2. "modification" - They want to modify, change, or update the plugin code

PLUGIN: ${pluginName}
USER MESSAGE: "${message}"

${pluginContext ? `PLUGIN CONTEXT: ${pluginContext.substring(0, 1000)}...` : ''}

CLASSIFICATION RULES:
- "info": Questions, requests for explanations, help, documentation, how-to guides, examples
- "modification": Requests to add features, change code, fix bugs, update functionality, modify files

RESPONSE FORMAT (JSON only):
{
  "intent": "info" | "modification",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of your decision"
}

Examples:
- "How do I install this plugin?" → info
- "What commands does this plugin have?" → info  
- "Can you add enchantments to the sword?" → modification
- "Fix the permission error" → modification
- "Help me understand the config" → info
- "Remove the teleport delay" → modification

Analyze the message and respond with JSON only.`;
  }
  /**
   * Parses the AI response and validates the classification result
   */
  private parseAIClassificationResponse(
    response: string,
  ): ChatClassificationResult {
    try {
      // Strategy 1: Clean the response to extract JSON
      let cleanResponse = response.trim();
      cleanResponse = cleanResponse.replace(/^\uFEFF/, ''); // Remove BOM

      // Remove any markdown code blocks
      cleanResponse = cleanResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '');

      // Strategy 2: Extract JSON object with balanced braces
      const jsonMatch = cleanResponse.match(/{[\s\S]*}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      let jsonStr = jsonMatch[0];

      // Strategy 3: Balance braces to find complete JSON
      let braceCount = 0;
      let lastValidEnd = -1;
      for (let i = 0; i < jsonStr.length; i++) {
        if (jsonStr[i] === '{') {
          braceCount++;
        } else if (jsonStr[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            lastValidEnd = i;
            break;
          }
        }
      }

      if (lastValidEnd > 0) {
        jsonStr = jsonStr.substring(0, lastValidEnd + 1);
      }

      // Strategy 4: Clean JSON string
      jsonStr = this.cleanClassificationJsonString(jsonStr);

      const parsed = JSON.parse(jsonStr);

      // Validate the response structure
      if (!parsed.intent || !['info', 'modification'].includes(parsed.intent)) {
        this.logger.warn('Invalid intent in AI response, defaulting to info');
        parsed.intent = 'info';
      }

      if (
        typeof parsed.confidence !== 'number' ||
        parsed.confidence < 0 ||
        parsed.confidence > 1
      ) {
        parsed.confidence = 0.7; // Default confidence
      }

      return {
        intent: parsed.intent as ChatIntentType,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning || 'AI classification',
      };
    } catch (error) {
      this.logger.error(
        `Failed to parse AI classification response: ${error.message}`,
      );
      this.logger.debug(`Raw AI response: ${response.substring(0, 300)}`);

      // Fallback to info if parsing fails
      return {
        intent: 'info',
        confidence: 0.5,
        reasoning: 'Failed to parse AI response, defaulting to info',
      };
    }
  }

  /**
   * Clean JSON string for classification parsing
   */
  private cleanClassificationJsonString(jsonStr: string): string {
    // Remove control characters except \t, \n, \r
    jsonStr = jsonStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Fix unescaped newlines in string values
    jsonStr = jsonStr.replace(
      /"([^"]*?)(\n)([^"]*?)"/g,
      (match, before, newline, after) => `"${before}\\n${after}"`,
    );

    // Fix trailing commas
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

    return jsonStr;
  }

  /**
   * Gets classification statistics for monitoring
   */
  getClassificationStats() {
    // This could be extended to track classification accuracy and performance
    return {
      service: 'ChatClassificationService',
      model: 'deepseek/deepseek-prover-v2:free',
      status: 'active',
    };
  }
}
