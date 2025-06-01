/* eslint-disable @typescript-eslint/require-await */
import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from './gemini.service';

export interface RefinedPrompt {
  originalPrompt: string;
  refinedPrompt: string;
  pluginName: string;
  detectedFeatures: string[];
  suggestedCommands: string[];
  suggestedEvents: string[];
  complexity: 'simple' | 'medium' | 'complex';
  packageName: string;
  className: string;
}

@Injectable()
export class PromptRefinementService {
  private readonly logger = new Logger(PromptRefinementService.name);

  constructor(private readonly geminiService: GeminiService) {}

  /**
   * Refines a user prompt for Minecraft plugin creation by analyzing intent,
   * extracting features, and creating a more structured prompt for the AI
   */
  async refinePrompt(
    originalPrompt: string,
    pluginName: string,
  ): Promise<RefinedPrompt> {
    this.logger.log(`Refining prompt for plugin: ${pluginName}`);

    try {
      // Create analysis prompt for the AI
      const analysisPrompt = this.createAnalysisPrompt(
        originalPrompt,
        pluginName,
      );

      // Get AI analysis using deepseek model specifically for prompt refinement
      const aiAnalysis = await this.geminiService.processDirectPrompt(
        analysisPrompt,
        'deepseek/deepseek-prover-v2:free',
      );

      // Parse AI analysis
      const analysis = this.parseAnalysis(aiAnalysis);

      // Generate refined prompt based on analysis
      const refinedPrompt = this.generateRefinedPrompt(
        originalPrompt,
        pluginName,
        analysis,
      );

      const result: RefinedPrompt = {
        originalPrompt,
        refinedPrompt,
        pluginName,
        detectedFeatures: analysis.features,
        suggestedCommands: analysis.commands,
        suggestedEvents: analysis.events,
        complexity: analysis.complexity,
        packageName: this.generatePackageName(pluginName),
        className: this.generateClassName(pluginName),
      };

      this.logger.log(
        `Prompt refined successfully. Detected ${result.detectedFeatures.length} features, ${result.suggestedCommands.length} commands, ${result.suggestedEvents.length} events`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Error refining prompt: ${error.message}`);
      // Return a fallback refined prompt
      return this.createFallbackRefinement(originalPrompt, pluginName);
    }
  }

  /**
   * Creates a prompt for AI to analyze the user's request
   */
  private createAnalysisPrompt(
    originalPrompt: string,
    pluginName: string,
  ): string {
    return `
You are a Minecraft plugin development expert. Analyze the following user request for a plugin called "${pluginName}".

USER REQUEST: ${originalPrompt}

Please analyze this request and provide a structured response in the following JSON format:

{
  "features": ["list of main features to implement"],
  "commands": ["list of suggested commands the plugin should have"],
  "events": ["list of Minecraft events the plugin should listen to"],
  "complexity": "simple|medium|complex",
  "dependencies": ["list of any external dependencies or APIs needed"],
  "description": "A clear, technical description of what the plugin should do",
  "implementation_notes": ["list of important implementation considerations"]
}

Guidelines:
- Features should be specific functionalities (e.g., "teleportation", "item_spawning", "chat_formatting")
- Commands should start with "/" and be logical (e.g., "/spawn", "/heal", "/gamemode")
- Events should be actual Bukkit events (e.g., "PlayerJoinEvent", "PlayerDeathEvent", "BlockBreakEvent")
- Complexity: simple (1-2 features), medium (3-5 features), complex (6+ features or advanced mechanics)
- Dependencies: only mention if truly necessary (e.g., "Vault API", "WorldGuard", "PlaceholderAPI")

Return ONLY the JSON response, no additional text.
`;
  }

  /**
   * Parses the AI analysis response
   */
  private parseAnalysis(aiResponse: string): {
    features: string[];
    commands: string[];
    events: string[];
    complexity: 'simple' | 'medium' | 'complex';
    dependencies: string[];
    description: string;
    implementationNotes: string[];
  } {
    try {
      // Extract JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        features: parsed.features || [],
        commands: parsed.commands || [],
        events: parsed.events || [],
        complexity: parsed.complexity || 'medium',
        dependencies: parsed.dependencies || [],
        description: parsed.description || '',
        implementationNotes: parsed.implementation_notes || [],
      };
    } catch (error) {
      this.logger.warn(`Failed to parse AI analysis: ${error.message}`);
      return this.createFallbackAnalysis();
    }
  }

  /**
   * Generates a refined prompt based on the analysis
   */
  private generateRefinedPrompt(
    originalPrompt: string,
    pluginName: string,
    analysis: any,
  ): string {
    const packageName = this.generatePackageName(pluginName);
    const className = this.generateClassName(pluginName);

    return `
Create a Minecraft plugin called "${pluginName}" based on the following requirements:

ORIGINAL REQUEST: ${originalPrompt}

REFINED SPECIFICATIONS:
- Plugin Name: ${pluginName}
- Main Class: ${className}
- Package: ${packageName}
- Complexity Level: ${analysis.complexity}

FEATURES TO IMPLEMENT:
${analysis.features.map((feature: string) => `- ${feature}`).join('\n')}

COMMANDS TO INCLUDE:
${analysis.commands.map((command: string) => `- ${command}`).join('\n')}

EVENTS TO HANDLE:
${analysis.events.map((event: string) => `- ${event}`).join('\n')}

${
  analysis.dependencies.length > 0
    ? `DEPENDENCIES:
${analysis.dependencies.map((dep: string) => `- ${dep}`).join('\n')}`
    : ''
}

${
  analysis.implementationNotes.length > 0
    ? `IMPLEMENTATION NOTES:
${analysis.implementationNotes.map((note: string) => `- ${note}`).join('\n')}`
    : ''
}

TECHNICAL REQUIREMENTS:
1. Create a fully functional Minecraft plugin
2. Use proper Java coding standards and Bukkit API best practices
3. Include comprehensive error handling and logging
4. Add configuration options where appropriate
5. Implement proper permission checks for commands
6. Use modern Bukkit/Spigot API (1.13+)
7. Include helpful player feedback messages
8. Follow security best practices

OUTPUT FORMAT:
Return ONLY valid JSON with the following structure:
{
  "createdFiles": [
    {
      "path": "src/main/java/${packageName.replace(/\./g, '/')}/${className}.java",
      "content": "// Complete Java implementation"
    },
    {
      "path": "src/main/resources/plugin.yml",
      "content": "// Complete plugin.yml with all commands and permissions"
    },
    {
      "path": "src/main/resources/config.yml",
      "content": "// Configuration file with relevant settings"
    }
  ],
  "modifiedFiles": [],
  "deletedFiles": []
}

Create production-ready, well-documented code that fully implements all specified features.
`;
  }

  /**
   * Generates a package name from plugin name
   */
  private generatePackageName(pluginName: string): string {
    const cleanName = pluginName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/^\d+/, ''); // Remove leading numbers

    return `com.${cleanName}`;
  }

  /**
   * Generates a class name from plugin name
   */
  private generateClassName(pluginName: string): string {
    const cleanName = pluginName
      .replace(/[^a-zA-Z0-9]/g, '')
      .replace(/^\d+/, ''); // Remove leading numbers

    // Convert to PascalCase
    const pascalCase = cleanName
      .split(/(?=[A-Z])|[\s_-]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');

    return pascalCase.endsWith('Plugin') ? pascalCase : `${pascalCase}Plugin`;
  }

  /**
   * Creates a fallback analysis when AI analysis fails
   */
  private createFallbackAnalysis(): {
    features: string[];
    commands: string[];
    events: string[];
    complexity: 'simple' | 'medium' | 'complex';
    dependencies: string[];
    description: string;
    implementationNotes: string[];
  } {
    return {
      features: ['basic_functionality'],
      commands: ['/plugin'],
      events: ['PlayerJoinEvent'],
      complexity: 'simple',
      dependencies: [],
      description: 'A basic Minecraft plugin',
      implementationNotes: ['Implement basic plugin structure'],
    };
  }

  /**
   * Creates a fallback refined prompt when analysis fails
   */
  private createFallbackRefinement(
    originalPrompt: string,
    pluginName: string,
  ): RefinedPrompt {
    const packageName = this.generatePackageName(pluginName);
    const className = this.generateClassName(pluginName);

    return {
      originalPrompt,
      refinedPrompt: `Create a Minecraft plugin called "${pluginName}". ${originalPrompt}`,
      pluginName,
      detectedFeatures: ['basic_functionality'],
      suggestedCommands: ['/plugin'],
      suggestedEvents: ['PlayerJoinEvent'],
      complexity: 'simple',
      packageName,
      className,
    };
  }
}
