/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Res,
  Query,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { CreateService } from '../services/create.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { ChatRequestDto } from './dto/chat-request.dto';
import * as fs from 'fs';
import * as path from 'path';
import { createExtractorFromFile } from 'node-unrar-js';
import { FileCompilerService } from '../services/file-compiler.service';
import { GeminiService } from '../services/gemini.service';
import { CodeCompilerService } from '../services/code-compiler.service';
import {
  PromptRefinementService,
  RefinedPrompt,
} from '../services/prompt-refinement.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PluginChatService } from '../services/plugin-chat.service';

// Define return type for execPromise
interface ExecResult {
  stdout: string;
  stderr: string;
}

const execPromise = promisify<string, { cwd?: string }, ExecResult>(
  (cmd, options, callback) => {
    exec(cmd, options, (error, stdout, stderr) => {
      // Convert stdout and stderr to strings if they're Buffers
      const stdoutStr = Buffer.isBuffer(stdout)
        ? stdout.toString('utf8')
        : stdout;
      const stderrStr = Buffer.isBuffer(stderr)
        ? stderr.toString('utf8')
        : stderr;

      if (error) {
        error.stdout = stdoutStr;
        error.stderr = stderrStr;
        // Pass a valid ExecResult as the second argument even in error case
        callback(error, { stdout: stdoutStr, stderr: stderrStr });
      } else {
        callback(null, { stdout: stdoutStr, stderr: stderrStr });
      }
    });
  },
);

interface ProcessingState {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  output?: Record<string, unknown>;
}

// Type definitions for file operations
interface FileDetails {
  path: string;
  type: string;
  size: number;
}

interface FileAction {
  createdFiles: Array<{ path: string; content: string }>;
  modifiedFiles: Array<{ path: string; content: string }>;
  deletedFiles: string[];
}

interface JsonFixes {
  created: Record<string, string>;
  updated: Record<string, string>;
  deleted: string[];
}

@Controller('create')
export class CreateController {
  constructor(
    private readonly createService: CreateService,
    private readonly fileCompilerService: FileCompilerService,
    private readonly geminiService: GeminiService,
    private readonly codeCompilerService: CodeCompilerService,
    private readonly pluginChatService: PluginChatService,
    private readonly promptRefinementService: PromptRefinementService,
  ) {}
  private logState(
    state: ProcessingState,
    message: string,
    pluginName?: string,
  ): void {
    console.log(`[Agent] ${state.status}: ${message}`);
    if (state.error) {
      console.error(`Error: ${state.error}`);
    }
  }

  @Post()
  async create(@Body() createData: CreateRequestDto): Promise<string> {
    // Initialize agent processing state
    const state: ProcessingState = {
      status: 'pending',
    };

    // Add this variable at the start of the try block
    let needsRecompilation = false;

    try {
      // Get folder path for the requested plugin
      const folderName = createData.name;
      const folderPath = path.join(process.cwd(), 'generated', folderName);

      // Check if plugin directory already exists
      const pluginExists =
        fs.existsSync(folderPath) &&
        fs.existsSync(path.join(folderPath, 'pom.xml'));

      if (pluginExists) {
        this.logState(
          state,
          `Plugin '${folderName}' already exists - skipping generation and proceeding to recompilation`,
          folderName,
        );

        // Store the original prompt for reference
        const promptFilePath = path.join(folderPath, 'original_prompt.txt');
        fs.writeFileSync(promptFilePath, createData.prompt);

        // Jump directly to compilation step
        state.status = 'processing';
        this.logState(state, 'Recompiling existing project', folderName); // Compile with Maven with AI fixing enabled for better error recovery
        const compilationResult =
          await this.codeCompilerService.compileMavenProject(folderPath);

        if (compilationResult.success) {
          state.status = 'completed';
          this.logState(
            state,
            `Maven build successful. Artifact: ${compilationResult.artifactPath}`,
            folderName,
          );
          return `Existing project '${folderName}' recompiled successfully. Artifact: ${compilationResult.artifactPath}`;
        } else {
          state.status = 'failed';
          state.error = compilationResult.error;
          this.logState(
            state,
            `Maven build failed: ${compilationResult.error}`,
            folderName,
          );
          return `Recompilation failed for existing project '${folderName}': ${compilationResult.error}`;
        }
      }

      // If we get here, the plugin doesn't exist - proceed with normal creation
      // STEP 1: Create folder structure
      state.status = 'processing';
      this.logState(state, 'Starting project creation', folderName);

      if (!fs.existsSync(path.join(process.cwd(), 'generated'))) {
        fs.mkdirSync(path.join(process.cwd(), 'generated'));
      }

      fs.mkdirSync(folderPath, { recursive: true });

      // STEP 2: Copy and extract template
      const rarSourcePath = path.join(process.cwd(), 'resources', 'basic.rar');
      const rarDestPath = path.join(folderPath, 'basic.rar');

      fs.copyFileSync(rarSourcePath, rarDestPath);

      try {
        const extractor = await createExtractorFromFile({
          filepath: rarDestPath,
          targetPath: folderPath,
        });

        const list = extractor.extract();
        const extractedFiles = Array.from(list.files).map(
          (f) => f.fileHeader.name,
        );
        state.output = { extractedFiles };
        this.logState(
          state,
          `Extracted ${extractedFiles.length} files`,
          folderName,
        );

        fs.unlinkSync(rarDestPath);

        // STEP 3: Compile files
        state.status = 'processing';
        this.logState(state, 'Compiling project files', folderName);

        const compiledOutputPath = path.join(folderPath, 'compiled_files.txt');
        await this.fileCompilerService.compileDirectoryToTxt(
          folderPath,
          compiledOutputPath,
        );

        // Keep only the compiled text file
        this.logState(
          state,
          'Removing extracted files, keeping only compiled text',
          folderName,
        );

        // First, delete all individual files
        for (const file of extractedFiles) {
          const filePath = path.join(folderPath, file);
          if (fs.existsSync(filePath) && filePath !== compiledOutputPath) {
            try {
              if (fs.statSync(filePath).isDirectory()) {
                // Skip directories for now - we'll handle them after files
                continue;
              } else {
                fs.unlinkSync(filePath);
                console.log(`Deleted extracted file: ${filePath}`);
              }
            } catch (error) {
              console.error(
                `Error deleting ${filePath}:`,
                error instanceof Error ? error.message : String(error),
              );
            }
          }
        }

        // Now delete empty directories (bottom-up approach)
        this.logState(state, 'Cleaning up empty directories', folderName);
        const cleanupDirectories = () => {
          let deletedAny = false;
          const dirQueue: string[] = [];

          // Find all directories
          for (const file of extractedFiles) {
            const filePath = path.join(folderPath, file);
            if (
              fs.existsSync(filePath) &&
              fs.statSync(filePath).isDirectory()
            ) {
              dirQueue.push(filePath);
            }
          }

          // Sort by depth (deepest first)
          dirQueue.sort((a, b) => {
            return b.split(path.sep).length - a.split(path.sep).length;
          });

          // Try to delete each directory
          for (const dir of dirQueue) {
            try {
              const contents = fs.readdirSync(dir);
              if (contents.length === 0) {
                fs.rmdirSync(dir);
                console.log(`Removed empty directory: ${dir}`);
                deletedAny = true;
              } else {
                console.log(
                  `Skipping non-empty directory: ${dir} (contains ${contents.length} items)`,
                );
              }
            } catch (error) {
              console.error(
                `Error removing directory ${dir}:`,
                error instanceof Error ? error.message : String(error),
              );
            }
          }

          return deletedAny;
        };

        // Run multiple passes to handle nested directories
        let madeProgress = true;
        let passes = 0;
        const maxPasses = 5;

        while (madeProgress && passes < maxPasses) {
          passes++;
          madeProgress = cleanupDirectories();
        }

        console.log(`Directory cleanup completed after ${passes} passes`);

        // STEP 4: Refine prompt and process with AI
        state.status = 'processing';
        this.logState(
          state,
          'Refining prompt and processing with AI',
          folderName,
        );

        // STEP 4a: Refine the prompt using the PromptRefinementService
        const refinedPromptData =
          await this.promptRefinementService.refinePrompt(
            createData.prompt,
            folderName,
          );

        // Save refined prompt data for debugging and reference
        fs.writeFileSync(
          path.join(folderPath, 'refined_prompt.json'),
          JSON.stringify(refinedPromptData, null, 2),
        );

        this.logState(
          state,
          `Prompt refined - detected ${refinedPromptData.detectedFeatures.length} features, complexity: ${refinedPromptData.complexity}`,
          folderName,
        );

        // Initialize array with the proper type for template context
        const fileDetailsArray: FileDetails[] = [];
        for (const file of extractedFiles) {
          const filePath = path.join(folderPath, file);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            fileDetailsArray.push({
              path: file,
              type: path.extname(file),
              size: fs.statSync(filePath).size,
            });
          }
        }

        // Create final enhanced prompt combining refined prompt with template context
        const fileDetails = JSON.stringify(fileDetailsArray, null, 2);
        const finalPrompt = this.createFinalPrompt(
          refinedPromptData.refinedPrompt,
          fileDetails,
          refinedPromptData,
        );

        let parsedActions: FileAction;
        try {
          const geminiResponse = await this.geminiService.processWithGemini(
            finalPrompt,
            compiledOutputPath,
          );

          // Save AI response for debugging
          fs.writeFileSync(
            path.join(folderPath, 'gemini_response.txt'),
            geminiResponse,
          );

          // Parse AI response
          parsedActions = this.parseAIResponse(geminiResponse);

          // Validate AI created proper files
          const hasJavaPlugin = parsedActions.createdFiles.some(
            (f) =>
              f.path.endsWith('.java') &&
              f.content.includes('extends JavaPlugin'),
          );
          const hasPluginYml = parsedActions.createdFiles.some((f) =>
            f.path.includes('plugin.yml'),
          );

          if (
            !hasJavaPlugin ||
            !hasPluginYml ||
            parsedActions.createdFiles.length < 2
          ) {
            throw new Error('AI failed to create required files');
          }

          this.logState(
            state,
            `AI created ${parsedActions.createdFiles.length} files successfully`,
            folderName,
          );
        } catch (error) {
          this.logState(
            state,
            `AI processing failed: ${error}. Using powerful fallback.`,
            folderName,
          );
          parsedActions = this.createPowerfulFallback(
            createData.prompt,
            folderName,
          );
        }

        // STEP 4: Validate generated files and regenerate if needed
        state.status = 'processing';
        this.logState(state, 'Validating generated files', folderName);

        let finalActions = parsedActions;
        let validationResult = this.validateGeneratedFiles(
          parsedActions,
          folderPath,
          folderName,
        );
        let regenerationAttempts = 0;
        const maxRegenerationAttempts = 2;

        while (
          !validationResult.isValid &&
          regenerationAttempts < maxRegenerationAttempts
        ) {
          regenerationAttempts++;
          this.logState(
            state,
            `Validation failed (attempt ${regenerationAttempts}): ${validationResult.issues.join(', ')}. Regenerating files...`,
            folderName,
          );

          try {
            finalActions = await this.regenerateFiles(
              createData.prompt,
              folderName,
              folderPath,
              validationResult.issues,
              refinedPromptData,
              fileDetails,
              regenerationAttempts,
            );

            // Re-validate the regenerated files
            validationResult = this.validateGeneratedFiles(
              finalActions,
              folderPath,
              folderName,
            );

            if (validationResult.isValid) {
              this.logState(
                state,
                `Files successfully regenerated and validated on attempt ${regenerationAttempts}`,
                folderName,
              );
            }
          } catch (regenerationError) {
            this.logState(
              state,
              `Regeneration attempt ${regenerationAttempts} failed: ${regenerationError}`,
              folderName,
            );
            // Continue with the loop to try again or fall back to fallback
          }
        } // If validation still fails after max attempts, use fallback
        if (!validationResult.isValid) {
          this.logState(
            state,
            `Validation failed after ${maxRegenerationAttempts} regeneration attempts. Using fallback method.`,
            folderName,
          );
          finalActions = this.createPowerfulFallback(
            createData.prompt,
            folderName,
          );

          // Validate fallback (should always pass)
          const fallbackValidation = this.validateGeneratedFiles(
            finalActions,
            folderPath,
            folderName,
          );
          if (!fallbackValidation.isValid) {
            this.logState(
              state,
              `Warning: Even fallback method has validation issues: ${fallbackValidation.issues.join(', ')}`,
              folderName,
            );
          }
        } // DEFAULT: AI-powered semantic validation with static fallback
        // Uses free DeepSeek model for cost-effective quality analysis
        const disableAIValidation =
          process.env.DISABLE_AI_VALIDATION === 'true';
        if (validationResult.isValid && !disableAIValidation) {
          try {
            // Step 4 continues - AI validation part
            this.logState(
              state,
              'Running AI semantic validation (free DeepSeek model)',
              folderName,
            );
            const semanticResult = await this.validateWithAI(
              finalActions,
              createData.prompt,
              folderName,
              true,
            );

            this.logState(
              state,
              `Semantic validation complete. Quality score: ${semanticResult.qualityScore.toFixed(2)}`,
              folderName,
            );

            // Log quality insights for development
            if (semanticResult.suggestions.length > 0) {
              console.log(
                `Quality suggestions: ${semanticResult.suggestions.join(', ')}`,
              );
            }

            // Optional: Save quality report for analytics
            fs.writeFileSync(
              path.join(folderPath, 'quality_report.json'),
              JSON.stringify(
                {
                  qualityScore: semanticResult.qualityScore,
                  suggestions: semanticResult.suggestions,
                  timestamp: new Date().toISOString(),
                  prompt: createData.prompt,
                },
                null,
                2,
              ),
            );
          } catch (semanticError) {
            // AI validation failed - fallback to static validation (already passed)
            this.logState(
              state,
              `AI validation failed, using static validation fallback: ${semanticError.message}`,
              folderName,
            );
            console.log(
              'Note: Static validation passed, plugin is still valid',
            );
          }
        } else if (validationResult.isValid && disableAIValidation) {
          this.logState(
            state,
            'AI validation disabled - using static validation only',
            folderName,
          );
        }

        // STEP 5: Execute file operations with validated files
        state.status = 'processing';
        this.logState(state, 'Writing validated files to disk', folderName);

        const actionsCount = await this.executeFileActions(
          finalActions,
          folderPath,
        );

        // STEP 6: Compile with Maven
        state.status = 'processing';
        this.logState(state, 'Compiling project with Maven', folderName);

        const groupId = `com.${folderName.toLowerCase()}`;
        const artifactId = folderName.toLowerCase();
        this.codeCompilerService.generateMinimalPom(
          folderPath,
          groupId,
          artifactId,
        );
        const compilationResult =
          await this.codeCompilerService.compileMavenProject(folderPath);

        if (compilationResult.success) {
          state.status = 'completed';
          this.logState(
            state,
            `Maven build successful. Artifact: ${compilationResult.artifactPath}`,
            folderName,
          );

          return `Project created successfully at ${folderPath}. AI processing complete with ${actionsCount} file operations. JAR: ${compilationResult.artifactPath}`;
        } else {
          state.status = 'failed';
          state.error = compilationResult.error;
          this.logState(
            state,
            `Maven build failed: ${compilationResult.error}`,
            createData.name,
          );

          return `Project created but compilation failed: ${compilationResult.error}`;
        }
      } catch (extractError) {
        state.status = 'failed';
        state.error =
          extractError instanceof Error
            ? extractError.message
            : String(extractError);
        this.logState(state, 'Extraction failed', createData.name);

        console.error('Failed to extract or process files:', extractError);
        return `Partial success: Files created but processing failed: ${extractError instanceof Error ? extractError.message : String(extractError)}`;
      }
    } catch (error) {
      state.status = 'failed';
      state.error = error instanceof Error ? error.message : String(error);
      this.logState(state, 'Operation failed', createData.name);

      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Enhances a prompt with file details for AI processing
   */
  private enhancePrompt(prompt: string, fileDetails: string): string {
    return `
You are an expert Minecraft plugin developer. You MUST create a complete, functional Minecraft plugin.

USER REQUEST: ${prompt}

Template context: ${fileDetails}

STRICT REQUIREMENTS:
1. ALWAYS create exactly 3 files: Main Java class, plugin.yml, config.yml
2. Main Java class MUST extend JavaPlugin
3. Use descriptive package names (com.pluginname)
4. Include proper imports and error handling
5. Add event listeners and commands as needed

BUKKIT COLOR API REQUIREMENTS:
- NEVER use Color.valueOf(String) - this method does not exist in Bukkit Color API
- For RGB colors from hex: use Color.fromRGB(int r, int g, int b) or Color.fromRGB(int rgb)
- For named colors: use Color.RED, Color.BLUE, Color.GREEN, etc. (static constants)
- For chat colors: use ChatColor.RED, ChatColor.BLUE, etc. (not Color class)
- Example correct usage: Color.fromRGB(255, 0, 0) for red, Color.BLUE for blue
- Example WRONG usage: Color.valueOf("RED") - DO NOT USE THIS

OUTPUT FORMAT - Return ONLY valid JSON with NO additional text:

{
  "createdFiles": [
    {
      "path": "src/main/java/com/[packagename]/[ClassName].java",
      "content": "package com.[packagename];\n\nimport org.bukkit.plugin.java.JavaPlugin;\n// ... complete Java code"
    },
    {
      "path": "src/main/resources/plugin.yml",
      "content": "name: PluginName\nversion: 1.0\nmain: com.[packagename].[ClassName]\napi-version: 1.13"
    },
    {
      "path": "src/main/resources/config.yml",
      "content": "# Configuration file\nenable-features: true"
    }
  ],
  "modifiedFiles": [],
  "deletedFiles": []
}

EXAMPLE STRUCTURE:
- Package: com.greeter
- Class: GreeterPlugin extends JavaPlugin
- Include onEnable(), onDisable(), event handlers
- Plugin.yml must reference correct main class
- Config.yml with relevant settings

CREATE FUNCTIONAL CODE NOW!`;
  }

  /**
   * Creates the final prompt by combining refined prompt with template context
   */ private createFinalPrompt(
    refinedPrompt: string,
    fileDetails: string,
    refinedData: RefinedPrompt,
  ): string {
    return `
You are an expert Minecraft plugin developer. Create a complete, functional Minecraft plugin based on the refined specifications below.

${refinedPrompt}

Template context: ${fileDetails}

ADDITIONAL TECHNICAL SPECIFICATIONS:
- Package Name: ${refinedData.packageName}
- Main Class: ${refinedData.className}
- Plugin Name: ${refinedData.pluginName}
- Complexity Level: ${refinedData.complexity}

DETECTED FEATURES: ${refinedData.detectedFeatures.join(', ')}
SUGGESTED COMMANDS: ${refinedData.suggestedCommands.join(', ')}
SUGGESTED EVENTS: ${refinedData.suggestedEvents.join(', ')}

STRICT REQUIREMENTS:
1. ALWAYS create exactly 3 files: Main Java class, plugin.yml, config.yml
2. Main Java class MUST extend JavaPlugin and be named ${refinedData.className}
3. Use the exact package name: ${refinedData.packageName}
4. Include proper imports and comprehensive error handling
5. Add event listeners and commands as specified in the refined prompt
6. Use modern Bukkit/Spigot API (1.13+) with proper version compatibility
7. Include helpful player feedback messages and logging
8. Add configuration options for all customizable features
9. Implement proper permission checks for all commands
10. Follow Java coding standards and security best practices

BUKKIT COLOR API REQUIREMENTS:
- NEVER use Color.valueOf(String) - this method does not exist in Bukkit Color API
- For RGB colors from hex: use Color.fromRGB(int r, int g, int b) or Color.fromRGB(int rgb)
- For named colors: use Color.RED, Color.BLUE, Color.GREEN, etc. (static constants)
- For chat colors: use ChatColor.RED, ChatColor.BLUE, etc. (not Color class)
- Example correct usage: Color.fromRGB(255, 0, 0) for red, Color.BLUE for blue
- Example WRONG usage: Color.valueOf("RED") - DO NOT USE THIS

OUTPUT FORMAT - Return ONLY valid JSON with NO additional text:

OUTPUT FORMAT - Return ONLY valid JSON with NO additional text:

{
  "createdFiles": [
    {
      "path": "src/main/java/${refinedData.packageName.replace(/\./g, '/')}/${refinedData.className}.java",
      "content": "package ${refinedData.packageName};\\n\\nimport org.bukkit.plugin.java.JavaPlugin;\\n// ... complete Java implementation"
    },
    {
      "path": "src/main/resources/plugin.yml",
      "content": "name: ${refinedData.pluginName}\\nversion: 1.0\\nmain: ${refinedData.packageName}.${refinedData.className}\\napi-version: 1.13\\n// ... complete plugin.yml with all commands and permissions"
    },
    {
      "path": "src/main/resources/config.yml",
      "content": "# ${refinedData.pluginName} Configuration\\n// ... configuration settings relevant to the plugin features"
    }
  ],
  "modifiedFiles": [],
  "deletedFiles": []
}

IMPORTANT: Implement ALL features, commands, and event handlers specified in the refined prompt. Create production-ready, well-documented code that fully satisfies the user's requirements.
`;
  }

  /**
   * Simplified AI response parser
   */
  private parseAIResponse(aiResponse: string): FileAction {
    try {
      // Extract JSON from response
      let jsonContent = '';

      // Try code block first
      const codeBlockMatch = aiResponse.match(
        /```(?:json)?\s*(\{[\s\S]*?\})\s*```/,
      );
      if (codeBlockMatch) {
        jsonContent = codeBlockMatch[1];
      } else {
        // Try standalone JSON
        const standaloneMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (standaloneMatch) {
          jsonContent = standaloneMatch[0];
        }
      }

      if (jsonContent) {
        const parsed = JSON.parse(jsonContent) as FileAction;

        // Basic path fixing
        if (parsed.createdFiles) {
          parsed.createdFiles = parsed.createdFiles.map((file) => ({
            ...file,
            path: file.path.replace('src/resources/', 'src/main/resources/'),
          }));
        }

        console.log(`AI created ${parsed.createdFiles?.length || 0} files`);
        return parsed;
      }

      throw new Error('No valid JSON found in AI response');
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      throw new Error('AI response parsing failed');
    }
  }

  /**
   * Single powerful fallback - creates a complete functional plugin
   */
  private createPowerfulFallback(
    prompt: string,
    pluginName: string,
  ): FileAction {
    console.log('FALLBACK ACTIVATED: Creating complete plugin from scratch');

    // Analyze prompt for plugin type
    const lowerPrompt = prompt.toLowerCase();
    let mainClassName = 'CustomPlugin';
    let packageName = 'com.custom';
    let functionality = '';
    let configContent = '';
    let commands = '';

    // Smart plugin type detection
    if (lowerPrompt.includes('greet') || lowerPrompt.includes('welcome')) {
      mainClassName = 'GreeterPlugin';
      packageName = 'com.greeter';
      functionality = `
    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        String message = getConfig().getString("welcome-message", "Welcome %player%!");
        message = message.replace("%player%", player.getName());
        player.sendMessage(ChatColor.translateAlternateColorCodes('&', message));
    }`;
      configContent = `# Greeter Plugin Configuration
welcome-message: "&aWelcome %player%! &eEnjoy your stay!"
enable-welcome: true
broadcast-join: false`;
    } else if (
      lowerPrompt.includes('admin') ||
      lowerPrompt.includes('command')
    ) {
      mainClassName = 'AdminPlugin';
      packageName = 'com.admin';
      functionality = `
    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (command.getName().equalsIgnoreCase("admin")) {
            if (sender.hasPermission("admin.use")) {
                sender.sendMessage(ChatColor.GREEN + "Admin tools activated!");
                return true;
            } else {
                sender.sendMessage(ChatColor.RED + "No permission!");
            }
        }
        return false;
    }`;
      commands = `
commands:
  admin:
    description: Main admin command
    usage: /admin
    permission: admin.use`;
      configContent = `# Admin Plugin Configuration
enable-admin-tools: true
broadcast-admin-actions: true
admin-prefix: "&c[ADMIN]&r"}`;
    } else if (lowerPrompt.includes('teleport') || lowerPrompt.includes('tp')) {
      mainClassName = 'TeleportPlugin';
      packageName = 'com.teleport';
      functionality = `
    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (command.getName().equalsIgnoreCase("spawn") && sender instanceof Player) {
            Player player = (Player) sender;
            Location spawn = player.getWorld().getSpawnLocation();
            player.teleport(spawn);
            player.sendMessage(ChatColor.GREEN + "Teleported to spawn!");
            return true;
        }
        return false;
    }`;
      commands = `
commands:
  spawn:
    description: Teleport to spawn
    usage: /spawn`;
      configContent = `# Teleport Plugin Configuration
enable-spawn-teleport: true
teleport-delay: 3
safe-teleport: true`;
    } else {
      // Generic plugin
      configContent = `# ${mainClassName} Configuration
plugin-enabled: true
debug-mode: false
feature-settings:
  auto-save: true
  notifications: true`;
    }

    // Create complete Java class
    const javaContent = `package ${packageName};

import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.event.Listener;
import org.bukkit.event.EventHandler;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.Location;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;

public class ${mainClassName} extends JavaPlugin implements Listener {
    
    @Override
    public void onEnable() {
        getLogger().info("${mainClassName} v" + getDescription().getVersion() + " has been enabled!");
        
        // Register events
        Bukkit.getPluginManager().registerEvents(this, this);
        
        // Save default config
        saveDefaultConfig();
        
        // Load configuration
        reloadConfig();
        
        getLogger().info("${mainClassName} loaded successfully!");
    }
    
    @Override
    public void onDisable() {
        getLogger().info("${mainClassName} has been disabled!");
        saveConfig();
    }${functionality}
    
    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (command.getName().equalsIgnoreCase("${mainClassName.toLowerCase()}")) {
            sender.sendMessage(ChatColor.GREEN + "${mainClassName} v" + getDescription().getVersion());
            sender.sendMessage(ChatColor.YELLOW + "Status: Running");
            return true;
        }
        return false;
    }
}`;

    // Create plugin.yml
    const pluginYmlContent = `name: ${mainClassName}
version: 1.0
main: ${packageName}.${mainClassName}
api-version: 1.13
author: PegasusNest
description: ${prompt.substring(0, 100)}
website: https://pegasus-nest.dev${commands}

permissions:
  ${mainClassName.toLowerCase()}.use:
    description: Basic plugin usage
    default: true`;

    return {
      createdFiles: [
        {
          path: `src/main/java/${packageName.replace(/\./g, '/')}/${mainClassName}.java`,
          content: javaContent,
        },
        {
          path: 'src/main/resources/plugin.yml',
          content: pluginYmlContent,
        },
        {
          path: 'src/main/resources/config.yml',
          content: configContent,
        },
      ],
      modifiedFiles: [],
      deletedFiles: [],
    };
  }

  /**
   * Efficient file writer - writes all files in one pass
   */
  private async executeFileActions(
    actions: FileAction,
    basePath: string,
  ): Promise<number> {
    let actionsCount = 0;

    console.log(`Writing ${actions.createdFiles.length} files to disk...`);

    // Process all files efficiently
    for (const file of actions.createdFiles) {
      try {
        const fullPath = path.join(basePath, file.path);
        const dirPath = path.dirname(fullPath);

        // Create directory structure
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }

        // Write file
        fs.writeFileSync(fullPath, file.content, 'utf8');
        console.log(`✓ Created: ${file.path}`);
        actionsCount++;
      } catch (error) {
        console.error(`✗ Failed to create ${file.path}:`, error);
      }
    }

    // Handle deletions if any
    for (const filePath of actions.deletedFiles || []) {
      try {
        const fullPath = path.join(basePath, filePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log(`✓ Deleted: ${filePath}`);
          actionsCount++;
        }
      } catch (error) {
        console.error(`✗ Failed to delete ${filePath}:`, error);
      }
    }

    console.log(`File operations completed: ${actionsCount} total`);
    return actionsCount;
  }

  /**
   * Validates generated files to ensure they meet quality standards
   */
  private validateGeneratedFiles(
    actions: FileAction,
    folderPath: string,
    pluginName: string,
  ): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check if essential files exist
    const hasJavaFile = actions.createdFiles.some(
      (f) =>
        f.path.endsWith('.java') && f.content.includes('extends JavaPlugin'),
    );
    const hasPluginYml = actions.createdFiles.some((f) =>
      f.path.includes('plugin.yml'),
    );
    const hasConfigYml = actions.createdFiles.some((f) =>
      f.path.includes('config.yml'),
    );

    if (!hasJavaFile) {
      issues.push('Missing main Java plugin class that extends JavaPlugin');
    }
    if (!hasPluginYml) {
      issues.push('Missing plugin.yml file');
    }
    if (!hasConfigYml) {
      issues.push('Missing config.yml file');
    }

    // Validate Java file content quality
    const javaFiles = actions.createdFiles.filter((f) =>
      f.path.endsWith('.java'),
    );
    for (const javaFile of javaFiles) {
      const content = javaFile.content;

      // Check for basic required methods and imports
      if (!content.includes('onEnable()') && !content.includes('onEnable')) {
        issues.push(`Java file ${javaFile.path} missing onEnable() method`);
      }
      if (!content.includes('import org.bukkit')) {
        issues.push(`Java file ${javaFile.path} missing Bukkit imports`);
      }
      if (content.includes('// ... ') || content.includes('// TODO')) {
        issues.push(
          `Java file ${javaFile.path} contains incomplete code placeholders`,
        );
      }
      if (content.length < 200) {
        issues.push(
          `Java file ${javaFile.path} seems too short (${content.length} chars)`,
        );
      }
    }

    // Validate plugin.yml content
    const pluginYmlFile = actions.createdFiles.find((f) =>
      f.path.includes('plugin.yml'),
    );
    if (pluginYmlFile) {
      const content = pluginYmlFile.content;
      if (
        !content.includes('name:') ||
        !content.includes('main:') ||
        !content.includes('version:')
      ) {
        issues.push('plugin.yml missing required fields (name, main, version)');
      }
      if (!content.includes(pluginName)) {
        issues.push('plugin.yml does not reference the plugin name');
      }
    }

    // Check for syntax issues in files
    for (const file of actions.createdFiles) {
      // Ensure file.content exists before processing
      if (!file.content) {
        issues.push(`File ${file.path} has no content`);
        continue;
      }

      if (file.content.includes('${') && file.content.includes('}')) {
        issues.push(`File ${file.path} contains unresolved template variables`);
      }
      if (file.content.trim().length === 0) {
        issues.push(`File ${file.path} is empty`);
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
  /**
   * AI-powered semantic validation using free DeepSeek model
   * Default quality checking with static validation as fallback
   * Uses deepseek/deepseek-prover-v2:free for cost-effective analysis
   */
  private async validateWithAI(
    actions: FileAction,
    originalPrompt: string,
    pluginName: string,
    enableSemanticValidation: boolean = true,
  ): Promise<{ qualityScore: number; suggestions: string[] }> {
    if (!enableSemanticValidation) {
      return { qualityScore: 1.0, suggestions: [] };
    }

    try {
      const javaFile = actions.createdFiles.find((f) =>
        f.path.endsWith('.java'),
      );
      const pluginYml = actions.createdFiles.find((f) =>
        f.path.includes('plugin.yml'),
      );

      if (!javaFile || !pluginYml) {
        return { qualityScore: 0.5, suggestions: ['Missing essential files'] };
      }

      const semanticPrompt = `
You are a senior Minecraft plugin developer conducting a code review. Analyze this plugin for quality and completeness.

ORIGINAL REQUEST: ${originalPrompt}
PLUGIN NAME: ${pluginName}

JAVA CODE:
${javaFile.content.substring(0, 2000)} ${javaFile.content.length > 2000 ? '...' : ''}

PLUGIN.YML:
${pluginYml.content}

Rate the plugin on a scale of 0.0 to 1.0 and provide improvement suggestions:

{
  "qualityScore": 0.85,
  "suggestions": [
    "Add null checks in event handlers",
    "Consider adding command tab completion",
    "Add more configuration options"
  ],
  "strengths": [
    "Good error handling",
    "Proper event registration"
  ],
  "fulfillsRequest": true
}

Focus on: Code quality, feature completeness, best practices, security, and user experience.
Return ONLY the JSON, no additional text.`;
      const aiResponse = await this.geminiService.processDirectPrompt(
        semanticPrompt,
        'deepseek/deepseek-prover-v2:free', // Use free model for cost-effective validation
      );

      const result = JSON.parse(
        aiResponse.match(/\{[\s\S]*\}/)?.[0] ||
          '{"qualityScore": 0.8, "suggestions": []}',
      );
      return {
        qualityScore: result.qualityScore || 0.8,
        suggestions: result.suggestions || [],
      };
    } catch (error) {
      console.log(
        `AI validation failed, falling back to static validation: ${error.message}`,
      );
      return {
        qualityScore: 0.8,
        suggestions: ['AI validation unavailable - using static validation'],
      }; // Graceful fallback to static validation
    }
  }

  /**
   * Regenerates files using AI with enhanced validation prompt
   */
  private async regenerateFiles(
    originalPrompt: string,
    pluginName: string,
    folderPath: string,
    previousIssues: string[],
    refinedData: RefinedPrompt,
    fileDetails: string,
    attempt: number = 1,
  ): Promise<FileAction> {
    const issuesText = previousIssues.join('; ');

    const regenerationPrompt = this.createRegenerationPrompt(
      originalPrompt,
      refinedData,
      fileDetails,
      issuesText,
      attempt,
    );

    const geminiResponse =
      await this.geminiService.processWithGemini(regenerationPrompt);

    // Save regeneration response for debugging
    fs.writeFileSync(
      path.join(folderPath, `gemini_regeneration_attempt_${attempt}.txt`),
      geminiResponse,
    );

    return this.parseAIResponse(geminiResponse);
  }

  /**
   * Creates enhanced prompt for file regeneration
   */
  private createRegenerationPrompt(
    originalPrompt: string,
    refinedData: RefinedPrompt,
    fileDetails: string,
    previousIssues: string,
    attempt: number,
  ): string {
    return `
You are an expert Minecraft plugin developer. Your previous attempt to create a plugin had validation issues and needs to be regenerated.

ORIGINAL USER REQUEST: ${originalPrompt}

REFINED SPECIFICATIONS:
- Package Name: ${refinedData.packageName}
- Main Class: ${refinedData.className}
- Plugin Name: ${refinedData.pluginName}
- Complexity Level: ${refinedData.complexity}
- Detected Features: ${refinedData.detectedFeatures.join(', ')}
- Suggested Commands: ${refinedData.suggestedCommands.join(', ')}
- Suggested Events: ${refinedData.suggestedEvents.join(', ')}

PREVIOUS ISSUES: ${previousIssues}

ATTEMPT ${attempt} - FOCUS ON:
- Fixing all validation issues
- Ensuring complete and functional code
- Meeting all user requirements

STRICT REQUIREMENTS:
1. ALWAYS create exactly 3 files: Main Java class, plugin.yml, config.yml
2. Main Java class MUST extend JavaPlugin and be named ${refinedData.className}
3. Use the exact package name: ${refinedData.packageName}
4. Include proper imports and comprehensive error handling
5. Add event listeners and commands as specified in the refined prompt
6. Use modern Bukkit/Spigot API (1.13+) with proper version compatibility
7. Include helpful player feedback messages and logging
8. Add configuration options for all customizable features
9. Implement proper permission checks for all commands
10. Follow Java coding standards and security best practices

BUKKIT COLOR API REQUIREMENTS:
- NEVER use Color.valueOf(String) - this method does not exist in Bukkit Color API
- For RGB colors from hex: use Color.fromRGB(int r, int g, int b) or Color.fromRGB(int rgb)
- For named colors: use Color.RED, Color.BLUE, Color.GREEN, etc. (static constants)
- For chat colors: use ChatColor.RED, ChatColor.BLUE, etc. (not Color class)
- Example correct usage: Color.fromRGB(255, 0, 0) for red, Color.BLUE for blue
- Example WRONG usage: Color.valueOf("RED") - DO NOT USE THIS

OUTPUT FORMAT - Return ONLY valid JSON with NO additional text:

{
  "createdFiles": [
    {
      "path": "src/main/java/${refinedData.packageName.replace(/\./g, '/')}/${refinedData.className}.java",
      "content": "package ${refinedData.packageName};\\n\\nimport org.bukkit.plugin.java.JavaPlugin;\\n// ... complete Java implementation"
    },
    {
      "path": "src/main/resources/plugin.yml",
      "content": "name: ${refinedData.pluginName}\\nversion: 1.0\\nmain: ${refinedData.packageName}.${refinedData.className}\\napi-version: 1.13\\n// ... complete plugin.yml with all commands and permissions"
    },
    {
      "path": "src/main/resources/config.yml",
      "content": "# ${refinedData.pluginName} Configuration\\n// ... configuration settings relevant to the plugin features"
    }
  ],
  "modifiedFiles": [],
  "deletedFiles": []
}

IMPORTANT: Implement ALL features, commands, and event handlers specified in the refined prompt. Create production-ready, well-documented code that fully satisfies the user's requirements.
`;
  }

  @Get('plugins')
  async listPlugins(): Promise<string[]> {
    try {
      const generatedPath = path.join(process.cwd(), 'generated');

      if (!fs.existsSync(generatedPath)) {
        return [];
      }

      const items = fs.readdirSync(generatedPath);
      const plugins = items.filter((item) => {
        const itemPath = path.join(generatedPath, item);
        return fs.statSync(itemPath).isDirectory();
      });

      return plugins;
    } catch (error) {
      console.error('Error listing plugins:', error);
      return [];
    }
  }

  @Get('download/:pluginName')
  async downloadPlugin(
    @Param('pluginName') pluginName: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    try {
      const pluginFolderPath = path.join(
        process.cwd(),
        'generated',
        pluginName,
      );

      // Check if plugin folder exists
      if (!fs.existsSync(pluginFolderPath)) {
        throw new NotFoundException(`Plugin '${pluginName}' not found`);
      }

      // Look for the compiled JAR file in target directory
      const targetDir = path.join(pluginFolderPath, 'target');
      if (!fs.existsSync(targetDir)) {
        throw new NotFoundException(
          `Plugin '${pluginName}' has not been compiled yet`,
        );
      }

      // Find JAR files
      const jarFiles = fs
        .readdirSync(targetDir)
        .filter(
          (file) =>
            file.endsWith('.jar') &&
            !file.endsWith('-sources.jar') &&
            !file.endsWith('-javadoc.jar') &&
            !file.endsWith('-shaded.jar'),
        );

      if (jarFiles.length === 0) {
        throw new NotFoundException(
          `No compiled JAR file found for plugin '${pluginName}'`,
        );
      }

      // Get the most recent JAR file
      const sortedJars = jarFiles
        .map((file) => ({
          file,
          mtime: fs.statSync(path.join(targetDir, file)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      const jarPath = path.join(targetDir, sortedJars[0].file);
      const jarBuffer = fs.readFileSync(jarPath);

      // Set response headers for download
      res.set({
        'Content-Type': 'application/java-archive',
        'Content-Disposition': `attachment; filename="${pluginName}.jar"`,
        'Content-Length': jarBuffer.length.toString(),
      });

      return new StreamableFile(jarBuffer);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(
        `Error downloading plugin '${pluginName}': ${error.message}`,
      );
    }
  }

  @Post('chat')
  async chat(
    @Body() chatData: ChatRequestDto,
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      // Validate required parameters
      if (!chatData.pluginName) {
        return {
          success: false,
          error: 'Plugin name is required',
        };
      }

      console.log(
        `Chat request received for plugin: ${chatData.pluginName}, message: ${chatData.message}`,
      );

      const response =
        await this.pluginChatService.getChatResponseWithRefinement(
          chatData.message,
          chatData.pluginName,
        );

      return {
        success: true,
        response: response,
      };
    } catch (error) {
      console.error('Chat endpoint error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }


}
