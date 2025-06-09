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

    // 🔒 INPUT VALIDATION: Validate inputs for security and correctness
    if (!originalPrompt || typeof originalPrompt !== 'string') {
      throw new Error('Invalid originalPrompt: must be a non-empty string');
    }

    if (!pluginName || typeof pluginName !== 'string') {
      throw new Error('Invalid pluginName: must be a non-empty string');
    }

    if (originalPrompt.length < 10) {
      throw new Error('Original prompt too short (minimum 10 characters)');
    }

    if (originalPrompt.length > 50000) {
      throw new Error('Original prompt too long (maximum 50,000 characters)');
    }

    if (pluginName.length < 2 || pluginName.length > 50) {
      throw new Error('Plugin name must be between 2 and 50 characters');
    }

    // Validate plugin name format (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(pluginName)) {
      throw new Error(
        'Plugin name can only contain letters, numbers, hyphens, and underscores',
      );
    }

    try {
      // Create analysis prompt for the AI
      const analysisPrompt = this.createAnalysisPrompt(
        originalPrompt,
        pluginName,
      );

      // Get AI analysis using deepseek model specifically for prompt refinement
      const aiAnalysis = await this.geminiService.processDirectPrompt(
        analysisPrompt,
        GeminiService.getModelForTask('PROMPT_REFINEMENT'),
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
   * Parses the AI analysis response with robust error handling
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
      // Strategy 1: Clean the response
      let cleanResponse = aiResponse.trim();
      cleanResponse = cleanResponse.replace(/^\uFEFF/, ''); // Remove BOM

      // Remove markdown code blocks
      cleanResponse = cleanResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '');

      // Strategy 2: Extract JSON with balanced braces
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn(
          'No JSON found in AI analysis response, using fallback',
        );
        return this.createFallbackAnalysis();
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
      jsonStr = this.cleanAnalysisJsonString(jsonStr);

      const parsed = JSON.parse(jsonStr);

      return {
        features: Array.isArray(parsed.features) ? parsed.features : [],
        commands: Array.isArray(parsed.commands) ? parsed.commands : [],
        events: Array.isArray(parsed.events) ? parsed.events : [],
        complexity: ['simple', 'medium', 'complex'].includes(parsed.complexity)
          ? parsed.complexity
          : 'medium',
        dependencies: Array.isArray(parsed.dependencies)
          ? parsed.dependencies
          : [],
        description:
          typeof parsed.description === 'string' ? parsed.description : '',
        implementationNotes: Array.isArray(parsed.implementation_notes)
          ? parsed.implementation_notes
          : Array.isArray(parsed.implementationNotes)
            ? parsed.implementationNotes
            : [],
      };
    } catch (error) {
      this.logger.warn(`Failed to parse AI analysis: ${error.message}`);
      this.logger.debug(
        `Raw response (first 300 chars): ${aiResponse.substring(0, 300)}`,
      );
      return this.createFallbackAnalysis();
    }
  }

  /**
   * Clean JSON string for analysis parsing
   */
  private cleanAnalysisJsonString(jsonStr: string): string {
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

BUKKIT COLOR API REQUIREMENTS:
- NEVER use Color.valueOf(String) - this method does not exist in Bukkit Color API
- For RGB colors from hex: use Color.fromRGB(int r, int g, int b) or Color.fromRGB(int rgb)
- For named colors: use Color.RED, Color.BLUE, Color.GREEN, etc. (static constants)
- For chat colors: use ChatColor.RED, ChatColor.BLUE, etc. (not Color class)
- Example correct usage: Color.fromRGB(255, 0, 0) for red, Color.BLUE for blue
- Example WRONG usage: Color.valueOf("RED") - DO NOT USE THIS

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

  /**
   * 🔒 SECURITY: Validate plugin name for security
   */
  private validatePluginName(pluginName: string): void {
    if (!pluginName || typeof pluginName !== 'string') {
      throw new Error('Invalid plugin name: must be a non-empty string');
    }

    if (pluginName.length < 2) {
      throw new Error('Invalid plugin name: too short (minimum 2 characters)');
    }

    if (pluginName.length > 50) {
      throw new Error('Invalid plugin name: too long (maximum 50 characters)');
    }

    // Check for valid characters (alphanumeric, hyphens, underscores)
    const validNamePattern = /^[a-zA-Z0-9_-]+$/;
    if (!validNamePattern.test(pluginName)) {
      throw new Error(
        'Invalid plugin name: only alphanumeric characters, hyphens, and underscores allowed',
      );
    }
  }

  /**
   * 🎯 VALIDATION: Ensure refined prompt meets quality standards
   */
  private validateRefinedPrompt(refinedPrompt: RefinedPrompt): void {
    if (
      !refinedPrompt.refinedPrompt ||
      refinedPrompt.refinedPrompt.length < 50
    ) {
      throw new Error('Refined prompt is too short or empty');
    }

    if (
      !refinedPrompt.detectedFeatures ||
      refinedPrompt.detectedFeatures.length === 0
    ) {
      throw new Error('No features identified in refined prompt');
    }

    if (
      !refinedPrompt.complexity ||
      !['simple', 'medium', 'complex'].includes(refinedPrompt.complexity)
    ) {
      throw new Error('Invalid complexity level in refined prompt');
    }
  }
}
