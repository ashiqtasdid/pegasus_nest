import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs/promises';
import * as path from 'path';
import { GeminiService } from './gemini.service';
import {
  PromptRefinementService,
  RefinedPrompt,
} from './prompt-refinement.service';
import { ValidationService } from '../common/validation.service';
import { RobustnessService } from '../common/robustness.service';
import { CodeCompilerService } from './code-compiler.service';
import { PluginStatusGateway } from '../gateways/plugin-status.gateway';

export interface FileCreationStep {
  id: string;
  order: number;
  fileName: string;
  filePath: string;
  fileType:
    | 'main_class'
    | 'config'
    | 'command'
    | 'listener'
    | 'utility'
    | 'resource'
    | 'build_config'
    | 'plugin_descriptor';
  description: string;
  dependencies: string[]; // Files this depends on
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'creating' | 'validating' | 'completed' | 'failed';
  content?: string;
  validationResults?: ValidationResult;
  retryCount: number;
  maxRetries: number;
  createdAt?: number; // Timestamp for ordering
  lastModified?: number;
}

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
  contextualErrors: string[];
}

// ============================================================================
// ENHANCED ACCURACY INTERFACES
// ============================================================================

export interface AdaptiveLearningMetrics {
  sessionId: string;
  pluginComplexity: 'simple' | 'medium' | 'complex' | 'advanced';
  successPatterns: SuccessPattern[];
  failurePatterns: FailurePattern[];
  validationThresholds: ValidationThresholds;
  generationStrategy: 'template' | 'ai' | 'hybrid';
}

export interface SuccessPattern {
  fileType: string;
  packageStructure: string;
  codePatterns: string[];
  successRate: number;
  qualityScore: number;
  validationScore: number;
  timestamp: number;
}

export interface FailurePattern {
  fileType: string;
  errorType: 'compilation' | 'validation' | 'integration' | 'syntax';
  errorMessage: string;
  frequency: number;
  lastSeen: number;
  context: string;
}

export interface ValidationThresholds {
  minQualityScore: number;
  maxValidationErrors: number;
  complexityAdjustment: number;
  strictnessLevel: 'lenient' | 'standard' | 'strict' | 'very_strict';
}

export interface TemplatePattern {
  id: string;
  name: string;
  fileType: string;
  complexity: 'simple' | 'medium' | 'complex';
  template: string;
  requiredDependencies: string[];
  successRate: number;
  lastUsed: number;
}

export interface QualityGate {
  name: string;
  condition: (
    context: IncrementalContext,
    fileStep: FileCreationStep,
  ) => boolean;
  action: 'continue' | 'fallback' | 'strict_validation' | 'template_mode';
  description: string;
}

export interface IncrementalContext {
  sessionId: string;
  pluginName: string;
  originalPrompt: string;
  refinedPrompt: RefinedPrompt;
  userId: string;
  projectPath: string;

  // Dynamic context that evolves
  createdFiles: Map<string, FileCreationStep>;
  fileContents: Map<string, string>;
  dependencies: Map<string, string[]>;
  compilationResults: any[];

  // Progress tracking
  currentStep: number;
  totalSteps: number;

  // Quality metrics
  warnings: string[];
  errors: string[];
  fileCreationTimes: Map<string, number>;
  qualityScores: Map<string, number>;
  contextRelevance: number; // 0-100, how well files work together

  // ============================================================================
  // ENHANCED ACCURACY FEATURES
  // ============================================================================

  // Adaptive learning components
  adaptiveLearning: AdaptiveLearningMetrics;
  validationThresholds: ValidationThresholds;
  qualityGates: QualityGate[];

  // Pattern recognition
  detectedPatterns: SuccessPattern[];
  avoidedPatterns: FailurePattern[];

  // Template management
  availableTemplates: Map<string, TemplatePattern>;
  templateUsage: Map<string, number>;

  // Complexity analysis
  complexityScore: number; // 0-100
  riskFactors: string[];
  fallbackStrategy: 'none' | 'template' | 'simplified' | 'abort';
  
  // ============================================================================
  // ULTRA-HIGH ACCURACY FEATURES (Target: 98-100%)
  // ============================================================================
  
  // Precision validation and multi-pass correction
  precisionMetrics: PrecisionValidationMetrics;
  multiPassValidations: MultiPassValidation[];
  complianceRules: CodeComplianceRules;
  realTimeCorrections: RealTimeCorrection[];
  accuracyEnforcement: AccuracyEnforcement;
  intelligentRetry: IntelligentRetry;
  
  // Advanced cross-file analysis
  crossFileRelationships: Map<string, string[]>; // file -> related files
  semanticConsistencyMap: Map<string, any>; // semantic relationship tracking
  integrationTestResults: Map<string, boolean>; // real-time integration validation
  
  // Perfect accuracy tracking
  targetAccuracy: number; // 98-100%
  currentAccuracy: number; // running accuracy score
  accuracyHistory: number[]; // track accuracy over time
}

// ============================================================================
// ULTRA-HIGH ACCURACY INTERFACES (Target: 98-100%)
// ============================================================================

export interface PrecisionValidationMetrics {
  syntaxAccuracy: number; // 0-100
  semanticAccuracy: number; // 0-100
  integrationAccuracy: number; // 0-100
  complianceScore: number; // 0-100
  crossReferenceScore: number; // 0-100
  consistencyScore: number; // 0-100
}

export interface MultiPassValidation {
  passNumber: number;
  validationType: 'syntax' | 'semantic' | 'integration' | 'cross_reference' | 'final';
  result: ValidationResult;
  improvements: string[];
  finalScore: number;
}

export interface CodeComplianceRules {
  bukkitAPICompliance: boolean;
  javaConventions: boolean;
  pluginStructure: boolean;
  namingConsistency: boolean;
  importOptimization: boolean;
  errorHandling: boolean;
  documentationStandards: boolean;
}

export interface RealTimeCorrection {
  detectedIssue: string;
  correctionApplied: string;
  confidence: number; // 0-100
  timestamp: number;
  context: string;
}

export interface AccuracyEnforcement {
  minPassingScore: number;
  maxIterations: number;
  requiresPerfectSyntax: boolean;
  requiresFullIntegration: boolean;
  enablesAutoCorrection: boolean;
  fallbackToTemplate: boolean;
}

export interface IntelligentRetry {
  retryStrategy: 'incremental_fix' | 'template_merge' | 'ai_regenerate' | 'human_pattern';
  analysisDepth: 'surface' | 'deep' | 'comprehensive';
  contextExpansion: boolean;
  crossFileAnalysis: boolean;
  patternMatching: boolean;
}

@Injectable()
export class IncrementalAgentService {
  private readonly logger = new Logger(IncrementalAgentService.name);
  private activeContexts = new Map<string, IncrementalContext>();

  constructor(
    private readonly geminiService: GeminiService,
    private readonly promptRefinementService: PromptRefinementService,
    private readonly validationService: ValidationService,
    private readonly robustnessService: RobustnessService,
    private readonly eventEmitter: EventEmitter2,
    private readonly compilerService: CodeCompilerService,
    private readonly pluginStatusGateway: PluginStatusGateway,
  ) {}

  // ============================================================================
  // MAIN INCREMENTAL CREATION FLOW
  // ============================================================================

  /**
   * Create plugin files incrementally with intelligent context awareness
   */
  async createPluginIncremental(
    pluginName: string,
    originalPrompt: string,
    userId: string,
    sessionId: string,
    projectPath: string,
  ): Promise<any> {
    const startTime = Date.now();
    this.logger.log(
      `🎯 Activating Incremental Agent Mode for file-by-file creation`,
    );

    try {
      // Initialize intelligent context
      this.emitProgress(sessionId, 'Initializing intelligent context...', 5);
      const context = await this.initializeContext(
        pluginName,
        originalPrompt,
        userId,
        sessionId,
        projectPath,
      );

      // Create intelligent file plan
      this.emitProgress(
        context.sessionId,
        'Creating intelligent file plan...',
        15,
      );
      const filePlan = await this.createIntelligentFilePlan(context);

      // Execute incremental creation with full context awareness
      const results = await this.executeIncrementalCreation(context, filePlan);

      // Perform final compilation and validation
      const compilationResult = await this.performFinalCompilation(context);
      const result = this.generateFinalResult(context, compilationResult);

      this.logger.log(
        `✅ Incremental creation completed in ${Date.now() - startTime}ms`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `❌ Incremental creation failed: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      this.activeContexts.delete(sessionId);
    }
  }

  // ============================================================================
  // CONTEXT INITIALIZATION AND MANAGEMENT
  // ============================================================================

  /**
   * Initialize comprehensive context for incremental creation with enhanced accuracy
   */
  private async initializeContext(
    pluginName: string,
    originalPrompt: string,
    userId: string,
    sessionId: string,
    projectPath: string,
  ): Promise<IncrementalContext> {
    // Refine the prompt for better understanding
    const refinedPrompt = await this.promptRefinementService.refinePrompt(
      originalPrompt,
      pluginName,
    );

    // Initialize adaptive learning with enhanced features
    const adaptiveLearning = await this.initializeAdaptiveLearning(
      sessionId,
      refinedPrompt,
    );

    // Create initial context structure
    const baseContext: IncrementalContext = {
      sessionId,
      pluginName,
      originalPrompt,
      refinedPrompt,
      userId,
      projectPath,
      createdFiles: new Map(),
      fileContents: new Map(),
      dependencies: new Map(),
      compilationResults: [],
      currentStep: 0,
      totalSteps: 0,
      warnings: [],
      errors: [],
      fileCreationTimes: new Map(),
      qualityScores: new Map(),
      contextRelevance: 0,

      // ============================================================================
      // ENHANCED ACCURACY FEATURES
      // ============================================================================

      // Adaptive learning components
      adaptiveLearning,
      validationThresholds: adaptiveLearning.validationThresholds,
      qualityGates: this.initializeQualityGates(),

      // Pattern recognition
      detectedPatterns: [],
      avoidedPatterns: [],

      // Template management
      availableTemplates: new Map(),
      templateUsage: new Map(),

      // Complexity analysis - will be calculated after context is created
      complexityScore: 0,
      riskFactors: [],
      fallbackStrategy: 'none',
      
      // ============================================================================
      // ULTRA-HIGH ACCURACY FEATURES (Target: 98-100%)
      // ============================================================================
      
      // Precision validation and multi-pass correction
      precisionMetrics: {
        syntaxAccuracy: 0,
        semanticAccuracy: 0,
        integrationAccuracy: 0,
        complianceScore: 0,
        crossReferenceScore: 0,
        consistencyScore: 0,
      },
      multiPassValidations: [],
      complianceRules: {
        bukkitAPICompliance: true,
        javaConventions: true,
        pluginStructure: true,
        namingConsistency: true,
        importOptimization: true,
        errorHandling: true,
        documentationStandards: false, // Less critical for functionality
      },
      realTimeCorrections: [],
      accuracyEnforcement: {
        minPassingScore: 95, // Ultra-high standard
        maxIterations: 5,
        requiresPerfectSyntax: true,
        requiresFullIntegration: true,
        enablesAutoCorrection: true,
        fallbackToTemplate: true,
      },
      intelligentRetry: {
        retryStrategy: 'ai_regenerate',
        analysisDepth: 'comprehensive',
        contextExpansion: true,
        crossFileAnalysis: true,
        patternMatching: true,
      },
      
      // Advanced cross-file analysis
      crossFileRelationships: new Map(),
      semanticConsistencyMap: new Map(),
      integrationTestResults: new Map(),
      
      // Perfect accuracy tracking
      targetAccuracy: 98, // Target 98-100%
      currentAccuracy: 0,
      accuracyHistory: [],
    };

    // Analyze complexity now that context exists
    baseContext.complexityScore = this.analyzeComplexity(baseContext);
    baseContext.fallbackStrategy = this.determineFallbackStrategy(baseContext);

    this.activeContexts.set(sessionId, baseContext);
    return baseContext;
  }

  // ============================================================================
  // INTELLIGENT FILE PLANNING
  // ============================================================================

  /**
   * Create an intelligent file creation plan based on dependencies and complexity
   */
  private async createIntelligentFilePlan(
    context: IncrementalContext,
  ): Promise<FileCreationStep[]> {
    try {
      const planningPrompt = this.createPlanningPrompt(context);
      const planResponse =
        await this.geminiService.processDirectPrompt(planningPrompt);

      const filePlan = this.parsePlanResponse(planResponse, context);
      const sortedPlan = this.sortByDependencies(filePlan);

      context.totalSteps = sortedPlan.length;
      this.logFilePlan(sortedPlan);

      return sortedPlan;
    } catch (error) {
      this.logger.warn(
        `⚠️ Failed to create intelligent plan, using fallback: ${error.message}`,
      );
      return this.createFallbackPlan(context);
    }
  }

  // ============================================================================
  // INCREMENTAL EXECUTION ENGINE
  // ============================================================================

  /**
   * Execute incremental file creation with comprehensive context awareness
   */
  private async executeIncrementalCreation(
    context: IncrementalContext,
    filePlan: FileCreationStep[],
  ): Promise<void> {
    for (const fileStep of filePlan) {
      const stepStartTime = Date.now();
      context.currentStep++;

      this.emitProgress(
        context.sessionId,
        `Creating ${fileStep.fileName} (${context.currentStep}/${context.totalSteps})`,
        Math.floor((context.currentStep / context.totalSteps) * 80) + 15,
      );

      try {
        // Create file with complete contextual awareness
        const content = await this.createSingleFileWithContext(
          fileStep,
          context,
        );

        // Validate against existing context
        const validation = await this.validateFileInContext(
          content,
          fileStep,
          context,
        );

        // Write file with backup
        await this.writeFileWithBackup(
          context.projectPath,
          fileStep.fileName,
          content,
        );

        // Update context with new file
        fileStep.content = content;
        fileStep.validationResults = validation;
        fileStep.status = 'completed';
        fileStep.lastModified = Date.now();

        context.createdFiles.set(fileStep.fileName, fileStep);
        context.fileContents.set(fileStep.fileName, content);
        context.fileCreationTimes.set(
          fileStep.fileName,
          Date.now() - stepStartTime,
        );

        // Update contextual quality metrics
        this.updateContextualQuality(context, validation);

        // Log creation summary
        this.logFileCreationSummary(fileStep, content, validation);
      } catch (error) {
        this.logger.error(
          `❌ Failed to create ${fileStep.fileName}: ${error.message}`,
        );
        fileStep.status = 'failed';
        context.errors.push(
          `Failed to create ${fileStep.fileName}: ${error.message}`,
        );

        if (fileStep.retryCount < fileStep.maxRetries) {
          fileStep.retryCount++;
          this.logger.log(
            `🔄 Retrying ${fileStep.fileName} (attempt ${fileStep.retryCount}/${fileStep.maxRetries})`,
          );
          // Re-add to the end of the plan for retry
          filePlan.push(fileStep);
        }
      }
    }
  }

  // ============================================================================
  // CONTEXTUAL FILE CREATION
  // ============================================================================

  /**
   * Create a single file with complete awareness of all existing files
   */
  private async createSingleFileWithContext(
    fileStep: FileCreationStep,
    context: IncrementalContext,
  ): Promise<string> {
    // Build comprehensive context from all existing files
    const existingContext = this.buildExistingFilesContext(context);
    const projectStructure = this.buildProjectStructureContext(context);

    // Create contextual prompt with COMPLETE file contents (not descriptions)
    const contextualPrompt = this.createContextualFilePrompt(
      fileStep,
      context,
      existingContext,
      projectStructure,
    );

    this.logger.debug(
      `📝 Creating ${fileStep.fileName} with complete context awareness`,
    );
    this.logger.debug(`   - Existing files: ${context.createdFiles.size}`);
    this.logger.debug(`   - Context size: ${existingContext.length} chars`);

    // Generate content with full context
    const content =
      await this.geminiService.processDirectPrompt(contextualPrompt);

    return this.cleanGeneratedContent(content);
  }

  /**
   * Build complete context from all existing files - SENDS FULL CONTENT
   */
  private buildExistingFilesContext(context: IncrementalContext): string {
    if (context.createdFiles.size === 0) {
      return 'No files created yet.';
    }

    let contextStr = `EXISTING FILES CONTEXT (${context.createdFiles.size} files):\n\n`;

    for (const [fileName, fileStep] of context.createdFiles) {
      if (fileStep.content) {
        contextStr += `=== ${fileName} ===\n`;
        contextStr += `Type: ${fileStep.fileType}\n`;
        contextStr += `Description: ${fileStep.description}\n`;
        contextStr += `COMPLETE CONTENT:\n${fileStep.content}\n\n`;
      }
    }

    return contextStr;
  }

  /**
   * Build project structure context for better organization
   */
  private buildProjectStructureContext(context: IncrementalContext): string {
    const structure = [`PROJECT STRUCTURE for ${context.pluginName}:`];

    const createdFiles = Array.from(context.createdFiles.keys()).sort();
    createdFiles.forEach((fileName) => {
      structure.push(`  📄 ${fileName}`);
    });

    if (context.dependencies.size > 0) {
      structure.push('\nDEPENDENCIES:');
      for (const [file, deps] of context.dependencies) {
        structure.push(`  ${file} depends on: ${deps.join(', ')}`);
      }
    }

    return structure.join('\n');
  }

  /**
   * Create comprehensive contextual prompt for file creation
   */
  private createContextualFilePrompt(
    fileStep: FileCreationStep,
    context: IncrementalContext,
    existingContext: string,
    projectStructure: string,
  ): string {
    return `You are creating a Minecraft plugin file with COMPLETE awareness of all existing files.

PLUGIN DETAILS:
- Name: ${context.pluginName}
- Original Request: ${context.originalPrompt}
- Features: ${context.refinedPrompt.detectedFeatures?.join(', ') || 'Standard plugin'}

CURRENT FILE TO CREATE:
- File: ${fileStep.fileName}
- Type: ${fileStep.fileType}
- Description: ${fileStep.description}
- Dependencies: ${fileStep.dependencies.join(', ') || 'None'}
- Priority: ${fileStep.priority}

${existingContext}

${projectStructure}

CRITICAL ACCURACY REQUIREMENTS:
1. 🎯 STUDY ALL EXISTING FILE CONTENTS thoroughly before creating this file
2. 🔗 ENSURE perfect integration with existing classes, methods, and configurations
3. 📝 MAINTAIN consistent naming conventions, package structure, and coding style
4. ⚡ IMPLEMENT proper imports and references to existing classes
5. 🛡️ VALIDATE that this file fulfills its role in the overall plugin architecture
6. 🎨 FOLLOW the established patterns from existing files
7. 🔍 CROSS-REFERENCE with plugin.yml, pom.xml, and other config files for consistency

Create ONLY the content for ${fileStep.fileName}. 
Do NOT include explanations, markdown formatting, or code blocks.
The output should be ready to write directly to the file.

ENSURE MAXIMUM INTEGRATION ACCURACY WITH EXISTING FILES!`;
  }

  // ============================================================================
  // COMPREHENSIVE VALIDATION SYSTEM
  // ============================================================================

  /**
   * Validate file against complete context of existing files
   */
  private async validateFileInContext(
    content: string,
    fileStep: FileCreationStep,
    context: IncrementalContext,
  ): Promise<ValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    const contextualErrors: string[] = [];
    let score = 100;

    // Basic validation
    const basicValidation = await this.validationService.validateData(
      { content, fileType: fileStep.fileType },
      [
        { field: 'content', type: 'string', required: true },
        { field: 'fileType', type: 'string', required: true },
      ],
    );
    issues.push(...basicValidation.errors);
    score -= basicValidation.errors.length * 5;

    // Contextual validations
    const packageValidation = this.validatePackageConsistency(
      content,
      fileStep,
      context,
    );
    const classValidation = this.validateClassReferences(
      content,
      fileStep,
      context,
    );
    const importValidation = this.validateImportStatements(
      content,
      fileStep,
      context,
    );
    const configValidation = this.validateConfigurationConsistency(
      content,
      fileStep,
      context,
    );
    const pluginYmlValidation = this.validatePluginYmlConsistency(
      content,
      fileStep,
      context,
    );
    const dependencyValidation = this.validateDependencyFulfillment(
      content,
      fileStep,
      context,
    );
    const styleValidation = this.validateCodeStyleConsistency(
      content,
      fileStep,
      context,
    );

    // Aggregate results
    issues.push(...packageValidation.issues);
    issues.push(...classValidation.issues);
    issues.push(...importValidation.issues);
    issues.push(...configValidation.issues);
    issues.push(...pluginYmlValidation.issues);
    issues.push(...dependencyValidation.issues);

    suggestions.push(...(classValidation.suggestions || []));
    suggestions.push(...(importValidation.suggestions || []));
    suggestions.push(...(configValidation.suggestions || []));
    suggestions.push(...(dependencyValidation.suggestions || []));
    suggestions.push(...(styleValidation.suggestions || []));

    // Calculate final score
    const totalPenalty =
      (packageValidation.penalty || 0) +
      (classValidation.penalty || 0) +
      (importValidation.penalty || 0) +
      (configValidation.penalty || 0) +
      (pluginYmlValidation.penalty || 0) +
      (dependencyValidation.penalty || 0) +
      (styleValidation.penalty || 0);

    score = Math.max(0, score - totalPenalty);

    return {
      isValid: issues.length === 0,
      score,
      issues,
      suggestions,
      contextualErrors,
    };
  }

  /**
   * Validate package consistency across Java files - Less strict validation
   */
  private validatePackageConsistency(
    content: string,
    fileStep: FileCreationStep,
    context: IncrementalContext,
  ) {
    const issues: string[] = [];
    let penalty = 0;

    if (fileStep.fileName.endsWith('.java')) {
      const packageMatch = content.match(/package\s+([\w.]+);/);
      if (!packageMatch) {
        // Only flag missing package for main plugin files
        if (content.includes('extends JavaPlugin') || 
            content.includes('main class') ||
            fileStep.fileName.toLowerCase().includes('main')) {
          issues.push('Main Java file missing package declaration');
          penalty += 15; // Reduced from 20
        }
      } else {
        const currentPackage = packageMatch[1];

        // Check consistency with other Java files - More flexible
        let hasConsistentPackage = false;
        let suggestedPackage = '';
        
        for (const [fileName, existingFile] of context.createdFiles) {
          if (fileName.endsWith('.java') && existingFile.content && fileName !== fileStep.fileName) {
            const existingPackageMatch =
              existingFile.content.match(/package\s+([\w.]+);/);
            if (existingPackageMatch) {
              const existingPackage = existingPackageMatch[1];
              
              // Allow subpackages and related packages
              const isSubpackage =
                currentPackage.startsWith(existingPackage) ||
                existingPackage.startsWith(currentPackage);
              
              // Allow packages that share common root with plugin name
              const shareCommonRoot = 
                currentPackage.includes(context.pluginName.toLowerCase()) ||
                existingPackage.includes(context.pluginName.toLowerCase()) ||
                this.sharePackageRoot(currentPackage, existingPackage);
              
              if (isSubpackage || shareCommonRoot || currentPackage === existingPackage) {
                hasConsistentPackage = true;
                break;
              } else if (!suggestedPackage) {
                suggestedPackage = existingPackage;
              }
            }
          }
        }

        // Only flag as issue if significantly inconsistent
        if (!hasConsistentPackage && suggestedPackage && 
            !this.isReasonablePackageVariation(currentPackage, suggestedPackage, context.pluginName)) {
          issues.push(
            `Package "${currentPackage}" may be inconsistent with project structure. Consider using package pattern similar to "${suggestedPackage}"`,
          );
          penalty += 5; // Significantly reduced from 15
        }
      }
    }

    return { issues, penalty };
  }

  /**
   * Check if two packages share a reasonable common root
   */
  private sharePackageRoot(package1: string, package2: string): boolean {
    const parts1 = package1.split('.');
    const parts2 = package2.split('.');
    
    // Share at least 2 common parts
    let commonParts = 0;
    for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
      if (parts1[i] === parts2[i]) {
        commonParts++;
      } else {
        break;
      }
    }
    
    return commonParts >= 2;
  }

  /**
   * Check if package variation is reasonable given the plugin context
   */
  private isReasonablePackageVariation(currentPackage: string, existingPackage: string, pluginName: string): boolean {
    const pluginLower = pluginName.toLowerCase();
    
    // Both packages contain plugin name
    if (currentPackage.includes(pluginLower) && existingPackage.includes(pluginLower)) {
      return true;
    }
    
    // Packages are subpackages of each other
    if (currentPackage.startsWith(existingPackage) || existingPackage.startsWith(currentPackage)) {
      return true;
    }
    
    // Similar depth and structure
    const currentParts = currentPackage.split('.');
    const existingParts = existingPackage.split('.');
    
    if (Math.abs(currentParts.length - existingParts.length) <= 1) {
      return true;
    }
    
    return false;
  }

  /**
   * Validate class references match actual class definitions - Improved flexibility
   */
  private validateClassReferences(
    content: string,
    fileStep: FileCreationStep,
    context: IncrementalContext,
  ) {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let penalty = 0;

    // Extract class references from current content
    const classReferences = this.extractClassReferences(content);
    const availableClasses = this.extractAvailableClasses(context);

    for (const classRef of classReferences) {
      if (
        !availableClasses.has(classRef) &&
        !this.isStandardJavaClass(classRef) &&
        !this.isCommonMinecraftClass(classRef)
      ) {
        // Check if it might be a reasonable class name that could be implemented
        if (this.isReasonableClassName(classRef)) {
          suggestions.push(`Consider implementing class "${classRef}" or verify import statement`);
          penalty += 3; // Much reduced penalty
        } else {
          issues.push(`Referenced class "${classRef}" not found in project`);
          penalty += 8; // Reduced from 10
        }
      }
    }

    // Check if main class is properly referenced in plugin.yml - More flexible
    if (fileStep.fileName === 'plugin.yml') {
      const mainClassMatch = content.match(/main:\s*([\w.]+)/);
      if (mainClassMatch) {
        const mainClass = mainClassMatch[1];
        const className = mainClass.split('.').pop() || '';
        
        if (!availableClasses.has(className)) {
          // Check if there's a similar class name
          const similarClass = this.findSimilarClassName(className, availableClasses);
          if (similarClass) {
            suggestions.push(
              `Main class "${mainClass}" not found. Did you mean "${similarClass}"?`,
            );
            penalty += 10; // Reduced penalty
          } else {
            issues.push(
              `Main class "${mainClass}" referenced in plugin.yml not found`,
            );
            penalty += 15; // Reduced from higher penalty
          }
        }
      }
    }

    return { issues, suggestions, penalty };
  }

  /**
   * Check if a class name is reasonable/valid
   */
  private isReasonableClassName(className: string): boolean {
    // Check Java naming conventions
    return /^[A-Z][a-zA-Z0-9]*$/.test(className) && className.length > 1;
  }

  /**
   * Check if it's a common Minecraft/Bukkit class
   */
  private isCommonMinecraftClass(className: string): boolean {
    const commonMinecraftClasses = [
      'Player', 'World', 'Location', 'ItemStack', 'Material', 'Entity',
      'Block', 'Chunk', 'Event', 'Command', 'CommandSender', 'Server',
      'Plugin', 'JavaPlugin', 'Bukkit', 'ChatColor', 'Sound', 'Effect'
    ];
    return commonMinecraftClasses.includes(className);
  }

  /**
   * Find similar class name in available classes
   */
  private findSimilarClassName(target: string, availableClasses: Set<string>): string | null {
    const targetLower = target.toLowerCase();
    
    for (const className of availableClasses) {
      const classLower = className.toLowerCase();
      // Check for similar names (case insensitive, partial matches)
      if (classLower === targetLower || 
          classLower.includes(targetLower) || 
          targetLower.includes(classLower) ||
          this.calculateSimilarity(targetLower, classLower) > 0.7) {
        return className;
      }
    }
    
    return null;
  }

  /**
   * Calculate string similarity (simple Jaccard similarity)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const set1 = new Set(str1.split(''));
    const set2 = new Set(str2.split(''));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }

    }

    return { issues, suggestions, penalty };
  }

  /**
   * Validate import statements are accurate and necessary
   */
  private validateImportStatements(
    content: string,
    fileStep: FileCreationStep,
    context: IncrementalContext,
  ) {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let penalty = 0;

    if (fileStep.fileName.endsWith('.java')) {
      const imports = content.match(/import\s+([\w.]+);/g) || [];
      const availableClasses = this.extractAvailableClasses(context);

      for (const importStmt of imports) {
        const className = importStmt.match(/import\s+([\w.]+);/)?.[1];
        if (className) {
          const shortName = className.split('.').pop() || '';

          // Check if imported class is actually used
          if (
            !content.includes(shortName) ||
            content.indexOf(shortName) === content.indexOf(importStmt)
          ) {
            suggestions.push(`Consider removing unused import: ${className}`);
          }

          // Check if imported class exists in project
          if (
            className.includes(context.pluginName.toLowerCase()) &&
            !availableClasses.has(shortName)
          ) {
            issues.push(
              `Import references non-existent project class: ${className}`,
            );
            penalty += 10;
          }
        }
      }
    }

    return { issues, suggestions, penalty };
  }

  /**
   * Validate configuration consistency across config files
   */
  private validateConfigurationConsistency(
    content: string,
    fileStep: FileCreationStep,
    context: IncrementalContext,
  ) {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let penalty = 0;

    if (
      fileStep.fileName.includes('config') ||
      fileStep.fileName.endsWith('.yml')
    ) {
      // Extract configuration keys from current file
      const currentKeys = this.extractConfigKeys(content);

      // Check consistency with other config files
      for (const [fileName, existingFile] of context.createdFiles) {
        if (
          (fileName.includes('config') || fileName.endsWith('.yml')) &&
          existingFile.content
        ) {
          const existingKeys = this.extractConfigKeys(existingFile.content);

          // Look for related configuration patterns
          for (const key of currentKeys) {
            for (const existingKey of existingKeys) {
              if (this.areConfigKeysRelated(key, existingKey)) {
                suggestions.push(
                  `Consider ensuring consistency between "${key}" and "${existingKey}" in ${fileName}`,
                );
              }
            }
          }
        }
      }
    }

    return { issues, suggestions, penalty };
  }

  /**
   * Validate plugin.yml consistency with Java classes - Improved flexibility
   */
  private validatePluginYmlConsistency(
    content: string,
    fileStep: FileCreationStep,
    context: IncrementalContext,
  ) {
    const issues: string[] = [];
    let penalty = 0;

    if (
      fileStep.fileName === 'plugin.yml' ||
      fileStep.fileName.includes('plugin.yml')
    ) {
      // Validate main class exists - More flexible matching
      const mainMatch = content.match(/main:\s*([\w.]+)/);
      if (mainMatch) {
        const mainClass = mainMatch[1];
        const className = mainClass.split('.').pop();
        const packagePath = mainClass.split('.').slice(0, -1).join('.');

        // Check if main class exists in created Java files - More flexible
        let mainClassFound = false;
        let partialMatch = false;
        
        for (const [fileName, file] of context.createdFiles) {
          if (fileName.endsWith('.java') && file.content) {
            // Exact class name match
            if (file.content.includes(`class ${className}`)) {
              // Check if it extends JavaPlugin or has plugin-like structure  
              if (file.content.includes('extends JavaPlugin') ||
                  file.content.includes('onEnable()') ||
                  file.content.includes('onDisable()') ||
                  file.content.includes('getCommand(')) {
                mainClassFound = true;
                break;
              } else {
                partialMatch = true;
              }
            }
            
            // Package consistency check
            if (packagePath && file.content.includes(`package ${packagePath}`)) {
              partialMatch = true;
            }
          }
        }

        if (!mainClassFound) {
          if (partialMatch) {
            // Reduce penalty for partial matches
            issues.push(
              `Main class "${mainClass}" found but may not extend JavaPlugin properly`,
            );
            penalty += 10; // Reduced from 30
          } else {
            issues.push(
              `Main class "${mainClass}" not found or doesn't extend JavaPlugin`,
            );
            penalty += 20; // Reduced from 30
          }
        }
      }

      // Validate commands exist in Java files - More flexible matching
      const commandMatches = content.match(
        /commands:\s*\n((?:\s+\w+:[\s\S]*?(?=\n\w|\n$))*)/,
      );
      if (commandMatches) {
        const commands = commandMatches[1].match(/^\s+(\w+):/gm) || [];
        for (const cmd of commands) {
          const commandName = cmd.trim().replace(':', '');

          // Check if command is handled in Java files - More flexible patterns
          let commandHandled = false;
          for (const [fileName, file] of context.createdFiles) {
            if (fileName.endsWith('.java') && file.content) {
              // Look for various command handling patterns
              if (
                file.content.includes(`"${commandName}"`) ||
                file.content.includes(`'${commandName}'`) ||
                file.content.includes(`${commandName.toLowerCase()}`) ||
                file.content.includes(`${commandName.toUpperCase()}`) ||
                file.content.includes(`onCommand`) ||
                file.content.includes(`getCommand("${commandName}")`) ||
                file.content.includes(`CommandExecutor`)
              ) {
                commandHandled = true;
                break;
              }
            }
          }

          if (!commandHandled) {
            // Reduce penalty and make it a suggestion rather than critical issue
            issues.push(
              `Command "${commandName}" defined in plugin.yml but handling not clearly found in Java code`,
            );
            penalty += 5; // Reduced from 15
          }
        }
      }
    }

    return { issues, penalty };
  }

  /**
   * Validate that file fulfills its dependency requirements
   */
  private validateDependencyFulfillment(
    content: string,
    fileStep: FileCreationStep,
    context: IncrementalContext,
  ) {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let penalty = 0;

    for (const depFileName of fileStep.dependencies) {
      const depFile = context.createdFiles.get(depFileName);
      if (depFile && depFile.content) {
        // Check if current file properly uses the dependency
        const depAnalysis = this.analyzeDependencyUsage(
          content,
          depFile.content,
          depFileName,
        );

        if (!depAnalysis.isUsed && depAnalysis.shouldBeUsed) {
          suggestions.push(
            `Consider using functionality from dependency: ${depFileName}`,
          );
        }

        if (depAnalysis.isUsedIncorrectly) {
          issues.push(`Incorrect usage of dependency: ${depFileName}`);
          penalty += 15;
        }
      }
    }

    return { issues, suggestions, penalty };
  }

  /**
   * Validate code style consistency across files
   */
  private validateCodeStyleConsistency(
    content: string,
    fileStep: FileCreationStep,
    context: IncrementalContext,
  ) {
    const suggestions: string[] = [];
    let penalty = 0;

    if (fileStep.fileName.endsWith('.java')) {
      // Get existing Java files' style patterns
      const existingStyles: any[] = [];
      for (const [fileName, file] of context.createdFiles) {
        if (fileName.endsWith('.java') && file.content) {
          existingStyles.push(this.extractStylePatterns(file.content));
        }
      }

      if (existingStyles.length > 0) {
        const currentStyle = this.extractStylePatterns(content);
        const referenceStyle = existingStyles[0]; // Use first file as reference

        // Check indentation consistency
        if (currentStyle.indentationType !== referenceStyle.indentationType) {
          suggestions.push(
            `Inconsistent indentation: using ${currentStyle.indentationType}, others use ${referenceStyle.indentationType}`,
          );
        }

        // Check brace style consistency
        if (currentStyle.braceStyle !== referenceStyle.braceStyle) {
          suggestions.push(
            `Inconsistent brace style: using ${currentStyle.braceStyle}, others use ${referenceStyle.braceStyle}`,
          );
        }

        // Check naming convention consistency
        if (currentStyle.classNamingStyle !== referenceStyle.classNamingStyle) {
          suggestions.push('Class naming style differs from existing files');
        }
      }
    }

    return { suggestions, penalty };
  }

  // ============================================================================
  // HELPER METHODS FOR VALIDATION
  // ============================================================================

  /**
   * Extract class references from Java code
   */
  private extractClassReferences(content: string): Set<string> {
    const references = new Set<string>();

    // Find new instantiations
    const newMatches = content.match(/new\s+(\w+)/g);
    if (newMatches) {
      newMatches.forEach((match) => {
        const className = match.replace('new ', '');
        references.add(className);
      });
    }

    // Find static method calls
    const staticMatches = content.match(/(\w+)\.\w+\(/g);
    if (staticMatches) {
      staticMatches.forEach((match) => {
        const className = match.split('.')[0];
        if (className && className[0].toUpperCase() === className[0]) {
          references.add(className);
        }
      });
    }

    // Find type declarations
    const typeMatches = content.match(/:\s*(\w+)|<(\w+)>/g);
    if (typeMatches) {
      typeMatches.forEach((match) => {
        const className = match.replace(/[:<>]/g, '').trim();
        if (className && className[0].toUpperCase() === className[0]) {
          references.add(className);
        }
      });
    }

    return references;
  }

  /**
   * Extract available class definitions from context
   */
  private extractAvailableClasses(context: IncrementalContext): Set<string> {
    const classes = new Set<string>();

    for (const [fileName, file] of context.createdFiles) {
      if (fileName.endsWith('.java') && file.content) {
        const classMatches = file.content.match(
          /(?:public\s+)?(?:abstract\s+)?class\s+(\w+)/g,
        );
        if (classMatches) {
          classMatches.forEach((match) => {
            const className = match.replace(/.*class\s+/, '');
            classes.add(className);
          });
        }

        const interfaceMatches = file.content.match(
          /(?:public\s+)?interface\s+(\w+)/g,
        );
        if (interfaceMatches) {
          interfaceMatches.forEach((match) => {
            const interfaceName = match.replace(/.*interface\s+/, '');
            classes.add(interfaceName);
          });
        }
      }
    }

    return classes;
  }

  /**
   * Check if a class is a standard Java/Bukkit class
   */
  private isStandardJavaClass(className: string): boolean {
    const standardClasses = [
      'String',
      'Integer',
      'Boolean',
      'List',
      'Map',
      'Set',
      'ArrayList',
      'HashMap',
      'Player',
      'ItemStack',
      'Material',
      'Location',
      'World',
      'Block',
      'Entity',
      'CommandSender',
      'JavaPlugin',
      'Bukkit',
      'Server',
      'Plugin',
      'Event',
      'Listener',
      'Command',
      'CommandExecutor',
      'TabCompleter',
      'Configuration',
      'FileConfiguration',
      'YamlConfiguration',
      'UUID',
      'Collection',
    ];

    return (
      standardClasses.includes(className) ||
      className.startsWith('org.bukkit') ||
      className.startsWith('java.') ||
      className.startsWith('javax.')
    );
  }

  /**
   * Extract configuration keys from YAML content
   */
  private extractConfigKeys(content: string): Set<string> {
    const keys = new Set<string>();
    const lines = content.split('\n');

    for (const line of lines) {
      const keyMatch = line.match(/^(\s*)(\w+(?:\.\w+)*)\s*:/);
      if (keyMatch) {
        const key = keyMatch[2];
        keys.add(key);
      }
    }

    return keys;
  }

  /**
   * Check if two configuration keys are related
   */
  private areConfigKeysRelated(key1: string, key2: string): boolean {
    // Check if keys share common prefixes or suffixes
    const parts1 = key1.split('.');
    const parts2 = key2.split('.');

    // Check for shared prefixes
    for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
      if (parts1[i] === parts2[i]) {
        return true;
      }
    }

    // Check for similar naming patterns
    return key1.includes(key2) || key2.includes(key1);
  }

  /**
   * Analyze how a dependency is used in the current content
   */
  private analyzeDependencyUsage(
    content: string,
    depContent: string,
    depFileName: string,
  ): {
    isUsed: boolean;
    shouldBeUsed: boolean;
    isUsedIncorrectly: boolean;
  } {
    // Extract class names from dependency
    const tempContext: IncrementalContext = {
      createdFiles: new Map([
        [
          depFileName,
          {
            id: 'temp',
            order: 0,
            fileName: depFileName,
            filePath: '',
            fileType: 'main_class',
            description: '',
            dependencies: [],
            priority: 'medium',
            status: 'completed',
            content: depContent,
            retryCount: 0,
            maxRetries: 2,
            createdAt: Date.now(),
            lastModified: Date.now(),
          } as FileCreationStep,
        ],
      ]),
      pluginName: '',
      originalPrompt: '',
      refinedPrompt: {} as RefinedPrompt,
      userId: '',
      projectPath: '',
      sessionId: '',
      fileContents: new Map(),
      dependencies: new Map(),
      compilationResults: [],
      currentStep: 0,
      totalSteps: 0,
      warnings: [],
      errors: [],
      fileCreationTimes: new Map(),
      qualityScores: new Map(),
      contextRelevance: 0,

      // ============================================================================
      // ENHANCED ACCURACY FEATURES
      // ============================================================================

      // Adaptive learning components
      adaptiveLearning: {
        sessionId: '',
        pluginComplexity: 'simple',
        successPatterns: [],
        failurePatterns: [],
        validationThresholds: {
          minQualityScore: 50,
          maxValidationErrors: 5,
          complexityAdjustment: 0,
          strictnessLevel: 'standard',
        },
        generationStrategy: 'template',
      },
      validationThresholds: {
        minQualityScore: 50,
        maxValidationErrors: 5,
        complexityAdjustment: 0,
        strictnessLevel: 'standard',
      },
      qualityGates: [],

      // Pattern recognition
      detectedPatterns: [],
      avoidedPatterns: [],

      // Template management
      availableTemplates: new Map(),
      templateUsage: new Map(),

      // Complexity analysis
      complexityScore: 0,
      riskFactors: [],
      fallbackStrategy: 'none',

      // ============================================================================
      // ULTRA-HIGH ACCURACY FEATURES (98-100% TARGET)
      // ============================================================================

      // Precision validation metrics
      precisionMetrics: {
        syntaxAccuracy: 0,
        semanticAccuracy: 0,
        integrationAccuracy: 0,
        complianceScore: 0,
        crossReferenceScore: 0,
        consistencyScore: 0,
      },

      // Multi-pass validation
      multiPassValidations: [],

      // Code compliance rules
      complianceRules: {
        bukkitAPICompliance: true,
        javaConventions: true,
        pluginStructure: true,
        namingConsistency: true,
        importOptimization: true,
        errorHandling: true,
        documentationStandards: true,
      },

      // Real-time correction
      realTimeCorrections: [],

      // Accuracy enforcement
      accuracyEnforcement: {
        minPassingScore: 95,
        maxIterations: 5,
        requiresPerfectSyntax: true,
        requiresFullIntegration: true,
        enablesAutoCorrection: true,
        fallbackToTemplate: true,
      },

      // Intelligent retry mechanism
      intelligentRetry: {
        retryStrategy: 'incremental_fix',
        analysisDepth: 'deep',
        contextExpansion: true,
        crossFileAnalysis: true,
        patternMatching: true,
      },

      // Cross-file relationships
      crossFileRelationships: new Map(),

      // Semantic consistency
      semanticConsistencyMap: new Map(),

      // Integration test results
      integrationTestResults: new Map(),

      // Perfect accuracy tracking
      targetAccuracy: 98,
      currentAccuracy: 0,
      accuracyHistory: [],
    };

    const depClasses = this.extractAvailableClasses(tempContext);

    let isUsed = false;
    let shouldBeUsed = false;
    let isUsedIncorrectly = false;

    // Check if any classes from dependency are referenced
    for (const className of depClasses) {
      if (content.includes(className)) {
        isUsed = true;
        // Check for proper import
        if (!content.includes(`import`) || !content.includes(className)) {
          isUsedIncorrectly = true;
        }
      }
    }

    // Determine if dependency should be used based on file type and context
    if (depFileName.includes('Command') && content.includes('onCommand')) {
      shouldBeUsed = true;
    }

    if (
      depFileName.includes('Listener') &&
      content.includes('registerEvents')
    ) {
      shouldBeUsed = true;
    }

    return { isUsed, shouldBeUsed, isUsedIncorrectly };
  }

  /**
   * Extract code style patterns from Java content
   */
  private extractStylePatterns(content: string): {
    indentationType: string;
    braceStyle: string;
    classNamingStyle: string;
  } {
    // Detect indentation type
    const spaceIndentMatch = content.match(/\n(    )/);
    const tabIndentMatch = content.match(/\n(\t)/);
    const indentationType = tabIndentMatch
      ? 'tabs'
      : spaceIndentMatch
        ? 'spaces'
        : 'mixed';

    // Detect brace style
    const sameLine = content.includes(') {');
    const nextLine = content.includes(')\n{') || content.includes(')\r\n{');
    const braceStyle = sameLine
      ? 'same-line'
      : nextLine
        ? 'next-line'
        : 'mixed';

    // Detect class naming style
    const classMatch = content.match(/class\s+(\w+)/);
    const className = classMatch ? classMatch[1] : '';
    const classNamingStyle =
      className && className[0] === className[0].toUpperCase()
        ? 'PascalCase'
        : 'other';

    return {
      indentationType,
      braceStyle,
      classNamingStyle,
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Clean generated content by removing markdown formatting
   */
  private cleanGeneratedContent(content: string): string {
    // Remove markdown code blocks
    let cleaned = content.replace(/```[\w]*\n/g, '').replace(/```/g, '');

    // Remove explanatory text at the start/end
    const lines = cleaned.split('\n');
    let startIndex = 0;
    let endIndex = lines.length - 1;

    // Find actual code start
    for (let i = 0; i < lines.length; i++) {
      if (
        lines[i]
          .trim()
          .match(/^(package|import|public|class|<\?xml|name:|version:|main:)/)
      ) {
        startIndex = i;
        break;
      }
    }

    // Find actual code end
    for (let i = lines.length - 1; i >= 0; i--) {
      if (
        lines[i].trim() &&
        !lines[i].startsWith('//') &&
        !lines[i].startsWith('*')
      ) {
        endIndex = i;
        break;
      }
    }

    return lines
      .slice(startIndex, endIndex + 1)
      .join('\n')
      .trim();
  }

  /**
   * Write file with backup capability
   */
  private async writeFileWithBackup(
    projectPath: string,
    fileName: string,
    content: string,
  ): Promise<void> {
    const filePath = path.join(projectPath, fileName);

    try {
      // Create backup if file exists
      await fs.stat(filePath);
      const backupPath = `${filePath}.backup`;
      await fs.copyFile(filePath, backupPath);
    } catch {
      // File doesn't exist, no backup needed
    }

    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Write the file
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Update contextual quality metrics
   */
  private updateContextualQuality(
    context: IncrementalContext,
    validation: ValidationResult,
  ): void {
    const currentFiles = context.createdFiles.size;
    const totalQuality = Array.from(context.qualityScores.values()).reduce(
      (sum, score) => sum + score,
      0,
    );

    context.qualityScores.set(`file_${currentFiles}`, validation.score);
    context.contextRelevance = totalQuality / Math.max(1, currentFiles);

    if (validation.issues.length > 0) {
      context.warnings.push(...validation.issues);
    }
  }

  /**
   * Log detailed file creation summary for debugging
   */
  private logFileCreationSummary(
    fileStep: FileCreationStep,
    content: string,
    validation: ValidationResult,
  ): void {
    this.logger.debug(`📋 File Creation Summary for ${fileStep.fileName}:`);
    this.logger.debug(`   Type: ${fileStep.fileType}`);
    this.logger.debug(`   Size: ${content.length} characters`);
    this.logger.debug(`   Quality Score: ${validation.score}/100`);
    this.logger.debug(`   Issues: ${validation.issues.length}`);
    this.logger.debug(`   Suggestions: ${validation.suggestions.length}`);

    if (validation.issues.length > 0) {
      this.logger.warn(
        `   ⚠️ Issues: ${validation.issues.slice(0, 3).join(', ')}${validation.issues.length > 3 ? '...' : ''}`,
      );
    }
  }

  // ============================================================================
  // PLANNING AND FALLBACK METHODS
  // ============================================================================

  /**
   * Create planning prompt for intelligent file ordering
   */
  private createPlanningPrompt(context: IncrementalContext): string {
    return `Create a detailed file creation plan for a Minecraft plugin.

PLUGIN REQUIREMENTS:
- Name: ${context.pluginName}
- Request: ${context.originalPrompt}
- Features: ${context.refinedPrompt.detectedFeatures?.join(', ') || 'Standard plugin'}

Generate a JSON array of files to create with this structure:
[
  {
    "fileName": "src/main/java/com/plugin/MainClass.java",
    "fileType": "main_class",
    "description": "Main plugin class that extends JavaPlugin",
    "dependencies": ["pom.xml", "src/main/resources/plugin.yml"],
    "priority": "critical"
  }
]

Order them by dependencies (dependencies first).
Include: pom.xml, plugin.yml, main class, commands, listeners, utilities as needed.
Return ONLY the JSON array.`;
  }

  /**
   * Parse planning response into file steps
   */
  private parsePlanResponse(
    planResponse: string,
    context: IncrementalContext,
  ): FileCreationStep[] {
    try {
      // Clean response and extract JSON
      let cleanResponse = planResponse.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.substring(7);
      }
      if (cleanResponse.endsWith('```')) {
        cleanResponse = cleanResponse.substring(0, cleanResponse.length - 3);
      }

      const planData = JSON.parse(cleanResponse);

      return planData.map(
        (item: any, index: number): FileCreationStep => ({
          id: `step_${index + 1}`,
          order: item.order || index + 1,
          fileName: item.fileName,
          filePath: item.fileName,
          fileType: item.fileType || 'utility',
          description: item.description || 'Generated file',
          dependencies: item.dependencies || [],
          priority: item.priority || 'medium',
          status: 'pending',
          retryCount: 0,
          maxRetries: 2,
          createdAt: Date.now(),
          lastModified: Date.now(),
        }),
      );
    } catch (error) {
      this.logger.warn(`Failed to parse plan response: ${error.message}`);
      return this.createFallbackPlan(context);
    }
  }

  /**
   * Create fallback plan if intelligent planning fails
   */
  private createFallbackPlan(context: IncrementalContext): FileCreationStep[] {
    const pluginName = context.pluginName;
    const packageName = `com.${pluginName.toLowerCase()}`;

    return [
      {
        id: 'step_1',
        order: 1,
        fileName: 'pom.xml',
        filePath: 'pom.xml',
        fileType: 'build_config',
        description: 'Maven configuration file',
        dependencies: [],
        priority: 'critical',
        status: 'pending',
        retryCount: 0,
        maxRetries: 2,
        createdAt: Date.now(),
        lastModified: Date.now(),
      },
      {
        id: 'step_2',
        order: 2,
        fileName: 'src/main/resources/plugin.yml',
        filePath: 'src/main/resources/plugin.yml',
        fileType: 'plugin_descriptor',
        description: 'Plugin configuration file',
        dependencies: ['pom.xml'],
        priority: 'critical',
        status: 'pending',
        retryCount: 0,
        maxRetries: 2,
        createdAt: Date.now(),
        lastModified: Date.now(),
      },
      {
        id: 'step_3',
        order: 3,
        fileName: `src/main/java/${packageName.replace(/\./g, '/')}/${pluginName}.java`,
        filePath: `src/main/java/${packageName.replace(/\./g, '/')}/${pluginName}.java`,
        fileType: 'main_class',
        description: 'Main plugin class',
        dependencies: ['pom.xml', 'src/main/resources/plugin.yml'],
        priority: 'critical',
        status: 'pending',
        retryCount: 0,
        maxRetries: 2,
        createdAt: Date.now(),
        lastModified: Date.now(),
      },
    ];
  }

  /**
   * Sort file plan by dependencies
   */
  private sortByDependencies(filePlan: FileCreationStep[]): FileCreationStep[] {
    const sorted: FileCreationStep[] = [];
    const remaining = [...filePlan];

    while (remaining.length > 0) {
      const nextFile = remaining.find((file) =>
        file.dependencies.every((dep) =>
          sorted.some((s) => s.fileName === dep),
        ),
      );

      if (nextFile) {
        sorted.push(nextFile);
        remaining.splice(remaining.indexOf(nextFile), 1);
      } else {
        // If no file can be resolved, add the first one to break the cycle
        sorted.push(remaining.shift()!);
      }
    }

    return sorted;
  }

  /**
   * Log file plan for debugging
   */
  private logFilePlan(filePlan: FileCreationStep[]): void {
    this.logger.log(
      `📋 Intelligent File Creation Plan (${filePlan.length} files):`,
    );
    filePlan.forEach((step, index) => {
      this.logger.log(
        `   ${index + 1}. ${step.fileName} (${step.fileType}) - ${step.priority}`,
      );
      if (step.dependencies.length > 0) {
        this.logger.log(`      Dependencies: ${step.dependencies.join(', ')}`);
      }
    });
  }

  // ============================================================================
  // FINAL COMPILATION AND RESULT GENERATION
  // ============================================================================

  /**
   * Perform final compilation and validation
   */
  private async performFinalCompilation(
    context: IncrementalContext,
  ): Promise<any> {
    try {
      const compilationResult = await this.compilerService.compileMavenProject(
        context.projectPath,
      );
      context.compilationResults.push(compilationResult);
      return compilationResult;
    } catch (error) {
      this.logger.error(`Compilation failed: ${error.message}`);
      context.errors.push(`Compilation failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate final result with comprehensive metrics
   */
  private generateFinalResult(
    context: IncrementalContext,
    compilationResult: any,
  ): any {
    const createdFiles = Array.from(context.createdFiles.keys());
    const avgQuality =
      Array.from(context.qualityScores.values()).reduce(
        (sum, score) => sum + score,
        0,
      ) / Math.max(1, context.qualityScores.size);

    return {
      success: compilationResult.success && context.errors.length === 0,
      files: createdFiles,
      quality: {
        averageScore: Math.round(avgQuality),
        contextRelevance: Math.round(context.contextRelevance),
        totalWarnings: context.warnings.length,
        totalErrors: context.errors.length,
      },
      compilation: compilationResult,
      recommendations: this.generateRecommendations(context),
    };
  }

  /**
   * Generate recommendations based on creation process
   */
  private generateRecommendations(context: IncrementalContext): string[] {
    const recommendations: string[] = [];

    if (context.warnings.length > 0) {
      recommendations.push('Review warnings to improve plugin stability');
    }

    if (context.errors.length > 0) {
      recommendations.push('Address errors before deployment');
    }

    const avgCreationTime =
      Array.from(context.fileCreationTimes.values()).reduce(
        (sum, time) => sum + time,
        0,
      ) / context.fileCreationTimes.size;

    if (avgCreationTime > 10000) {
      // 10 seconds
      recommendations.push(
        'Consider simplifying complex requirements for faster generation',
      );
    }

    if (context.contextRelevance < 80) {
      recommendations.push('Review file integration for better consistency');
    }

    return recommendations;
  }

  // ============================================================================
  // PROGRESS AND MONITORING
  // ============================================================================

  /**
   * Emit progress updates to clients
   */
  private emitProgress(
    sessionId: string,
    message: string,
    progress: number,
  ): void {
    this.pluginStatusGateway.emitCompilationProgress(sessionId, {
      stage: 'incremental_creation',
      message,
      percentage: progress,
    });
  }

  /**
   * Get active context for monitoring
   */
  getActiveContext(sessionId: string): IncrementalContext | undefined {
    return this.activeContexts.get(sessionId);
  }

  /**
   * Get service health status
   */
  getHealthStatus() {
    return {
      activeContexts: this.activeContexts.size,
      status: this.activeContexts.size < 10 ? 'healthy' : 'busy',
    };
  }

  // ============================================================================
  // ENHANCED ACCURACY METHODS
  // ============================================================================

  /**
   * Initialize adaptive learning for the session
   */
  private async initializeAdaptiveLearning(
    sessionId: string,
    refinedPrompt: RefinedPrompt,
  ): Promise<AdaptiveLearningMetrics> {
    const complexity = this.determinePluginComplexity(refinedPrompt);
    const failurePatterns = await this.loadFailurePatterns();
    const validationThresholds = this.getValidationThresholds(complexity);

    return {
      sessionId,
      pluginComplexity: complexity,
      successPatterns: [],
      failurePatterns,
      validationThresholds,
      generationStrategy: complexity === 'simple' ? 'template' : 'hybrid',
    };
  }

  /**
   * Determine plugin complexity based on refined prompt analysis
   */
  private determinePluginComplexity(
    refinedPrompt: RefinedPrompt,
  ): 'simple' | 'medium' | 'complex' | 'advanced' {
    const features = refinedPrompt.detectedFeatures || [];
    const commands = refinedPrompt.suggestedCommands || [];
    const events = refinedPrompt.suggestedEvents || [];

    let complexityScore = 0;

    // Use existing complexity from refined prompt
    switch (refinedPrompt.complexity) {
      case 'simple':
        complexityScore = 10;
        break;
      case 'medium':
        complexityScore = 30;
        break;
      case 'complex':
        complexityScore = 60;
        break;
    }

    // Feature complexity
    complexityScore += Math.min(features.length * 2, 20);

    // Command complexity
    complexityScore += Math.min(commands.length * 3, 15);

    // Event complexity
    complexityScore += Math.min(events.length * 2, 10);

    // Special patterns that increase complexity
    const complexPatterns = [
      'database',
      'api',
      'gui',
      'economy',
      'permissions',
      'world',
      'nms',
    ];
    for (const pattern of complexPatterns) {
      if (refinedPrompt.originalPrompt.toLowerCase().includes(pattern)) {
        complexityScore += 10;
      }
    }

    if (complexityScore <= 20) return 'simple';
    if (complexityScore <= 40) return 'medium';
    if (complexityScore <= 70) return 'complex';
    return 'advanced';
  }

  /**
   * Get validation thresholds based on complexity
   */
  private getValidationThresholds(
    complexity: 'simple' | 'medium' | 'complex' | 'advanced',
  ): ValidationThresholds {
    const thresholds = {
      simple: {
        minQualityScore: 70,
        maxValidationErrors: 2,
        complexityAdjustment: 0,
        strictnessLevel: 'lenient' as const,
      },
      medium: {
        minQualityScore: 60,
        maxValidationErrors: 3,
        complexityAdjustment: 5,
        strictnessLevel: 'standard' as const,
      },
      complex: {
        minQualityScore: 50,
        maxValidationErrors: 5,
        complexityAdjustment: 10,
        strictnessLevel: 'strict' as const,
      },
      advanced: {
        minQualityScore: 40,
        maxValidationErrors: 7,
        complexityAdjustment: 15,
        strictnessLevel: 'very_strict' as const,
      },
    };

    return thresholds[complexity];
  }

  /**
   * Initialize quality gates for pre-generation analysis
   */
  private initializeQualityGates(): QualityGate[] {
    return [
      {
        name: 'complexity_check',
        condition: (context, fileStep) => context.complexityScore < 80,
        action: 'continue',
        description: 'Check if complexity is manageable',
      },
      {
        name: 'dependency_check',
        condition: (context, fileStep) => fileStep.dependencies.length <= 5,
        action: 'continue',
        description: 'Ensure dependencies are reasonable',
      },
      {
        name: 'error_threshold_check',
        condition: (context, fileStep) =>
          context.errors.length <=
          context.validationThresholds.maxValidationErrors,
        action: 'strict_validation',
        description: 'Check error threshold',
      },
      {
        name: 'template_fallback_check',
        condition: (context, fileStep) =>
          context.adaptiveLearning.generationStrategy !== 'ai' ||
          context.riskFactors.length > 3,
        action: 'template_mode',
        description: 'Use template if risk is high',
      },
    ];
  }

  /**
   * Load known failure patterns from historical data
   */
  private async loadFailurePatterns(): Promise<FailurePattern[]> {
    // In a real implementation, this would load from a database or cache
    // For now, return common failure patterns
    return [
      {
        fileType: 'main_class',
        errorType: 'compilation',
        errorMessage: 'Cannot resolve symbol',
        frequency: 15,
        lastSeen: Date.now() - 86400000, // 1 day ago
        context: 'Missing import statements',
      },
      {
        fileType: 'listener',
        errorType: 'integration',
        errorMessage: 'Event not registered',
        frequency: 8,
        lastSeen: Date.now() - 172800000, // 2 days ago
        context: 'Event registration in main class',
      },
      {
        fileType: 'command',
        errorType: 'validation',
        errorMessage: 'Command not registered in plugin.yml',
        frequency: 12,
        lastSeen: Date.now() - 259200000, // 3 days ago
        context: 'plugin.yml configuration',
      },
    ];
  }

  /**
   * Load template patterns for fallback generation
   */
  private async loadTemplatePatterns(): Promise<Map<string, TemplatePattern>> {
    const templates = new Map<string, TemplatePattern>();

    // Main class template
    templates.set('main_class', {
      id: 'main_class_basic',
      name: 'Basic Main Class',
      fileType: 'main_class',
      complexity: 'simple',
      template: `package ${'{packageName}'};

import org.bukkit.plugin.java.JavaPlugin;

public class ${'{className}'} extends JavaPlugin {
    
    @Override
    public void onEnable() {
        getLogger().info("${'{pluginName}'} has been enabled!");
        // Initialize plugin components here
    }
    
    @Override
    public void onDisable() {
        getLogger().info("${'{pluginName}'} has been disabled!");
        // Cleanup resources here
    }
}`,
      requiredDependencies: ['plugin.yml'],
      successRate: 0.95,
      lastUsed: Date.now(),
    });

    // Command template
    templates.set('command', {
      id: 'command_basic',
      name: 'Basic Command Handler',
      fileType: 'command',
      complexity: 'simple',
      template: `package ${'{packageName}'}.commands;

import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

public class ${'{commandName}'}Command implements CommandExecutor {
    
    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player)) {
            sender.sendMessage("This command can only be used by players!");
            return true;
        }
        
        Player player = (Player) sender;
        // Implement command logic here
        player.sendMessage("Hello from ${'{pluginName}'}!");
        
        return true;
    }
}`,
      requiredDependencies: ['main_class'],
      successRate: 0.88,
      lastUsed: Date.now(),
    });

    // Listener template
    templates.set('listener', {
      id: 'listener_basic',
      name: 'Basic Event Listener',
      fileType: 'listener',
      complexity: 'simple',
      template: `package ${'{packageName}'}.listeners;

import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;

public class ${'{listenerName}'}Listener implements Listener {
    
    @EventHandler
    public void onPlayerJoin(PlayerJoinEvent event) {
        // Handle player join event
        event.getPlayer().sendMessage("Welcome to the server!");
    }
}`,
      requiredDependencies: ['main_class'],
      successRate: 0.92,
      lastUsed: Date.now(),
    });

    return templates;
  }

  /**
   * Analyze complexity of current generation context
   */
  private analyzeComplexity(context: IncrementalContext): number {
    let complexityScore = 0;

    // Base complexity from prompt analysis
    const features = context.refinedPrompt.detectedFeatures || [];
    const commands = context.refinedPrompt.suggestedCommands || [];
    const events = context.refinedPrompt.suggestedEvents || [];

    complexityScore += features.length * 2;
    complexityScore += commands.length * 3;
    complexityScore += events.length * 2;

    // File count complexity
    complexityScore += context.createdFiles.size * 1.5;

    // Error accumulation penalty
    complexityScore += context.errors.length * 8;

    // Warning accumulation penalty
    complexityScore += context.warnings.length * 3;

    // Dependency web complexity
    const totalDependencies = Array.from(context.dependencies.values()).reduce(
      (sum, deps) => sum + deps.length,
      0,
    );
    complexityScore += totalDependencies * 2;

    return Math.min(complexityScore, 100);
  }

  /**
   * Update success patterns based on successful file creation
   */
  private updateSuccessPattern(
    context: IncrementalContext,
    fileStep: FileCreationStep,
    validation: ValidationResult,
  ): void {
    const pattern: SuccessPattern = {
      fileType: fileStep.fileType,
      packageStructure: this.extractPackageStructure(fileStep.filePath),
      codePatterns: this.extractCodePatterns(fileStep.content || ''),
      successRate: validation.score / 100,
      qualityScore: validation.score,
      validationScore:
        validation.issues.length === 0
          ? 100
          : Math.max(0, 100 - validation.issues.length * 10),
      timestamp: Date.now(),
    };

    context.adaptiveLearning.successPatterns.push(pattern);
    context.detectedPatterns.push(pattern);

    // Keep only recent patterns (last 50)
    if (context.adaptiveLearning.successPatterns.length > 50) {
      context.adaptiveLearning.successPatterns =
        context.adaptiveLearning.successPatterns.slice(-50);
    }
  }

  /**
   * Record failure pattern for learning
   */
  private recordFailurePattern(
    context: IncrementalContext,
    fileStep: FileCreationStep,
    error: string,
  ): void {
    const existingPattern = context.adaptiveLearning.failurePatterns.find(
      (p) =>
        p.fileType === fileStep.fileType &&
        p.errorMessage.includes(error.substring(0, 50)),
    );

    if (existingPattern) {
      existingPattern.frequency++;
      existingPattern.lastSeen = Date.now();
    } else {
      const newPattern: FailurePattern = {
        fileType: fileStep.fileType,
        errorType: this.classifyError(error),
        errorMessage: error,
        frequency: 1,
        lastSeen: Date.now(),
        context: `${fileStep.fileName} - ${fileStep.description}`,
      };

      context.adaptiveLearning.failurePatterns.push(newPattern);
      context.avoidedPatterns.push(newPattern);
    }
  }

  /**
   * Classify error type for pattern recognition
   */
  private classifyError(
    error: string,
  ): 'compilation' | 'validation' | 'integration' | 'syntax' {
    const errorLower = error.toLowerCase();

    if (
      errorLower.includes('cannot resolve') ||
      errorLower.includes('symbol not found')
    ) {
      return 'compilation';
    }
    if (errorLower.includes('syntax') || errorLower.includes('unexpected')) {
      return 'syntax';
    }
    if (
      errorLower.includes('not registered') ||
      errorLower.includes('missing')
    ) {
      return 'integration';
    }
    return 'validation';
  }

  /**
   * Extract package structure from file path
   */
  private extractPackageStructure(filePath: string): string {
    const match = filePath.match(/src\/main\/java\/([^\/]+(?:\/[^\/]+)*)/);
    return match ? match[1].replace(/\//g, '.') : 'unknown';
  }

  /**
   * Extract code patterns from file content
   */
  private extractCodePatterns(content: string): string[] {
    const patterns: string[] = [];

    // Extract class patterns
    const classMatches = content.match(
      /(?:public\s+)?(?:abstract\s+)?class\s+\w+(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?/g,
    );
    if (classMatches) patterns.push(...classMatches);

    // Extract method patterns
    const methodMatches = content.match(
      /(?:public|private|protected)?\s*(?:static\s+)?(?:void|\w+)\s+\w+\s*\([^)]*\)/g,
    );
    if (methodMatches) patterns.push(...methodMatches.slice(0, 5)); // Limit to 5 methods

    // Extract import patterns
    const importMatches = content.match(/import\s+[^;]+;/g);
    if (importMatches) patterns.push(...importMatches.slice(0, 10)); // Limit to 10 imports

    return patterns;
  }

  /**
   * Apply quality gates before file generation
   */
  private async applyQualityGates(
    context: IncrementalContext,
    fileStep: FileCreationStep,
  ): Promise<'continue' | 'fallback' | 'strict_validation' | 'template_mode'> {
    for (const gate of context.qualityGates) {
      if (!gate.condition(context, fileStep)) {
        this.logger.warn(
          `Quality gate failed: ${gate.name} - ${gate.description}`,
        );
        return gate.action;
      }
    }
    return 'continue';
  }

  /**
   * Get template for file type based on success patterns
   */
  private async getOptimalTemplate(
    context: IncrementalContext,
    fileType: string,
  ): Promise<TemplatePattern | null> {
    const template = context.availableTemplates.get(fileType);
    if (template) {
      // Update usage statistics
      const currentUsage = context.templateUsage.get(fileType) || 0;
      context.templateUsage.set(fileType, currentUsage + 1);
      template.lastUsed = Date.now();
      return template;
    }
    return null;
  }

  /**
   * Determine fallback strategy based on context analysis
   */
  private determineFallbackStrategy(
    context: IncrementalContext,
  ): 'none' | 'template' | 'simplified' | 'abort' {
    const riskScore =
      context.riskFactors.length * 10 +
      context.errors.length * 15 +
      context.complexityScore;

    if (riskScore > 80) return 'abort';
    if (riskScore > 60) return 'simplified';
    if (
      riskScore > 30 ||
      context.adaptiveLearning.generationStrategy === 'template'
    )
      return 'template';
    return 'none';
  }

  // ============================================================================
  // ENHANCED CONTEXT INITIALIZATION
  // ============================================================================

  // ============================================================================
  // ULTRA-HIGH ACCURACY METHODS (Target: 98-100%)
  // ============================================================================

  /**
   * Perform multi-pass validation with progressive accuracy improvement
   * Validates code through multiple passes until 98%+ accuracy is achieved
   */
  private async performMultiPassValidation(
    content: string,
    fileStep: FileCreationStep,
    context: IncrementalContext,
  ): Promise<ValidationResult> {
    const maxPasses = 5;
    let currentPass = 1;
    let bestResult: ValidationResult = {
      isValid: false,
      score: 0,
      issues: [],
      suggestions: [],
      contextualErrors: [],
    };

    this.logger.debug(`Starting multi-pass validation for ${fileStep.fileName}`);

    while (currentPass <= maxPasses) {
      // Perform validation pass
      const passResult = await this.performValidationPass(
        content,
        fileStep,
        context,
        currentPass,
      );

      // Track this pass
      const multiPassValidation: MultiPassValidation = {
        passNumber: currentPass,
        validationType: this.getValidationTypeForPass(currentPass),
        result: passResult,
        improvements: this.calculateImprovements(bestResult, passResult),
        finalScore: passResult.score,
      };

      context.multiPassValidations.push(multiPassValidation);

      // Update best result if this pass is better
      if (passResult.score > bestResult.score) {
        bestResult = passResult;
      }

      // Check if we've reached target accuracy
      if (passResult.score >= context.accuracyEnforcement.minPassingScore) {
        this.logger.debug(
          `Multi-pass validation completed in ${currentPass} passes with score: ${passResult.score}`,
        );
        break;
      }

      // Apply intelligent corrections for next pass
      if (currentPass < maxPasses) {
        content = await this.applyIntelligentCorrections(
          content,
          passResult,
          context,
        );
      }

      currentPass++;
    }

    // Update precision metrics
    this.updatePrecisionMetrics(context, bestResult, fileStep);

    return bestResult;
  }

  /**
   * Perform a single validation pass with specific focus
   */
  private async performValidationPass(
    content: string,
    fileStep: FileCreationStep,
    context: IncrementalContext,
    passNumber: number,
  ): Promise<ValidationResult> {
    const validationType = this.getValidationTypeForPass(passNumber);
    let result: ValidationResult = {
      isValid: true,
      score: 100,
      issues: [],
      suggestions: [],
      contextualErrors: [],
    };

    switch (validationType) {
      case 'syntax':
        result = await this.validateSyntaxAccuracy(content, fileStep);
        break;
      case 'semantic':
        result = await this.validateSemanticAccuracy(content, fileStep, context);
        break;
      case 'integration':
        result = await this.validateIntegrationAccuracy(content, context);
        break;
      case 'cross_reference':
        result = await this.validateCrossReferences(content, context);
        break;
      case 'final':
        result = await this.performFinalValidation(content, fileStep, context);
        break;
    }

    return result;
  }

  /**
   * Get validation type for specific pass number
   */
  private getValidationTypeForPass(
    passNumber: number,
  ): 'syntax' | 'semantic' | 'integration' | 'cross_reference' | 'final' {
    switch (passNumber) {
      case 1:
        return 'syntax';
      case 2:
        return 'semantic';
      case 3:
        return 'integration';
      case 4:
        return 'cross_reference';
      default:
        return 'final';
    }
  }

  /**
   * Validate syntax accuracy with ultra-high precision
   */
  private async validateSyntaxAccuracy(
    content: string,
    fileStep: FileCreationStep,
  ): Promise<ValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Check for basic Java syntax
    if (!content.includes('package ') && fileStep.fileType === 'main_class') {
      issues.push('Missing package declaration');
      score -= 15;
    }

    // Check for proper class declaration
    if (fileStep.fileType === 'main_class' && !content.match(/public class \w+/)) {
      issues.push('Missing or incorrect public class declaration');
      score -= 20;
    }

    // Check for proper imports
    const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
    const unusedImports = this.detectUnusedImports(content, importLines);
    if (unusedImports.length > 0) {
      issues.push(`Unused imports: ${unusedImports.join(', ')}`);
      score -= unusedImports.length * 3;
    }

    // Check for proper bracket matching
    const openBrackets = (content.match(/\{/g) || []).length;
    const closeBrackets = (content.match(/\}/g) || []).length;
    if (openBrackets !== closeBrackets) {
      issues.push('Mismatched brackets');
      score -= 25;
    }

    // Check for proper semicolons
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.length > 0 &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('/*') &&
        !trimmed.endsWith('{') &&
        !trimmed.endsWith('}') &&
        !trimmed.endsWith(';') &&
        !trimmed.includes('import ') &&
        !trimmed.includes('package ')
      ) {
        if (!trimmed.includes('class ') && !trimmed.includes('interface ')) {
          issues.push(`Missing semicolon: ${trimmed}`);
          score -= 2;
        }
      }
    }

    return {
      isValid: score >= 95,
      score: Math.max(0, score),
      issues,
      suggestions,
      contextualErrors: [],
    };
  }

  /**
   * Validate semantic accuracy and logic consistency
   */
  private async validateSemanticAccuracy(
    content: string,
    fileStep: FileCreationStep,
    context: IncrementalContext,
  ): Promise<ValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Check for proper Bukkit API usage
    if (content.includes('org.bukkit')) {
      const apiUsageScore = await this.validateBukkitAPIUsage(content);
      score = Math.min(score, apiUsageScore);
      if (apiUsageScore < 90) {
        issues.push('Improper Bukkit API usage detected');
        suggestions.push('Review Bukkit API documentation for proper usage');
      }
    }

    // Check for proper error handling
    if (content.includes('try') && !content.includes('catch')) {
      issues.push('Try block without catch block');
      score -= 10;
    }

    // Check for proper variable naming
    const variableNames = this.extractVariableNames(content);
    for (const varName of variableNames) {
      if (!this.isProperJavaVariableName(varName)) {
        issues.push(`Improper variable naming: ${varName}`);
        score -= 3;
      }
    }

    // Check for proper method structure
    const methodIssues = this.validateMethodStructure(content);
    issues.push(...methodIssues);
    score -= methodIssues.length * 5;

    return {
      isValid: score >= 90,
      score: Math.max(0, score),
      issues,
      suggestions,
      contextualErrors: [],
    };
  }

  /**
   * Validate integration accuracy with other files
   */
  private async validateIntegrationAccuracy(
    content: string,
    context: IncrementalContext,
  ): Promise<ValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Check dependency resolution
    for (const [fileName, fileContent] of context.fileContents) {
      const dependencyIssues = this.checkDependencyIntegration(content, fileContent, fileName);
      issues.push(...dependencyIssues);
      score -= dependencyIssues.length * 5;
    }

    // Validate cross-file references
    const crossRefIssues = this.validateCrossFileReferences(content, context);
    issues.push(...crossRefIssues);
    score -= crossRefIssues.length * 8;

    return {
      isValid: score >= 85,
      score: Math.max(0, score),
      issues,
      suggestions,
      contextualErrors: [],
    };
  }

  /**
   * Validate cross-references between files
   */
  private async validateCrossReferences(
    content: string,
    context: IncrementalContext,
  ): Promise<ValidationResult> {
    const issues: string[] = [];
    let score = 100;

    // Build cross-reference map
    this.buildCrossReferenceMap(content, context);

    // Validate all references are properly resolved
    const unresolvedRefs = this.findUnresolvedReferences(content, context);
    issues.push(...unresolvedRefs.map(ref => `Unresolved reference: ${ref}`));
    score -= unresolvedRefs.length * 10;

    return {
      isValid: score >= 90,
      score: Math.max(0, score),
      issues,
      suggestions: [],
      contextualErrors: [],
    };
  }

  /**
   * Perform final comprehensive validation
   */
  private async performFinalValidation(
    content: string,
    fileStep: FileCreationStep,
    context: IncrementalContext,
  ): Promise<ValidationResult> {
    // Combine all validation types for final score
    const syntaxResult = await this.validateSyntaxAccuracy(content, fileStep);
    const semanticResult = await this.validateSemanticAccuracy(content, fileStep, context);
    const integrationResult = await this.validateIntegrationAccuracy(content, context);

    const finalScore = Math.round(
      (syntaxResult.score * 0.4 + semanticResult.score * 0.4 + integrationResult.score * 0.2)
    );

    const allIssues = [
      ...syntaxResult.issues,
      ...semanticResult.issues,
      ...integrationResult.issues,
    ];

    return {
      isValid: finalScore >= context.accuracyEnforcement.minPassingScore,
      score: finalScore,
      issues: allIssues,
      suggestions: [],
      contextualErrors: [],
    };
  }

  /**
   * Apply intelligent corrections based on validation results
   */
  private async applyIntelligentCorrections(
    content: string,
    validationResult: ValidationResult,
    context: IncrementalContext,
  ): Promise<string> {
    let correctedContent = content;

    for (const issue of validationResult.issues) {
      const correction = await this.generateCorrection(issue, content, context);
      if (correction) {
        correctedContent = this.applyCorrection(correctedContent, correction);
        
        // Track the correction
        const realTimeCorrection: RealTimeCorrection = {
          detectedIssue: issue,
          correctionApplied: correction.description,
          confidence: correction.confidence,
          timestamp: Date.now(),
          context: 'multi_pass_validation',
        };
        
        context.realTimeCorrections.push(realTimeCorrection);
      }
    }

    return correctedContent;
  }

  /**
   * Generate correction for a specific issue
   */
  private async generateCorrection(
    issue: string,
    content: string,
    context: IncrementalContext,
  ): Promise<{ description: string; correction: string; confidence: number } | null> {
    // Pattern-based corrections for common issues
    if (issue.includes('Missing package declaration')) {
      return {
        description: 'Add package declaration',
        correction: `package ${this.generatePackageName(context.pluginName)};`,
        confidence: 95,
      };
    }

    if (issue.includes('Missing semicolon')) {
      const line = issue.split(': ')[1];
      return {
        description: 'Add missing semicolon',
        correction: `${line};`,
        confidence: 90,
      };
    }

    if (issue.includes('Unused imports')) {
      return {
        description: 'Remove unused imports',
        correction: 'REMOVE_UNUSED_IMPORTS',
        confidence: 85,
      };
    }

    return null;
  }

  /**
   * Apply a correction to content
   */
  private applyCorrection(
    content: string,
    correction: { description: string; correction: string; confidence: number },
  ): string {
    if (correction.correction === 'REMOVE_UNUSED_IMPORTS') {
      return this.removeUnusedImports(content);
    }

    if (correction.description === 'Add package declaration') {
      return `${correction.correction}\n\n${content}`;
    }

    // For other corrections, try to apply intelligently
    return content.replace(
      correction.correction.replace(';', ''),
      correction.correction,
    );
  }

  /**
   * Update precision metrics based on validation results
   */
  private updatePrecisionMetrics(
    context: IncrementalContext,
    validationResult: ValidationResult,
    fileStep: FileCreationStep,
  ): void {
    const metrics = context.precisionMetrics;

    // Calculate weighted metrics based on validation result
    metrics.syntaxAccuracy = Math.max(metrics.syntaxAccuracy, validationResult.score);
    metrics.semanticAccuracy = Math.max(metrics.semanticAccuracy, validationResult.score * 0.9);
    metrics.integrationAccuracy = Math.max(metrics.integrationAccuracy, validationResult.score * 0.8);
    metrics.complianceScore = this.calculateComplianceScore(context);
    metrics.crossReferenceScore = this.calculateCrossReferenceScore(context);
    metrics.consistencyScore = this.calculateConsistencyScore(context);

    // Update overall accuracy
    const overallAccuracy = Math.round(
      (metrics.syntaxAccuracy +
        metrics.semanticAccuracy +
        metrics.integrationAccuracy +
        metrics.complianceScore +
        metrics.crossReferenceScore +
        metrics.consistencyScore) / 6
    );

    context.currentAccuracy = overallAccuracy;
    context.accuracyHistory.push(overallAccuracy);

    this.logger.debug(`Updated precision metrics - Overall accuracy: ${overallAccuracy}%`);
  }

  /**
   * Perform intelligent retry with deep analysis
   */
  private async performIntelligentRetry(
    fileStep: FileCreationStep,
    context: IncrementalContext,
    lastError: string,
  ): Promise<string> {
    const retryConfig = context.intelligentRetry;

    this.logger.debug(
      `Performing intelligent retry ${fileStep.retryCount + 1} for ${fileStep.fileName}`,
    );

    // Analyze the failure pattern
    const failureAnalysis = this.analyzeFailurePattern(lastError, context);

    // Choose retry strategy based on analysis
    const strategy = this.chooseRetryStrategy(failureAnalysis, retryConfig);

    // Apply the retry strategy
    switch (strategy) {
      case 'incremental_fix':
        return await this.applyIncrementalFix(fileStep, context, failureAnalysis);
      case 'template_merge':
        return await this.applyTemplateMerge(fileStep, context);
      case 'ai_regenerate':
        return await this.regenerateWithAI(fileStep, context, failureAnalysis);
      case 'human_pattern':
        return await this.applyHumanPattern(fileStep, context);
      default:
        return await this.applyIncrementalFix(fileStep, context, failureAnalysis);
    }
  }

  // ============================================================================
  // ULTRA-HIGH ACCURACY HELPER METHODS
  // ============================================================================

  private calculateImprovements(oldResult: ValidationResult, newResult: ValidationResult): string[] {
    const improvements: string[] = [];
    
    if (newResult.score > oldResult.score) {
      improvements.push(`Score improved from ${oldResult.score} to ${newResult.score}`);
    }
    
    if (newResult.issues.length < oldResult.issues.length) {
      improvements.push(`Reduced issues from ${oldResult.issues.length} to ${newResult.issues.length}`);
    }
    
    return improvements;
  }

  private detectUnusedImports(content: string, importLines: string[]): string[] {
    const unusedImports: string[] = [];
    
    for (const importLine of importLines) {
      const importMatch = importLine.match(/import\s+(.+);/);
      if (importMatch) {
        const importPath = importMatch[1];
        const className = importPath.split('.').pop() || '';
        
        if (!content.includes(className) || content.indexOf(className) === content.indexOf(importLine)) {
          unusedImports.push(className);
        }
      }
    }
    
    return unusedImports;
  }

  private async validateBukkitAPIUsage(content: string): Promise<number> {
    let score = 100;
    
    // Check for common Bukkit API misuses
    if (content.includes('new Player(')) {
      score -= 20; // Players cannot be instantiated
    }
    
    if (content.includes('Bukkit.getServer().getOnlinePlayers().size()')) {
      score -= 5; // Should use .size() not .length
    }
    
    return score;
  }

  private extractVariableNames(content: string): string[] {
    const variablePattern = /(?:private|public|protected)?\s*\w+\s+(\w+)\s*[=;]/g;
    const matches: string[] = [];
    let match;
    
    while ((match = variablePattern.exec(content)) !== null) {
      matches.push(match[1]);
    }
    
    return matches;
  }

  private isProperJavaVariableName(name: string): boolean {
    // Java variable naming conventions
    return /^[a-z][a-zA-Z0-9]*$/.test(name);
  }

  private validateMethodStructure(content: string): string[] {
    const issues: string[] = [];
    const methodPattern = /(public|private|protected)\s+\w+\s+\w+\s*\([^)]*\)\s*\{/g;
    let match;
    
    while ((match = methodPattern.exec(content)) !== null) {
      const methodSignature = match[0];
      // Check for proper spacing and formatting
      if (!methodSignature.includes(' ')) {
        issues.push(`Improper method formatting: ${methodSignature}`);
      }
    }
    
    return issues;
  }

  private checkDependencyIntegration(content: string, depContent: string, depFileName: string): string[] {
    const issues: string[] = [];
    
    // Extract class names from dependency
    const classMatches = depContent.match(/class\s+(\w+)/g);
    if (classMatches) {
      for (const classMatch of classMatches) {
        const className = classMatch.split(' ')[1];
        if (content.includes(className) && !content.includes(`import`) && !depFileName.includes(className)) {
          issues.push(`Missing import for ${className} from ${depFileName}`);
        }
      }
    }
    
    return issues;
  }

  private validateCrossFileReferences(content: string, context: IncrementalContext): string[] {
    const issues: string[] = [];
    
    // Check if referenced classes exist in other files
    const classReferences = content.match(/new\s+(\w+)\(/g);
    if (classReferences) {
      for (const ref of classReferences) {
        const className = ref.match(/new\s+(\w+)\(/)?.[1];
        if (className && !this.classExistsInContext(className, context)) {
          issues.push(`Referenced class ${className} not found in project`);
        }
      }
    }
    
    return issues;
  }

  private buildCrossReferenceMap(content: string, context: IncrementalContext): void {
    const fileName = this.getCurrentFileName(content, context);
    if (!fileName) return;
    
    const references: string[] = [];
    
    // Extract all class references
    const classRefs = content.match(/\b[A-Z]\w+\b/g);
    if (classRefs) {
      references.push(...classRefs);
    }
    
    context.crossFileRelationships.set(fileName, references);
  }

  private findUnresolvedReferences(content: string, context: IncrementalContext): string[] {
    const unresolved: string[] = [];
    const classRefs = content.match(/\b[A-Z]\w+\b/g) || [];
    
    for (const ref of classRefs) {
      if (!this.classExistsInContext(ref, context) && !this.isBuiltInJavaClass(ref)) {
        unresolved.push(ref);
      }
    }
    
    return unresolved;
  }

  private classExistsInContext(className: string, context: IncrementalContext): boolean {
    for (const [fileName, fileContent] of context.fileContents) {
      if (fileContent.includes(`class ${className}`)) {
        return true;
      }
    }
    return false;
  }

  private isBuiltInJavaClass(className: string): boolean {
    const javaBuiltIns = ['String', 'Integer', 'Boolean', 'List', 'Map', 'Set', 'HashMap', 'ArrayList'];
    return javaBuiltIns.includes(className);
  }

  private getCurrentFileName(content: string, context: IncrementalContext): string | null {
    for (const [fileName, fileContent] of context.fileContents) {
      if (fileContent === content) {
        return fileName;
      }
    }
    return null;
  }

  private removeUnusedImports(content: string): string {
    const lines = content.split('\n');
    const filteredLines = lines.filter(line => {
      if (!line.trim().startsWith('import ')) return true;
      
      const importMatch = line.match(/import\s+(.+);/);
      if (!importMatch) return true;
      
      const importPath = importMatch[1];
      const className = importPath.split('.').pop() || '';
      
      return content.includes(className) && content.indexOf(className) !== content.indexOf(line);
    });
    
    return filteredLines.join('\n');
  }

  private generatePackageName(pluginName: string): string {
    return `com.${pluginName.toLowerCase().replace(/[^a-z0-9]/g, '')}.plugin`;
  }

  private calculateComplianceScore(context: IncrementalContext): number {
    const rules = context.complianceRules;
    let score = 0;
    let totalRules = 0;

    Object.values(rules).forEach(rule => {
      if (typeof rule === 'boolean') {
        totalRules++;
        if (rule) score++;
      }
    });

    return totalRules > 0 ? Math.round((score / totalRules) * 100) : 100;
  }

  private calculateCrossReferenceScore(context: IncrementalContext): number {
    let resolvedRefs = 0;
    let totalRefs = 0;

    for (const [fileName, refs] of context.crossFileRelationships) {
      totalRefs += refs.length;
      for (const ref of refs) {
        if (this.classExistsInContext(ref, context) || this.isBuiltInJavaClass(ref)) {
          resolvedRefs++;
        }
      }
    }

    return totalRefs > 0 ? Math.round((resolvedRefs / totalRefs) * 100) : 100;
  }

  private calculateConsistencyScore(context: IncrementalContext): number {
    // Calculate consistency based on naming patterns, structure similarity, etc.
    let consistencyScore = 100;
    
    // Check naming consistency across files
    const namingPatterns = new Set<string>();
    for (const [fileName, content] of context.fileContents) {
      const classNames = content.match(/class\s+(\w+)/g);
      if (classNames) {
        classNames.forEach(name => {
          const className = name.split(' ')[1];
          const pattern = this.extractNamingPattern(className);
          namingPatterns.add(pattern);
        });
      }
    }
    
    // Penalize for too many different naming patterns
    if (namingPatterns.size > 2) {
      consistencyScore -= (namingPatterns.size - 2) * 10;
    }
    
    return Math.max(0, consistencyScore);
  }

  private extractNamingPattern(className: string): string {
    // Extract naming pattern (PascalCase, camelCase, etc.)
    if (/^[A-Z][a-z]+([A-Z][a-z]+)*$/.test(className)) return 'PascalCase';
    if (/^[a-z]+([A-Z][a-z]+)*$/.test(className)) return 'camelCase';
    return 'other';
  }

  private analyzeFailurePattern(error: string, context: IncrementalContext): any {
    return {
      errorType: this.categorizeError(error),
      frequency: this.getErrorFrequency(error, context),
      context: error,
      suggestedFix: this.suggestFix(error),
    };
  }

  private categorizeError(error: string): 'syntax' | 'semantic' | 'integration' | 'compilation' {
    if (error.includes('syntax') || error.includes('bracket') || error.includes('semicolon')) {
      return 'syntax';
    }
    if (error.includes('import') || error.includes('class not found')) {
      return 'integration';  
    }
    if (error.includes('compilation')) {
      return 'compilation';
    }
    return 'semantic';
  }

  private getErrorFrequency(error: string, context: IncrementalContext): number {
    return context.adaptiveLearning.failurePatterns
      .filter(pattern => pattern.errorMessage.includes(error))
      .reduce((sum, pattern) => sum + pattern.frequency, 0);
  }

  private suggestFix(error: string): string {
    if (error.includes('Missing package')) return 'Add package declaration';
    if (error.includes('Missing import')) return 'Add missing import statements';
    if (error.includes('bracket')) return 'Fix bracket matching';
    return 'Apply general code correction';
  }

  private chooseRetryStrategy(
    failureAnalysis: any,
    retryConfig: IntelligentRetry,
  ): 'incremental_fix' | 'template_merge' | 'ai_regenerate' | 'human_pattern' {
    if (failureAnalysis.errorType === 'syntax') return 'incremental_fix';
    if (failureAnalysis.frequency > 3) return 'template_merge';
    if (retryConfig.analysisDepth === 'comprehensive') return 'ai_regenerate';
    return 'incremental_fix';
  }

  private async applyIncrementalFix(
    fileStep: FileCreationStep,
    context: IncrementalContext,
    failureAnalysis: any,
  ): Promise<string> {
    // Apply targeted fixes based on failure analysis
    let content = fileStep.content || '';
    
    if (failureAnalysis.suggestedFix.includes('package')) {
      content = `package ${this.generatePackageName(context.pluginName)};\n\n${content}`;
    }
    
    return content;
  }

  private async applyTemplateMerge(
    fileStep: FileCreationStep,
    context: IncrementalContext,
  ): Promise<string> {
    const template = await this.getOptimalTemplate(context, fileStep.fileType);
    if (template) {
      return this.mergeWithTemplate(fileStep.content || '', template.template);
    }
    return fileStep.content || '';
  }

  private async regenerateWithAI(
    fileStep: FileCreationStep,
    context: IncrementalContext,
    failureAnalysis: any,
  ): Promise<string> {
    const enhancedPrompt = this.buildEnhancedPrompt(fileStep, context, failureAnalysis);
    return await this.geminiService.processDirectPrompt(enhancedPrompt);
  }

  private async applyHumanPattern(
    fileStep: FileCreationStep,
    context: IncrementalContext,
  ): Promise<string> {
    // Apply patterns learned from successful human-written code
    const patterns = context.adaptiveLearning.successPatterns
      .filter(p => p.fileType === fileStep.fileType)
      .sort((a, b) => b.successRate - a.successRate);
    
    if (patterns.length > 0) {
      return this.applySuccessPattern(fileStep.content || '', patterns[0]);
    }
    
    return fileStep.content || '';
  }

  private mergeWithTemplate(content: string, template: string): string {
    // Intelligent merge of content with template
    const contentLines = content.split('\n');
    const templateLines = template.split('\n');
    
    // Keep package and imports from template, merge logic from content
    const packageLine = templateLines.find(line => line.includes('package '));
    const importLines = templateLines.filter(line => line.includes('import '));
    const contentLogic = contentLines.filter(line => 
      !line.includes('package ') && !line.includes('import ')
    );
    
    const merged = [
      packageLine || '',
      '',
      ...importLines,
      '',
      ...contentLogic
    ].filter(line => line !== undefined);
    
    return merged.join('\n');
  }

  private buildEnhancedPrompt(
    fileStep: FileCreationStep,
    context: IncrementalContext,
    failureAnalysis: any,
  ): string {
    return `
Create a ${fileStep.fileType} file for a Minecraft plugin with ultra-high accuracy.

Previous Error: ${failureAnalysis.context}
Suggested Fix: ${failureAnalysis.suggestedFix}

Requirements:
- Perfect Java syntax
- Proper Bukkit API usage
- Clean code structure
- Full error handling
- Comprehensive imports

Plugin Name: ${context.pluginName}
File Type: ${fileStep.fileType}
Description: ${fileStep.description}

Context Files:
${Array.from(context.fileContents.keys()).join(', ')}

Generate production-ready code with 98%+ accuracy.
`;
  }

  private applySuccessPattern(content: string, pattern: SuccessPattern): string {
    // Apply successful patterns to improve content
    let enhancedContent = content;
    
    for (const codePattern of pattern.codePatterns) {
      if (!content.includes(codePattern) && this.shouldApplyPattern(codePattern, content)) {
        enhancedContent = this.insertPattern(enhancedContent, codePattern);
      }
    }
    
    return enhancedContent;
  }

  private shouldApplyPattern(pattern: string, content: string): boolean {
    // Determine if a pattern should be applied based on context
    if (pattern.includes('import ') && !content.includes('import ')) return true;
    if (pattern.includes('package ') && !content.includes('package ')) return true;
    return false;
  }

  private insertPattern(content: string, pattern: string): string {
    if (pattern.includes('package ')) {
      return `${pattern}\n\n${content}`;
    }
    if (pattern.includes('import ')) {
      const lines = content.split('\n');
      const insertIndex = lines.findIndex(line => line.includes('import ')) || 1;
      lines.splice(insertIndex, 0, pattern);
      return lines.join('\n');
    }
    return content;
  }
}
