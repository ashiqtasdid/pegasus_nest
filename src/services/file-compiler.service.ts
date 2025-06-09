/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as fs from 'fs/promises'; // Using fs.promises for async/await
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { RobustnessService } from '../common/robustness.service';
import { ValidationService } from '../common/validation.service';

interface FileCompilationOptions {
  maxFileSize?: number; // Max file size in bytes (default: 10MB)
  maxFiles?: number; // Max number of files to process (default: 1000)
  allowedExtensions?: string[]; // Allowed file extensions
  excludePatterns?: string[]; // Patterns to exclude
  timeout?: number; // Timeout in milliseconds
}

interface CompilationStats {
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  errors: number;
  totalSize: number;
}

@Injectable()
export class FileCompilerService {
  private readonly logger = new Logger(FileCompilerService.name);
  private readonly DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly DEFAULT_MAX_FILES = 1000;
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  // Health monitoring properties
  private serviceHealth = {
    isHealthy: true,
    lastHealthCheck: Date.now(),
    successfulCompilations: 0,
    failedCompilations: 0,
    totalCompilations: 0,
    totalFilesProcessed: 0,
    totalErrors: 0,
    averageProcessingTimeMs: 0,
    lastProcessingTimes: [] as number[],
  };

  constructor(
    private readonly robustnessService: RobustnessService,
    private readonly validationService: ValidationService,
  ) {}

  /**
   * Enhanced compiles the text content of all files within a given folder
   * with comprehensive robustness features
   */
  async compileDirectoryToTxt(
    inputFolderPath: string,
    outputFilePath: string,
    options: FileCompilationOptions = {},
  ): Promise<CompilationStats> {
    const circuitBreakerName = 'file_compilation';

    try {
      return await this.robustnessService.executeWithCircuitBreaker(
        circuitBreakerName,
        async () => {
          // Input validation
          const validation = await this.validateCompilationInput(
            inputFolderPath,
            outputFilePath,
            options,
          );

          if (!validation.isValid) {
            const errorMsg = `Invalid compilation input: ${validation.errors?.join(', ')}`;
            this.robustnessService.recordError(
              'file_validation',
              new Error(errorMsg),
            );
            throw new Error(errorMsg);
          }

          // Proceed with compilation using validated data
          return this.performCompilationWithRobustness(
            validation.sanitizedData.inputPath,
            validation.sanitizedData.outputPath,
            validation.sanitizedData.options,
          );
        },
        // Fallback when circuit breaker is open
        async () => {
          throw new Error(
            'File compilation service is currently unavailable due to high failure rate',
          );
        },
      );
    } catch (error) {
      this.logger.error(
        `Critical error in file compilation: ${error.message}`,
        error.stack,
      );
      this.robustnessService.recordError('file_compilation_critical', error);
      throw error;
    }
  }

  /**
   * Validate compilation input parameters
   */
  private async validateCompilationInput(
    inputFolderPath: string,
    outputFilePath: string,
    options: FileCompilationOptions,
  ): Promise<{
    isValid: boolean;
    errors?: string[];
    sanitizedData?: {
      inputPath: string;
      outputPath: string;
      options: FileCompilationOptions;
    };
  }> {
    try {
      const errors: string[] = [];

      // Validate input folder path
      if (!inputFolderPath || typeof inputFolderPath !== 'string') {
        errors.push('Input folder path is required and must be a string');
      } else if (!path.isAbsolute(inputFolderPath)) {
        errors.push('Input folder path must be absolute');
      }

      // Validate output file path
      if (!outputFilePath || typeof outputFilePath !== 'string') {
        errors.push('Output file path is required and must be a string');
      } else if (!path.isAbsolute(outputFilePath)) {
        errors.push('Output file path must be absolute');
      }

      // Sanitize paths
      const sanitizedInputPath = path.normalize(inputFolderPath);
      const sanitizedOutputPath = path.normalize(outputFilePath);

      // Validate options
      const sanitizedOptions: FileCompilationOptions = {
        maxFileSize: options.maxFileSize || this.DEFAULT_MAX_FILE_SIZE,
        maxFiles: options.maxFiles || this.DEFAULT_MAX_FILES,
        allowedExtensions: options.allowedExtensions || [
          '.txt',
          '.js',
          '.ts',
          '.java',
          '.json',
          '.xml',
          '.md',
        ],
        excludePatterns: options.excludePatterns || [
          'node_modules',
          '.git',
          'target',
          'build',
        ],
        timeout: options.timeout || this.DEFAULT_TIMEOUT,
      };

      // Validate numeric options
      if (
        sanitizedOptions.maxFileSize <= 0 ||
        sanitizedOptions.maxFileSize > 50 * 1024 * 1024
      ) {
        errors.push('Max file size must be between 1 byte and 50MB');
      }

      if (sanitizedOptions.maxFiles <= 0 || sanitizedOptions.maxFiles > 10000) {
        errors.push('Max files must be between 1 and 10000');
      }

      return {
        isValid: errors.length === 0,
        errors,
        sanitizedData: {
          inputPath: sanitizedInputPath,
          outputPath: sanitizedOutputPath,
          options: sanitizedOptions,
        },
      };
    } catch (error) {
      this.robustnessService.recordError('file_validation_error', error);
      return {
        isValid: false,
        errors: ['Validation service error'],
      };
    }
  }

  /**
   * Perform compilation with comprehensive robustness features
   */
  private async performCompilationWithRobustness(
    inputFolderPath: string,
    outputFilePath: string,
    options: FileCompilationOptions,
  ): Promise<CompilationStats> {
    this.logger.log(
      `Starting enhanced compilation of folder: ${inputFolderPath} to ${outputFilePath}`,
    );

    const stats: CompilationStats = {
      totalFiles: 0,
      processedFiles: 0,
      skippedFiles: 0,
      errors: 0,
      totalSize: 0,
    };

    try {
      // Check if the input folder exists with enhanced error handling
      await this.validateInputFolder(inputFolderPath);

      // Ensure output directory exists
      await this.ensureOutputDirectory(outputFilePath);

      let outputContent = this.generateHeader(inputFolderPath);

      // Recursive function to walk through directories with robustness
      const walkDirectory = async (
        currentPath: string,
        depth: number = 0,
      ): Promise<void> => {
        // Prevent infinite recursion
        if (depth > 20) {
          this.logger.warn(`Maximum directory depth reached: ${currentPath}`);
          return;
        }

        // Check if we've exceeded limits
        if (stats.totalFiles >= options.maxFiles) {
          this.logger.warn(`Maximum file limit reached: ${options.maxFiles}`);
          return;
        }

        outputContent += `Folder: ${currentPath}\n`;
        outputContent += '='.repeat(50) + '\n\n';

        try {
          const entries = await fs.readdir(currentPath, {
            withFileTypes: true,
          });

          for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);

            try {
              if (entry.isDirectory()) {
                // Check if directory should be excluded
                if (
                  this.shouldExcludeDirectory(
                    entry.name,
                    options.excludePatterns,
                  )
                ) {
                  stats.skippedFiles++;
                  continue;
                }

                await walkDirectory(fullPath, depth + 1);
              } else if (entry.isFile()) {
                stats.totalFiles++;

                // Check file size and extension
                if (await this.shouldProcessFile(fullPath, options)) {
                  const fileContent = await this.processFileWithSafety(
                    fullPath,
                    options,
                  );
                  if (fileContent !== null) {
                    outputContent += `File: ${entry.name}\n`;
                    outputContent += '-'.repeat(50) + '\n';
                    outputContent += fileContent;
                    outputContent += '\n' + '-'.repeat(50) + '\n\n';
                    stats.processedFiles++;
                  } else {
                    stats.skippedFiles++;
                  }
                } else {
                  stats.skippedFiles++;
                }
              }
            } catch (entryError) {
              this.logger.warn(
                `Error processing entry ${fullPath}: ${entryError.message}`,
              );
              stats.errors++;
              this.robustnessService.recordError(
                'file_entry_processing',
                entryError,
              );
            }
          }
        } catch (dirError) {
          this.logger.error(
            `Error reading directory ${currentPath}: ${dirError.message}`,
          );
          stats.errors++;
          this.robustnessService.recordError('directory_reading', dirError);
        }
      };

      // Execute with timeout protection
      await Promise.race([
        walkDirectory(inputFolderPath),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Compilation timeout')),
            options.timeout,
          ),
        ),
      ]);

      // Write output with atomic operation
      await this.writeOutputSafely(outputFilePath, outputContent);

      stats.totalSize = Buffer.byteLength(outputContent, 'utf-8');

      this.logger.log(`Compilation complete! Stats: ${JSON.stringify(stats)}`);
      this.robustnessService.recordSuccess('file_compilation');

      // Update health monitoring data
      this.updateHealthMetrics(stats);

      return stats;
    } catch (error) {
      this.logger.error(`Error during compilation: ${error.message}`);
      this.robustnessService.recordError('file_compilation', error);
      throw new Error(`Failed to compile directory to text: ${error.message}`);
    }
  }

  /**
   * Validate input folder existence and accessibility
   */
  private async validateInputFolder(inputFolderPath: string): Promise<void> {
    try {
      const stats = await fs.stat(inputFolderPath);
      if (!stats.isDirectory()) {
        throw new Error(`Input path is not a directory: ${inputFolderPath}`);
      }

      // Test read access
      await fs.access(inputFolderPath, fs.constants.R_OK);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Input folder not found: ${inputFolderPath}`);
      } else if (error.code === 'EACCES') {
        throw new Error(
          `No read permission for input folder: ${inputFolderPath}`,
        );
      }
      throw error;
    }
  }

  /**
   * Ensure output directory exists
   */
  private async ensureOutputDirectory(outputFilePath: string): Promise<void> {
    const outputDir = path.dirname(outputFilePath);
    try {
      await fs.mkdir(outputDir, { recursive: true });
      // Test write access
      await fs.access(outputDir, fs.constants.W_OK);
    } catch (error) {
      throw new Error(`Cannot create or access output directory: ${outputDir}`);
    }
  }

  /**
   * Generate file header with metadata
   */
  private generateHeader(inputPath: string): string {
    const timestamp = new Date().toISOString();
    return `File Compilation Report
Generated: ${timestamp}
Source: ${inputPath}
${'='.repeat(80)}

`;
  }

  /**
   * Check if directory should be excluded
   */
  private shouldExcludeDirectory(
    dirName: string,
    excludePatterns: string[],
  ): boolean {
    return excludePatterns.some(
      (pattern) =>
        dirName.includes(pattern) || dirName.match(new RegExp(pattern)),
    );
  }

  /**
   * Check if file should be processed based on criteria
   */
  private async shouldProcessFile(
    filePath: string,
    options: FileCompilationOptions,
  ): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);

      // Check file size
      if (stats.size > options.maxFileSize) {
        this.logger.warn(
          `File too large, skipping: ${filePath} (${stats.size} bytes)`,
        );
        return false;
      }

      // Check file extension
      const ext = path.extname(filePath).toLowerCase();
      if (!options.allowedExtensions.includes(ext)) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn(`Error checking file ${filePath}: ${error.message}`);
      return false;
    }
  }

  /**
   * Process file content with safety checks
   */
  private async processFileWithSafety(
    filePath: string,
    options: FileCompilationOptions,
  ): Promise<string | null> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');

      // Basic content validation
      if (this.isBinaryContent(fileContent)) {
        return `[Binary file - content not displayed]`;
      }

      // Truncate very large content for safety
      if (fileContent.length > options.maxFileSize) {
        return (
          fileContent.substring(0, options.maxFileSize) +
          '\n[Content truncated - file too large]'
        );
      }

      return fileContent;
    } catch (readError) {
      const errorMessage = `[Error reading file ${filePath}: ${readError.message}]`;
      this.logger.warn(errorMessage);
      this.robustnessService.recordError('file_read_error', readError);
      return errorMessage;
    }
  }

  /**
   * Check if content appears to be binary
   */
  private isBinaryContent(content: string): boolean {
    // Simple binary detection - check for null bytes or high ratio of non-printable chars
    if (content.includes('\0')) return true;

    const nonPrintable = content.split('').filter((char) => {
      const code = char.charCodeAt(0);
      return code < 32 && code !== 9 && code !== 10 && code !== 13; // exclude tab, newline, carriage return
    }).length;

    return nonPrintable / content.length > 0.3; // More than 30% non-printable
  }

  /**
   * Write output file with atomic operation
   */
  private async writeOutputSafely(
    outputFilePath: string,
    content: string,
  ): Promise<void> {
    const tempFilePath = `${outputFilePath}.tmp`;

    try {
      // Write to temporary file first
      await fs.writeFile(tempFilePath, content, 'utf-8');

      // Atomic move to final location
      await fs.rename(tempFilePath, outputFilePath);

      this.logger.log(`Output saved to: ${outputFilePath}`);
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Update health metrics based on compilation stats
   */
  private updateHealthMetrics(stats: CompilationStats): void {
    this.serviceHealth.totalCompilations++;
    this.serviceHealth.totalFilesProcessed += stats.processedFiles;
    this.serviceHealth.totalErrors += stats.errors;

    // Calculate success/failure rates
    if (stats.errors === 0) {
      this.serviceHealth.successfulCompilations++;
      this.serviceHealth.failedCompilations = 0;
      this.serviceHealth.isHealthy = true;
    } else {
      this.serviceHealth.failedCompilations++;
      this.serviceHealth.successfulCompilations = 0;
      this.serviceHealth.isHealthy = false;
    }

    // Update average processing time
    const processingTime = Date.now() - this.serviceHealth.lastHealthCheck;
    this.serviceHealth.averageProcessingTimeMs =
      (this.serviceHealth.averageProcessingTimeMs *
        (this.serviceHealth.totalCompilations - 1) +
        processingTime) /
      this.serviceHealth.totalCompilations;

    // Record last processing time
    this.serviceHealth.lastProcessingTimes.push(processingTime);
    if (this.serviceHealth.lastProcessingTimes.length > 10) {
      this.serviceHealth.lastProcessingTimes.shift(); // Keep last 10 processing times
    }

    this.serviceHealth.lastHealthCheck = Date.now();
  }

  /**
   * Get the health status of the FileCompilerService
   * @returns Health status object with metrics
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastChecked: Date;
    metrics: {
      totalCompilations: number;
      totalFilesProcessed: number;
      successRate: number;
      averageProcessingTimeMs: number;
      errorRate: number;
    };
  }> {
    // Update last health check time
    this.serviceHealth.lastHealthCheck = Date.now();

    // Calculate error rate
    const errorRate =
      this.serviceHealth.totalFilesProcessed > 0
        ? this.serviceHealth.totalErrors /
          this.serviceHealth.totalFilesProcessed
        : 0;

    // Calculate compilation success rate
    const successRate =
      this.serviceHealth.totalCompilations > 0
        ? this.serviceHealth.successfulCompilations /
          this.serviceHealth.totalCompilations
        : 1;

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (errorRate > 0.3 || successRate < 0.5) {
      status = 'unhealthy';
    } else if (errorRate > 0.1 || successRate < 0.8) {
      status = 'degraded';
    }

    // Calculate average processing time from recent compilations
    const avgTime =
      this.serviceHealth.lastProcessingTimes.length > 0
        ? this.serviceHealth.lastProcessingTimes.reduce(
            (sum, time) => sum + time,
            0,
          ) / this.serviceHealth.lastProcessingTimes.length
        : 0;

    // If average processing time is too high, degrade status
    if (avgTime > 60000) {
      // 60 seconds
      status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
    }

    return {
      status,
      lastChecked: new Date(this.serviceHealth.lastHealthCheck),
      metrics: {
        totalCompilations: this.serviceHealth.totalCompilations,
        totalFilesProcessed: this.serviceHealth.totalFilesProcessed,
        successRate: successRate * 100,
        averageProcessingTimeMs: avgTime,
        errorRate: errorRate * 100,
      },
    };
  }
}
