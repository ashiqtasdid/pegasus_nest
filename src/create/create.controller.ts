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
import { ChatStorageService } from '../services/chat-storage.service';
import { ChatSession } from '../models/chat-session.model';
import { exec } from 'child_process';
import { promisify } from 'util';

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
    private readonly chatStorageService: ChatStorageService,
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
      totalSteps: 5,
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
        this.logState(state, 'Recompiling existing project');

        // Compile with Maven (changed from true to false to disable auto-fix)
        const compilationResult =
          await this.codeCompilerService.compileMavenProject(folderPath, false);

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

        console.log(`Directory cleanup completed after ${passes} passes`);

        // STEP 4: Process with AI
        state.status = 'processing';
        state.step = 3;
        this.logState(state, 'Processing with Gemini AI');

        // Initialize array with the proper type
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

        // Add agent instructions to the prompt with file details
        const fileDetails = JSON.stringify(fileDetailsArray, null, 2);
        const enhancedPrompt = this.enhancePrompt(
          createData.prompt,
          fileDetails,
        );

        const geminiResponse = await this.geminiService.processWithGemini(
          enhancedPrompt,
          compiledOutputPath,
        );

        // STEP 5: Analyze response and take action
        state.step = 4;
        this.logState(state, 'Analyzing AI response');

        const responseOutputPath = path.join(folderPath, 'gemini_response.txt');
        fs.writeFileSync(responseOutputPath, geminiResponse);

        // Parse response and extract actionable items
        const parsedActions = this.parseAIResponse(geminiResponse);

        // STEP 6: Execute actions based on AI response
        state.step = 5;
        state.status = 'completed';
        this.logState(state, 'Executing project actions');

        // Use the controller's own method instead of the service
        const actionsCount = await this.executeFileActions(
          parsedActions,
          folderPath,
        );

        // STEP 6.5: Verify and fix Minecraft plugin files
        state.step = 5.5;
        this.logState(state, 'Verifying Minecraft plugin configuration');

        // Check if this is a Minecraft plugin by looking for plugin.yml
        const pluginYmlPath = path.join(
          folderPath,
          'src',
          'main',
          'resources',
          'plugin.yml',
        );
        const pluginYmlExists = fs.existsSync(pluginYmlPath);

        // Also check for possible incorrect locations
        const incorrectLocations = [
          path.join(folderPath, 'plugin.yml'),
          path.join(folderPath, 'resources', 'plugin.yml'),
          path.join(folderPath, 'src', 'resources', 'plugin.yml'),
        ];

        let foundPluginYml = false;
        let incorrectPluginYmlPath: string | null = null;
        for (const loc of incorrectLocations) {
          if (fs.existsSync(loc)) {
            foundPluginYml = true;
            incorrectPluginYmlPath = loc;
            break;
          }
        }

        // If plugin.yml exists in wrong location, move it to the correct location
        if (!pluginYmlExists && foundPluginYml && incorrectPluginYmlPath) {
          this.logState(
            state,
            `Found plugin.yml in incorrect location: ${incorrectPluginYmlPath}`,
          );

          // Create resources directory if it doesn't exist
          const resourcesDir = path.join(
            folderPath,
            'src',
            'main',
            'resources',
          );
          if (!fs.existsSync(resourcesDir)) {
            fs.mkdirSync(resourcesDir, { recursive: true });
          }

          // Copy file to correct location
          fs.copyFileSync(incorrectPluginYmlPath, pluginYmlPath);
          this.logState(
            state,
            `Moved plugin.yml to correct location: ${pluginYmlPath}`,
          );

          // Flag for recompilation
          needsRecompilation = true;
        }

        // Check for config.yml in the correct location
        const configYmlPath = path.join(
          folderPath,
          'src',
          'main',
          'resources',
          'config.yml',
        );
        const configYmlExists = fs.existsSync(configYmlPath);

        // Check for config.yml in incorrect locations
        const incorrectConfigLocations = [
          path.join(folderPath, 'config.yml'),
          path.join(folderPath, 'resources', 'config.yml'),
          path.join(folderPath, 'src', 'resources', 'config.yml'),
        ];

        let foundConfigYml = false;
        let incorrectConfigYmlPath: string | null = null;
        for (const loc of incorrectConfigLocations) {
          if (fs.existsSync(loc)) {
            foundConfigYml = true;
            incorrectConfigYmlPath = loc;
            break;
          }
        }

        // If config.yml exists in wrong location, move it to the correct location
        if (!configYmlExists && foundConfigYml && incorrectConfigYmlPath) {
          this.logState(
            state,
            `Found config.yml in incorrect location: ${incorrectConfigYmlPath}`,
          );

          // Resources directory should already exist from plugin.yml check
          // Copy file to correct location
          fs.copyFileSync(incorrectConfigYmlPath, configYmlPath);
          this.logState(
            state,
            `Moved config.yml to correct location: ${configYmlPath}`,
          );

          // Flag for recompilation
          needsRecompilation = true;
        }

        // Update the pom.xml to ensure resources are included
        const pomPath = path.join(folderPath, 'pom.xml');
        if (fs.existsSync(pomPath)) {
          let pomContent = fs.readFileSync(pomPath, 'utf8');

          // Check if resources are configured properly
          if (
            !pomContent.includes('<resources>') ||
            !pomContent.includes('src/main/resources')
          ) {
            this.logState(state, 'Updating pom.xml to include resources');

            // Add resources section if it doesn't exist
            if (!pomContent.includes('<build>')) {
              pomContent = pomContent.replace(
                '</project>',
                `
    <build>
      <resources>
        <resource>
          <directory>src/main/resources</directory>
          <filtering>true</filtering>
        </resource>
      </resources>
    </build>
  </project>`,
              );
            } else if (!pomContent.includes('<resources>')) {
              pomContent = pomContent.replace(
                '<build>',
                `<build>
      <resources>
        <resource>
          <directory>src/main/resources</directory>
          <filtering>true</filtering>
        </resource>
      </resources>`,
              );
            }

            fs.writeFileSync(pomPath, pomContent);

            // Flag for recompilation
            needsRecompilation = true;
          }
        }

        // STEP 7: Compile the project with Maven
        if (actionsCount > 0 || needsRecompilation) {
          // If we moved files, indicate we're recompiling
          if (needsRecompilation) {
            state.step = 6;
            state.status = 'compiling';
            this.logState(
              state,
              'Recompiling project after moving configuration files',
            );
          } else {
            state.step = 6;
            state.status = 'compiling';
            this.logState(state, 'Compiling project with Maven');
          }

          // Generate a pom.xml file if not present
          const groupId = `com.${folderName.toLowerCase()}`;
          const artifactId = folderName.toLowerCase();
          this.codeCompilerService.generateMinimalPom(
            folderPath,
            groupId,
            artifactId,
          );

          // Compile with Maven (changed from true to false to disable auto-fix)
          const compilationResult =
            await this.codeCompilerService.compileMavenProject(
              folderPath,
              false,
            );

          if (compilationResult.success) {
            this.logState(
              state,
              `Maven build successful. Artifact: ${compilationResult.artifactPath}`,
            );

            // Add after successful Maven compilation
            if (compilationResult.artifactPath) {
              // Verify JAR contents
              this.logState(state, 'Verifying JAR contents');

              try {
                const { stdout } = await execPromise(
                  `jar tf "${compilationResult.artifactPath}"`,
                  { cwd: folderPath },
                );

                const hasPluginYml = stdout.includes('plugin.yml');
                const hasConfigYml = stdout.includes('config.yml');

                if (!hasPluginYml) {
                  this.logState(
                    state,
                    'WARNING: plugin.yml not found in JAR file',
                  );
                }

                if (!hasConfigYml) {
                  this.logState(
                    state,
                    'WARNING: config.yml not found in JAR file',
                  );
                }

                if (!hasPluginYml || !hasConfigYml) {
                  // Extract more details about the JAR
                  this.logState(state, 'JAR contents:');
                  console.log(stdout);
                } else {
                  this.logState(
                    state,
                    'Verified plugin.yml and config.yml are properly included in JAR',
                  );
                }
              } catch (error) {
                this.logState(
                  state,
                  `Failed to verify JAR contents: ${error instanceof Error ? error.message : String(error)}`,
                );
              }
            }
          } else {
            state.status = 'completed';
            state.error = compilationResult.error;
            this.logState(
              state,
              `Maven build failed: ${compilationResult.error}`,
            );
          }
        }

        return `Project created successfully at ${folderPath}. AI processing complete with ${actionsCount} file operations.`;
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

  @Post('auto')
  async createWithAutoFix(
    @Body() createData: CreateRequestDto,
  ): Promise<string> {
    // Use the injected service instead of creating a new instance
    const session = await this.chatStorageService.createSession(
      createData.name,
    );

    // Add the initial prompt as a user message
    await this.chatStorageService.addMessage(session.id, {
      role: 'user',
      content: `/generate ${createData.prompt}`,
      timestamp: new Date(),
    });

    try {
      // Start the generation process
      await this.chatStorageService.addMessage(session.id, {
        role: 'system',
        content: `Starting plugin generation for '${createData.name}'`,
        timestamp: new Date(),
      });

      // Call the regular create method
      const result = await this.create(createData);

      // Record the result in the chat
      await this.chatStorageService.addMessage(session.id, {
        role: 'assistant',
        content: result,
        timestamp: new Date(),
      });

      // Check if compilation failed
      if (result.includes('failed') || result.includes('Error:')) {
        // Start the auto-fix process
        return await this.autoFixCompilationErrors(session, createData);
      }

      return `Plugin '${createData.name}' created successfully! Chat session ID: ${session.id}`;
    } catch (error) {
      await this.chatStorageService.addMessage(session.id, {
        role: 'system',
        content: `Error during plugin generation: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      });

      return `Error creating plugin: ${error instanceof Error ? error.message : String(error)}. Chat session ID: ${session.id}`;
    }
  }

  private async autoFixCompilationErrors(
    session: ChatSession,
    createData: CreateRequestDto,
    attempts = 0,
  ): Promise<string> {
    const maxAttempts = 3;

    if (attempts >= maxAttempts) {
      await this.chatStorageService.addMessage(session.id, {
        role: 'system',
        content: `Maximum fix attempts (${maxAttempts}) reached. Manual intervention required.`,
        timestamp: new Date(),
      });

      return `Plugin creation completed with errors. Maximum fix attempts reached. Chat session ID: ${session.id}`;
    }

    // Get plugin path
    const folderPath = path.join(process.cwd(), 'generated', createData.name);

    // Step 1: Re-run file compiler to get fresh file contents
    const compiledOutputPath = path.join(folderPath, 'output.txt');
    await this.fileCompilerService.compileDirectoryToTxt(
      folderPath,
      compiledOutputPath,
    );

    await this.chatStorageService.addMessage(session.id, {
      role: 'system',
      content: 'Regenerated file content summary for error analysis',
      timestamp: new Date(),
    });

    // Step 2: Read compilation errors
    let errorDetails = '';
    try {
      const mavenLogPath = path.join(folderPath, 'maven.log');
      if (fs.existsSync(mavenLogPath)) {
        errorDetails = fs.readFileSync(mavenLogPath, 'utf8');
      }
    } catch (error) {
      console.error(
        'Failed to read error logs:',
        error instanceof Error ? error.message : String(error),
      );
    }

    // Step 3: Create the AI prompt with context, error details, and file contents
    const fileContents = fs.existsSync(compiledOutputPath)
      ? fs.readFileSync(compiledOutputPath, 'utf8')
      : 'No file contents available';

    const contextPrompt = `You are fixing compilation errors in a Minecraft plugin called '${createData.name}'.

COMPILATION ERRORS:
${errorDetails}

PROJECT FILES:
${fileContents}

INSTRUCTIONS:
1. Analyze the errors and identify which files need to be modified.
2. Provide the FULL content of any files that need to be created, updated, or deleted.
3. Format your response as a JSON object with this exact structure:
{
  "created": {
    "path/to/file1.java": "full file content here",
    "path/to/file2.java": "full file content here"
  },
  "updated": {
    "path/to/existingFile.java": "full updated content here"
  },
  "deleted": [
    "path/to/fileToDelete.java"
  ]
}

DO NOT include any explanations or comments outside the JSON structure. The response must be valid JSON.`;

    try {
      // Step 4: Get the AI's fix suggestions
      console.log('Sending prompt to AI for error fixes...');
      const aiResponse =
        await this.geminiService.processWithGemini(contextPrompt);

      await this.chatStorageService.addMessage(session.id, {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
      });

      // Step 5: Extract JSON fixes from AI response
      console.log('Extracting JSON fixes from AI response...');
      const fixes = this.extractFixesFromJson(aiResponse);

      if (!fixes) {
        await this.chatStorageService.addMessage(session.id, {
          role: 'system',
          content:
            'Failed to parse AI response as valid JSON. Trying different parsing approach...',
          timestamp: new Date(),
        });

        // Try alternative parsing if JSON extraction failed
        const alternativeFixes = this.extractCodeFixes(aiResponse);
        if (
          !alternativeFixes ||
          (!alternativeFixes.createdFiles.length &&
            !alternativeFixes.modifiedFiles.length)
        ) {
          throw new Error('Could not extract valid fixes from AI response');
        }

        // Execute the alternative fixes
        await this.chatStorageService.addMessage(session.id, {
          role: 'system',
          content: `Applying fixes using alternative parser: ${alternativeFixes.createdFiles.length} created, ${alternativeFixes.modifiedFiles.length} modified`,
          timestamp: new Date(),
        });

        await this.executeFileActions(alternativeFixes, folderPath);
      } else {
        // Step 6: Apply the fixes to the filesystem
        await this.chatStorageService.addMessage(session.id, {
          role: 'system',
          content: `Applying suggested fixes: ${Object.keys(fixes.created || {}).length} created, ${Object.keys(fixes.updated || {}).length} updated, ${(fixes.deleted || []).length} deleted`,
          timestamp: new Date(),
        });

        // Convert fixes to the format expected by executeFileActions
        const actionsFormat: FileAction = {
          createdFiles: Object.entries(fixes.created || {}).map(
            ([filePath, content]) => ({ path: filePath, content }),
          ),
          modifiedFiles: Object.entries(fixes.updated || {}).map(
            ([filePath, content]) => ({ path: filePath, content }),
          ),
          deletedFiles: fixes.deleted || [],
        };

        await this.executeFileActions(actionsFormat, folderPath);
      }

      // Step 7: Try compiling again
      await this.chatStorageService.addMessage(session.id, {
        role: 'system',
        content: 'Recompiling after applying fixes...',
        timestamp: new Date(),
      });

      const compilationResult =
        await this.codeCompilerService.compileMavenProject(folderPath, false);

      if (compilationResult.success) {
        await this.chatStorageService.addMessage(session.id, {
          role: 'system',
          content: `Maven build successful after fixes. Artifact: ${compilationResult.artifactPath}`,
          timestamp: new Date(),
        });

        return `Plugin '${createData.name}' created and fixed successfully! Chat session ID: ${session.id}`;
      } else {
        // Record failure and try again
        await this.chatStorageService.addMessage(session.id, {
          role: 'system',
          content: `Compilation still failing: ${compilationResult.error}`,
          timestamp: new Date(),
        });

        // Recursive call with incremented attempts
        return await this.autoFixCompilationErrors(
          session,
          createData,
          attempts + 1,
        );
      }
    } catch (error) {
      await this.chatStorageService.addMessage(session.id, {
        role: 'system',
        content: `Error during auto-fix process: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
      });

      return `Error fixing plugin: ${error instanceof Error ? error.message : String(error)}. Chat session ID: ${session.id}`;
    }
  }

  /**
   * Enhances a prompt with file details for AI processing
   */
  private enhancePrompt(prompt: string, fileDetails: string): string {
    return `
You are an AI assistant that helps create Minecraft plugins. 
I want you to create a plugin with the following description:

${prompt}

Here are the file details from the template:
${fileDetails}

Please provide the necessary code files for this plugin.
Format your response as follows:

{
  "createdFiles": [
    {
      "path": "src/main/java/com/example/MyClass.java",
      "content": "package com.example;\n\npublic class MyClass {\n  // code here\n}"
    }
  ],
  "modifiedFiles": [
    {
      "path": "src/main/resources/plugin.yml",
      "content": "name: MyPlugin\nversion: 1.0\nmain: com.example.MyPlugin"
    }
  ],
  "deletedFiles": [
    "src/main/java/com/example/UnusedClass.java"
  ]
}

Ensure all necessary files for a working Minecraft plugin are included.
`;
  }

  /**
   * Parses the AI response to extract file actions
   */
  private parseAIResponse(aiResponse: string): FileAction {
    try {
      // Look for JSON in the AI response
      const jsonMatch = aiResponse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        return JSON.parse(jsonMatch[1]) as FileAction;
      }

      // If no JSON found, look for specific sections
      const actions: FileAction = {
        createdFiles: [],
        modifiedFiles: [],
        deletedFiles: [],
      };

      // Extract file blocks with filepath comments
      const filePathRegex =
        /```(?:\w+)?\s*\/\/ filepath: ([^\n]+)([\s\S]*?)```/g;
      let match: RegExpExecArray | null;
      while ((match = filePathRegex.exec(aiResponse)) !== null) {
        const filePath = match[1].trim();
        const content = match[2].trim();

        actions.modifiedFiles.push({
          path: filePath,
          content: content,
        });
      }

      return actions;
    } catch (error) {
      console.error(
        'Failed to parse AI response:',
        error instanceof Error ? error.message : String(error),
      );
      return {
        createdFiles: [],
        modifiedFiles: [],
        deletedFiles: [],
      };
    }
  }

  /**
   * Extracts file fixes from a JSON string in the AI response
   */
  private extractFixesFromJson(aiResponse: string): JsonFixes | null {
    try {
      // More efficient regex to extract JSON - handles both wrapped and unwrapped JSON
      const jsonRegex =
        /(?:```(?:json)?\s*)?(\{[\s\S]*?(?:\}[\s\S]*?)*\})(?:\s*```)?/;
      const jsonMatch = aiResponse.match(jsonRegex);
      if (!jsonMatch) return null;

      // Extract and clean the JSON string
      const jsonStr = jsonMatch[1].trim();

      // Log smaller preview to reduce console output
      console.log(
        'Extracted JSON string:',
        jsonStr.length > 100
          ? `${jsonStr.substring(0, 100)}... (${jsonStr.length} chars)`
          : jsonStr,
      );

      // Parse and validate in one pass
      let fixes: Record<string, unknown>;
      try {
        fixes = JSON.parse(jsonStr);
      } catch {
        // Try removing any trailing commas which can break JSON parsing
        const fixedJson = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        fixes = JSON.parse(fixedJson);
      }

      // Validate structure with more detailed error feedback
      if (typeof fixes !== 'object' || fixes === null) {
        console.error('Invalid JSON structure: not an object');
        return null;
      }

      // Use type guards for better validation
      const isStringRecord = (obj: unknown): obj is Record<string, string> =>
        typeof obj === 'object' &&
        obj !== null &&
        Object.values(obj as Record<string, unknown>).every(
          (v) => typeof v === 'string',
        );

      const isStringArray = (arr: unknown): arr is string[] =>
        Array.isArray(arr) && arr.every((v) => typeof v === 'string');

      // Validate each section with specific error messages
      const created = fixes.created as Record<string, string> | undefined;
      const updated = fixes.updated as Record<string, string> | undefined;
      const deleted = fixes.deleted as string[] | undefined;

      if (created !== undefined && !isStringRecord(created)) {
        console.error('Invalid "created" section:', created);
        fixes.created = {};
      }

      if (updated !== undefined && !isStringRecord(updated)) {
        console.error('Invalid "updated" section:', updated);
        fixes.updated = {};
      }

      if (deleted !== undefined && !isStringArray(deleted)) {
        console.error('Invalid "deleted" section:', deleted);
        fixes.deleted = [];
      }

      return {
        created: (fixes.created as Record<string, string>) || {},
        updated: (fixes.updated as Record<string, string>) || {},
        deleted: (fixes.deleted as string[]) || [],
      };
    } catch (error) {
      console.error(
        'Failed to parse JSON from AI response:',
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  /**
   * Enhanced code fix extraction with multiple fallback strategies
   */
  private extractCodeFixes(aiResponse: string): FileAction {
    // Create result object with proper type annotations
    const fixes: FileAction = {
      createdFiles: [],
      modifiedFiles: [],
      deletedFiles: [],
    };

    try {
      // Strategy 1: Extract JSON blocks
      const jsonRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
      const jsonMatch = aiResponse.match(jsonRegex);

      if (jsonMatch && jsonMatch[1]) {
        try {
          const parsed = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
          console.log('Successfully parsed JSON response');

          // Map to our standard format
          if (parsed.createdFiles || parsed.created) {
            const createdFiles = parsed.createdFiles as Array<{
              path: string;
              content: string;
            }>;
            const created = parsed.created as Record<string, string>;

            if (Array.isArray(createdFiles)) {
              fixes.createdFiles = createdFiles;
            } else if (created) {
              fixes.createdFiles = Object.entries(created).map(
                ([path, content]) => ({
                  path,
                  content,
                }),
              );
            }
          }

          if (parsed.modifiedFiles || parsed.updated) {
            const modifiedFiles = parsed.modifiedFiles as Array<{
              path: string;
              content: string;
            }>;
            const updated = parsed.updated as Record<string, string>;

            if (Array.isArray(modifiedFiles)) {
              fixes.modifiedFiles = modifiedFiles;
            } else if (updated) {
              fixes.modifiedFiles = Object.entries(updated).map(
                ([path, content]) => ({
                  path,
                  content,
                }),
              );
            }
          }

          if (parsed.deletedFiles || parsed.deleted) {
            const deletedFiles = parsed.deletedFiles as string[];
            const deleted = parsed.deleted as string[];

            if (Array.isArray(deletedFiles)) {
              fixes.deletedFiles = deletedFiles;
            } else if (Array.isArray(deleted)) {
              fixes.deletedFiles = deleted;
            }
          }

          if (
            fixes.createdFiles.length ||
            fixes.modifiedFiles.length ||
            fixes.deletedFiles.length
          ) {
            return fixes;
          }
        } catch (parseError) {
          console.error(
            'Failed to parse JSON in AI response:',
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
          );
        }
      }

      // Strategy 2: More aggressively search for filepath markers
      // This improved regex captures multiple file blocks with better content extraction
      const fileBlockRegex =
        /```(?:\w+)?\s*(?:\/\/\s*filepath:\s*([^\n]+))([\s\S]*?)```/g;
      let match: RegExpExecArray | null;
      let foundAny = false;

      while ((match = fileBlockRegex.exec(aiResponse)) !== null) {
        foundAny = true;
        const filePath = match[1]?.trim() || '';
        let content = match[2]?.trim() || '';

        if (filePath && content) {
          // Detect if the content still has the filepath comment at the beginning
          if (content.startsWith('// filepath:')) {
            const contentLines = content.split('\n');
            contentLines.shift(); // Remove the filepath line
            content = contentLines.join('\n').trim();
          }

          fixes.modifiedFiles.push({ path: filePath, content });
        }
      }

      if (foundAny) {
        return fixes;
      }

      // Strategy 3: Parse Java code blocks by analyzing package and class names
      const codeBlockRegex = /```(?:java)?\s*([\s\S]*?)```/g;
      while ((match = codeBlockRegex.exec(aiResponse)) !== null) {
        const content = match[1].trim();
        if (!content) continue;

        // Enhanced Java code detection with pattern matching
        const packageMatch = content.match(/package\s+([^;]+);/);
        const classMatch = content.match(
          /(?:public\s+)?(?:final\s+)?class\s+(\w+)/,
        );

        if (packageMatch && classMatch) {
          const packageName = packageMatch[1].trim();
          const className = classMatch[1].trim();
          const packagePath = packageName.replace(/\./g, '/');
          const filePath = `src/main/java/${packagePath}/${className}.java`;

          fixes.modifiedFiles.push({ path: filePath, content });
          foundAny = true;
        } else if (
          content.includes('plugin.yml') ||
          (content.includes('name:') &&
            content.includes('version:') &&
            content.includes('main:'))
        ) {
          // Detect plugin.yml content
          fixes.modifiedFiles.push({
            path: 'src/main/resources/plugin.yml',
            content,
          });
          foundAny = true;
        } else if (
          content.includes('config.yml') ||
          (content.includes('settings:') && !content.includes('class'))
        ) {
          // Detect config.yml content
          fixes.modifiedFiles.push({
            path: 'src/main/resources/config.yml',
            content,
          });
          foundAny = true;
        }
      }

      // Return results if we found anything
      if (foundAny) {
        return fixes;
      }

      console.log(
        'No code blocks found using standard methods, trying direct error correction',
      );

      // Strategy 4: Direct error correction based on error messages
      if (
        aiResponse.includes('AdminCommand.java') ||
        aiResponse.includes('illegal start of expression')
      ) {
        // Extract any Java code that might be a direct class fix
        const javaCodeMatch = aiResponse.match(
          /(?:```java)?\s*((?:package|import|public|class)[\s\S]*?(?:}\s*)+)(?:```)?/,
        );
        if (javaCodeMatch && javaCodeMatch[1]) {
          const content = javaCodeMatch[1].trim();
          const packageMatch = content.match(/package\s+([^;]+);/);

          if (packageMatch) {
            const packageName = packageMatch[1].trim();
            const className = 'AdminCommand'; // Hardcoded based on error pattern
            const packagePath = packageName.replace(/\./g, '/');
            const filePath = `src/main/java/${packagePath}/${className}.java`;

            fixes.modifiedFiles.push({ path: filePath, content });
            return fixes;
          }
        }
      }

      // Return default structure if nothing was found
      return fixes;
    } catch (error) {
      console.error(
        'Failed to parse AI fixes:',
        error instanceof Error ? error.message : String(error),
      );
      return fixes;
    }
  }

  /**
   * Optimized file operation execution with proper error handling and progress tracking
   */
  private async executeFileActions(
    actions: FileAction,
    basePath: string,
  ): Promise<number> {
    let actionsCount = 0;
    const results = {
      created: 0,
      modified: 0,
      deleted: 0,
      failed: 0,
    };

    // Define an interface for the file operations
    interface FileOperation {
      type: 'create' | 'modify' | 'delete';
      path: string;
      content?: string;
    }

    // Create operation queue with explicit type
    const operations: FileOperation[] = [];

    // Queue file creations
    if (actions.createdFiles && Array.isArray(actions.createdFiles)) {
      for (const file of actions.createdFiles) {
        if (typeof file.path === 'string' && typeof file.content === 'string') {
          operations.push({
            type: 'create',
            path: file.path,
            content: file.content,
          });
        } else {
          console.error('Invalid created file entry:', file);
          results.failed++;
        }
      }
    }

    // Queue file modifications
    if (actions.modifiedFiles && Array.isArray(actions.modifiedFiles)) {
      for (const file of actions.modifiedFiles) {
        if (typeof file.path === 'string' && typeof file.content === 'string') {
          operations.push({
            type: 'modify',
            path: file.path,
            content: file.content,
          });
        } else {
          console.error('Invalid modified file entry:', file);
          results.failed++;
        }
      }
    }

    // Queue file deletions
    if (actions.deletedFiles && Array.isArray(actions.deletedFiles)) {
      for (const filePath of actions.deletedFiles) {
        if (typeof filePath === 'string') {
          operations.push({
            type: 'delete',
            path: filePath,
          });
        } else {
          console.error('Invalid deleted file entry:', filePath);
          results.failed++;
        }
      }
    }

    // Process operation queue with proper error handling
    for (const op of operations) {
      try {
        const fullPath = path.join(basePath, op.path);
        const dirPath = path.dirname(fullPath);

        switch (op.type) {
          case 'create':
          case 'modify': {
            // Create directory if it doesn't exist
            if (!fs.existsSync(dirPath)) {
              fs.mkdirSync(dirPath, { recursive: true });
            }

            // Check if file already exists (for logging purposes)
            const fileExists = fs.existsSync(fullPath);

            // Write file content (overwrite if exists)
            if (op.content) {
              fs.writeFileSync(fullPath, op.content);
              actionsCount++;

              if (op.type === 'create' || !fileExists) {
                console.log(`Created file: ${op.path}`);
                results.created++;
              } else {
                console.log(`Modified file: ${op.path}`);
                results.modified++;
              }
            } else {
              console.error(`Missing content for ${op.path}`);
              results.failed++;
            }
            break;
          }

          case 'delete':
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
              actionsCount++;
              console.log(`Deleted file: ${op.path}`);
              results.deleted++;
            } else {
              console.log(`Skipped deleting non-existent file: ${op.path}`);
            }
            break;
        }
      } catch (error) {
        console.error(
          `Error ${op.type}ing file ${op.path}: ${error instanceof Error ? error.message : String(error)}`,
        );
        results.failed++;
      }
    }

    // Report detailed actions taken
    console.log(
      `Executed ${actionsCount} file operations: ${results.created} created, ${results.modified} modified, ${results.deleted} deleted, ${results.failed} failed.`,
    );

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
}
