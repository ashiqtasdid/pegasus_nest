/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Res,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { CreateService } from '../services/create.service';
import { CreateRequestDto } from './dto/create-request.dto';
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
  status:
    | 'pending'
    | 'extracting'
    | 'compiling'
    | 'processing'
    | 'completed'
    | 'failed';
  step: number;
  totalSteps: number;
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

  private logState(state: ProcessingState, message: string): void {
    console.log(
      `[Agent] Step ${state.step}/${state.totalSteps} - ${state.status}: ${message}`,
    );
    if (state.error) {
      console.error(`Error: ${state.error}`);
    }
  }

  @Post()
  async create(@Body() createData: CreateRequestDto): Promise<string> {
    // Initialize agent processing state
    const state: ProcessingState = {
      status: 'pending',
      step: 0,
      totalSteps: 6,
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
        );

        // Store the original prompt for reference
        const promptFilePath = path.join(folderPath, 'original_prompt.txt');
        fs.writeFileSync(promptFilePath, createData.prompt);

        // Jump directly to compilation step

        state.step = 6;
        state.status = 'compiling';
        this.logState(state, 'Recompiling existing project'); // Compile with Maven with AI fixing enabled for better error recovery
        const compilationResult =
          await this.codeCompilerService.compileMavenProject(folderPath);

        if (compilationResult.success) {
          this.logState(
            state,
            `Maven build successful. Artifact: ${compilationResult.artifactPath}`,
          );
          return `Existing project '${folderName}' recompiled successfully. Artifact: ${compilationResult.artifactPath}`;
        } else {
          state.status = 'completed';
          state.error = compilationResult.error;
          this.logState(
            state,
            `Maven build failed: ${compilationResult.error}`,
          );
          return `Recompilation failed for existing project '${folderName}': ${compilationResult.error}`;
        }
      }

      // If we get here, the plugin doesn't exist - proceed with normal creation
      // STEP 1: Create folder structure
      state.status = 'extracting';
      state.step = 1;
      this.logState(state, 'Starting project creation');

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
        this.logState(state, `Extracted ${extractedFiles.length} files`);

        fs.unlinkSync(rarDestPath);

        // STEP 3: Compile files
        state.status = 'compiling';
        state.step = 2;
        this.logState(state, 'Compiling project files');

        const compiledOutputPath = path.join(folderPath, 'compiled_files.txt');
        await this.fileCompilerService.compileDirectoryToTxt(
          folderPath,
          compiledOutputPath,
        );

        // Keep only the compiled text file
        this.logState(
          state,
          'Removing extracted files, keeping only compiled text',
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
        this.logState(state, 'Cleaning up empty directories');
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

        console.log(`Directory cleanup completed after ${passes} passes`); // STEP 4: Refine prompt and process with AI
        state.status = 'processing';
        state.step = 3;
        this.logState(state, 'Refining prompt and processing with AI');

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
          );
        } catch (error) {
          this.logState(
            state,
            `AI processing failed: ${error}. Using powerful fallback.`,
          );
          parsedActions = this.createPowerfulFallback(
            createData.prompt,
            folderName,
          );
        }

        // Execute file operations
        state.step = 4;
        state.status = 'completed';
        this.logState(state, 'Writing files to disk');

        const actionsCount = await this.executeFileActions(
          parsedActions,
          folderPath,
        );

        // Compile with Maven
        state.step = 5;
        state.status = 'compiling';
        this.logState(state, 'Compiling project with Maven');

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
          this.logState(
            state,
            `Maven build successful. Artifact: ${compilationResult.artifactPath}`,
          );
          return `Project created successfully at ${folderPath}. AI processing complete with ${actionsCount} file operations. JAR: ${compilationResult.artifactPath}`;
        } else {
          this.logState(
            state,
            `Maven build failed: ${compilationResult.error}`,
          );
          return `Project created but compilation failed: ${compilationResult.error}`;
        }
      } catch (extractError) {
        state.status = 'failed';
        state.error =
          extractError instanceof Error
            ? extractError.message
            : String(extractError);
        this.logState(state, 'Extraction failed');
        console.error('Failed to extract or process files:', extractError);
        return `Partial success: Files created but processing failed: ${extractError instanceof Error ? extractError.message : String(extractError)}`;
      }
    } catch (error) {
      state.status = 'failed';
      state.error = error instanceof Error ? error.message : String(error);
      this.logState(state, 'Operation failed');
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

  @Get('download/:pluginName')
  async downloadPlugin(
    @Param('pluginName') pluginName: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    // Get folder path for the requested plugin
    const folderPath = path.join(process.cwd(), 'generated', pluginName);
    const targetPath = path.join(folderPath, 'target');

    // Check if plugin directory exists
    if (!fs.existsSync(folderPath)) {
      throw new NotFoundException(`Plugin '${pluginName}' not found`);
    }

    // Check if target directory exists (plugin has been compiled)
    if (!fs.existsSync(targetPath)) {
      throw new NotFoundException(
        `Plugin '${pluginName}' hasn't been compiled yet`,
      );
    }

    // Find the latest JAR file in the target directory
    const files = fs.readdirSync(targetPath);
    const jarFiles = files.filter(
      (file) =>
        file.endsWith('.jar') &&
        !file.endsWith('-sources.jar') &&
        !file.endsWith('-javadoc.jar'),
    );

    if (jarFiles.length === 0) {
      throw new NotFoundException(
        `No compiled JAR found for plugin '${pluginName}'`,
      );
    }

    // Get the latest JAR file (by modification time if multiple exist)
    let latestJar = jarFiles[0];
    let latestTime = fs
      .statSync(path.join(targetPath, latestJar))
      .mtime.getTime();

    for (let i = 1; i < jarFiles.length; i++) {
      const jarFile = jarFiles[i];
      const modTime = fs
        .statSync(path.join(targetPath, jarFile))
        .mtime.getTime();
      if (modTime > latestTime) {
        latestJar = jarFile;
        latestTime = modTime;
      }
    }

    const jarPath = path.join(targetPath, latestJar);

    // Set response headers for file download
    response.set({
      'Content-Type': 'application/java-archive',
      'Content-Disposition': `attachment; filename="${latestJar}"`,
    });

    // Create a readable stream from the file
    const fileStream = fs.createReadStream(jarPath);

    // Return the file as a StreamableFile
    return new StreamableFile(fileStream);
  }
  @Post('chat')
  async chatAboutPlugin(
    @Body() chatRequest: { message: string; pluginName: string },
  ): Promise<string> {
    try {
      // Log the incoming chat request
      console.log(
        `[Chat] Processing message for plugin "${chatRequest.pluginName}": ${chatRequest.message}`,
      );

      // Use enhanced chat service with prompt refinement
      const response =
        await this.pluginChatService.getChatResponseWithRefinement(
          chatRequest.message,
          chatRequest.pluginName,
        );

      console.log(`[Chat] Successfully processed chat request`);
      return response;
    } catch (error) {
      console.error(`[Chat] Error processing chat request: ${error.message}`);

      // Return a user-friendly error message instead of letting the error bubble up
      if (
        error.message.includes('ECONNRESET') ||
        error.message.includes('socket hang up')
      ) {
        return `I'm experiencing connection issues right now. Please try your request again in a moment.`;
      } else if (
        error.message.includes('timeout') ||
        error.message.includes('ETIMEDOUT')
      ) {
        return `The request is taking longer than expected. Please try again with a simpler message.`;
      } else if (error.message.includes('Rate limit')) {
        return `I'm receiving too many requests right now. Please wait a moment and try again.`;
      } else {
        return `I encountered an issue while processing your request: ${error.message}. Please try rephrasing your message.`;
      }
    }
  }
}
