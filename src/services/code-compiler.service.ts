import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

interface CompilationResult {
  success: boolean;
  output: string;
  error?: string;
  artifactPath?: string;
}

@Injectable()
export class CodeCompilerService {
  private readonly logger = new Logger(CodeCompilerService.name);

  /**
   * Compile a Maven project
   * @param projectPath Path to the project directory
   * @returns CompilationResult with compilation status and output
   */
  async compileMavenProject(projectPath: string): Promise<CompilationResult> {
    this.logger.log(`Compiling Maven project at: ${projectPath}`);
    
    try {
      // Check if pom.xml exists
      const pomPath = path.join(projectPath, 'pom.xml');
      if (!fs.existsSync(pomPath)) {
        this.logger.warn('No pom.xml found in project directory');
        return {
          success: false,
          output: 'No pom.xml found. Maven compilation requires a pom.xml file.',
          error: 'Missing pom.xml'
        };
      }
      
      // Run Maven clean install
      this.logger.log('Running mvn clean install...');
      const { stdout, stderr } = await execPromise(
        'mvn clean install',
        { cwd: projectPath }
      );
      
      // Check for compilation errors (Maven return codes)
      if (stderr && stderr.includes('BUILD FAILURE')) {
        return {
          success: false,
          output: stdout,
          error: stderr
        };
      }
      
      // Find the generated JAR file in target directory
      const targetDir = path.join(projectPath, 'target');
      const jarFiles = fs.readdirSync(targetDir)
        .filter(file => file.endsWith('.jar') && !file.endsWith('-sources.jar') && !file.endsWith('-javadoc.jar'));
      
      if (jarFiles.length === 0) {
        return {
          success: false,
          output: 'Maven build completed but no JAR file was found',
          error: 'No artifacts generated'
        };
      }
      
      const artifactPath = path.join(targetDir, jarFiles[0]);
      
      return {
        success: true,
        output: `Maven build successful: ${stdout}`,
        artifactPath
      };
    } catch (error) {
      this.logger.error(`Maven compilation failed: ${error.message}`);
      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  /**
   * Generate a minimal pom.xml file if one doesn't exist
   * @param projectPath Project directory path
   * @param groupId Group ID for the project
   * @param artifactId Artifact ID for the project
   * @param version Version for the project
   */
  generateMinimalPom(projectPath: string, groupId: string, artifactId: string, version: string = '1.0-SNAPSHOT'): void {
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
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <dependencies>
        <!-- Add dependencies here -->
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.10.1</version>
                <configuration>
                    <source>11</source>
                    <target>11</target>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-jar-plugin</artifactId>
                <version>3.2.2</version>
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
}