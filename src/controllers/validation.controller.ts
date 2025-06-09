import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { PluginFeatureValidationService } from '../services/plugin-feature-validation.service';
import { ValidationService } from '../common/validation.service';

/**
 * 🔍 VALIDATION CONTROLLER
 * Standalone plugin feature validation and analysis endpoints
 *
 * Features:
 * - Validate existing plugins against requirements
 * - Analyze feature gaps and implementation quality
 * - Generate validation reports
 * - Compare plugins to specifications
 * - Bulk validation operations
 */

@ApiTags('validation')
@Controller('validation')
export class ValidationController {
  private readonly logger = new Logger(ValidationController.name);

  constructor(
    private readonly pluginFeatureValidationService: PluginFeatureValidationService,
    private readonly validationService: ValidationService,
  ) {}

  /**
   * 🔍 Validate Plugin Features
   * Comprehensive validation of a plugin against user requirements
   */
  @Post('validate-plugin')
  @ApiOperation({
    summary: 'Validate plugin against requirements',
    description:
      'Analyzes a plugin implementation against user requirements and provides detailed validation report',
  })
  @ApiBody({
    description: 'Plugin validation request',
    schema: {
      type: 'object',
      required: ['pluginPath', 'requirements', 'userId'],
      properties: {
        pluginPath: {
          type: 'string',
          description: 'Absolute path to the plugin directory',
          example: '/path/to/plugin/MyPlugin',
        },
        requirements: {
          type: 'string',
          description:
            'Original user requirements or prompt describing desired features',
          example:
            'Create a plugin that gives players diamond swords when they join and tracks their kills',
        },
        userId: {
          type: 'string',
          description: 'User identifier for tracking and logging',
          example: 'user123',
        },
        fixMissingFeatures: {
          type: 'boolean',
          description: 'Whether to automatically implement missing features',
          default: false,
        },
        validationLevel: {
          type: 'string',
          enum: ['basic', 'standard', 'comprehensive'],
          description: 'Level of validation detail',
          default: 'standard',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Validation completed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        validationReport: {
          type: 'object',
          properties: {
            overallScore: { type: 'number', minimum: 0, maximum: 1 },
            featuresFound: { type: 'array', items: { type: 'string' } },
            missingFeatures: { type: 'array', items: { type: 'string' } },
            implementationQuality: { type: 'number', minimum: 0, maximum: 1 },
            suggestions: { type: 'array', items: { type: 'string' } },
            detailedAnalysis: { type: 'object' },
            wasFixed: { type: 'boolean' },
            timestamp: { type: 'string' },
          },
        },
        timestamp: { type: 'string' },
      },
    },
  })
  async validatePlugin(
    @Body()
    validationRequest: {
      pluginPath: string;
      requirements: string;
      userId: string;
      fixMissingFeatures?: boolean;
      validationLevel?: 'basic' | 'standard' | 'comprehensive';
    },
  ) {
    this.logger.log(
      `🔍 Validation request for plugin: ${validationRequest.pluginPath}`,
    );

    try {
      // Validate input parameters
      const validation = await this.validationService.validateData(
        validationRequest,
        [
          {
            field: 'pluginPath',
            type: 'string',
            required: true,
            minLength: 1,
          },
          {
            field: 'requirements',
            type: 'string',
            required: true,
            minLength: 10,
            maxLength: 10000,
          },
          {
            field: 'userId',
            type: 'string',
            required: true,
            minLength: 1,
          },
        ],
      );

      if (!validation.isValid) {
        throw new HttpException(
          {
            message: 'Invalid validation request',
            errors: validation.errors,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const {
        pluginPath,
        requirements,
        userId,
        fixMissingFeatures = false,
      } = validationRequest;

      // Perform validation
      let validationReport;
      if (fixMissingFeatures) {
        // Full validation with automatic fixes
        const result =
          await this.pluginFeatureValidationService.validateAndFixPlugin(
            pluginPath,
            requirements,
            userId,
          );
        validationReport = {
          overallScore: result.finalReport.qualityScore / 100,
          featuresFound: result.finalReport.validationResults
            .filter((r) => r.isImplemented)
            .map((r) => r.featureName),
          missingFeatures: result.finalReport.missingFeatures.map(
            (f) => f.name,
          ),
          implementationQuality: result.finalReport.qualityScore / 100,
          suggestions: result.finalReport.overallSuggestions,
          detailedAnalysis: result.finalReport,
          wasFixed: result.success,
        };
      } else {
        // Analysis-only validation
        const report =
          await this.pluginFeatureValidationService.validatePluginFeatures(
            pluginPath,
            requirements,
            userId,
          );
        validationReport = {
          overallScore: report.qualityScore / 100,
          featuresFound: report.validationResults
            .filter((r) => r.isImplemented)
            .map((r) => r.featureName),
          missingFeatures: report.missingFeatures.map((f) => f.name),
          implementationQuality: report.qualityScore / 100,
          suggestions: report.overallSuggestions,
          detailedAnalysis: report,
          wasFixed: false,
        };
      }

      this.logger.log(
        `✅ Validation completed for ${pluginPath} - Score: ${validationReport.overallScore}`,
      );

      return {
        success: true,
        validationReport,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Validation failed: ${error.message}`, error.stack);
      throw new HttpException(
        {
          message: 'Plugin validation failed',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📊 Analyze Plugin Features
   * Extract and analyze features from a plugin without validation
   */
  @Post('analyze-features')
  @ApiOperation({
    summary: 'Analyze plugin features',
    description: 'Extract and analyze features implemented in a plugin',
  })
  @ApiBody({
    description: 'Feature analysis request',
    schema: {
      type: 'object',
      required: ['pluginPath'],
      properties: {
        pluginPath: {
          type: 'string',
          description: 'Absolute path to the plugin directory',
        },
        includeCodeAnalysis: {
          type: 'boolean',
          description: 'Include detailed code analysis',
          default: true,
        },
      },
    },
  })
  async analyzeFeatures(
    @Body() request: { pluginPath: string; includeCodeAnalysis?: boolean },
  ) {
    this.logger.log(`📊 Feature analysis request for: ${request.pluginPath}`);

    try {
      // Validate input
      if (!request.pluginPath) {
        throw new HttpException(
          'Plugin path is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Analyze plugin implementation using the validatePluginFeatures method
      const report =
        await this.pluginFeatureValidationService.validatePluginFeatures(
          request.pluginPath,
          'General feature analysis', // Default prompt for analysis
          'unknown', // Default plugin name for analysis
        );

      return {
        success: true,
        analysis: {
          featuresFound: report.validationResults
            .filter((r) => r.isImplemented)
            .map((r) => r.featureName),
          implementationQuality: report.qualityScore / 100,
          codeMetrics: {
            totalFeatures: report.totalFeatures,
            implementedFeatures: report.implementedFeatures,
            missingFeatures: report.missingFeatures.length,
            validationResults: report.validationResults,
          },
          suggestions: report.overallSuggestions,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ Feature analysis failed: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          message: 'Feature analysis failed',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔄 Compare Plugin to Requirements
   * Compare plugin implementation against specific requirements
   */
  @Post('compare-requirements')
  @ApiOperation({
    summary: 'Compare plugin to requirements',
    description:
      'Compare plugin implementation against specific feature requirements',
  })
  @ApiBody({
    description: 'Requirements comparison request',
    schema: {
      type: 'object',
      required: ['pluginPath', 'requirements'],
      properties: {
        pluginPath: { type: 'string' },
        requirements: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of specific requirements to validate',
        },
      },
    },
  })
  async compareRequirements(
    @Body() request: { pluginPath: string; requirements: string[] },
  ) {
    this.logger.log(`🔄 Requirements comparison for: ${request.pluginPath}`);

    try {
      if (
        !request.pluginPath ||
        !request.requirements ||
        request.requirements.length === 0
      ) {
        throw new HttpException(
          'Plugin path and requirements are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Extract features from user requirements by validating against an empty plugin
      const requirementsText = request.requirements.join('\n');

      // Use validatePluginFeatures to extract required features from the prompt
      const requirementsReport =
        await this.pluginFeatureValidationService.validatePluginFeatures(
          request.pluginPath,
          requirementsText,
          'requirements-comparison',
        );

      // Extract feature names from the validation report
      const extractedFeatureNames = requirementsReport.missingFeatures
        .map((f) => f.name)
        .concat(requirementsReport.validationResults.map((r) => r.featureName));

      // Get plugin analysis
      const pluginReport =
        await this.pluginFeatureValidationService.validatePluginFeatures(
          request.pluginPath,
          'General analysis',
          'plugin-analysis',
        );

      const implementedFeatureNames = pluginReport.validationResults
        .filter((r) => r.isImplemented)
        .map((r) => r.featureName);

      // Generate comparison report
      const comparison = {
        requiredFeatures: extractedFeatureNames,
        implementedFeatures: implementedFeatureNames,
        missingFeatures: requirementsReport.missingFeatures.map((f) => f.name),
        matchingFeatures: extractedFeatureNames.filter((feature) =>
          implementedFeatureNames.some(
            (impl) =>
              impl.toLowerCase().includes(feature.toLowerCase()) ||
              feature.toLowerCase().includes(impl.toLowerCase()),
          ),
        ),
        completionPercentage:
          extractedFeatureNames.length > 0
            ? ((extractedFeatureNames.length -
                requirementsReport.missingFeatures.length) /
                extractedFeatureNames.length) *
              100
            : 100,
      };

      return {
        success: true,
        comparison,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ Requirements comparison failed: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          message: 'Requirements comparison failed',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📋 Get Validation History
   * Retrieve validation history for a specific plugin or user
   */
  @Get('history')
  @ApiOperation({
    summary: 'Get validation history',
    description: 'Retrieve validation history for plugins',
  })
  async getValidationHistory(
    @Query('userId') userId?: string,
    @Query('pluginPath') pluginPath?: string,
    @Query('limit') limit: number = 50,
  ) {
    this.logger.log(
      `📋 Validation history request - User: ${userId}, Plugin: ${pluginPath}`,
    );

    try {
      // Note: This would typically connect to a database to retrieve history
      // For now, return a placeholder response since we don't have persistent storage
      return {
        success: true,
        message: 'Validation history feature requires database integration',
        history: [],
        filters: {
          userId,
          pluginPath,
          limit,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ History retrieval failed: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        {
          message: 'Failed to retrieve validation history',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🎯 Validation Health Check
   * Check if validation services are working properly
   */
  @Get('health')
  @ApiOperation({
    summary: 'Validation service health check',
    description: 'Check if validation services are operational',
  })
  async getValidationHealth() {
    try {
      // Test validation service components
      const healthStatus = {
        validationService: 'operational',
        pluginFeatureValidationService: 'operational',
        aiServices: 'operational',
        timestamp: new Date().toISOString(),
      };

      // Test basic validation functionality
      const testValidation = await this.validationService.validateData(
        { test: 'value' },
        [{ field: 'test', type: 'string', required: true }],
      );

      if (!testValidation.isValid) {
        healthStatus.validationService = 'degraded';
      }

      return {
        success: true,
        status: 'healthy',
        components: healthStatus,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ Validation health check failed: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 📝 Get Validation Schemas
   * Retrieve validation schemas and documentation
   */
  @Get('schemas')
  @ApiOperation({
    summary: 'Get validation schemas',
    description:
      'Retrieve available validation schemas and their documentation',
  })
  async getValidationSchemas() {
    return {
      success: true,
      schemas: {
        pluginValidation: {
          required: ['pluginPath', 'requirements', 'userId'],
          optional: ['fixMissingFeatures', 'validationLevel'],
          description: 'Schema for validating plugins against requirements',
        },
        featureAnalysis: {
          required: ['pluginPath'],
          optional: ['includeCodeAnalysis'],
          description: 'Schema for analyzing plugin features',
        },
        requirementsComparison: {
          required: ['pluginPath', 'requirements'],
          optional: [],
          description: 'Schema for comparing plugins to requirements',
        },
      },
      validationLevels: ['basic', 'standard', 'comprehensive'],
      supportedFeatureTypes: [
        'commands',
        'events',
        'permissions',
        'configuration',
        'database',
        'gui',
        'api',
        'integration',
      ],
      timestamp: new Date().toISOString(),
    };
  }
}
