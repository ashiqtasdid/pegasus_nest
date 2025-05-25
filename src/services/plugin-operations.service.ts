import { Injectable, Logger } from '@nestjs/common';
import { CreateRequestDto } from '../create/dto/create-request.dto';
import { GeminiService } from './gemini.service';
import { CodeCompilerService } from './code-compiler.service';
import { ChatStorageService } from './chat-storage.service';
import * as fs from 'fs';
import * as path from 'path';
import { ChatSession } from '../models/chat-session.model';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

@Injectable()
export class PluginOperationsService {
  private readonly logger = new Logger(PluginOperationsService.name);

  constructor(
    private readonly geminiService: GeminiService,
    private readonly codeCompilerService: CodeCompilerService,
    private readonly chatStorageService: ChatStorageService
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
      `Create a Minecraft plugin called ${createData.name}. ${createData.prompt}`
    );
    
    // Extract actions from AI response
    const actions = this.extractCodeFixes(aiResponse);
    
    // Execute file actions
    const actionsCount = await this.executeFileActions(actions, folderPath);
    
    // Compile the project
    const compilationResult = await this.codeCompilerService.compileMavenProject(folderPath, false);
    
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
          this.logger.error(`Error creating file ${file.path}: ${error.message}`);
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
          this.logger.error(`Error modifying file ${file.path}: ${error.message}`);
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
          this.logger.error(`Error deleting file ${filePath}: ${error.message}`);
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
        createdFiles: Array<{path: string, content: string}>;
        modifiedFiles: Array<{path: string, content: string}>;
        deletedFiles: string[];
        renamedFiles: Array<{oldPath: string, newPath: string}>;
      } = {
        createdFiles: [],
        modifiedFiles: [],
        deletedFiles: [],
        renamedFiles: []
      };
      
      // Extract file paths and contents from code blocks
      const codeBlocks = aiResponse.match(/```(?:\w+)?\s*([\s\S]*?)```/g);
      if (codeBlocks) {
        let currentFilePath = null;
        
        // Extract filepath comments like: // filepath: src/main/java/com/example/Main.java
        const filePathMatches = aiResponse.match(/filepath:\s*([^\s\n]+)/g);
        if (filePathMatches) {
          filePathMatches.forEach((match, index) => {
            const filePath = match.replace(/filepath:\s*/, '').trim();
            
            // Find associated code block
            if (codeBlocks[index]) {
              const content = codeBlocks[index].replace(/```(?:\w+)?\s*/, '').replace(/\s*```$/, '');
              
              fixes.modifiedFiles.push({
                path: filePath,
                content: content
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
        renamedFiles: []
      };
    }
  }

  async autoFixCompilationErrors(session: ChatSession, createData: CreateRequestDto, attempts = 0): Promise<string> {
    const maxAttempts = 3;
    
    if (attempts >= maxAttempts) {
      await this.chatStorageService.addMessage(session.id, {
        role: 'system',
        content: `Maximum fix attempts (${maxAttempts}) reached. Manual intervention required.`,
        timestamp: new Date()
      });
      
      return `Plugin creation completed with errors. Maximum fix attempts reached. Chat session ID: ${session.id}`;
    }
    
    // Add a message asking the AI to fix the errors
    await this.chatStorageService.addMessage(session.id, {
      role: 'user',
      content: 'The compilation failed. Can you analyze the errors and fix the code?',
      timestamp: new Date()
    });
    
    // Get plugin path
    const folderPath = path.join(process.cwd(), 'generated', createData.name);
    
    // Read compilation errors
    let errorDetails = '';
    try {
      // Look for Maven output or error logs
      const mavenLogPath = path.join(folderPath, 'maven.log');
      if (fs.existsSync(mavenLogPath)) {
        errorDetails = fs.readFileSync(mavenLogPath, 'utf8');
      }
    } catch (error) {
      console.error('Failed to read error logs:', error);
    }
    
    // Create the AI prompt with context and error details
    const contextPrompt = `You are helping with a Minecraft plugin called '${createData.name}' that failed to compile. 
  Please analyze the errors and suggest fixes. Here are the compilation errors:
  ${errorDetails}`;
    
    try {
      // Get the AI's fix suggestions using the injected service
      const aiResponse = await this.geminiService.processWithGemini(contextPrompt);
      
      // Add AI response to chat
      await this.chatStorageService.addMessage(session.id, {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      });
      
      // Extract code fixes from AI response
      const fixActions = this.extractCodeFixes(aiResponse);
      
      // Apply the fixes
      await this.chatStorageService.addMessage(session.id, {
        role: 'system',
        content: 'Applying suggested fixes...',
        timestamp: new Date()
      });
      
      // Execute the actions
      await this.executeFileActions(fixActions, folderPath);
      
      // Try compiling again
      await this.chatStorageService.addMessage(session.id, {
        role: 'system',
        content: 'Recompiling after fixes...',
        timestamp: new Date()
      });
      
      // Compile with Maven using the injected service
      const compilationResult = await this.codeCompilerService.compileMavenProject(folderPath, false);
      
      if (compilationResult.success) {
        await this.chatStorageService.addMessage(session.id, {
          role: 'system',
          content: `Maven build successful after fixes. Artifact: ${compilationResult.artifactPath}`,
          timestamp: new Date()
        });
        
        return `Plugin '${createData.name}' created and fixed successfully! Chat session ID: ${session.id}`;
      } else {
        // Record failure and try again
        await this.chatStorageService.addMessage(session.id, {
          role: 'system',
          content: `Compilation still failing: ${compilationResult.error}`,
          timestamp: new Date()
        });
        
        // Recursive call with incremented attempts
        return await this.autoFixCompilationErrors(session, createData, attempts + 1);
      }
    } catch (error) {
      await this.chatStorageService.addMessage(session.id, {
        role: 'system',
        content: `Error during auto-fix process: ${error.message}`,
        timestamp: new Date()
      });
      
      return `Error fixing plugin: ${error.message}. Chat session ID: ${session.id}`;
    }
  }
}