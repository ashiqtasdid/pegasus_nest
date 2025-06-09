/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { FileCompilerService } from './file-compiler.service';
import { CodeCompilerService } from './code-compiler.service';
import { PromptRefinementService } from './prompt-refinement.service';
import {
  ChatClassificationService,
  ChatIntentType,
} from './chat-classification.service';
import { PluginStatusGateway } from '../gateways/plugin-status.gateway';
import * as fs from 'fs';
import * as path from 'path';

interface PluginModification {
  createdFiles: Array<{ path: string; content: string }>;
  modifiedFiles: Array<{ path: string; content: string }>;
  deletedFiles: string[];
}

@Injectable()
export class PluginChatService {
  private readonly logger = new Logger(PluginChatService.name);

  constructor(
    private readonly geminiService: GeminiService,
    private readonly fileCompilerService: FileCompilerService,
    private readonly codeCompilerService: CodeCompilerService,
    private readonly promptRefinementService: PromptRefinementService,
    private readonly chatClassificationService: ChatClassificationService,
    private readonly pluginStatusGateway: PluginStatusGateway,
  ) {}
  /**
   * Enhanced chat response with intelligent classification and routing
   * Uses DeepSeek free model to classify user intent and routes accordingly
   */
  async getChatResponseWithRefinement(
    message: string,
    pluginName: string,
    userId: string,
  ): Promise<string> {
    this.logger.log(
      `Processing chat request for plugin: ${pluginName}, user: ${userId}, message: "${message.substring(0, 100)}..."`,
    );

    try {
      // Check if plugin exists in user-specific directory
      const folderPath = path.join(
        process.cwd(),
        'generated',
        userId,
        pluginName,
      );
      this.logger.log(`Checking for plugin at path: ${folderPath}`);

      if (!fs.existsSync(folderPath)) {
        this.logger.warn(
          `Plugin "${pluginName}" not found for user "${userId}" at path: ${folderPath}`,
        );

        // List available plugins for debugging - check user directory
        const userGeneratedPath = path.join(process.cwd(), 'generated', userId);
        let availablePlugins = [];
        try {
          if (fs.existsSync(userGeneratedPath)) {
            availablePlugins = fs
              .readdirSync(userGeneratedPath)
              .filter((item) => {
                const itemPath = path.join(userGeneratedPath, item);
                return fs.statSync(itemPath).isDirectory();
              });
          }
        } catch (error) {
          this.logger.error(
            `Error listing available plugins for user ${userId}: ${error.message}`,
          );
        }

        this.logger.log(
          `Available plugins for user ${userId}: ${availablePlugins.join(', ') || 'None'}`,
        );

        return `❌ **Plugin Not Found**

The plugin "${pluginName}" doesn't exist for your account. Please ensure:

1. The plugin name is spelled correctly
2. The plugin has been generated previously under your account
3. You're using the exact plugin name from the system

**Your available plugins:** ${availablePlugins.length > 0 ? availablePlugins.join(', ') : 'None found'}

**Available actions:**
• Generate a new plugin with this name
• Check the list of existing plugins for your account
• Verify the plugin name spelling`;
      }

      this.logger.log(
        `Plugin "${pluginName}" found for user "${userId}" at path: ${folderPath}`,
      );

      // Step 1: Classify the user's intent using AI
      this.logger.log('Classifying user intent...');
      const classification =
        await this.chatClassificationService.classifyUserIntent(
          message,
          pluginName,
        );

      this.logger.log(
        `Classification result: ${classification.intent} (confidence: ${classification.confidence})`,
      );

      // Step 2: Route based on classification
      if (classification.intent === 'modification') {
        return await this.handleModificationRequest(
          message,
          pluginName,
          folderPath,
          classification,
        );
      } else {
        return await this.handleInfoRequest(
          message,
          pluginName,
          folderPath,
          classification,
        );
      }
    } catch (error) {
      this.logger.error(`Chat processing failed: ${error.message}`);
      return `❌ **Error Processing Request**

I encountered an error while processing your request: ${error.message}

**Please try:**
• Rephrasing your request
• Being more specific about what you want
• Checking if the plugin name exists

If the problem persists, please try regenerating the plugin or contact support.`;
    }
  }

  /**
   * Main processing logic for enhanced chat with refinement
   */
  private async processEnhancedChat(
    message: string,
    pluginName: string,
    folderPath: string,
  ): Promise<string> {
    // Path for the documentation file
    const docsPath = path.join(folderPath, 'docs');
    if (!fs.existsSync(docsPath)) {
      fs.mkdirSync(docsPath, { recursive: true });
    }

    const docFilePath = path.join(docsPath, `${pluginName}_documentation.txt`);

    // Create or update documentation file
    await this.ensurePluginDocumentation(pluginName, folderPath, docFilePath);

    // Read the documentation file with size limit
    let pluginContext = '';
    try {
      pluginContext = fs.readFileSync(docFilePath, 'utf8');

      // Truncate if too large for AI context window
      if (pluginContext.length > 80000) {
        this.logger.warn(
          `Plugin documentation is very large (${pluginContext.length} chars), truncating to 80K chars`,
        );
        pluginContext =
          pluginContext.substring(0, 80000) +
          '\n...(content truncated due to length)';
      }
    } catch (error) {
      this.logger.error(`Error reading documentation file: ${error.message}`);
      return `Sorry, I couldn't access the documentation for plugin "${pluginName}".`;
    }

    // Step 1: Refine the user's message for better AI understanding
    this.logger.log('Refining user message for better AI processing...');
    let refinedMessage = message;

    try {
      // Create a focused refinement prompt for chat messages
      const refinementResult = await this.promptRefinementService.refinePrompt(
        `Plugin modification request: ${message}`,
        pluginName,
      );

      if (refinementResult?.refinedPrompt) {
        refinedMessage = refinementResult.refinedPrompt;
        this.logger.log('Successfully refined user message');
      }
    } catch (error) {
      this.logger.warn(
        `Prompt refinement failed, using original message: ${error.message}`,
      );
      // Continue with original message if refinement fails
    }

    // Step 2: Create enhanced prompt with refined message and context
    const prompt = this.createEnhancedPluginModificationPrompt(
      refinedMessage,
      pluginName,
      pluginContext,
    );

    // Step 3: Process with AI using retry logic for connection resilience
    const aiResponse = await this.processWithRetry(prompt);

    // Add debug logging to see what AI is returning
    this.logger.log(`AI Response received (length: ${aiResponse.length})`);
    this.logger.log(
      `AI Response (first 1000 chars): ${aiResponse.substring(0, 1000)}`,
    );

    // Step 4: Parse and apply modifications
    let pluginModification: PluginModification;
    try {
      pluginModification = this.parseAIResponse(aiResponse);

      // Check if we got an empty modification (fallback case)
      const totalOperations =
        pluginModification.createdFiles.length +
        pluginModification.modifiedFiles.length +
        pluginModification.deletedFiles.length;

      if (totalOperations === 0) {
        // If no file operations, treat as a simple question response
        this.logger.log(
          'No file modifications requested, treating as informational query',
        );

        // Try to extract useful information from the AI response for user
        const cleanResponse = aiResponse
          .replace(/{[\s\S]*}/, '') // Remove any JSON attempt
          .replace(/```[\s\S]*?```/g, '') // Remove code blocks
          .trim();

        if (cleanResponse.length > 50) {
          return cleanResponse;
        } else {
          return this.createInformationalResponse(pluginName, pluginContext);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to parse AI response: ${error.message}`);

      // Try to provide a helpful response based on the original message
      return this.createInformationalResponse(
        pluginName,
        pluginContext,
        message,
      );
    }

    // Step 5: Apply file operations
    const operationsResult = await this.applyFileOperations(
      folderPath,
      pluginModification,
    );

    // Step 6: Regenerate documentation after modifications
    await this.ensurePluginDocumentation(
      pluginName,
      folderPath,
      docFilePath,
      true,
    );

    return operationsResult;
  }
  /**
   * Process AI request with retry logic to handle connection issues
   */
  private async processWithRetry(
    prompt: string,
    maxRetries = 3,
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`AI processing attempt ${attempt}/${maxRetries}`);

        // Add exponential backoff between retries
        if (attempt > 1) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 2s, 4s, 8s...
          this.logger.log(`Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        return await this.geminiService.processDirectPrompt(
          prompt,
          'anthropic/claude-sonnet-4',
        );
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `AI processing attempt ${attempt} failed: ${error.message}`,
        );

        // Don't retry on authentication or rate limit errors
        if (
          error.message.includes('Authentication') ||
          error.message.includes('Rate limit')
        ) {
          throw error;
        }

        // Continue to next attempt for connection errors
        if (
          attempt < maxRetries &&
          (error.message.includes('ECONNRESET') ||
            error.message.includes('socket hang up') ||
            error.message.includes('timeout') ||
            error.message.includes('ETIMEDOUT'))
        ) {
          continue;
        }
      }
    }

    // If we get here, all attempts failed
    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Creates an enhanced prompt for AI with better structure and context
   */
  private createEnhancedPluginModificationPrompt(
    refinedMessage: string,
    pluginName: string,
    pluginContext: string,
  ): string {
    return `
You are a Minecraft plugin expert helping modify an existing plugin. 
The user is requesting changes to a plugin named "${pluginName}".

RESPONSE FORMAT INSTRUCTIONS:
You must respond with a valid JSON object containing file operations to create, modify, or delete.
Do not include any explanatory text before or after the JSON.
Your entire response should be parseable as JSON.

The expected JSON format is:
{
  "createdFiles": [
    {
      "path": "src/main/java/com/example/MyClass.java",
      "content": "package com.example;\\n\\npublic class MyClass {\\n  // code here\\n}"
    }
  ],
  "modifiedFiles": [
    {
      "path": "src/main/resources/plugin.yml",
      "content": "name: MyPlugin\\nversion: 1.0\\nmain: com.example.MyPlugin"
    }
  ],
  "deletedFiles": [
    "src/main/java/com/example/UnusedClass.java"
  ]
}

EXISTING PLUGIN STRUCTURE AND CONTENT:
${pluginContext}

REFINED USER REQUEST:
${refinedMessage}

IMPLEMENTATION GUIDELINES:
1. Only include files that are relevant to the request
2. Make sure to include the full content of any new or modified files
3. Use proper Java syntax and Bukkit/Spigot API conventions
4. Include proper error handling and logging
5. Follow the existing code style and structure
6. Test for edge cases and provide user-friendly messages
7. Optimize for performance and memory usage

BUKKIT COLOR API REQUIREMENTS:
- NEVER use Color.valueOf(String) - this method does not exist in Bukkit Color API
- For RGB colors from hex: use Color.fromRGB(int r, int g, int b) or Color.fromRGB(int rgb)
- For named colors: use Color.RED, Color.BLUE, Color.GREEN, etc. (static constants)
- For chat colors: use ChatColor.RED, ChatColor.BLUE, etc. (not Color class)
- Example correct usage: Color.fromRGB(255, 0, 0) for red, Color.BLUE for blue
- Example WRONG usage: Color.valueOf("RED") - DO NOT USE THIS

Remember: Only output valid JSON with no additional text. The path should be relative to the plugin's root directory.
`;
  }

  /**
   * Ensures the plugin documentation file exists and is up-to-date
   */
  private async ensurePluginDocumentation(
    pluginName: string,
    pluginFolderPath: string,
    docFilePath: string,
    forceRegenerate = false,
  ): Promise<void> {
    // Check if documentation already exists and is fresh (less than 1 hour old)
    if (!forceRegenerate && fs.existsSync(docFilePath)) {
      const stats = fs.statSync(docFilePath);
      const docAge = Date.now() - stats.mtimeMs;

      // If doc is less than 1 hour old, don't regenerate
      if (docAge < 3600000) {
        this.logger.debug(
          `Using existing documentation for '${pluginName}' (age: ${Math.round(docAge / 60000)} minutes)`,
        );
        return;
      }
    } // Generate/regenerate documentation
    try {
      this.logger.log(`Generating documentation for plugin '${pluginName}'...`);

      // Validate paths before using them
      if (!pluginFolderPath) {
        this.logger.error(
          `Plugin folder path is undefined for plugin: ${pluginName}`,
        );
        throw new Error(
          `Plugin folder path is undefined for plugin: ${pluginName}`,
        );
      }
      if (!docFilePath) {
        this.logger.error(
          `Documentation file path is undefined for plugin: ${pluginName}`,
        );
        throw new Error(
          `Documentation file path is undefined for plugin: ${pluginName}`,
        );
      }

      // Ensure plugin folder exists
      if (!fs.existsSync(pluginFolderPath)) {
        this.logger.error(`Plugin folder does not exist: ${pluginFolderPath}`);
        throw new Error(`Plugin folder does not exist: ${pluginFolderPath}`);
      }

      const sourcePath = path.join(pluginFolderPath, 'src');
      this.logger.debug(`Source path: ${sourcePath}, Doc path: ${docFilePath}`);

      // Check if source path exists
      if (!fs.existsSync(sourcePath)) {
        this.logger.warn(
          `Source path does not exist: ${sourcePath}, creating basic documentation`,
        );
        // Create basic documentation if source doesn't exist
        const basicDoc = `Plugin: ${pluginName}\nStatus: Generated but source files not found\nLocation: ${pluginFolderPath}`;
        const docDir = path.dirname(docFilePath);
        if (!fs.existsSync(docDir)) {
          fs.mkdirSync(docDir, { recursive: true });
        }
        fs.writeFileSync(docFilePath, basicDoc, 'utf8');
        return;
      }

      // Use FileCompilerService to compile plugin files
      await this.fileCompilerService.compileDirectoryToTxt(
        sourcePath,
        docFilePath,
      );

      this.logger.log(
        `Documentation for plugin '${pluginName}' created at ${docFilePath}`,
      );
    } catch (error) {
      this.logger.error(
        `Error creating documentation for plugin '${pluginName}':`,
        error,
      );
      // If file exists but couldn't be updated, we'll use the existing one
      if (!fs.existsSync(docFilePath)) {
        throw error; // Rethrow if we couldn't create a new file
      }
    }
  }

  /**
   * Creates a prompt for the AI to modify plugin files
   */
  private createPluginModificationPrompt(
    message: string,
    pluginName: string,
    pluginContext: string,
  ): string {
    return `
You are a Minecraft plugin expert helping modify an existing plugin. 
The user is requesting changes to a plugin named "${pluginName}".

RESPONSE FORMAT INSTRUCTIONS:
You must respond with a valid JSON object containing file operations to create, modify, or delete.
Do not include any explanatory text before or after the JSON.
Your entire response should be parseable as JSON.

The expected JSON format is:
{
  "createdFiles": [
    {
      "path": "src/main/java/com/example/MyClass.java",
      "content": "package com.example;\\n\\npublic class MyClass {\\n  // code here\\n}"
    }
  ],
  "modifiedFiles": [
    {
      "path": "src/main/resources/plugin.yml",
      "content": "name: MyPlugin\\nversion: 1.0\\nmain: com.example.MyPlugin"
    }
  ],
  "deletedFiles": [
    "src/main/java/com/example/UnusedClass.java"
  ]
}

EXISTING PLUGIN STRUCTURE AND CONTENT:
${pluginContext}

USER REQUEST:
${message}

Also, only include files that are relevant to the request. & make sure to include the full content of any new or modified files.

Remember: Only output valid JSON with no additional text. The path should be relative to the plugin's root directory.
`;
  } /**
   * Parses the AI response to extract file operations
   */
  private parseAIResponse(aiResponse: string): PluginModification {
    try {
      // Add debug logging to see the raw response
      this.logger.debug(`Raw AI Response length: ${aiResponse.length}`);
      this.logger.debug(
        `First 200 chars: ${JSON.stringify(aiResponse.substring(0, 200))}`,
      );

      // Multiple strategies to extract valid JSON from AI response

      // Strategy 1: Clean the response of any BOM or invisible characters
      let cleanResponse = aiResponse.replace(/^\uFEFF/, ''); // Remove BOM
      cleanResponse = cleanResponse.replace(/^\s+/, ''); // Remove leading whitespace
      cleanResponse = cleanResponse.replace(/\s+$/, ''); // Remove trailing whitespace

      // Strategy 2: Try to find complete JSON block with balanced braces
      const jsonRegex = /{[\s\S]*}/;
      const match = cleanResponse.match(jsonRegex);

      if (match) {
        let jsonStr = match[0];
        this.logger.debug(`Extracted JSON string length: ${jsonStr.length}`);
        this.logger.debug(
          `First 100 chars of JSON: ${JSON.stringify(jsonStr.substring(0, 100))}`,
        );

        // Strategy 3: Find the last complete JSON object by balancing braces
        let braceCount = 0;
        let lastValidEnd = -1;

        for (let i = 0; i < jsonStr.length; i++) {
          if (jsonStr[i] === '{') {
            braceCount++;
          } else if (jsonStr[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              lastValidEnd = i;
            }
          }
        }

        if (lastValidEnd > 0) {
          jsonStr = jsonStr.substring(0, lastValidEnd + 1);
          this.logger.debug(
            `Truncated JSON to valid end: ${lastValidEnd + 1} chars`,
          );
        }

        // Strategy 4: Clean up common JSON issues
        jsonStr = this.cleanJsonString(jsonStr);
        this.logger.debug(
          `Cleaned JSON first 100 chars: ${JSON.stringify(jsonStr.substring(0, 100))}`,
        );

        // Try parsing the cleaned JSON
        const result = JSON.parse(jsonStr) as PluginModification;

        // Validate and normalize the structure
        if (!result.createdFiles) result.createdFiles = [];
        if (!result.modifiedFiles) result.modifiedFiles = [];
        if (!result.deletedFiles) result.deletedFiles = [];

        this.logger.log(
          `Successfully parsed AI response: ${result.createdFiles.length} created, ${result.modifiedFiles.length} modified, ${result.deletedFiles.length} deleted files`,
        );
        return result;
      }

      // Strategy 4: If no JSON found, create empty modification
      this.logger.warn(
        'No valid JSON found in AI response, creating empty modification',
      );
      return {
        createdFiles: [],
        modifiedFiles: [],
        deletedFiles: [],
      };
    } catch (error) {
      this.logger.error(`Failed to parse AI response: ${error.message}`);
      this.logger.debug(
        `AI Response (first 500 chars): ${aiResponse.substring(0, 500)}`,
      );

      // Fallback: return empty modification instead of throwing
      this.logger.warn('Falling back to empty modification due to parse error');
      return {
        createdFiles: [],
        modifiedFiles: [],
        deletedFiles: [],
      };
    }
  } /**
   * Cleans common JSON formatting issues from AI responses
   */
  private cleanJsonString(jsonStr: string): string {
    // Remove any text before the first {
    const firstBrace = jsonStr.indexOf('{');
    if (firstBrace > 0) {
      jsonStr = jsonStr.substring(firstBrace);
    }

    // Remove any BOM or non-printable control characters
    jsonStr = jsonStr.replace(/^\uFEFF/, ''); // Remove BOM
    jsonStr = jsonStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control chars except \t, \n, \r

    // Try to parse as-is first (the AI might have given us proper JSON)
    try {
      JSON.parse(jsonStr);
      return jsonStr; // If it parses successfully, return as-is
    } catch (e) {
      // If parsing fails, try to fix common issues
    }

    // Fix unescaped newlines and tabs within string values
    jsonStr = jsonStr.replace(
      /"([^"]*?)(\n)([^"]*?)"/g,
      (match, before, newline, after) => {
        return `"${before}\\n${after}"`;
      },
    );

    jsonStr = jsonStr.replace(
      /"([^"]*?)(\t)([^"]*?)"/g,
      (match, before, tab, after) => {
        return `"${before}\\t${after}"`;
      },
    );

    // Remove trailing commas before closing braces or brackets
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

    return jsonStr;
  }

  /**
   * Applies file operations to the plugin directory
   */
  private async applyFileOperations(
    pluginFolderPath: string,
    operations: PluginModification,
  ): Promise<string> {
    const results: string[] = [];
    let createdCount = 0;
    let modifiedCount = 0;
    let deletedCount = 0;
    let errorCount = 0;

    try {
      // Process file creations
      for (const file of operations.createdFiles) {
        try {
          const fullPath = path.join(pluginFolderPath, file.path);

          // Create parent directories if they don't exist
          const parentDir = path.dirname(fullPath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }

          // Don't overwrite existing files as "creation"
          if (fs.existsSync(fullPath)) {
            results.push(
              `⚠️ File already exists (skipped creation): ${file.path}`,
            );
            continue;
          }

          // Write the file
          fs.writeFileSync(fullPath, file.content);
          results.push(`✓ Created: ${file.path}`);
          createdCount++;
        } catch (error) {
          results.push(
            `❌ Failed to create file ${file.path}: ${error.message}`,
          );
          errorCount++;
        }
      }

      // Process file modifications
      for (const file of operations.modifiedFiles) {
        try {
          const fullPath = path.join(pluginFolderPath, file.path);

          // Check if file exists
          if (!fs.existsSync(fullPath)) {
            results.push(
              `⚠️ File doesn't exist (creating instead): ${file.path}`,
            );

            // Create parent directories if they don't exist
            const parentDir = path.dirname(fullPath);
            if (!fs.existsSync(parentDir)) {
              fs.mkdirSync(parentDir, { recursive: true });
            }
          }

          // Write/overwrite the file
          fs.writeFileSync(fullPath, file.content);
          results.push(`✓ Modified: ${file.path}`);
          modifiedCount++;
        } catch (error) {
          results.push(
            `❌ Failed to modify file ${file.path}: ${error.message}`,
          );
          errorCount++;
        }
      }

      // Process file deletions
      for (const filePath of operations.deletedFiles) {
        try {
          const fullPath = path.join(pluginFolderPath, filePath);

          // Check if file exists
          if (!fs.existsSync(fullPath)) {
            results.push(
              `⚠️ File doesn't exist (skipped deletion): ${filePath}`,
            );
            continue;
          }

          // Delete the file
          fs.unlinkSync(fullPath);
          results.push(`✓ Deleted: ${filePath}`);
          deletedCount++;
        } catch (error) {
          results.push(
            `❌ Failed to delete file ${filePath}: ${error.message}`,
          );
          errorCount++;
        }
      }

      // After applying all file operations, delete target folder and recompile
      try {
        results.push(`\n⚙️ Recompiling plugin...`);
        await this.cleanAndRecompilePlugin(pluginFolderPath);
        results.push(`✓ Plugin successfully recompiled`);
      } catch (error) {
        results.push(`❌ Failed to recompile plugin: ${error.message}`);
        errorCount++;
      }

      // Create summary message
      const summary = `
### Plugin Modification Summary

I've applied the following changes to the plugin:
- Created ${createdCount} file(s)
- Modified ${modifiedCount} file(s)
- Deleted ${deletedCount} file(s)
${errorCount > 0 ? `- Encountered ${errorCount} error(s)` : ''}

### Details:
${results.join('\n')}
`;

      return summary;
    } catch (error) {
      this.logger.error(`Error applying file operations: ${error.message}`);
      return `Error applying changes to plugin files: ${error.message}\n\nPartial results:\n${results.join('\n')}`;
    }
  }

  /**
   * Cleans and recompiles the plugin by deleting the target folder and running Maven
   */
  private async cleanAndRecompilePlugin(
    pluginFolderPath: string,
  ): Promise<void> {
    try {
      // Extract plugin name from folder path for WebSocket notifications
      const pluginName = path.basename(pluginFolderPath);

      // Delete target folder if it exists
      const targetPath = path.join(pluginFolderPath, 'target');
      if (fs.existsSync(targetPath)) {
        this.logger.log(`Deleting target folder: ${targetPath}`);
        fs.rmSync(targetPath, { recursive: true, force: true });
        this.logger.log('Target folder deleted successfully');
      }

      // Emit recompilation start via WebSocket
      this.pluginStatusGateway.emitCompilationProgress(pluginName, {
        stage: 'initialization',
        percentage: 0,
        message: 'Starting plugin recompilation after modifications...',
      });

      // Use CodeCompilerService with AI fixing enabled for better error handling
      this.logger.log(`Recompiling plugin at: ${pluginFolderPath}`);
      const result =
        await this.codeCompilerService.compileMavenProject(pluginFolderPath);

      if (!result.success) {
        this.logger.error(`Maven compilation failed: ${result.error}`);
        this.logger.error(`Maven output: ${result.output}`);

        // Emit compilation failure via WebSocket
        this.pluginStatusGateway.emitCompilationProgress(pluginName, {
          stage: 'error',
          percentage: 0,
          message: 'Plugin recompilation failed',
          success: false,
          error: result.error,
        });

        throw new Error(`Maven compilation failed: ${result.error}`);
      }

      this.logger.log('Maven compilation successful');

      // Emit successful completion via WebSocket
      this.pluginStatusGateway.emitCompilationProgress(pluginName, {
        stage: 'complete',
        percentage: 100,
        message: 'Plugin recompilation completed successfully!',
        success: true,
      });
    } catch (error) {
      this.logger.error(`Error during clean and recompile: ${error.message}`);
      throw error;
    }
  }

  /**
   * Creates an informational response when AI parsing fails or when providing general information
   */
  private createInformationalResponse(
    pluginName: string,
    pluginContext: string,
    message?: string,
  ): string {
    this.logger.debug(
      `Creating informational response for plugin: ${pluginName}`,
    );

    // Extract key information from the plugin context
    const hasCommands =
      pluginContext.includes('CommandExecutor') ||
      pluginContext.includes('@Override\n    public boolean onCommand');
    const hasListeners =
      pluginContext.includes('Listener') ||
      pluginContext.includes('@EventHandler');
    const hasConfig =
      pluginContext.includes('config.yml') ||
      pluginContext.includes('getConfig()');
    const hasPermissions =
      pluginContext.includes('permission') ||
      pluginContext.includes('Permission');

    // Build a helpful response based on available features
    let response = `Here's what I can tell you about **${pluginName}**:\n\n`;

    // Add feature overview
    const features = [];
    if (hasCommands)
      features.push('✅ **Commands** - Custom commands are implemented');
    if (hasListeners)
      features.push('✅ **Event Listeners** - Responds to game events');
    if (hasConfig)
      features.push('✅ **Configuration** - Customizable settings available');
    if (hasPermissions)
      features.push('✅ **Permissions** - Access control implemented');

    if (features.length > 0) {
      response += '**Features:**\n' + features.join('\n') + '\n\n';
    }

    // Add basic information
    response += '**Basic Information:**\n';
    response += `• Plugin Type: Bukkit/Spigot compatible\n`;
    response += `• Language: Java\n`;
    response += `• Build System: Maven\n\n`;

    // Add helpful suggestions based on the message
    if (message) {
      const lowerMessage = message.toLowerCase();

      if (lowerMessage.includes('install')) {
        response += '**Installation:**\n';
        response += '• Download the JAR file\n';
        response += "• Place it in your server's `plugins/` folder\n";
        response += '• Restart your server\n\n';
      }

      if (lowerMessage.includes('command')) {
        response += hasCommands
          ? '**Commands:** This plugin includes custom commands. Check the main plugin class for details.\n\n'
          : "**Commands:** This plugin doesn't appear to have custom commands.\n\n";
      }

      if (lowerMessage.includes('config')) {
        response += hasConfig
          ? '**Configuration:** This plugin includes a configuration system. Look for `config.yml` in the resources folder.\n\n'
          : "**Configuration:** This plugin doesn't appear to have configuration options.\n\n";
      }

      if (lowerMessage.includes('permission')) {
        response += hasPermissions
          ? '**Permissions:** This plugin includes permission checks. Review the code for specific permission nodes.\n\n'
          : "**Permissions:** This plugin doesn't appear to use permissions.\n\n";
      }
    }

    // Add general help
    response += '**Need more help?** Try asking:\n';
    response += '• "How do I install this plugin?"\n';
    response += '• "What commands does this plugin have?"\n';
    response += '• "How do I configure this plugin?"\n';
    response += '• "What permissions does this plugin use?"\n';

    return response;
  }

  /**
   * Handles modification requests - uses existing modification system
   */
  private async handleModificationRequest(
    message: string,
    pluginName: string,
    folderPath: string,
    classification: any,
  ): Promise<string> {
    this.logger.log(`Handling modification request for plugin: ${pluginName}`);

    try {
      // Use the existing modification system
      return await this.processEnhancedChat(message, pluginName, folderPath);
    } catch (error) {
      this.logger.error(`Modification request failed: ${error.message}`);

      return `❌ **Modification Failed**

I encountered an error while trying to modify your plugin "${pluginName}":

**Error:** ${error.message}

**What you can try:**
• Rephrase your modification request more clearly
• Be specific about what files or features you want to change
• Make sure your request is technically feasible for a Minecraft plugin
• Try breaking complex changes into smaller, specific requests

**Example modification requests:**
• "Add a /heal command that restores player health"
• "Change the welcome message color to blue"
• "Add a cooldown of 30 seconds to the teleport command"
• "Create a config option to disable the death messages"`;
    }
  }

  /**
   * Handles informational requests - provides helpful information about the plugin
   */
  private async handleInfoRequest(
    message: string,
    pluginName: string,
    folderPath: string,
    classification: any,
  ): Promise<string> {
    this.logger.log(`Handling info request for plugin: ${pluginName}`);

    try {
      // Generate or read plugin documentation
      const docsPath = path.join(folderPath, 'docs');
      if (!fs.existsSync(docsPath)) {
        fs.mkdirSync(docsPath, { recursive: true });
      }

      const docFilePath = path.join(
        docsPath,
        `${pluginName}_documentation.txt`,
      );

      // Ensure documentation exists
      await this.ensurePluginDocumentation(pluginName, folderPath, docFilePath);

      // Read plugin context
      let pluginContext = '';
      try {
        pluginContext = fs.readFileSync(docFilePath, 'utf8');

        // Truncate if too large
        if (pluginContext.length > 50000) {
          pluginContext =
            pluginContext.substring(0, 50000) + '\n...(truncated)';
        }
      } catch (error) {
        this.logger.warn(
          `Could not read plugin documentation: ${error.message}`,
        );
        pluginContext = `Plugin: ${pluginName}\nLocation: ${folderPath}`;
      }

      // Use AI to provide intelligent response to the specific question
      const infoPrompt = this.createInfoResponsePrompt(
        message,
        pluginName,
        pluginContext,
      );

      const aiResponse = await this.geminiService.processDirectPrompt(
        infoPrompt,
        'deepseek/deepseek-prover-v2:free',
      );

      return (
        aiResponse ||
        this.createInformationalResponse(pluginName, pluginContext, message)
      );
    } catch (error) {
      this.logger.error(`Info request failed: ${error.message}`);

      // Fallback to basic informational response
      try {
        const basicContext = `Plugin: ${pluginName}`;
        return this.createInformationalResponse(
          pluginName,
          basicContext,
          message,
        );
      } catch (fallbackError) {
        return `❌ **Information Request Failed**

I couldn't retrieve information about the plugin "${pluginName}".

**Possible reasons:**
• Plugin files may be corrupted or missing
• Documentation generation failed
• System is experiencing temporary issues

**What you can try:**
• Regenerate the plugin to ensure all files are properly created
• Ask a more specific question about the plugin
• Check if the plugin name is correct

**Example information requests:**
• "What commands does this plugin have?"
• "How do I configure this plugin?"
• "What permissions does this plugin use?"
• "How do I install this plugin?"`;
      }
    }
  }

  /**
   * Creates a prompt for AI to respond to informational queries
   */
  private createInfoResponsePrompt(
    message: string,
    pluginName: string,
    pluginContext: string,
  ): string {
    return `
You are a helpful assistant for Minecraft plugin users. The user is asking about a plugin called "${pluginName}".

USER QUESTION: "${message}"

PLUGIN INFORMATION:
${pluginContext}

INSTRUCTIONS:
1. Answer the user's question directly and helpfully
2. Use the plugin information provided to give accurate details
3. Format your response in markdown for readability
4. Include specific examples when relevant
5. If the question can't be answered from the plugin info, say so clearly
6. Focus on practical, actionable information

RESPONSE STYLE:
- Be friendly and conversational
- Use clear headings and bullet points
- Include code examples if relevant
- Suggest next steps when appropriate

Please provide a helpful response to the user's question about "${pluginName}".`;
  }
}
