/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { FileCompilerService } from './file-compiler.service';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

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
  ) {}

  async getChatResponse(message: string, pluginName: string): Promise<string> {
    // Get folder path for the requested plugin
    const folderPath = path.join(process.cwd(), 'generated', pluginName);

    // Check if plugin directory exists
    if (!fs.existsSync(folderPath)) {
      return `I don't have information about a plugin named "${pluginName}". Please generate it first.`;
    }

    // Path for the documentation file
    const docsPath = path.join(folderPath, 'docs');
    if (!fs.existsSync(docsPath)) {
      fs.mkdirSync(docsPath, { recursive: true });
    }

    const docFilePath = path.join(docsPath, `${pluginName}_documentation.txt`);

    try {
      // Create or update documentation file
      await this.ensurePluginDocumentation(pluginName, folderPath, docFilePath);

      // Read the documentation file
      let pluginContext = '';
      try {
        pluginContext = fs.readFileSync(docFilePath, 'utf8');

        // Truncate if too large for AI context window
        if (pluginContext.length > 100000) {
          this.logger.warn(
            `Plugin documentation is very large (${pluginContext.length} chars), truncating to 100K chars`,
          );
          pluginContext =
            pluginContext.substring(0, 100000) +
            '\n...(content truncated due to length)';
        }
      } catch (error) {
        this.logger.error(`Error reading documentation file: ${error.message}`);
        return `Sorry, I couldn't access the documentation for plugin "${pluginName}".`;
      }

      // Create a prompt for the AI that includes context about the plugin
      const prompt = this.createPluginModificationPrompt(
        message,
        pluginName,
        pluginContext,
      );

      // Use the Gemini service to process the prompt
      const aiResponse = await this.geminiService.processDirectPrompt(prompt);

      // Parse the AI response to get file operations
      let pluginModification: PluginModification;
      try {
        pluginModification = this.parseAIResponse(aiResponse);
      } catch (error) {
        this.logger.error(`Failed to parse AI response: ${error.message}`);
        return `I received a response but couldn't parse it correctly. Here's the raw response:\n\n${aiResponse}`;
      }

      // Apply the file operations to the plugin directory
      const operationsResult = await this.applyFileOperations(
        folderPath,
        pluginModification,
      );

      // Regenerate documentation after modifications
      await this.ensurePluginDocumentation(
        pluginName,
        folderPath,
        docFilePath,
        true,
      );

      // Return a summary of operations performed
      return operationsResult;
    } catch (error) {
      this.logger.error(`Error in chat response: ${error.message}`);
      return `Sorry, an error occurred while processing your request: ${error.message}`;
    }
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
    }

    // Generate/regenerate documentation
    try {
      this.logger.log(`Generating documentation for plugin '${pluginName}'...`);

      // Use FileCompilerService to compile plugin files
      await this.fileCompilerService.compileDirectoryToTxt(
        path.join(pluginFolderPath, 'src'),
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
  }

  /**
   * Parses the AI response to extract file operations
   */
  private parseAIResponse(aiResponse: string): PluginModification {
    try {
      // Try to find JSON in the response (sometimes AI might add explanatory text)
      const jsonRegex = /{[\s\S]*}/;
      const match = aiResponse.match(jsonRegex);

      if (!match) {
        throw new Error('No valid JSON found in the AI response');
      }

      const jsonStr = match[0];
      const result = JSON.parse(jsonStr) as PluginModification;

      // Validate the structure
      if (!result.createdFiles) result.createdFiles = [];
      if (!result.modifiedFiles) result.modifiedFiles = [];
      if (!result.deletedFiles) result.deletedFiles = [];

      return result;
    } catch (error) {
      this.logger.error(`Failed to parse AI response: ${error.message}`);
      throw new Error(
        `Could not parse AI response as valid JSON: ${error.message}`,
      );
    }
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
      // Delete target folder if it exists
      const targetPath = path.join(pluginFolderPath, 'target');
      if (fs.existsSync(targetPath)) {
        this.logger.log(`Deleting target folder: ${targetPath}`);

        // Delete directory recursively
        fs.rmSync(targetPath, { recursive: true, force: true });
        this.logger.log('Target folder deleted successfully');
      }

      // Recompile plugin using Maven
      this.logger.log(`Recompiling plugin at: ${pluginFolderPath}`);

      return new Promise((resolve, reject) => {
        exec(
          'mvn package',
          { cwd: pluginFolderPath },
          (error, stdout, stderr) => {
            if (error) {
              this.logger.error(`Maven compilation error: ${error.message}`);
              this.logger.error(stderr);
              reject(new Error(`Maven compilation failed: ${error.message}`));
              return;
            }

            this.logger.log('Maven compilation successful');
            this.logger.debug(stdout);
            resolve();
          },
        );
      });
    } catch (error) {
      this.logger.error(`Error during clean and recompile: ${error.message}`);
      throw error;
    }
  }
}
