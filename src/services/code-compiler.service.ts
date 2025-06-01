/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { exec, ExecException } from 'child_process';
import { promisify } from 'util';
import { GeminiService } from './gemini.service';

// Enhanced exec exception interface
interface EnhancedExecException extends ExecException {
  stdout?: string;
  stderr?: string;
}

const execPromise = promisify(exec) as (
  command: string,
  options?: { cwd?: string; timeout?: number },
) => Promise<{ stdout: string; stderr: string }>;

// Enhanced result interface with more detailed error information
interface CompilationResult {
  success: boolean;
  output: string;
  error?: string;
  artifactPath?: string;
  // Add structured error information
  errors?: CompilationError[];
  warnings?: CompilationWarning[];
}

// Structured error interface for better error handling
interface CompilationError {
  type:
    | 'syntax'
    | 'semantic'
    | 'dependency'
    | 'plugin-specific'
    | 'maven'
    | 'unknown';
  file?: string;
  line?: number;
  column?: number;
  message: string;
  code?: string;
  suggestion?: string;
}

interface CompilationWarning {
  type: 'deprecation' | 'unused' | 'performance' | 'plugin-specific' | 'other';
  file?: string;
  line?: number;
  message: string;
  suggestion?: string;
}

// Plugin-specific issue interface
interface PluginIssue {
  type: string;
  field?: string;
  file?: string;
  main?: string;
  message?: string;
}

// Define Minecraft server versions for better API compatibility
type MinecraftVersion =
  | '1.16.5'
  | '1.17.1'
  | '1.18.2'
  | '1.19.4'
  | '1.20.1'
  | '1.20.2'
  | '1.20.4'
  | 'latest';

// Configuration for POM generation
interface PomConfig {
  groupId: string;
  artifactId: string;
  version: string;
  minecraftVersion: MinecraftVersion;
  spigotVersion?: string;
  paperVersion?: string;
  useSpigot: boolean;
  usePaper: boolean;
  addDefaultRepositories: boolean;
  javaVersion: 8 | 11 | 17 | 21;
  includeCommands: boolean;
  includeConfig: boolean;
  dependencies: Array<{
    name: string;
    groupId: string;
    artifactId: string;
    version: string;
  }>;
}

@Injectable()
export class CodeCompilerService {
  private readonly logger = new Logger(CodeCompilerService.name);
  // Cache for dependency resolution to improve performance
  private dependencyCache = new Map<
    string,
    { resolved: boolean; path: string }
  >();

  // Map of Minecraft versions to API versions
  private readonly minecraftApiVersions: Record<MinecraftVersion, string> = {
    '1.16.5': '1.16.5-R0.1-SNAPSHOT',
    '1.17.1': '1.17.1-R0.1-SNAPSHOT',
    '1.18.2': '1.18.2-R0.1-SNAPSHOT',
    '1.19.4': '1.19.4-R0.1-SNAPSHOT',
    '1.20.1': '1.20.1-R0.1-SNAPSHOT',
    '1.20.2': '1.20.2-R0.1-SNAPSHOT',
    '1.20.4': '1.20.4-R0.1-SNAPSHOT',
    latest: '1.20.4-R0.1-SNAPSHOT',
  };
  constructor(private readonly geminiService: GeminiService) {
    this.logger.log('CodeCompilerService initialized');
  } /**
   * Compile a Maven project with enhanced error handling and validation
   * Auto-fix and AI assistance are enabled by default
   * @param projectPath Path to the project directory
   * @returns CompilationResult with structured compilation status and errors
   */
  async compileMavenProject(projectPath: string): Promise<CompilationResult> {
    return this.compileMavenProjectInternal(projectPath, true, true);
  }

  /**
   * Internal method for Maven compilation with configurable auto-fix and AI options
   * @param projectPath Path to the project directory
   * @param autoFix Whether to automatically attempt to fix compilation errors
   * @param useAI Whether to use AI for fixing when autoFix fails
   * @returns CompilationResult with structured compilation status and errors
   */ private async compileMavenProjectInternal(
    projectPath: string,
    autoFix: boolean,
    useAI: boolean,
  ): Promise<CompilationResult> {
    this.logger.log(
      `Compiling Maven project at: ${projectPath} (autoFix: ${autoFix}, useAI: ${useAI})`,
    );

    // Validate project path for security
    if (!this.isValidProjectPath(projectPath)) {
      return {
        success: false,
        output: 'Invalid project path specified.',
        error: 'Security constraint: Invalid project path',
      };
    }

    try {
      // Check if pom.xml exists
      const pomPath = path.join(projectPath, 'pom.xml');
      if (!fs.existsSync(pomPath)) {
        this.logger.warn('No pom.xml found in project directory');
        return {
          success: false,
          output:
            'No pom.xml found. Maven compilation requires a pom.xml file.',
          error: 'Missing pom.xml',
        };
      }

      // Validate pom.xml structure before compilation
      const pomValidation = await this.validatePomXml(pomPath);
      if (!pomValidation.valid) {
        this.logger.warn(`Invalid pom.xml: ${pomValidation.error}`);

        if (autoFix && pomValidation.fixable) {
          await this.fixPomXml(pomPath, pomValidation.issues || []);
          this.logger.log('Automatically fixed pom.xml issues');
        } else {
          return {
            success: false,
            output: `Invalid pom.xml: ${pomValidation.error}`,
            error: 'Invalid pom.xml structure',
          };
        }
      }

      // Pre-verify Minecraft plugin structure
      const isMinecraftPlugin = await this.isMinecraftPlugin(projectPath);
      if (isMinecraftPlugin) {
        const pluginValidation =
          await this.validateMinecraftPlugin(projectPath);
        if (!pluginValidation.valid) {
          this.logger.warn(
            `Invalid Minecraft plugin structure: ${pluginValidation.error}`,
          );

          if (autoFix && pluginValidation.fixable) {
            await this.fixMinecraftPluginStructure(
              projectPath,
              pluginValidation.issues || [],
            );
            this.logger.log(
              'Automatically fixed Minecraft plugin structure issues',
            );
          } else if (!autoFix) {
            this.logger.warn(
              'Plugin structure issues detected but autoFix is disabled',
            );
          }
        }
      }

      // Run Maven clean install with better error capture
      this.logger.log('Running mvn clean install...');
      try {
        // Use a timeout to prevent hanging builds (10 minutes)
        const { stdout, stderr } = await this.execWithTimeout(
          'mvn clean install -B',
          { cwd: projectPath },
          600000, // 10-minute timeout
        );

        // Save the Maven output to a log file for analysis
        const mavenLogPath = path.join(projectPath, 'maven.log');
        fs.writeFileSync(
          mavenLogPath,
          `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`,
        ); // Enhanced error detection - Check both stdout and stderr, handle undefined/null values
        const buildFailed =
          (stderr &&
            (stderr.includes('BUILD FAILURE') || stderr.includes('[ERROR]'))) ||
          (stdout &&
            (stdout.includes('BUILD FAILURE') || stdout.includes('[ERROR]')));
        if (buildFailed) {
          this.logger.warn('Maven compilation failed'); // Parse structured errors for better diagnostics
          const parsedErrors = this.parseMavenErrors(stdout, stderr);

          // Attempt auto-fix if enabled
          if (autoFix && parsedErrors.length > 0) {
            this.logger.log(
              `Attempting to auto-fix ${parsedErrors.length} compilation errors`,
            );
            const fixResult = await this.attemptAutoFix(
              projectPath,
              parsedErrors,
            );
            if (fixResult.fixed) {
              // Retry compilation after fixes
              this.logger.log('Retrying compilation after applying fixes');
              return this.compileMavenProjectInternal(
                projectPath,
                false,
                false,
              ); // Don't auto-fix again to prevent loops
            } else {
              this.logger.warn(`Auto-fix failed: ${fixResult.reason}`); // Try AI-based fixing if enabled and auto-fix failed
              if (useAI) {
                this.logger.log('🤖 Attempting AI-based error fixing...');
                this.logger.log(
                  `📊 Found ${parsedErrors.length} compilation errors to analyze`,
                );
                try {
                  const aiFixResult = await this.fixWithAI(
                    projectPath,
                    stdout,
                    stderr,
                    parsedErrors,
                  );

                  if (aiFixResult.fixed) {
                    this.logger.log(
                      '✅ AI-based fixes applied successfully, retrying compilation',
                    );
                    return this.compileMavenProjectInternal(
                      projectPath,
                      false,
                      false,
                    ); // Don't auto-fix or use AI again to prevent loops
                  } else {
                    this.logger.warn(
                      `❌ AI-based fixing failed: ${aiFixResult.reason}`,
                    );
                  }
                } catch (error) {
                  this.logger.error(
                    `💥 AI-based fixing encountered error: ${error.message}`,
                  );
                  // Log the full error stack for debugging
                  this.logger.error(`Full error details: ${error.stack}`);
                }
              } else {
                this.logger.log('⚠️ AI fixing is disabled (useAI=false)');
              }
            }
          }

          // Return detailed error information
          return {
            success: false,
            output: stdout,
            error: stderr,
            errors: parsedErrors,
          };
        }

        // Find the generated JAR file in target directory with enhanced validation
        const targetDir = path.join(projectPath, 'target');
        if (fs.existsSync(targetDir)) {
          const jarFiles = fs
            .readdirSync(targetDir)
            .filter(
              (file) =>
                file.endsWith('.jar') &&
                !file.endsWith('-sources.jar') &&
                !file.endsWith('-javadoc.jar') &&
                !file.endsWith('-shaded.jar'),
            );

          if (jarFiles.length > 0) {
            // Sort by modification time to get the most recent
            const sortedJars = jarFiles
              .map((file) => ({
                file,
                mtime: fs.statSync(path.join(targetDir, file)).mtime,
              }))
              .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

            const artifactPath = path.join(targetDir, sortedJars[0].file);

            // Validate JAR contents for Minecraft plugins
            if (isMinecraftPlugin) {
              const jarValidation =
                await this.validateJarContents(artifactPath);
              if (!jarValidation.valid) {
                this.logger.warn(
                  `Generated JAR has issues: ${jarValidation.error}`,
                );
                return {
                  success: true,
                  output: `Maven build successful but JAR has issues: ${jarValidation.error}`,
                  artifactPath,
                  warnings: jarValidation.warnings,
                };
              }
            }

            return {
              success: true,
              output: `Maven build successful: ${stdout}`,
              artifactPath,
            };
          }
        }

        // Handle the case where build succeeded but no JAR was found
        return {
          success: true,
          output: `Maven build completed but no JAR file was found: ${stdout}`,
          warnings: [
            {
              type: 'plugin-specific',
              message:
                'Build completed successfully but no JAR artifact was generated',
              suggestion: 'Check maven-jar-plugin configuration in pom.xml',
            },
          ],
        };
      } catch (err) {
        // Enhanced error logging with structured error information
        this.logger.error(
          `🚨 ENTERED CATCH BLOCK - Maven compilation exception occurred`,
        );
        const compileError = err as EnhancedExecException;
        this.logger.error(`Maven compilation error details:`);
        this.logger.error(`stdout: ${compileError.stdout || 'N/A'}`);
        this.logger.error(`stderr: ${compileError.stderr || 'N/A'}`);

        // Handle Maven execution errors
        const stdout =
          typeof compileError.stdout === 'string' ? compileError.stdout : '';
        const stderr =
          typeof compileError.stderr === 'string' ? compileError.stderr : '';
        const errorOutput = stdout || stderr || compileError.message;
        const parsedErrors = this.parseMavenErrors(stdout || '', stderr || '');

        // Try to determine if it's a timeout
        const isTimeout =
          compileError.killed ||
          errorOutput.includes('timeout') ||
          errorOutput.includes('timed out');

        if (isTimeout) {
          return {
            success: false,
            output: stdout || '',
            error:
              'Maven build timed out. The build process took too long to complete.',
            errors: [
              {
                type: 'maven',
                message: 'Build process timed out',
                suggestion:
                  'Check for infinite loops or excessive processing in your code',
              },
            ],
          };
        }

        // Apply auto-fix and AI fixing logic in catch block as well
        if (parsedErrors.length > 0) {
          // Attempt auto-fix if enabled
          if (autoFix) {
            this.logger.log(
              `Attempting to auto-fix ${parsedErrors.length} compilation errors in catch block`,
            );
            const fixResult = await this.attemptAutoFix(
              projectPath,
              parsedErrors,
            );
            if (fixResult.fixed) {
              // Retry compilation after fixes
              this.logger.log(
                'Retrying compilation after applying fixes (catch block)',
              );
              return this.compileMavenProjectInternal(
                projectPath,
                false,
                false,
              ); // Don't auto-fix again to prevent loops
            } else {
              this.logger.warn(
                `Auto-fix failed in catch block: ${fixResult.reason}`,
              );

              // Try AI-based fixing if enabled and auto-fix failed
              if (useAI) {
                this.logger.log(
                  '🤖 Attempting AI-based error fixing in catch block...',
                );
                this.logger.log(
                  `📊 Found ${parsedErrors.length} compilation errors to analyze in catch block`,
                );
                try {
                  const aiFixResult = await this.fixWithAI(
                    projectPath,
                    stdout,
                    stderr,
                    parsedErrors,
                  );

                  if (aiFixResult.fixed) {
                    this.logger.log(
                      '✅ AI-based fixes applied successfully in catch block, retrying compilation',
                    );
                    return this.compileMavenProjectInternal(
                      projectPath,
                      false,
                      false,
                    ); // Don't auto-fix or use AI again to prevent loops
                  } else {
                    this.logger.warn(
                      `❌ AI-based fixing failed in catch block: ${aiFixResult.reason}`,
                    );
                  }
                } catch (error) {
                  this.logger.error(
                    `💥 AI-based fixing encountered error in catch block: ${error.message}`,
                  );
                  // Log the full error stack for debugging
                  this.logger.error(`Full error details: ${error.stack}`);
                }
              } else {
                this.logger.log(
                  '⚠️ AI fixing is disabled (useAI=false) in catch block',
                );
              }
            }
          }
        }

        return {
          success: false,
          output: stdout || '',
          error: errorOutput,
          errors: parsedErrors,
        };
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Maven compilation failed: ${err.message}`);
      return {
        success: false,
        output: '',
        error: err.message,
        errors: [
          {
            type: 'unknown',
            message: err.message,
          },
        ],
      };
    }
  }

  /**
   * Generate a Minecraft-specific pom.xml file with proper dependencies
   * @param projectPath Project directory path
   * @param config Configuration for POM generation
   */
  generateMinecraftPom(projectPath: string, config: Partial<PomConfig>): void {
    const pomPath = path.join(projectPath, 'pom.xml');

    // Default configuration values
    const defaultConfig: PomConfig = {
      groupId: 'com.example',
      artifactId: path.basename(projectPath).toLowerCase(),
      version: '1.0-SNAPSHOT',
      minecraftVersion: 'latest',
      useSpigot: true,
      usePaper: false,
      addDefaultRepositories: true,
      javaVersion: 17,
      includeCommands: true,
      includeConfig: true,
      dependencies: [],
    };

    // Merge with provided config
    const mergedConfig = { ...defaultConfig, ...config };

    if (fs.existsSync(pomPath)) {
      this.logger.log('pom.xml already exists, skipping generation');
      return;
    }

    // Build repositories section
    const repositories = mergedConfig.addDefaultRepositories
      ? `
    <repositories>
        <repository>
            <id>spigot-repo</id>
            <url>https://hub.spigotmc.org/nexus/content/repositories/snapshots/</url>
        </repository>
        ${
          mergedConfig.usePaper
            ? `
        <repository>
            <id>papermc</id>
            <url>https://repo.papermc.io/repository/maven-public/</url>
        </repository>`
            : ''
        }
        <repository>
            <id>sonatype</id>
            <url>https://oss.sonatype.org/content/groups/public/</url>
        </repository>
    </repositories>`
      : '';

    // Build dependencies section
    let dependencies = `
    <dependencies>`;

    // Add Spigot/Paper API dependency
    if (mergedConfig.useSpigot) {
      dependencies += `
        <!-- Spigot API -->
        <dependency>
            <groupId>org.spigotmc</groupId>
            <artifactId>spigot-api</artifactId>
            <version>${mergedConfig.spigotVersion || this.minecraftApiVersions[mergedConfig.minecraftVersion]}</version>
            <scope>provided</scope>
        </dependency>`;
    }

    if (mergedConfig.usePaper) {
      dependencies += `
        <!-- Paper API -->
        <dependency>
            <groupId>io.papermc.paper</groupId>
            <artifactId>paper-api</artifactId>
            <version>${mergedConfig.paperVersion || this.minecraftApiVersions[mergedConfig.minecraftVersion]}</version>
            <scope>provided</scope>
        </dependency>`;
    }

    // Add custom dependencies
    for (const dep of mergedConfig.dependencies) {
      dependencies += `
        <!-- ${dep.name} -->
        <dependency>
            <groupId>${dep.groupId}</groupId>
            <artifactId>${dep.artifactId}</artifactId>
            <version>${dep.version}</version>
            <scope>provided</scope>
        </dependency>`;
    }

    dependencies += `
    </dependencies>`;

    const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>${mergedConfig.groupId}</groupId>
    <artifactId>${mergedConfig.artifactId}</artifactId>
    <version>${mergedConfig.version}</version>

    <properties>
        <maven.compiler.source>${mergedConfig.javaVersion}</maven.compiler.source>
        <maven.compiler.target>${mergedConfig.javaVersion}</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>
    ${repositories}
    ${dependencies}

    <build>
        <resources>
            <resource>
                <directory>src/main/resources</directory>
                <filtering>true</filtering>
            </resource>
        </resources>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <configuration>
                    <source>${mergedConfig.javaVersion}</source>
                    <target>${mergedConfig.javaVersion}</target>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-shade-plugin</artifactId>
                <version>3.5.0</version>
                <executions>
                    <execution>
                        <phase>package</phase>
                        <goals>
                            <goal>shade</goal>
                        </goals>
                        <configuration>
                            <createDependencyReducedPom>false</createDependencyReducedPom>
                        </configuration>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</project>`;

    fs.writeFileSync(pomPath, pomContent);
    this.logger.log(`Generated Minecraft plugin pom.xml at ${pomPath}`);

    // Create default plugin.yml if it doesn't exist and includeConfig is true
    if (mergedConfig.includeConfig) {
      const resourcesDir = path.join(projectPath, 'src', 'main', 'resources');
      if (!fs.existsSync(resourcesDir)) {
        fs.mkdirSync(resourcesDir, { recursive: true });
      }

      const pluginYmlPath = path.join(resourcesDir, 'plugin.yml');
      if (!fs.existsSync(pluginYmlPath)) {
        const mainClass = `${mergedConfig.groupId}.${this.pascalCase(mergedConfig.artifactId)}`;
        const pluginYml = `name: ${this.pascalCase(mergedConfig.artifactId)}
version: ${mergedConfig.version}
main: ${mainClass}
api-version: 1.13
author: YourName
description: A Minecraft plugin
${
  mergedConfig.includeCommands
    ? `
commands:
  example:
    description: An example command
    usage: /example
    permission: ${mergedConfig.artifactId}.command.example`
    : ''
}`;

        fs.writeFileSync(pluginYmlPath, pluginYml);
        this.logger.log(`Generated default plugin.yml at ${pluginYmlPath}`);
      }

      // Create default config.yml
      const configYmlPath = path.join(resourcesDir, 'config.yml');
      if (!fs.existsSync(configYmlPath)) {
        const configYml = `# Configuration for ${this.pascalCase(mergedConfig.artifactId)}
settings:
  debug: false
  # Add your configuration options here
messages:
  prefix: '&7[&b${this.pascalCase(mergedConfig.artifactId)}&7] &r'
  no-permission: '&cYou do not have permission to do that!'`;

        fs.writeFileSync(configYmlPath, configYml);
        this.logger.log(`Generated default config.yml at ${configYmlPath}`);
      }
    }
  }

  /**
   * Generate a minimal pom.xml file if one doesn't exist
   * @param projectPath Project directory path
   * @param groupId Group ID for the project
   * @param artifactId Artifact ID for the project
   * @param version Version for the project
   */
  generateMinimalPom(
    projectPath: string,
    groupId: string,
    artifactId: string,
    version: string = '1.0-SNAPSHOT',
  ): void {
    // Check if this appears to be a Minecraft plugin
    if (this.isLikelyMinecraftPlugin(projectPath)) {
      this.logger.log(
        'Project appears to be a Minecraft plugin, generating Minecraft-specific POM',
      );
      return this.generateMinecraftPom(projectPath, {
        groupId,
        artifactId,
        version,
      });
    }

    const pomPath = path.join(projectPath, 'pom.xml');

    if (fs.existsSync(pomPath)) {
      this.logger.log('pom.xml already exists, skipping generation');
      return;
    }

    const pomContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>${groupId}</groupId>
    <artifactId>${artifactId}</artifactId>
    <version>${version}</version>

    <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <dependencies>
        <!-- Add dependencies here -->
    </dependencies>

    <build>
        <resources>
            <resource>
                <directory>src/main/resources</directory>
                <filtering>true</filtering>
            </resource>
        </resources>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <configuration>
                    <source>17</source>
                    <target>17</target>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-jar-plugin</artifactId>
                <version>3.3.0</version>
                <configuration>
                    <archive>
                        <manifest>
                            <addClasspath>true</addClasspath>
                            <mainClass>${groupId}.Main</mainClass>
                        </manifest>
                    </archive>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>`;

    fs.writeFileSync(pomPath, pomContent);
    this.logger.log(`Generated minimal pom.xml at ${pomPath}`);
  }

  // ----- HELPER METHODS -----

  /**
   * Execute a command with a timeout
   */
  private async execWithTimeout(
    cmd: string,
    options: any,
    timeout: number,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const process = exec(cmd, options, (error, stdout, stderr) => {
        if (error) {
          const enhancedError = error as EnhancedExecException;
          enhancedError.stdout = stdout.toString();
          enhancedError.stderr = stderr.toString();
          reject(enhancedError);
        } else {
          resolve({
            stdout: stdout.toString(),
            stderr: stderr.toString(),
          });
        }
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        process.kill();
        const timeoutError = new Error(
          'Command execution timed out',
        ) as EnhancedExecException;
        reject(timeoutError);
      }, timeout);

      // Clear timeout if process exits before timeout
      process.on('exit', () => {
        clearTimeout(timeoutId);
      });
    });
  }

  /**
   * Parse Maven compilation errors into structured format
   */
  private parseMavenErrors(stdout: string, stderr: string): CompilationError[] {
    const errors: CompilationError[] = [];
    const combinedOutput = stdout + '\n' + stderr;

    // Regex patterns for different error types
    const syntaxErrorPattern =
      /\[ERROR\]\s+([^:]+):(\d+)(?::(\d+))?\s+(?:error:|-)?\s+(.+)/g;
    const dependencyErrorPattern =
      /\[ERROR\]\s+Failed to execute goal .*?dependency:(.+)/g;
    const pluginErrorPattern =
      /\[ERROR\]\s+Failed to execute goal .*?plugin:(.+)/g;

    // Extract syntax errors
    let match;
    while ((match = syntaxErrorPattern.exec(combinedOutput)) !== null) {
      const [_, file, line, column, message] = match;

      // Determine error type based on message
      let type: CompilationError['type'] = 'syntax';
      if (
        message.includes('cannot find symbol') ||
        message.includes('cannot be resolved')
      ) {
        type = 'semantic';
      } else if (message.includes('is already defined')) {
        type = 'semantic';
      }

      errors.push({
        type,
        file,
        line: parseInt(line),
        column: column ? parseInt(column) : undefined,
        message: message.trim(),
      });
    }

    // Extract dependency errors
    while ((match = dependencyErrorPattern.exec(combinedOutput)) !== null) {
      errors.push({
        type: 'dependency',
        message: match[1].trim(),
      });
    }

    // Extract plugin errors
    while ((match = pluginErrorPattern.exec(combinedOutput)) !== null) {
      errors.push({
        type: 'maven',
        message: match[1].trim(),
      });
    }

    // Look for Minecraft-specific errors
    if (
      combinedOutput.includes('JavaPlugin') ||
      combinedOutput.includes('bukkit') ||
      combinedOutput.includes('spigot')
    ) {
      if (
        combinedOutput.includes('cannot find symbol') &&
        combinedOutput.includes('JavaPlugin')
      ) {
        errors.push({
          type: 'plugin-specific',
          message: 'Missing Bukkit/Spigot API dependency',
          suggestion: 'Add Spigot-API as a dependency in your pom.xml',
        });
      }

      if (combinedOutput.includes('plugin.yml')) {
        errors.push({
          type: 'plugin-specific',
          message: 'Issues with plugin.yml file',
          suggestion:
            'Ensure plugin.yml is properly formatted and in src/main/resources',
        });
      }
    }

    // If no specific errors found but build failed, add a generic error
    if (
      errors.length === 0 &&
      (combinedOutput.includes('BUILD FAILURE') ||
        combinedOutput.includes('[ERROR]'))
    ) {
      errors.push({
        type: 'unknown',
        message: 'Build failed with no specific error details',
      });
    }

    return errors;
  }

  /**
   * Attempt to automatically fix compilation errors
   */
  private async attemptAutoFix(
    projectPath: string,
    errors: CompilationError[],
  ): Promise<{ fixed: boolean; reason?: string }> {
    let fixedAny = false;

    for (const error of errors) {
      switch (error.type) {
        case 'dependency':
          // Try to fix dependency issues
          if (await this.fixDependencyIssue(projectPath, error)) {
            fixedAny = true;
          }
          break;

        case 'plugin-specific':
          // Try to fix Minecraft plugin issues
          if (await this.fixPluginSpecificIssue(projectPath, error)) {
            fixedAny = true;
          }
          break;

        case 'syntax':
        case 'semantic':
          // Basic fixes for common syntax/semantic issues
          if (error.file && (await this.fixCodeIssue(projectPath, error))) {
            fixedAny = true;
          }
          break;
      }
    }

    return fixedAny
      ? { fixed: true }
      : { fixed: false, reason: 'No automatic fixes could be applied' };
  }

  /**
   * Fix dependency issues in pom.xml
   */
  private async fixDependencyIssue(
    projectPath: string,
    error: CompilationError,
  ): Promise<boolean> {
    const pomPath = path.join(projectPath, 'pom.xml');
    if (!fs.existsSync(pomPath)) return false;

    // Read the POM file
    const pomContent = fs.readFileSync(pomPath, 'utf8');

    // Check for common Minecraft dependency issues
    if (
      error.message.includes('JavaPlugin') ||
      error.message.includes('Bukkit') ||
      error.message.includes('Spigot')
    ) {
      // Check if the POM already has Spigot dependency
      if (
        !pomContent.includes('org.spigotmc') &&
        !pomContent.includes('spigot-api')
      ) {
        // Add Spigot API dependency
        const newPomContent = pomContent.replace(
          /<dependencies>[\s\S]*?<\/dependencies>/,
          `<dependencies>
        <!-- Spigot API -->
        <dependency>
            <groupId>org.spigotmc</groupId>
            <artifactId>spigot-api</artifactId>
            <version>1.20.4-R0.1-SNAPSHOT</version>
            <scope>provided</scope>
        </dependency>
        $&`,
        );

        // Add Spigot repository if missing
        let finalPomContent = newPomContent;
        if (!newPomContent.includes('spigot-repo')) {
          finalPomContent = newPomContent.includes('<repositories>')
            ? newPomContent.replace(
                /<repositories>[\s\S]*?<\/repositories>/,
                `<repositories>
        <repository>
            <id>spigot-repo</id>
            <url>https://hub.spigotmc.org/nexus/content/repositories/snapshots/</url>
        </repository>
        $&`,
              )
            : newPomContent.replace(
                /<properties>[\s\S]*?<\/properties>/,
                `$&
    
    <repositories>
        <repository>
            <id>spigot-repo</id>
            <url>https://hub.spigotmc.org/nexus/content/repositories/snapshots/</url>
        </repository>
    </repositories>`,
              );
        }

        fs.writeFileSync(pomPath, finalPomContent);
        this.logger.log('Added Spigot API dependency to pom.xml');
        return true;
      }
    }

    return false;
  }

  /**
   * Fix Minecraft plugin-specific issues
   */
  private async fixPluginSpecificIssue(
    projectPath: string,
    error: CompilationError,
  ): Promise<boolean> {
    // Check if plugin.yml is missing or incorrectly located
    if (error.message.includes('plugin.yml')) {
      const resourcesDir = path.join(projectPath, 'src', 'main', 'resources');
      const pluginYmlPath = path.join(resourcesDir, 'plugin.yml');

      // Check alternate locations
      const possibleLocations = [
        path.join(projectPath, 'plugin.yml'),
        path.join(projectPath, 'resources', 'plugin.yml'),
        path.join(projectPath, 'src', 'resources', 'plugin.yml'),
      ];

      for (const location of possibleLocations) {
        if (fs.existsSync(location)) {
          // Create resources directory if it doesn't exist
          if (!fs.existsSync(resourcesDir)) {
            fs.mkdirSync(resourcesDir, { recursive: true });
          }

          // Copy file to correct location
          fs.copyFileSync(location, pluginYmlPath);
          this.logger.log(
            `Moved plugin.yml from ${location} to ${pluginYmlPath}`,
          );
          return true;
        }
      }

      // If not found, create a basic plugin.yml
      if (!fs.existsSync(pluginYmlPath)) {
        // Try to determine main class from project structure
        const mainClass = await this.determineMainClass(projectPath);

        if (mainClass) {
          // Create resources directory if it doesn't exist
          if (!fs.existsSync(resourcesDir)) {
            fs.mkdirSync(resourcesDir, { recursive: true });
          }

          // Create basic plugin.yml
          const pluginYml = `name: ${path.basename(projectPath)}
version: 1.0
main: ${mainClass}
api-version: 1.13
author: Generated
description: A Minecraft plugin`;

          fs.writeFileSync(pluginYmlPath, pluginYml);
          this.logger.log(`Generated basic plugin.yml at ${pluginYmlPath}`);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Fix common code issues
   */
  private async fixCodeIssue(
    projectPath: string,
    error: CompilationError,
  ): Promise<boolean> {
    if (!error.file) return false;

    const filePath = path.join(projectPath, error.file);
    if (!fs.existsSync(filePath)) return false;

    const fileContent = fs.readFileSync(filePath, 'utf8');
    let newContent = fileContent;
    let fixed = false;

    // Fix common package declaration issues
    if (
      error.message.includes('package') &&
      error.message.includes('does not exist')
    ) {
      // Extract the package from the file
      const packageMatch = fileContent.match(/package\s+([^;]+);/);
      if (packageMatch) {
        const packageName = packageMatch[1].trim();
        const packageDir = path.join(
          projectPath,
          'src',
          'main',
          'java',
          ...packageName.split('.'),
        );

        // Create directory if it doesn't exist
        if (!fs.existsSync(packageDir)) {
          fs.mkdirSync(packageDir, { recursive: true });
          this.logger.log(`Created package directory: ${packageDir}`);
          fixed = true;
        }
      }
    } // Fix API usage issues - specifically non-cancellable events
    if (
      error.message.includes('cannot find symbol') &&
      error.message.includes('setCancelled')
    ) {
      // Check if trying to cancel a non-cancellable event
      if (
        fileContent.includes('EntityDeathEvent') &&
        fileContent.includes('setCancelled(')
      ) {
        this.logger.log(
          'Detected setCancelled() usage on EntityDeathEvent - converting to EntityDamageEvent approach',
        );

        // Replace EntityDeathEvent import with EntityDamageEvent
        if (
          fileContent.includes(
            'import org.bukkit.event.entity.EntityDeathEvent;',
          )
        ) {
          newContent = newContent.replace(
            'import org.bukkit.event.entity.EntityDeathEvent;',
            'import org.bukkit.event.entity.EntityDamageEvent;',
          );
        }

        // Convert EntityDeathEvent handler to EntityDamageEvent handler
        newContent = newContent.replace(
          /public\s+void\s+(\w+)\(EntityDeathEvent\s+event\)/,
          'public void $1(EntityDamageEvent event)',
        );

        // Convert the method logic to prevent death instead of handling death
        newContent = newContent.replace(
          /\/\*\*[\s\S]*?Handle\s+(?:Ender\s+Dragon\s+)?(?:Entity)?(?:Death|death)\s+(?:Event|events?)[\s\S]*?\*\//,
          '/**\n     * Handle Ender Dragon damage events to prevent death and preserve the corpse\n     * @param event The EntityDamageEvent\n     */',
        );

        // Add damage check logic before the main logic
        const damageCheckLogic = `
        // Check if this damage would kill the dragon
        if (dragon.getHealth() - event.getFinalDamage() <= 0) {
            try {
                Location deathLocation = dragon.getLocation();
                World world = dragon.getWorld();
                
                getLogger().info("Ender Dragon would die at " + formatLocation(deathLocation) + ". Preserving corpse...");
                
                // Cancel the damage event to prevent death
                event.setCancelled(true);`;

        // Replace the death event logic with damage prevention logic
        newContent = newContent.replace(
          /try\s*\{\s*getLogger\(\)\.info\("Ender Dragon killed at[\s\S]*?event\.setCancelled\(true\);/,
          damageCheckLogic,
        );

        // Close the damage check block properly
        newContent = newContent.replace(
          /\}\s*catch\s*\(\s*Exception\s+e\s*\)\s*\{\s*getLogger\(\)\.log\(Level\.SEVERE,\s*"Error handling Ender Dragon (?:death|damage) event"/,
          '            } catch (Exception e) {\n                getLogger().log(Level.SEVERE, "Error handling Ender Dragon damage event"',
        );

        // Add closing brace for the damage check
        newContent = newContent.replace(
          /event\.setCancelled\(false\);\s*\}\s*\}\s*$/m,
          'event.setCancelled(false);\n            }\n        }\n    }',
        );

        fs.writeFileSync(filePath, newContent);
        this.logger.log(
          'Converted EntityDeathEvent to EntityDamageEvent approach',
        );
        fixed = true;
      }
    }

    // Fix missing imports for common Minecraft classes
    if (
      error.message.includes('cannot find symbol') ||
      error.message.includes('cannot be resolved')
    ) {
      const symbolMatch = error.message.match(
        /symbol:\s+(?:class|variable)\s+(\w+)/,
      );

      if (symbolMatch) {
        const symbol = symbolMatch[1];

        // Map of common Minecraft classes to their import statements
        const commonImports: { [key: string]: string } = {
          JavaPlugin: 'import org.bukkit.plugin.java.JavaPlugin;',
          Plugin: 'import org.bukkit.plugin.Plugin;',
          Bukkit: 'import org.bukkit.Bukkit;',
          Player: 'import org.bukkit.entity.Player;',
          Command: 'import org.bukkit.command.Command;',
          CommandSender: 'import org.bukkit.command.CommandSender;',
          ItemStack: 'import org.bukkit.inventory.ItemStack;',
          Material: 'import org.bukkit.Material;',
          Location: 'import org.bukkit.Location;',
          World: 'import org.bukkit.World;',
          Event: 'import org.bukkit.event.Event;',
          EventHandler: 'import org.bukkit.event.EventHandler;',
          Listener: 'import org.bukkit.event.Listener;',
          PlayerJoinEvent: 'import org.bukkit.event.player.PlayerJoinEvent;',
          PlayerQuitEvent: 'import org.bukkit.event.player.PlayerQuitEvent;',
          EntityDamageEvent:
            'import org.bukkit.event.entity.EntityDamageEvent;',
        };

        if (
          commonImports[symbol] &&
          !fileContent.includes(commonImports[symbol])
        ) {
          // Add import statement after package declaration
          newContent = fileContent.replace(
            /package\s+[^;]+;/,
            `$&\n\n${commonImports[symbol]}`,
          );

          fs.writeFileSync(filePath, newContent);
          this.logger.log(`Added import for ${symbol} in ${error.file}`);
          fixed = true;
        }
      }
    }

    return fixed;
  }

  /**
   * Determine the main class of a Minecraft plugin project
   */
  private async determineMainClass(
    projectPath: string,
  ): Promise<string | null> {
    // Try to find Java files that extend JavaPlugin
    const javaDir = path.join(projectPath, 'src', 'main', 'java');
    if (!fs.existsSync(javaDir)) return null;

    // Find all Java files
    const javaFiles = await this.findFiles(javaDir, '.java');

    for (const file of javaFiles) {
      const content = fs.readFileSync(file, 'utf8');

      // Check if this file extends JavaPlugin
      if (
        content.includes('extends JavaPlugin') ||
        content.includes('extends org.bukkit.plugin.java.JavaPlugin')
      ) {
        // Extract package
        const packageMatch = content.match(/package\s+([^;]+);/);
        if (!packageMatch) continue;

        // Extract class name
        const classMatch = content.match(/public\s+class\s+(\w+)/);
        if (!classMatch) continue;

        return `${packageMatch[1]}.${classMatch[1]}`;
      }
    }

    return null;
  }

  /**
   * Find all files with a specific extension in a directory recursively
   */
  private async findFiles(dir: string, extension: string): Promise<string[]> {
    const files: string[] = [];

    const readDirRecursive = async (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await readDirRecursive(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
          files.push(fullPath);
        }
      }
    };

    await readDirRecursive(dir);
    return files;
  }

  /**
   * Validate if a path is a valid project path (security check)
   */
  private isValidProjectPath(projectPath: string): boolean {
    // Normalize path and check if it's absolute
    const normalizedPath = path.normalize(projectPath);

    // Security check: don't allow paths that might access sensitive directories
    const sensitiveDirectories = [
      '/etc',
      '/var',
      '/usr',
      '/bin',
      '/boot',
      '/dev',
      '/lib',
      '/proc',
      '/sys',
      'C:\\Windows',
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      'C:\\ProgramData',
    ];

    for (const dir of sensitiveDirectories) {
      if (normalizedPath.startsWith(dir)) {
        this.logger.warn(`Rejected suspicious project path: ${normalizedPath}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a project is likely a Minecraft plugin
   */
  private isLikelyMinecraftPlugin(projectPath: string): boolean {
    // Check for plugin.yml in various locations
    const possibleLocations = [
      path.join(projectPath, 'plugin.yml'),
      path.join(projectPath, 'src', 'main', 'resources', 'plugin.yml'),
      path.join(projectPath, 'resources', 'plugin.yml'),
    ];

    for (const location of possibleLocations) {
      if (fs.existsSync(location)) {
        return true;
      }
    }

    // Check for Java files that might be Minecraft-related
    const srcDir = path.join(projectPath, 'src');
    if (fs.existsSync(srcDir)) {
      try {
        // Find .java files that contain Minecraft-specific imports
        const javaFiles = this.findFilesSync(srcDir, '.java');
        for (const file of javaFiles.slice(0, 10)) {
          // Check at most 10 files
          const content = fs.readFileSync(file, 'utf8');
          if (
            content.includes('org.bukkit') ||
            content.includes('JavaPlugin') ||
            content.includes('Spigot') ||
            content.includes('Bukkit')
          ) {
            return true;
          }
        }
      } catch (error) {
        // Ignore errors in file finding/reading
      }
    }

    return false;
  }

  /**
   * Synchronous version of findFiles for smaller operations
   */
  private findFilesSync(dir: string, extension: string): string[] {
    const files: string[] = [];

    const readDirRecursive = (currentDir: string) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);

          if (entry.isDirectory()) {
            readDirRecursive(fullPath);
          } else if (entry.isFile() && entry.name.endsWith(extension)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Ignore errors for individual directories
      }
    };

    readDirRecursive(dir);
    return files;
  }

  /**
   * Check if a project is a Minecraft plugin by examining its structure
   */
  private async isMinecraftPlugin(projectPath: string): Promise<boolean> {
    // Check for plugin.yml
    const pluginYmlPath = path.join(
      projectPath,
      'src',
      'main',
      'resources',
      'plugin.yml',
    );
    if (fs.existsSync(pluginYmlPath)) {
      return true;
    }

    // Check pom.xml for Bukkit/Spigot dependencies
    const pomPath = path.join(projectPath, 'pom.xml');
    if (fs.existsSync(pomPath)) {
      const pomContent = fs.readFileSync(pomPath, 'utf8');
      if (
        pomContent.includes('org.bukkit') ||
        pomContent.includes('org.spigotmc') ||
        pomContent.includes('io.papermc')
      ) {
        return true;
      }
    }

    return this.isLikelyMinecraftPlugin(projectPath);
  }

  /**
   * Validate plugin.yml structure
   */
  private async validateMinecraftPlugin(projectPath: string): Promise<{
    valid: boolean;
    error?: string;
    issues?: PluginIssue[];
    fixable?: boolean;
  }> {
    const pluginYmlPath = path.join(
      projectPath,
      'src',
      'main',
      'resources',
      'plugin.yml',
    );
    if (!fs.existsSync(pluginYmlPath)) {
      return {
        valid: false,
        error: 'plugin.yml not found in src/main/resources',
        issues: [{ type: 'missing_file', file: 'plugin.yml' }],
        fixable: true,
      };
    }

    try {
      const pluginYml = fs.readFileSync(pluginYmlPath, 'utf8');
      const issues: PluginIssue[] = [];

      // Check for required fields
      if (!pluginYml.includes('name:')) {
        issues.push({ type: 'missing_field', field: 'name' });
      }

      if (!pluginYml.includes('version:')) {
        issues.push({ type: 'missing_field', field: 'version' });
      }

      if (!pluginYml.includes('main:')) {
        issues.push({ type: 'missing_field', field: 'main' });
      }

      // Extract main class and check if it exists
      const mainMatch = pluginYml.match(/main:\s*([^\s]+)/);
      if (mainMatch) {
        const mainClass = mainMatch[1];
        const mainClassPath = mainClass.replace(/\./g, '/') + '.java';
        const mainClassFile = path.join(
          projectPath,
          'src',
          'main',
          'java',
          mainClassPath,
        );

        if (
          !this.doesFileExistIgnoreCase(
            projectPath,
            'src/main/java/' + mainClassPath,
          )
        ) {
          issues.push({
            type: 'invalid_main',
            main: mainClass,
            message: `Main class ${mainClass} not found in src/main/java`,
          });
        } else {
          // Check if the main class extends JavaPlugin
          const mainClassContent = fs.readFileSync(mainClassFile, 'utf8');
          if (
            !mainClassContent.includes('extends JavaPlugin') &&
            !mainClassContent.includes(
              'extends org.bukkit.plugin.java.JavaPlugin',
            )
          ) {
            issues.push({
              type: 'invalid_main_class',
              main: mainClass,
              message: `Main class ${mainClass} does not extend JavaPlugin`,
            });
          }
        }
      }

      if (issues.length > 0) {
        return {
          valid: false,
          error: `Invalid plugin.yml: ${issues.map((i) => i.message || i.type).join(', ')}`,
          issues,
          fixable: true,
        };
      }

      return { valid: true };
    } catch (error) {
      const err = error as Error;
      return {
        valid: false,
        error: `Error reading plugin.yml: ${err.message}`,
        issues: [{ type: 'read_error', file: 'plugin.yml' }],
        fixable: false,
      };
    }
  }

  /**
   * Case-insensitive file existence check for cross-platform compatibility
   */
  private doesFileExistIgnoreCase(
    basePath: string,
    relativePath: string,
  ): boolean {
    const parts = relativePath.split(/[\\/]/);
    let currentPath = basePath;

    for (const part of parts) {
      if (!fs.existsSync(currentPath)) {
        return false;
      }

      const entries = fs.readdirSync(currentPath);
      const match = entries.find(
        (entry) => entry.toLowerCase() === part.toLowerCase(),
      );

      if (!match) {
        return false;
      }

      currentPath = path.join(currentPath, match);
    }

    return fs.existsSync(currentPath);
  }

  /**
   * Validate pom.xml structure
   */
  private async validatePomXml(pomPath: string): Promise<{
    valid: boolean;
    error?: string;
    issues?: PluginIssue[];
    fixable?: boolean;
  }> {
    if (!fs.existsSync(pomPath)) {
      return {
        valid: false,
        error: 'pom.xml not found',
        fixable: true,
      };
    }

    try {
      const pomContent = fs.readFileSync(pomPath, 'utf8');

      // Simple XML validation
      if (
        !pomContent.includes('<project') ||
        !pomContent.includes('</project>')
      ) {
        return {
          valid: false,
          error: 'pom.xml is not valid XML',
          fixable: false,
        };
      }

      // Check for required elements
      const issues: PluginIssue[] = [];

      if (!pomContent.includes('<groupId>')) {
        issues.push({ type: 'missing_field', field: 'groupId' });
      }

      if (!pomContent.includes('<artifactId>')) {
        issues.push({ type: 'missing_field', field: 'artifactId' });
      }

      if (!pomContent.includes('<version>')) {
        issues.push({ type: 'missing_field', field: 'version' });
      }

      // For Minecraft plugins, check for proper resource filtering
      if (
        (await this.isMinecraftPlugin(path.dirname(pomPath))) &&
        (!pomContent.includes('<resources>') ||
          !pomContent.includes('<filtering>true</filtering>'))
      ) {
        issues.push({
          type: 'missing_resource_filtering',
          message:
            'Missing resource filtering configuration for Minecraft plugin',
        });
      }

      if (issues.length > 0) {
        return {
          valid: false,
          error: `Invalid pom.xml: ${issues.map((i) => i.message || i.type).join(', ')}`,
          issues,
          fixable: true,
        };
      }

      return { valid: true };
    } catch (error) {
      const err = error as Error;
      return {
        valid: false,
        error: `Error reading pom.xml: ${err.message}`,
        fixable: false,
      };
    }
  }

  /**
   * Fix issues in pom.xml
   */
  private async fixPomXml(
    pomPath: string,
    issues: PluginIssue[],
  ): Promise<boolean> {
    if (!fs.existsSync(pomPath)) return false;

    try {
      let pomContent = fs.readFileSync(pomPath, 'utf8');
      let modified = false;

      for (const issue of issues) {
        if (issue.type === 'missing_resource_filtering') {
          // Add resource filtering
          if (!pomContent.includes('<resources>')) {
            if (pomContent.includes('<build>')) {
              // Add resources section to existing build
              pomContent = pomContent.replace(
                /<build>\s*/,
                `<build>
        <resources>
            <resource>
                <directory>src/main/resources</directory>
                <filtering>true</filtering>
            </resource>
        </resources>
        `,
              );
            } else {
              // Add build section with resources
              pomContent = pomContent.replace(
                /<\/project>/,
                `    <build>
        <resources>
            <resource>
                <directory>src/main/resources</directory>
                <filtering>true</filtering>
            </resource>
        </resources>
    </build>
</project>`,
              );
            }
            modified = true;
          }
        }
      }

      if (modified) {
        fs.writeFileSync(pomPath, pomContent);
        return true;
      }

      return false;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error fixing pom.xml: ${err.message}`);
      return false;
    }
  }

  /**
   * Fix Minecraft plugin structure issues
   */
  private async fixMinecraftPluginStructure(
    projectPath: string,
    issues: PluginIssue[],
  ): Promise<boolean> {
    let fixed = false;

    for (const issue of issues) {
      if (issue.type === 'missing_file' && issue.file === 'plugin.yml') {
        // Create basic plugin.yml
        const resourcesDir = path.join(projectPath, 'src', 'main', 'resources');
        if (!fs.existsSync(resourcesDir)) {
          fs.mkdirSync(resourcesDir, { recursive: true });
        }

        const pluginYmlPath = path.join(resourcesDir, 'plugin.yml');

        // Try to determine main class
        const mainClass =
          (await this.determineMainClass(projectPath)) ||
          `com.example.${this.pascalCase(path.basename(projectPath))}`;

        const pluginYml = `name: ${this.pascalCase(path.basename(projectPath))}
version: 1.0
main: ${mainClass}
api-version: 1.13
author: Generated
description: A Minecraft plugin`;

        fs.writeFileSync(pluginYmlPath, pluginYml);
        this.logger.log(`Generated basic plugin.yml at ${pluginYmlPath}`);
        fixed = true;
      } else if (issue.type === 'invalid_main' && issue.main) {
        // Create main class file
        const mainClass = issue.main;
        const packageParts = mainClass.split('.');
        const className = packageParts.pop() || '';
        const packageName = packageParts.join('.');
        const packagePath = packageName.replace(/\./g, '/');

        const mainClassDir = path.join(
          projectPath,
          'src',
          'main',
          'java',
          packagePath,
        );
        if (!fs.existsSync(mainClassDir)) {
          fs.mkdirSync(mainClassDir, { recursive: true });
        }

        const mainClassPath = path.join(mainClassDir, `${className}.java`);
        const mainClassContent = `package ${packageName};

import org.bukkit.plugin.java.JavaPlugin;

public class ${className} extends JavaPlugin {
    @Override
    public void onEnable() {
        getLogger().info("${className} has been enabled!");
    }

    @Override
    public void onDisable() {
        getLogger().info("${className} has been disabled!");
    }
}`;

        fs.writeFileSync(mainClassPath, mainClassContent);
        this.logger.log(`Created main class at ${mainClassPath}`);
        fixed = true;
      }
    }

    return fixed;
  }

  /**
   * Validate JAR file contents for Minecraft plugins
   */
  private async validateJarContents(jarPath: string): Promise<{
    valid: boolean;
    error?: string;
    warnings?: CompilationWarning[];
  }> {
    try {
      const { stdout } = await execPromise(`jar tf "${jarPath}"`, {
        timeout: 10000,
      });
      const warnings: CompilationWarning[] = [];

      // Check for plugin.yml
      if (!stdout.includes('plugin.yml')) {
        warnings.push({
          type: 'plugin-specific',
          message: 'plugin.yml not found in JAR file',
          suggestion:
            'Ensure plugin.yml is in src/main/resources and resources are properly configured in pom.xml',
        });
      }

      // Check for config.yml if it exists in the project
      const jarDir = path.dirname(jarPath);
      const projectDir = path.resolve(jarDir, '..');
      const configPath = path.join(
        projectDir,
        'src',
        'main',
        'resources',
        'config.yml',
      );

      if (fs.existsSync(configPath) && !stdout.includes('config.yml')) {
        warnings.push({
          type: 'plugin-specific',
          message: 'config.yml exists in project but is not included in JAR',
          suggestion: 'Check resource filtering in pom.xml',
        });
      }

      // Check for common class file issues
      if (!stdout.includes('.class')) {
        warnings.push({
          type: 'plugin-specific',
          message: 'No compiled class files found in JAR',
          suggestion: 'Check for compilation errors',
        });
      }

      if (warnings.length > 0) {
        return {
          valid: false,
          error: warnings.map((w) => w.message).join(', '),
          warnings,
        };
      }

      return { valid: true };
    } catch (error) {
      const err = error as Error;
      return {
        valid: false,
        error: `Failed to validate JAR contents: ${err.message}`,
        warnings: [
          {
            type: 'other',
            message: `Failed to validate JAR contents: ${err.message}`,
          },
        ],
      };
    }
  }

  /**
   * Convert string to PascalCase
   */
  private pascalCase(str: string): string {
    return str
      .replace(/[-_\s.]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^(.)/, (c) => c.toUpperCase());
  }

  /**
   * Cleans and recompiles the plugin by deleting the target folder and running Maven
   */
  /**
   * Use AI to fix compilation errors
   * @param projectPath Path to the project directory
   * @param stdout Maven compilation stdout
   * @param stderr Maven compilation stderr
   * @param parsedErrors Structured compilation errors
   * @returns Promise with fix result
   */ private async fixWithAI(
    projectPath: string,
    stdout: string,
    stderr: string,
    parsedErrors: CompilationError[],
  ): Promise<{ fixed: boolean; reason?: string }> {
    try {
      this.logger.log('🔧 Preparing AI context for compilation error fixing');

      // Build project context
      const projectContext = await this.buildProjectContext(projectPath);
      this.logger.log(
        `📁 Built project context (${projectContext.length} characters)`,
      );

      // Format errors for AI analysis
      const errorSummary = this.formatErrorsForAI(parsedErrors, stdout, stderr);
      this.logger.log(
        `📋 Formatted ${parsedErrors.length} errors for AI analysis`,
      );

      // Create comprehensive prompt for AI
      const aiPrompt = this.buildAIFixPrompt(projectContext, errorSummary);
      this.logger.log(`📝 Created AI prompt (${aiPrompt.length} characters)`);

      this.logger.log(
        '🚀 Requesting AI assistance for compilation error fixes',
      );

      // Get AI response using the main model (not refinement service)
      const aiResponse = await this.geminiService.processWithGemini(aiPrompt);
      this.logger.log(
        `📥 Received AI response (${aiResponse.length} characters)`,
      );

      // Parse AI response to extract fixes
      const fixes = this.parseAIFixResponse(aiResponse);
      this.logger.log('🔍 Parsing AI response for actionable fixes...');

      if (
        !fixes ||
        (!fixes.modifiedFiles?.length && !fixes.createdFiles?.length)
      ) {
        this.logger.warn('⚠️ AI did not provide any actionable fixes');
        return {
          fixed: false,
          reason: 'AI did not provide any actionable fixes',
        };
      }

      this.logger.log(
        `🛠️ Applying ${fixes.modifiedFiles?.length || 0} file modifications and ${fixes.createdFiles?.length || 0} new files`,
      );

      // Apply fixes to the project
      const applyResult = await this.applyAIFixes(projectPath, fixes);

      if (!applyResult.success) {
        this.logger.error(`❌ Failed to apply AI fixes: ${applyResult.error}`);
        return {
          fixed: false,
          reason: `Failed to apply AI fixes: ${applyResult.error}`,
        };
      }

      this.logger.log('✅ AI fixes applied successfully');
      return { fixed: true };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`💥 AI-based fixing failed: ${err.message}`);
      this.logger.error(`Stack trace: ${err.stack}`);
      return {
        fixed: false,
        reason: `AI processing error: ${err.message}`,
      };
    }
  }

  /**
   * Build project context for AI analysis
   */
  private async buildProjectContext(projectPath: string): Promise<string> {
    let context = `Project: ${path.basename(projectPath)}\n`;
    context += `Location: ${projectPath}\n\n`;

    // Add pom.xml content if it exists
    const pomPath = path.join(projectPath, 'pom.xml');
    if (fs.existsSync(pomPath)) {
      const pomContent = fs.readFileSync(pomPath, 'utf8');
      context += `POM.XML:\n${pomContent}\n\n`;
    }

    // Add plugin.yml content if it exists (Minecraft plugin)
    const pluginYmlPath = path.join(
      projectPath,
      'src',
      'main',
      'resources',
      'plugin.yml',
    );
    if (fs.existsSync(pluginYmlPath)) {
      const pluginYmlContent = fs.readFileSync(pluginYmlPath, 'utf8');
      context += `PLUGIN.YML:\n${pluginYmlContent}\n\n`;
    }

    // Add main Java files content (up to 3 files to avoid overwhelming the AI)
    const javaFiles = this.findJavaFiles(projectPath).slice(0, 3);
    for (const javaFile of javaFiles) {
      try {
        const relativePath = path.relative(projectPath, javaFile);
        const content = fs.readFileSync(javaFile, 'utf8');
        context += `FILE: ${relativePath}\n${content}\n\n`;
      } catch (error) {
        this.logger.warn(`Could not read Java file: ${javaFile}`);
      }
    }

    return context;
  }

  /**
   * Find Java files in the project
   */
  private findJavaFiles(projectPath: string): string[] {
    const javaFiles: string[] = [];
    const srcDir = path.join(projectPath, 'src', 'main', 'java');

    if (fs.existsSync(srcDir)) {
      this.findJavaFilesRecursive(srcDir, javaFiles);
    }

    return javaFiles;
  }

  /**
   * Recursively find Java files
   */
  private findJavaFilesRecursive(dir: string, javaFiles: string[]): void {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          this.findJavaFilesRecursive(fullPath, javaFiles);
        } else if (stat.isFile() && item.endsWith('.java')) {
          javaFiles.push(fullPath);
        }
      }
    } catch (error) {
      this.logger.warn(`Could not scan directory: ${dir}`);
    }
  }

  /**
   * Format compilation errors for AI analysis
   */
  private formatErrorsForAI(
    parsedErrors: CompilationError[],
    stdout: string,
    stderr: string,
  ): string {
    let errorSummary = 'COMPILATION ERRORS:\n\n';

    // Add structured errors
    if (parsedErrors.length > 0) {
      errorSummary += 'Structured Errors:\n';
      parsedErrors.forEach((error, index) => {
        errorSummary += `${index + 1}. Type: ${error.type}\n`;
        errorSummary += `   Message: ${error.message}\n`;
        if (error.file) errorSummary += `   File: ${error.file}\n`;
        if (error.line) errorSummary += `   Line: ${error.line}\n`;
        if (error.suggestion)
          errorSummary += `   Suggestion: ${error.suggestion}\n`;
        errorSummary += '\n';
      });
    }

    // Add raw Maven output (truncated to avoid overwhelming the AI)
    if (stderr && stderr.trim()) {
      errorSummary += '\nMaven STDERR (last 2000 chars):\n';
      errorSummary += stderr.slice(-2000) + '\n\n';
    }

    if (stdout && stdout.trim()) {
      errorSummary += '\nMaven STDOUT (last 2000 chars):\n';
      errorSummary += stdout.slice(-2000) + '\n\n';
    }

    return errorSummary;
  }

  /**
   * Build AI prompt for fixing compilation errors
   */
  private buildAIFixPrompt(
    projectContext: string,
    errorSummary: string,
  ): string {
    return `You are an expert Java and Minecraft plugin developer. A Maven project failed to compile and needs your help to fix the compilation errors.

PROJECT CONTEXT:
${projectContext}

${errorSummary}

Please analyze the compilation errors and provide fixes. Focus on:
1. Missing imports and dependencies
2. Incorrect class/method signatures
3. Plugin.yml configuration issues
4. Package structure problems
5. Maven POM.xml dependency issues

Respond with a JSON object containing the fixes in this exact format:
{
  "analysis": "Brief explanation of the main issues found",
  "createdFiles": [
    {
      "path": "relative/path/from/project/root/NewFile.java",
      "content": "complete file content here"
    }
  ],
  "modifiedFiles": [
    {
      "path": "relative/path/from/project/root/ExistingFile.java", 
      "content": "complete updated file content here"
    }
  ],
  "deletedFiles": ["relative/path/to/file/to/delete.java"]
}

IMPORTANT RULES:
- Provide complete file content for modifiedFiles, not just snippets
- Use forward slashes (/) in all file paths
- Paths should be relative to the project root
- Include proper package declarations and imports
- Ensure Minecraft plugin compatibility (Bukkit/Spigot API)
- Only suggest realistic and safe changes
- If you cannot fix an issue, explain why in the analysis

Respond ONLY with the JSON object, no additional text.`;
  }

  /**
   * Parse AI response to extract file operations
   */
  private parseAIFixResponse(aiResponse: string): any {
    try {
      // Try to find JSON in the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and normalize the response structure
      return {
        analysis: parsed.analysis || 'No analysis provided',
        createdFiles: parsed.createdFiles || [],
        modifiedFiles: parsed.modifiedFiles || [],
        deletedFiles: parsed.deletedFiles || [],
      };
    } catch (error) {
      this.logger.error(`Failed to parse AI fix response: ${error.message}`);
      throw new Error(`Invalid AI response format: ${error.message}`);
    }
  }

  /**
   * Apply AI-generated fixes to the project
   */
  private async applyAIFixes(
    projectPath: string,
    fixes: any,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Apply file deletions first
      if (fixes.deletedFiles && fixes.deletedFiles.length > 0) {
        for (const filePath of fixes.deletedFiles) {
          const fullPath = path.join(projectPath, filePath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            this.logger.log(`Deleted file: ${filePath}`);
          }
        }
      }

      // Apply file modifications
      if (fixes.modifiedFiles && fixes.modifiedFiles.length > 0) {
        for (const file of fixes.modifiedFiles) {
          const fullPath = path.join(projectPath, file.path);

          // Create directory if it doesn't exist
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          // Write the file content
          fs.writeFileSync(fullPath, file.content, 'utf8');
          this.logger.log(`Modified file: ${file.path}`);
        }
      }

      // Apply file creations
      if (fixes.createdFiles && fixes.createdFiles.length > 0) {
        for (const file of fixes.createdFiles) {
          const fullPath = path.join(projectPath, file.path);

          // Create directory if it doesn't exist
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          // Write the file content (don't overwrite existing files)
          if (!fs.existsSync(fullPath)) {
            fs.writeFileSync(fullPath, file.content, 'utf8');
            this.logger.log(`Created file: ${file.path}`);
          } else {
            this.logger.warn(
              `File already exists, skipping creation: ${file.path}`,
            );
          }
        }
      }

      return { success: true };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to apply AI fixes: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}
