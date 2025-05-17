import { Controller, Post, Body } from '@nestjs/common';
import { CreateService } from '../services/create.service';
import { CreateRequestDto } from './dto/create-request.dto';
import * as fs from 'fs';
import * as path from 'path';
import { createExtractorFromFile } from 'node-unrar-js';
import { FileCompilerService } from '../services/file-compiler.service';
import { GeminiService } from '../services/gemini.service';
import { CodeCompilerService } from '../services/code-compiler.service';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

interface ProcessingState {
  status: 'pending' | 'extracting' | 'compiling' | 'processing' | 'completed' | 'failed';
  step: number;
  totalSteps: number;
  error?: string;
  output?: any;
}

@Controller('create')
export class CreateController {
  constructor(
    private readonly createService: CreateService,
    private readonly fileCompilerService: FileCompilerService,
    private readonly geminiService: GeminiService,
    private readonly codeCompilerService: CodeCompilerService
  ) { }

  private logState(state: ProcessingState, message: string): void {
    console.log(`[Agent] Step ${state.step}/${state.totalSteps} - ${state.status}: ${message}`);
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
      totalSteps: 5
    };

    // Add this variable at the start of the try block
    let needsRecompilation = false;

    try {
      // STEP 1: Create folder structure
      state.status = 'extracting';
      state.step = 1;
      this.logState(state, 'Starting project creation');

      const folderName = createData.name;
      const folderPath = path.join(process.cwd(), 'generated', folderName);

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
          targetPath: folderPath
        });

        const list = extractor.extract();
        const extractedFiles = Array.from(list.files).map(f => f.fileHeader.name);
        state.output = { extractedFiles };
        this.logState(state, `Extracted ${extractedFiles.length} files`);

        fs.unlinkSync(rarDestPath);

        // STEP 3: Compile files
        state.status = 'compiling';
        state.step = 2;
        this.logState(state, 'Compiling project files');

        const compiledOutputPath = path.join(folderPath, 'compiled_files.txt');
        await this.fileCompilerService.compileDirectoryToTxt(folderPath, compiledOutputPath);

        // Keep only the compiled text file
        this.logState(state, 'Removing extracted files, keeping only compiled text');

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
              console.error(`Error deleting ${filePath}:`, error.message);
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
            if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
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
                console.log(`Skipping non-empty directory: ${dir} (contains ${contents.length} items)`);
              }
            } catch (error) {
              console.error(`Error removing directory ${dir}:`, error.message);
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

        // Define an interface for file details
        interface FileDetails {
          path: string;
          type: string;
          size: number;
        }

        // Initialize array with the proper type
        const fileDetailsArray: FileDetails[] = [];
        for (const file of extractedFiles) {
          const filePath = path.join(folderPath, file);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            fileDetailsArray.push({
              path: file,
              type: path.extname(file),
              size: fs.statSync(filePath).size
            });
          }
        }

        // Add agent instructions to the prompt with file details
        const fileDetails = JSON.stringify(fileDetailsArray, null, 2);
        const enhancedPrompt = this.enhancePrompt(createData.prompt, fileDetails);

        const geminiResponse = await this.geminiService.processWithGemini(
          enhancedPrompt,
          compiledOutputPath
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

        const actionsCount = await this.executeFileActions(parsedActions, folderPath);

        // STEP 6.5: Verify and fix Minecraft plugin files
        state.step = 5.5;
        this.logState(state, 'Verifying Minecraft plugin configuration');

        // Check if this is a Minecraft plugin by looking for plugin.yml
        const pluginYmlPath = path.join(folderPath, 'src', 'main', 'resources', 'plugin.yml');
        const pluginYmlExists = fs.existsSync(pluginYmlPath);

        // Also check for possible incorrect locations
        const incorrectLocations = [
          path.join(folderPath, 'plugin.yml'),
          path.join(folderPath, 'resources', 'plugin.yml'),
          path.join(folderPath, 'src', 'resources', 'plugin.yml')
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
          this.logState(state, `Found plugin.yml in incorrect location: ${incorrectPluginYmlPath}`);

          // Create resources directory if it doesn't exist
          const resourcesDir = path.join(folderPath, 'src', 'main', 'resources');
          if (!fs.existsSync(resourcesDir)) {
            fs.mkdirSync(resourcesDir, { recursive: true });
          }

          // Copy file to correct location
          fs.copyFileSync(incorrectPluginYmlPath, pluginYmlPath);
          this.logState(state, `Moved plugin.yml to correct location: ${pluginYmlPath}`);

          // Flag for recompilation
          needsRecompilation = true;
        }

        // Check for config.yml in the correct location
        const configYmlPath = path.join(folderPath, 'src', 'main', 'resources', 'config.yml');
        const configYmlExists = fs.existsSync(configYmlPath);

        // Check for config.yml in incorrect locations
        const incorrectConfigLocations = [
          path.join(folderPath, 'config.yml'),
          path.join(folderPath, 'resources', 'config.yml'),
          path.join(folderPath, 'src', 'resources', 'config.yml')
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
          this.logState(state, `Found config.yml in incorrect location: ${incorrectConfigYmlPath}`);

          // Resources directory should already exist from plugin.yml check
          // Copy file to correct location
          fs.copyFileSync(incorrectConfigYmlPath, configYmlPath);
          this.logState(state, `Moved config.yml to correct location: ${configYmlPath}`);

          // Flag for recompilation
          needsRecompilation = true;
        }

        // Update the pom.xml to ensure resources are included
        const pomPath = path.join(folderPath, 'pom.xml');
        if (fs.existsSync(pomPath)) {
          let pomContent = fs.readFileSync(pomPath, 'utf8');

          // Check if resources are configured properly
          if (!pomContent.includes('<resources>') || !pomContent.includes('src/main/resources')) {
            this.logState(state, 'Updating pom.xml to include resources');

            // Add resources section if it doesn't exist
            if (!pomContent.includes('<build>')) {
              pomContent = pomContent.replace('</project>', `
    <build>
      <resources>
        <resource>
          <directory>src/main/resources</directory>
          <filtering>true</filtering>
        </resource>
      </resources>
    </build>
  </project>`);
            } else if (!pomContent.includes('<resources>')) {
              pomContent = pomContent.replace('<build>', `<build>
      <resources>
        <resource>
          <directory>src/main/resources</directory>
          <filtering>true</filtering>
        </resource>
      </resources>`);
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
            this.logState(state, 'Recompiling project after moving configuration files');
          } else {
            state.step = 6;
            state.status = 'compiling';
            this.logState(state, 'Compiling project with Maven');
          }

          // Generate a pom.xml file if not present
          const groupId = `com.${folderName.toLowerCase()}`;
          const artifactId = folderName.toLowerCase();
          this.codeCompilerService.generateMinimalPom(folderPath, groupId, artifactId);

          // Compile with Maven
          let compilationResult = await this.codeCompilerService.compileMavenProject(folderPath);

          // STEP 7.5: Handle build failures with AI-assisted fixes
          if (!compilationResult.success) {
            state.status = 'compiling';
            this.logState(state, 'Maven build failed, attempting AI-assisted fixes');
            
            // Track attempts to prevent infinite loops
            let fixAttempts = 0;
            const maxFixAttempts = 2;
            
            while (!compilationResult.success && fixAttempts < maxFixAttempts) {
              fixAttempts++;
              this.logState(state, `AI fix attempt ${fixAttempts}/${maxFixAttempts}`);
              
              // 1. Recompile files.txt to capture current state
              const fixesOutputPath = path.join(folderPath, 'compiled_fixes.txt');
              await this.fileCompilerService.compileDirectoryToTxt(folderPath, fixesOutputPath);
              
              // 2. Send to AI with error information
              const errorPrompt = this.createErrorFixPrompt(
                compilationResult.error || 'Unknown error',  // Provide a default if undefined
                fixesOutputPath,
                folderPath
              );
              
              // 3. Process with AI to get fixes
              this.logState(state, 'Asking AI for fixes to compilation errors');
              const fixesResponse = await this.geminiService.processWithGemini(
                errorPrompt,
                fixesOutputPath
              );
              
              // Save the response for debugging
              const fixesResponsePath = path.join(folderPath, `fix_attempt_${fixAttempts}.txt`);
              fs.writeFileSync(fixesResponsePath, fixesResponse);
              
              // 4. Parse AI response
              const parsedFixes = this.parseAIResponse(fixesResponse);
              
              // 5. Apply fixes
              const fixesCount = await this.executeFileActions(parsedFixes, folderPath);
              this.logState(state, `Applied ${fixesCount} fixes from AI response`);
              
              // 6. Recompile
              this.logState(state, 'Recompiling project after applying fixes');
              compilationResult = await this.codeCompilerService.compileMavenProject(folderPath);
              
              if (compilationResult.success) {
                this.logState(state, `Fixed successfully on attempt ${fixAttempts}!`);
                break;
              } else {
                this.logState(state, `Fix attempt ${fixAttempts} unsuccessful, trying again...`);
              }
            }
            
            // Final status update
            if (compilationResult.success) {
              state.status = 'completed';
              this.logState(state, `Maven build successful after AI fixes. Artifact: ${compilationResult.artifactPath}`);
            } else {
              state.status = 'completed';
              state.error = compilationResult.error;
              this.logState(state, `Maven build failed despite ${maxFixAttempts} fix attempts: ${compilationResult.error}`);
            }
          }

          if (compilationResult.success) {
            this.logState(state, `Maven build successful. Artifact: ${compilationResult.artifactPath}`);

            // Add after successful Maven compilation
            if (compilationResult.success && compilationResult.artifactPath) {
              // Verify JAR contents
              this.logState(state, 'Verifying JAR contents');

              try {
                const { stdout } = await execPromise(
                  `jar tf "${compilationResult.artifactPath}"`,
                  { cwd: folderPath }
                );

                let hasPluginYml = stdout.includes('plugin.yml');
                let hasConfigYml = stdout.includes('config.yml');

                if (!hasPluginYml) {
                  this.logState(state, 'WARNING: plugin.yml not found in JAR file');
                }

                if (!hasConfigYml) {
                  this.logState(state, 'WARNING: config.yml not found in JAR file');
                }

                if (!hasPluginYml || !hasConfigYml) {
                  // Extract more details about the JAR
                  this.logState(state, 'JAR contents:');
                  console.log(stdout);
                } else {
                  this.logState(state, 'Verified plugin.yml and config.yml are properly included in JAR');
                }
              } catch (error) {
                this.logState(state, `Failed to verify JAR contents: ${error.message}`);
              }
            }
          } else {
            state.status = 'completed';
            state.error = compilationResult.error;
            this.logState(state, `Maven build failed: ${compilationResult.error}`);
          }
        }

        return `Project created successfully at ${folderPath}. AI processing complete with ${actionsCount} file operations.`;

      } catch (extractError) {
        state.status = 'failed';
        state.error = extractError.message;
        this.logState(state, 'Extraction failed');
        console.error('Failed to extract or process files:', extractError);
        return `Partial success: Files created but processing failed: ${extractError.message}`;
      }
    } catch (error) {
      state.status = 'failed';
      state.error = error.message;
      this.logState(state, 'Operation failed');
      return `Error: ${error.message}`;
    }
  }

  private enhancePrompt(userPrompt: string, fileDetails: string): string {
    return `${userPrompt}
I have analyzed your project and compiled its file structure into a text summary.
IMPORTANT: You should generate all required files from scratch rather than modifying existing ones,
as I've deleted the original files and kept only the compiled structure for reference.

Here's the previous file structure for reference:
${fileDetails}

Please provide a complete implementation for all necessary files in a JSON format with this structure:
{
  "createdFiles": [
    {
      "path": "relative/path/to/file.ext", 
      "content": "file content here"
    }
  ],
  "deletedFiles": [],
  "modifiedFiles": [],
  "renamedFiles": [],
  "unchangedFiles": []
}
Dont generate any other text, just give me the JSON.
Don't forget to create necessary files like plugin.yml and config.yml in the correct locations.
(Also, create a pom.xml if it doesn't exist & ensure it includes the resources directory & the dependencies for the project.)
`;
  }

  private parseAIResponse(response: string): any {
    try {
      // Extract JSON from the response (assuming the AI might include other text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // If no JSON found, return empty structure
      return {
        createdFiles: [],
        deletedFiles: [],
        modifiedFiles: [],
        renamedFiles: [],
        unchangedFiles: []
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return {
        createdFiles: [],
        deletedFiles: [],
        modifiedFiles: [],
        renamedFiles: [],
        unchangedFiles: []
      };
    }
  }

  private async executeFileActions(actions: any, basePath: string) {
    let changesCount = 0;
    console.log(`Starting execution of file actions...`);

    try {
      // Process renames first (including package/directory renames)
      if (actions.renamedFiles && Array.isArray(actions.renamedFiles)) {
        // Sort by path depth (process parent directories first)
        const sortedRenames = [...actions.renamedFiles].sort((a, b) => {
          return a.oldPath?.split('/').length - b.oldPath?.split('/').length;
        });

        for (const file of sortedRenames) {
          try {
            if (file.oldPath && file.newPath && typeof file.oldPath === 'string' && typeof file.newPath === 'string') {
              const oldPath = path.join(basePath, file.oldPath);
              const newPath = path.join(basePath, file.newPath);
              const newDirPath = path.dirname(newPath);

              // Create parent directory structure if it doesn't exist
              if (!fs.existsSync(newDirPath)) {
                fs.mkdirSync(newDirPath, { recursive: true });
              }

              if (fs.existsSync(oldPath)) {
                // Rest of your rename logic...
                // ...
                changesCount++;
              } else {
                console.log(`Warning: Source path doesn't exist for rename: ${oldPath}`);
              }
            } else {
              console.log(`Warning: Invalid rename structure. Expected {oldPath: string, newPath: string}, got:`, file);
            }
          } catch (error) {
            console.error(`Error processing rename:`, error);
          }
        }
      }

      // Handle deleted files
      if (actions.deletedFiles && Array.isArray(actions.deletedFiles)) {
        for (const filePath of actions.deletedFiles) {
          try {
            if (typeof filePath === 'string') {
              const fullPath = path.join(basePath, filePath);
              // Rest of your delete logic...
            } else {
              console.log(`Warning: Invalid file path in 'deletedFiles'. Expected string, got:`, filePath);
            }
          } catch (error) {
            console.error(`Error processing deletion:`, error);
          }
        }
      }

      // Now handle created files
      if (actions.createdFiles && Array.isArray(actions.createdFiles)) {
        for (const file of actions.createdFiles) {
          try {
            if (file.path && file.content && typeof file.path === 'string') {
              const filePath = path.join(basePath, file.path);
              const dirPath = path.dirname(filePath);

              // Create directory if it doesn't exist
              if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
              }

              // Write file
              fs.writeFileSync(filePath, file.content);
              console.log(`Created file: ${filePath}`);
              changesCount++;
            } else {
              console.log(`Warning: Invalid file structure in 'createdFiles'. Expected {path: string, content: string}, got:`, file);
            }
          } catch (error) {
            console.error(`Error creating file:`, error);
          }
        }
      }

      // Finally handle modified files
      if (actions.modifiedFiles && Array.isArray(actions.modifiedFiles)) {
        for (const file of actions.modifiedFiles) {
          try {
            if (file.path && file.content && typeof file.path === 'string') {
              const filePath = path.join(basePath, file.path);
              const dirPath = path.dirname(filePath);

              // Create directory if it doesn't exist
              if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
              }

              // Write modified content
              fs.writeFileSync(filePath, file.content);
              console.log(`Modified file: ${filePath}`);
              changesCount++;
            } else {
              console.log(`Warning: Invalid file structure in 'modifiedFiles'. Expected {path: string, content: string}, got:`, file);
            }
          } catch (error) {
            console.error(`Error modifying file:`, error);
          }
        }
      }

      console.log(`Executed ${changesCount} file operations. ${actions.unchangedFiles?.length || 0} files unchanged.`);
      return changesCount;
    } catch (error) {
      console.error(`Error executing file actions:`, error);
      return changesCount;
    }
  }

  private createErrorFixPrompt(errorOutput: string, compiledFilesPath: string, projectPath: string): string {
    // Extract the likely error message from Maven output
    const extractedError = this.extractMavenErrors(errorOutput);
    
    // Add any pom.xml content if it exists
    let pomContent = '';
    const pomPath = path.join(projectPath, 'pom.xml');
    if (fs.existsSync(pomPath)) {
      pomContent = fs.readFileSync(pomPath, 'utf8');
    }
  
    // Find likely Java files with errors (if mentioned in error output)
    const javaFileRegex = /([A-Za-z0-9_$]+\.java)/g;
    const mentionedFiles = [...new Set(errorOutput.match(javaFileRegex) || [])];
    
    let fileContents = '';
    if (mentionedFiles.length > 0) {
      fileContents = 'Here are the Java files that might have issues:\n\n';
      for (const filename of mentionedFiles) {
        // Find the file in the project structure
        const foundFiles = this.findFilesInDirectory(projectPath, filename);
        if (foundFiles.length > 0) {
          for (const filePath of foundFiles) {
            try {
              const content = fs.readFileSync(filePath, 'utf8');
              fileContents += `File: ${path.relative(projectPath, filePath)}\n\`\`\`java\n${content}\n\`\`\`\n\n`;
            } catch (error) {
              fileContents += `Could not read file: ${filePath}\n`;
            }
          }
        }
      }
    }
    
    return `I need your help fixing a Maven compilation error in my Java project.
  
  COMPILATION ERROR:
  ${extractedError}
  
  Here is the full error output:
  ${errorOutput.substring(0, 2000)}${errorOutput.length > 2000 ? '...(truncated)' : ''}
  
  The current pom.xml:
  \`\`\`xml
  ${pomContent}
  \`\`\`
  
  ${fileContents}
  
  Common issues to check for:
  1. Missing dependencies in pom.xml
  2. Incorrect package statements in Java files
  3. Missing imports
  4. Incorrect class name (should match filename)
  5. Method signatures don't match interfaces or parent classes
  6. Invalid plugin configurations
  
  Please analyze the error and provide fixes.
  
  Respond with a JSON structure of the files that need to be modified or created:
  {
    "createdFiles": [
      {
        "path": "relative/path/to/file.ext", 
        "content": "file content here"
      }
    ],
    "deletedFiles": [],
    "modifiedFiles": [
      {
        "path": "relative/path/to/file.ext",
        "content": "updated content here"
      }
    ],
    "renamedFiles": [],
    "unchangedFiles": []
  }
  
  Focus on fixing compilation issues only. Don't include any text outside the JSON structure.`;
  }
  
  private extractMavenErrors(output: string): string {
    const errorLines: string[] = [];
    
    // Enhanced Maven error patterns
    const patterns = [
      /\[ERROR\].*?(?=\n)/g,
      /Failed to execute goal.*?(?=\n)/g,
      /Compilation failure.*?(?:\n.*?)+?(?=\n\[INFO\]|\n\[ERROR\]|\Z)/gs,
      /cannot find symbol\s*\n\s*symbol:.*?(?=\n\[INFO\]|\n\[ERROR\]|\Z)/gs,
      /package .* does not exist/g,
      /cannot resolve symbol/g,
      /No plugin found for prefix.*?(?=\n)/g
    ];
    
    // Extract matches for each pattern
    for (const pattern of patterns) {
      const matches = output.match(pattern) || [];
      errorLines.push(...matches);
    }
    
    if (errorLines.length === 0) {
      // Try to get at least SOME output if there are no matches
      const lines = output.split('\n').filter(line => 
        line.includes('[ERROR]') || 
        line.includes('Failed to execute') ||
        line.includes('BUILD FAILURE')
      );
      return lines.slice(-10).join('\n'); // Return last 10 error lines
    }
    
    // Return unique error lines, limiting length
    return [...new Set(errorLines)].join('\n').trim().substring(0, 1000);
  }

  // Helper method to find files in a directory
  private findFilesInDirectory(dir: string, filename: string): string[] {
    const results: string[] = [];
    
    try {
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const filepath = path.join(dir, file);
        const stat = fs.statSync(filepath);
        
        if (stat.isDirectory()) {
          results.push(...this.findFilesInDirectory(filepath, filename));
        } else if (file.toLowerCase() === filename.toLowerCase()) {
          results.push(filepath);
        }
      }
    } catch (error) {
      console.error(`Error searching for files: ${error.message}`);
    }
    
    return results;
  }
}