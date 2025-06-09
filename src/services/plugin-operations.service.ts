/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from '@nestjs/common';
import { CreateRequestDto } from '../create/dto/create-request.dto';
import { GeminiService } from './gemini.service';
import { CodeCompilerService } from './code-compiler.service';
import { PluginStatusGateway } from '../gateways/plugin-status.gateway';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

interface FixResult {
  success: boolean;
  message: string;
  artifactPath?: string;
}

@Injectable()
export class PluginOperationsService {
  private readonly logger = new Logger(PluginOperationsService.name);

  constructor(
    private readonly geminiService: GeminiService,
    private readonly codeCompilerService: CodeCompilerService,
    private readonly pluginStatusGateway: PluginStatusGateway,
  ) {}

  async createPlugin(createData: CreateRequestDto): Promise<string> {
    // Implementation of plugin creation logic from CreateController
    const folderPath = path.join(process.cwd(), 'generated', createData.name);

    // Create the directory if it doesn't exist
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Process with AI
    const aiResponse = await this.geminiService.processWithGemini(
      `Create a Minecraft plugin called ${createData.name}. ${createData.prompt}`,
    );

    // Extract actions from AI response
    const actions = this.extractCodeFixes(aiResponse);

    // Execute file actions
    const actionsCount = await this.executeFileActions(actions, folderPath);

    // Emit initial compilation status via WebSocket
    this.pluginStatusGateway.emitCompilationProgress(createData.name, {
      stage: 'initialization',
      percentage: 0,
      message: 'Starting Maven compilation...',
    });

    // Compile the project with auto-fix and AI assistance enabled
    const compilationResult =
      await this.codeCompilerService.compileMavenProject(folderPath);

    if (compilationResult.success) {
      return `Plugin ${createData.name} created and compiled successfully. Files created: ${actionsCount}`;
    } else {
      return `Plugin ${createData.name} created but compilation failed: ${compilationResult.error}`;
    }
  }

  async executeFileActions(actions: any, basePath: string): Promise<number> {
    let actionsCount = 0;

    // Handle file creations
    if (actions.createdFiles && actions.createdFiles.length > 0) {
      for (const file of actions.createdFiles) {
        try {
          const fullPath = path.join(basePath, file.path);
          const dirPath = path.dirname(fullPath);

          // Create directory if it doesn't exist
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }

          // Write file content
          fs.writeFileSync(fullPath, file.content);
          actionsCount++;

          this.logger.log(`Created file: ${file.path}`);
        } catch (error) {
          this.logger.error(
            `Error creating file ${file.path}: ${error.message}`,
          );
        }
      }
    }

    // Handle file modifications
    if (actions.modifiedFiles && actions.modifiedFiles.length > 0) {
      for (const file of actions.modifiedFiles) {
        try {
          const fullPath = path.join(basePath, file.path);
          const dirPath = path.dirname(fullPath);

          // Create directory if it doesn't exist
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }

          // Write file content (overwrite)
          fs.writeFileSync(fullPath, file.content);
          actionsCount++;

          this.logger.log(`Modified file: ${file.path}`);
        } catch (error) {
          this.logger.error(
            `Error modifying file ${file.path}: ${error.message}`,
          );
        }
      }
    }

    // Handle file deletions
    if (actions.deletedFiles && actions.deletedFiles.length > 0) {
      for (const filePath of actions.deletedFiles) {
        try {
          const fullPath = path.join(basePath, filePath);

          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            actionsCount++;

            this.logger.log(`Deleted file: ${filePath}`);
          }
        } catch (error) {
          this.logger.error(
            `Error deleting file ${filePath}: ${error.message}`,
          );
        }
      }
    }

    return actionsCount;
  }

  private extractCodeFixes(aiResponse: string): any {
    // Try to extract JSON code fixes from the AI response
    try {
      const jsonMatch = aiResponse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        return JSON.parse(jsonMatch[1]);
      }

      // Look for specific file edits in the response
      const fixes: {
        createdFiles: Array<{ path: string; content: string }>;
        modifiedFiles: Array<{ path: string; content: string }>;
        deletedFiles: string[];
        renamedFiles: Array<{ oldPath: string; newPath: string }>;
      } = {
        createdFiles: [],
        modifiedFiles: [],
        deletedFiles: [],
        renamedFiles: [],
      };

      // Extract file paths and contents from code blocks
      const codeBlocks = aiResponse.match(/```(?:\w+)?\s*([\s\S]*?)```/g);
      if (codeBlocks) {
        const currentFilePath = null;

        // Extract filepath comments like: // filepath: src/main/java/com/example/Main.java
        const filePathMatches = aiResponse.match(/filepath:\s*([^\s\n]+)/g);
        if (filePathMatches) {
          filePathMatches.forEach((match, index) => {
            const filePath = match.replace(/filepath:\s*/, '').trim();

            // Find associated code block
            if (codeBlocks[index]) {
              const content = codeBlocks[index]
                .replace(/```(?:\w+)?\s*/, '')
                .replace(/\s*```$/, '');

              fixes.modifiedFiles.push({
                path: filePath,
                content: content,
              });
            }
          });
        }
      }

      return fixes;
    } catch (error) {
      console.error('Failed to parse AI fixes:', error);
      return {
        createdFiles: [],
        modifiedFiles: [],
        deletedFiles: [],
        renamedFiles: [],
      };
    }
  }

  async autoFixCompilationErrors(
    createData: CreateRequestDto,
    attempts = 0,
  ): Promise<FixResult> {
    const maxAttempts = 3;
    const folderPath = path.join(process.cwd(), 'generated', createData.name);

    if (attempts >= maxAttempts) {
      this.logger.warn(
        `Maximum fix attempts (${maxAttempts}) reached. Manual intervention required.`,
      );
      return {
        success: false,
        message: `Maximum fix attempts (${maxAttempts}) reached. Manual intervention required.`,
      };
    }
    this.logger.log(
      'Attempting to fix compilation errors using integrated AI system...',
    );

    // Emit fix attempt status via WebSocket
    this.pluginStatusGateway.emitCompilationProgress(createData.name, {
      stage: 'retry',
      percentage: 25,
      message: `Attempting to fix compilation errors (attempt ${attempts + 1}/${maxAttempts})...`,
    });

    try {
      // Use the integrated AI fixing system in CodeCompilerService
      // This includes auto-fix first, then AI-based fixing if needed
      const compilationResult =
        await this.codeCompilerService.compileMavenProject(folderPath);

      if (compilationResult.success) {
        this.logger.log(
          `Plugin '${createData.name}' fixed and compiled successfully! Artifact: ${compilationResult.artifactPath}`,
        );

        return {
          success: true,
          message: `Plugin '${createData.name}' fixed successfully!`,
          artifactPath: compilationResult.artifactPath,
        };
      } else {
        // If compilation still fails after AI fixes, try again up to max attempts
        this.logger.warn(
          `Compilation still failing after AI fixes: ${compilationResult.error}`,
        );

        // Recursive call with incremented attempts
        return await this.autoFixCompilationErrors(createData, attempts + 1);
      }
    } catch (error) {
      this.logger.error(`Error during auto-fix process: ${error.message}`);

      return {
        success: false,
        message: `Error fixing plugin: ${error.message}`,
      };
    }
  }
}
