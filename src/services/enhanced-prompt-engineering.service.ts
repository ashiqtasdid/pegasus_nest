import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from './gemini.service';

interface PromptTemplate {
  name: string;
  complexity: 'simple' | 'medium' | 'complex';
  features: string[];
  template: string;
  examples: string[];
  successRate: number;
}

interface PromptOptimization {
  originalPrompt: string;
  optimizedPrompt: string;
  optimizations: string[];
  confidenceScore: number;
}

@Injectable()
export class EnhancedPromptEngineeringService {
  private readonly logger = new Logger(EnhancedPromptEngineeringService.name);

  private readonly promptTemplates: PromptTemplate[] = [
    {
      name: 'basic_command_plugin',
      complexity: 'simple',
      features: ['commands', 'basic_events'],
      template: `Create a Minecraft plugin called "{pluginName}" with the following specifications:

PRIMARY FUNCTIONALITY:
{primaryFunction}

COMMANDS TO IMPLEMENT:
{commands}

EVENTS TO HANDLE:
{events}

TECHNICAL REQUIREMENTS:
- Use Bukkit/Spigot API 1.20.4
- Implement proper error handling with try-catch blocks
- Add comprehensive logging for debugging
- Include permission checks for all commands
- Use configuration file for customizable settings
- Follow Java naming conventions and best practices

CODE STRUCTURE REQUIREMENTS:
1. Main class extending JavaPlugin in package {packageName}
2. Separate command executors for complex commands
3. Event listeners in dedicated classes
4. Configuration management class
5. Utility classes for common operations

QUALITY STANDARDS:
- All methods must have proper JavaDoc documentation
- Include null checks and input validation
- Use modern Java 8+ features where appropriate
- Implement proper resource cleanup
- Add helpful error messages for users`,
      examples: [
        'Create a teleportation plugin with /home and /sethome commands',
        'Make a simple chat prefix plugin with customizable prefixes',
      ],
      successRate: 0.92,
    },
    {
      name: 'advanced_game_mechanic',
      complexity: 'complex',
      features: ['custom_mechanics', 'database', 'events', 'commands', 'gui'],
      template: `Create an advanced Minecraft plugin called "{pluginName}" with sophisticated game mechanics:

CORE SYSTEM:
{coreSystem}

ADVANCED FEATURES:
{advancedFeatures}

DATABASE INTEGRATION:
- Use SQLite/MySQL for data persistence
- Implement proper connection pooling
- Add data validation and sanitization
- Include backup/restore functionality

USER INTERFACE:
- Create interactive GUIs using Bukkit Inventory API
- Implement pagination for large datasets
- Add confirmation dialogs for destructive actions
- Include real-time data updates

PERFORMANCE OPTIMIZATION:
- Use async tasks for database operations
- Implement caching for frequently accessed data
- Add rate limiting for resource-intensive operations
- Include memory management optimizations

INTEGRATION REQUIREMENTS:
- Support PlaceholderAPI for other plugin integration
- Implement proper plugin messaging channels
- Add webhook notifications for important events
- Include metrics collection for monitoring

SECURITY CONSIDERATIONS:
- Validate all user inputs
- Implement proper permission hierarchies
- Add audit logging for administrative actions
- Include protection against common exploits`,
      examples: [
        'Create a faction warfare system with territory control',
        'Build a custom economy with shops, auctions, and banking',
      ],
      successRate: 0.78,
    },
  ];

  constructor(private readonly geminiService: GeminiService) {}

  /**
   * Optimize prompt using AI-powered analysis and template matching
   */
  async optimizePrompt(
    originalPrompt: string,
    pluginName: string,
    detectedFeatures: string[],
    complexity: 'simple' | 'medium' | 'complex',
  ): Promise<PromptOptimization> {
    try {
      // Find best matching template
      const template = this.findBestTemplate(detectedFeatures, complexity);

      // Apply template optimizations
      const templateOptimized = this.applyTemplate(
        originalPrompt,
        pluginName,
        template,
      );

      // Use AI to further refine the prompt
      const aiOptimized = await this.aiOptimizePrompt(
        templateOptimized,
        originalPrompt,
      );

      return {
        originalPrompt,
        optimizedPrompt: aiOptimized.optimizedPrompt,
        optimizations: [
          ...this.getTemplateOptimizations(template),
          ...aiOptimized.optimizations,
        ],
        confidenceScore: this.calculateConfidenceScore(template, aiOptimized),
      };
    } catch (error) {
      this.logger.error(`Prompt optimization failed: ${error.message}`);

      // Return fallback optimization
      return {
        originalPrompt,
        optimizedPrompt: this.applyBasicOptimizations(
          originalPrompt,
          pluginName,
        ),
        optimizations: ['Applied basic prompt structure improvements'],
        confidenceScore: 0.6,
      };
    }
  }

  private findBestTemplate(
    features: string[],
    complexity: 'simple' | 'medium' | 'complex',
  ): PromptTemplate {
    let bestTemplate = this.promptTemplates[0];
    let bestScore = 0;

    for (const template of this.promptTemplates) {
      let score = 0;

      // Match complexity
      if (template.complexity === complexity) score += 3;
      else if (
        Math.abs(
          this.complexityToNumber(template.complexity) -
            this.complexityToNumber(complexity),
        ) === 1
      )
        score += 1;

      // Match features
      const featureMatches = template.features.filter((f) =>
        features.includes(f),
      ).length;
      score += featureMatches * 2;

      // Consider success rate
      score += template.successRate * 2;

      if (score > bestScore) {
        bestScore = score;
        bestTemplate = template;
      }
    }

    this.logger.log(
      `Selected template '${bestTemplate.name}' with score ${bestScore}`,
    );
    return bestTemplate;
  }

  private complexityToNumber(
    complexity: 'simple' | 'medium' | 'complex',
  ): number {
    switch (complexity) {
      case 'simple':
        return 1;
      case 'medium':
        return 2;
      case 'complex':
        return 3;
    }
  }

  private applyTemplate(
    originalPrompt: string,
    pluginName: string,
    template: PromptTemplate,
  ): string {
    let optimizedPrompt = template.template;

    // Replace placeholders
    optimizedPrompt = optimizedPrompt.replace('{pluginName}', pluginName);
    optimizedPrompt = optimizedPrompt.replace(
      '{packageName}',
      this.generatePackageName(pluginName),
    );

    // Extract and apply specific requirements from original prompt
    const extractedRequirements = this.extractRequirements(originalPrompt);
    optimizedPrompt = optimizedPrompt.replace(
      '{primaryFunction}',
      extractedRequirements.primaryFunction,
    );
    optimizedPrompt = optimizedPrompt.replace(
      '{commands}',
      extractedRequirements.commands.join('\n'),
    );
    optimizedPrompt = optimizedPrompt.replace(
      '{events}',
      extractedRequirements.events.join('\n'),
    );

    return optimizedPrompt;
  }

  private async aiOptimizePrompt(
    templatePrompt: string,
    originalPrompt: string,
  ): Promise<{
    optimizedPrompt: string;
    optimizations: string[];
  }> {
    const optimizationPrompt = `
You are an expert prompt engineer specializing in Minecraft plugin development. 
Analyze and improve this prompt to maximize code generation accuracy.

ORIGINAL USER REQUEST: ${originalPrompt}

CURRENT TEMPLATE-BASED PROMPT: ${templatePrompt}

OPTIMIZATION GOALS:
1. Ensure all user requirements are clearly specified
2. Add missing technical details that commonly cause compilation errors
3. Include specific implementation guidance for complex features
4. Clarify ambiguous requirements
5. Add quality assurance checkpoints

COMMON ISSUES TO ADDRESS:
- Missing import statements
- Unclear event handling requirements
- Insufficient error handling specifications
- Missing configuration details
- Ambiguous permission requirements

Please provide:
1. An optimized version of the prompt
2. List of specific optimizations made
3. Risk assessment for potential issues

Respond in JSON format:
{
  "optimizedPrompt": "improved prompt text",
  "optimizations": ["list of optimizations made"],
  "riskAssessment": ["potential issues identified"]
}`;

    try {
      const response = await this.geminiService.processDirectPrompt(
        optimizationPrompt,
        'anthropic/claude-sonnet-4',
      );

      const parsed = JSON.parse(response.match(/\{[\s\S]*\}/)?.[0] || '{}');

      return {
        optimizedPrompt: parsed.optimizedPrompt || templatePrompt,
        optimizations: parsed.optimizations || ['AI optimization applied'],
      };
    } catch (error) {
      this.logger.warn(`AI prompt optimization failed: ${error.message}`);
      return {
        optimizedPrompt: templatePrompt,
        optimizations: ['Template optimization applied (AI unavailable)'],
      };
    }
  }

  private extractRequirements(prompt: string): {
    primaryFunction: string;
    commands: string[];
    events: string[];
  } {
    // Simple extraction logic - could be enhanced with NLP
    const commands = this.extractCommands(prompt);
    const events = this.extractEvents(prompt);
    const primaryFunction = this.extractPrimaryFunction(prompt);

    return { primaryFunction, commands, events };
  }

  private extractCommands(prompt: string): string[] {
    const commandMatches = prompt.match(/\/\w+/g) || [];
    const commandKeywords = ['command', 'cmd', 'slash'];

    const commands = [...commandMatches];

    // Look for command descriptions
    commandKeywords.forEach((keyword) => {
      const regex = new RegExp(`${keyword}[s]?[:\\s]+([^.!?]+)`, 'gi');
      const matches = prompt.match(regex);
      if (matches) {
        commands.push(...matches);
      }
    });

    return [...new Set(commands)].slice(0, 10); // Limit to prevent bloat
  }

  private extractEvents(prompt: string): string[] {
    const eventKeywords = [
      'player join',
      'player quit',
      'player death',
      'block break',
      'block place',
      'player chat',
      'player move',
      'player interact',
      'entity damage',
      'world load',
    ];

    const events: string[] = [];
    eventKeywords.forEach((event) => {
      if (prompt.toLowerCase().includes(event)) {
        events.push(event);
      }
    });

    return events;
  }

  private extractPrimaryFunction(prompt: string): string {
    // Extract the main purpose - first sentence or key functionality
    const sentences = prompt.split(/[.!?]+/);
    return sentences[0]?.trim() || 'Plugin functionality as described';
  }

  private generatePackageName(pluginName: string): string {
    return `com.example.${pluginName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  }

  private getTemplateOptimizations(template: PromptTemplate): string[] {
    return [
      `Applied ${template.name} template for ${template.complexity} complexity`,
      `Included ${template.features.length} feature categories`,
      `Template has ${Math.round(template.successRate * 100)}% historical success rate`,
    ];
  }

  private calculateConfidenceScore(
    template: PromptTemplate,
    aiOptimization: any,
  ): number {
    let score = template.successRate * 0.4; // Template success rate (40%)
    score += 0.3; // AI optimization applied (30%)
    score += 0.3; // Base confidence (30%)

    return Math.min(score, 1.0);
  }

  private applyBasicOptimizations(
    originalPrompt: string,
    pluginName: string,
  ): string {
    return `Create a Minecraft plugin called "${pluginName}".

${originalPrompt}

TECHNICAL REQUIREMENTS:
- Use Bukkit/Spigot API 1.20.4
- Implement proper error handling
- Add comprehensive logging
- Include permission checks
- Use configuration files for settings
- Follow Java coding standards

STRUCTURE REQUIREMENTS:
- Main class extending JavaPlugin
- Proper package structure
- Separate classes for commands and events
- Include plugin.yml with all commands and permissions`;
  }

  /**
   * Get template recommendations based on prompt analysis
   */
  getTemplateRecommendations(prompt: string): {
    recommended: PromptTemplate[];
    reasoning: string[];
  } {
    const features = this.detectFeatures(prompt);
    const complexity = this.detectComplexity(prompt);

    const scored = this.promptTemplates
      .map((template) => ({
        template,
        score: this.scoreTemplate(template, features, complexity),
      }))
      .sort((a, b) => b.score - a.score);

    return {
      recommended: scored.slice(0, 3).map((s) => s.template),
      reasoning: [
        `Detected complexity: ${complexity}`,
        `Identified features: ${features.join(', ')}`,
        `Top template: ${scored[0].template.name} (score: ${scored[0].score})`,
      ],
    };
  }

  private detectFeatures(prompt: string): string[] {
    const features: string[] = [];
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('command') || lowerPrompt.includes('cmd'))
      features.push('commands');
    if (lowerPrompt.includes('gui') || lowerPrompt.includes('inventory'))
      features.push('gui');
    if (lowerPrompt.includes('database') || lowerPrompt.includes('save'))
      features.push('database');
    if (lowerPrompt.includes('event') || lowerPrompt.includes('listener'))
      features.push('events');
    if (lowerPrompt.includes('config') || lowerPrompt.includes('setting'))
      features.push('configuration');

    return features;
  }

  private detectComplexity(prompt: string): 'simple' | 'medium' | 'complex' {
    const complexityIndicators = {
      simple: ['basic', 'simple', 'easy', 'quick'],
      medium: ['moderate', 'intermediate', 'standard'],
      complex: ['advanced', 'complex', 'sophisticated', 'enterprise'],
    };

    const lowerPrompt = prompt.toLowerCase();
    let complexityScore = 1; // Default to simple

    // Check for explicit complexity indicators
    Object.entries(complexityIndicators).forEach(([level, indicators]) => {
      indicators.forEach((indicator) => {
        if (lowerPrompt.includes(indicator)) {
          complexityScore = level === 'simple' ? 1 : level === 'medium' ? 2 : 3;
        }
      });
    });

    // Analyze feature complexity
    const featureCount = this.detectFeatures(prompt).length;
    if (featureCount > 5) complexityScore = Math.max(complexityScore, 3);
    else if (featureCount > 2) complexityScore = Math.max(complexityScore, 2);

    return complexityScore === 1
      ? 'simple'
      : complexityScore === 2
        ? 'medium'
        : 'complex';
  }

  private scoreTemplate(
    template: PromptTemplate,
    features: string[],
    complexity: 'simple' | 'medium' | 'complex',
  ): number {
    let score = 0;

    // Complexity match
    if (template.complexity === complexity) score += 5;

    // Feature overlap
    const featureOverlap = template.features.filter((f) =>
      features.includes(f),
    ).length;
    score += featureOverlap * 3;

    // Success rate
    score += template.successRate * 10;

    return score;
  }
}
