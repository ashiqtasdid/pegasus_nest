/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as fs from 'fs/promises'; // Using fs.promises for async/await
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class FileCompilerService {
  private readonly logger = new Logger(FileCompilerService.name);

  /**
   * Compiles the text content of all files within a given folder (and its subfolders)
   * into a single output text file.
   *
   * @param inputFolderPath The absolute path to the folder to process.
   * @param outputFilePath The absolute path where the compiled text file will be saved.
   * @returns Promise<void>
   * @throws Error if the input folder does not exist or if there are issues writing the output file.
   */
  async compileDirectoryToTxt(
    inputFolderPath: string,
    outputFilePath: string,
  ): Promise<void> {
    this.logger.log(
      `Starting compilation of folder: ${inputFolderPath} to ${outputFilePath}`,
    );

    try {
      // Check if the input folder exists
      const stats = await fs.stat(inputFolderPath);
      if (!stats.isDirectory()) {
        throw new Error(`Input path is not a directory: ${inputFolderPath}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.error(`Input folder not found: ${inputFolderPath}`);
        throw new Error(`Input folder not found: ${inputFolderPath}`);
      }
      this.logger.error(
        `Error accessing input folder ${inputFolderPath}: ${error.message}`,
      );
      throw error; // Re-throw other stat errors
    }

    let outputContent = ''; // We'll build the content string here

    // Recursive function to walk through directories
    const walkDirectory = async (currentPath: string): Promise<void> => {
      outputContent += `Folder: ${currentPath}\n`;
      outputContent += '='.repeat(50) + '\n\n';

      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          await walkDirectory(fullPath); // Recurse into subdirectories
        } else if (entry.isFile()) {
          outputContent += `File: ${entry.name}\n`;
          outputContent += '-'.repeat(50) + '\n';
          try {
            const fileContent = await fs.readFile(fullPath, 'utf-8');
            outputContent += fileContent;
          } catch (readError) {
            const errorMessage = `[Error reading file ${fullPath}: ${readError.message}]\n`;
            this.logger.warn(errorMessage);
            outputContent += errorMessage;
          }
          outputContent += '\n' + '-'.repeat(50) + '\n\n';
        }
      }
    };

    try {
      await walkDirectory(inputFolderPath);
      await fs.writeFile(outputFilePath, outputContent, 'utf-8');
      this.logger.log(
        `Compilation complete! Output saved to: ${outputFilePath}`,
      );
    } catch (error) {
      this.logger.error(
        `Error during compilation or writing output file: ${error.message}`,
      );
      throw new Error(`Failed to compile directory to text: ${error.message}`);
    }
  }
}
