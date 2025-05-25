import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ChatStorageService } from '../services/chat-storage.service';
import { GeminiService } from '../services/gemini.service';
import { CreateService } from '../services/create.service';
import { CodeCompilerService } from '../services/code-compiler.service';
import { PluginOperationsService } from '../services/plugin-operations.service';
import { ChatSession, ChatMessage } from '../models/chat-session.model';
import * as fs from 'fs';
import * as path from 'path';
import { ChatMessageDto } from './dto/chat-message.dto';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatStorageService: ChatStorageService,
    private readonly geminiService: GeminiService,
    private readonly pluginOperationsService: PluginOperationsService,
    private readonly createService: CreateService,
    private readonly codeCompilerService: CodeCompilerService,
  ) { }

  @Post('message')
  async sendMessage(@Body() messageDto: ChatMessageDto) {
    let session;

    // Create a new session or get existing one
    if (messageDto.sessionId) {
      session = await this.chatStorageService.getSession(messageDto.sessionId);
      if (!session) {
        throw new Error(`Session with ID ${messageDto.sessionId} not found`);
      }
    } else if (messageDto.pluginName) {
      // Check if there are existing sessions for this plugin
      const existingSessions = await this.chatStorageService.listSessionsByPlugin(messageDto.pluginName);

      if (existingSessions.length > 0) {
        // Use the most recent session
        session = existingSessions.sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0];
      } else {
        // Create a new session
        session = await this.chatStorageService.createSession(messageDto.pluginName);
      }
    } else {
      throw new Error('Either sessionId or pluginName must be provided');
    }

    // Add user message to the session
    await this.chatStorageService.addMessage(session.id, {
      role: 'user',
      content: messageDto.content,
      timestamp: new Date()
    });

    // Check if this is a command or action request
    if (messageDto.content.startsWith('/generate')) {
      // Generate a new plugin
      const prompt = messageDto.content.replace('/generate', '').trim();

      // Add system message explaining what's happening
      await this.chatStorageService.addMessage(session.id, {
        role: 'system',
        content: `Generating plugin '${session.pluginName}' with prompt: ${prompt}`,
        timestamp: new Date()
      });

      try {
        const result = await this.pluginOperationsService.createPlugin({
          name: session.pluginName,
          prompt: prompt
        });

        // Add result as assistant message
        await this.chatStorageService.addMessage(session.id, {
          role: 'assistant',
          content: `Plugin generation complete: ${result}`,
          timestamp: new Date()
        });

        // Return the updated session
        return {
          success: true,
          session: await this.chatStorageService.getSession(session.id)
        };
      } catch (error) {
        // Add error as system message
        await this.chatStorageService.addMessage(session.id, {
          role: 'system',
          content: `Error during plugin generation: ${error.message}`,
          timestamp: new Date()
        });

        throw error;
      }
    } else if (messageDto.content.startsWith('/compile')) {
      // Compile the plugin
      await this.chatStorageService.addMessage(session.id, {
        role: 'system',
        content: `Compiling plugin '${session.pluginName}'...`,
        timestamp: new Date()
      });

      try {
        const result = await this.codeCompilerService.compileMavenProject(
          session.pluginPath,
          false
        );

        if (result.success) {
          await this.chatStorageService.addMessage(session.id, {
            role: 'assistant',
            content: `Compilation successful! Artifact: ${result.artifactPath}`,
            timestamp: new Date()
          });
        } else {
          await this.chatStorageService.addMessage(session.id, {
            role: 'assistant',
            content: `Compilation failed: ${result.error}\n\nHere's what happened:\n${result.output}`,
            timestamp: new Date()
          });
        }

        return {
          success: true,
          session: await this.chatStorageService.getSession(session.id)
        };
      } catch (error) {
        await this.chatStorageService.addMessage(session.id, {
          role: 'system',
          content: `Error during compilation: ${error.message}`,
          timestamp: new Date()
        });

        throw error;
      }
    } else {
      // Regular chat message - process with AI
      // First, add context about the plugin
      let contextPrompt = `You are helping with a Minecraft plugin called '${session.pluginName}'. `;

      // Include information about plugin structure if it exists
      if (fs.existsSync(session.pluginPath)) {
        contextPrompt += "The plugin has these key files:\n";

        // Add information about key files
        const pluginFiles = this.getKeyPluginFiles(session.pluginPath);
        contextPrompt += pluginFiles.join('\n');
      }

      // Create the AI prompt with context and chat history
      const aiPrompt = this.buildPromptFromChatHistory(session, contextPrompt);

      try {
        const aiResponse = await this.geminiService.processWithGemini(aiPrompt);

        // Add AI response to chat history
        await this.chatStorageService.addMessage(session.id, {
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date()
        });

        // Return the updated session
        return {
          success: true,
          session: await this.chatStorageService.getSession(session.id)
        };
      } catch (error) {
        await this.chatStorageService.addMessage(session.id, {
          role: 'system',
          content: `Error getting AI response: ${error.message}`,
          timestamp: new Date()
        });

        throw error;
      }
    }
  }

  @Get('sessions/:pluginName')
  async getSessionsByPlugin(@Param('pluginName') pluginName: string) {
    return await this.chatStorageService.listSessionsByPlugin(pluginName);
  }

  @Get('session/:sessionId')
  async getSession(@Param('sessionId') sessionId: string) {
    return await this.chatStorageService.getSession(sessionId);
  }

  // Helper methods
  private getKeyPluginFiles(pluginPath: string): string[] {
    const result: string[] = []; // Add explicit type here

    // Check for pom.xml
    const pomPath = path.join(pluginPath, 'pom.xml');
    if (fs.existsSync(pomPath)) {
      result.push('pom.xml - Maven build file');
    }

    // Check for plugin.yml
    const pluginYmlPath = path.join(pluginPath, 'src', 'main', 'resources', 'plugin.yml');
    if (fs.existsSync(pluginYmlPath)) {
      result.push('plugin.yml - Plugin configuration file');
    }

    // Check for main class files
    const javaDir = path.join(pluginPath, 'src', 'main', 'java');
    if (fs.existsSync(javaDir)) {
      // Find Java files (limit to 5 for brevity)
      let javaFiles = this.findFilesRecursively(javaDir, '.java', 5);
      result.push(...javaFiles.map(f => `${path.relative(pluginPath, f)} - Java class file`));
    }

    return result;
  }

  private findFilesRecursively(dir: string, extension: string, limit: number): string[] {
    const results: string[] = []; // Add explicit type here

    // Rest of method remains the same
    if (!fs.existsSync(dir)) {
      return results;
    }

    const items = fs.readdirSync(dir);

    for (const item of items) {
      if (results.length >= limit) break;

      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        results.push(...this.findFilesRecursively(itemPath, extension, limit - results.length));
      } else if (item.endsWith(extension)) {
        results.push(itemPath);
      }
    }

    return results;
  }

  private buildPromptFromChatHistory(session: ChatSession, contextPrefix: string): string {
    let prompt = contextPrefix + "\n\n";

    // Add recent chat history (last 10 messages)
    const recentMessages = session.messages.slice(-10);
    for (const msg of recentMessages) {
      const role = msg.role === 'assistant' ? 'AI' : msg.role.toUpperCase();
      prompt += `${role}: ${msg.content}\n\n`;
    }

    prompt += "Please provide helpful information about Minecraft plugin development, fix code issues, or suggest improvements.";

    return prompt;
  }
}