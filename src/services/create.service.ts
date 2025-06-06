/* eslint-disable @typescript-eslint/require-await */
import { Injectable, Logger } from '@nestjs/common';
import { CreateRequestDto } from 'src/create/dto/create-request.dto';
import {
  PromptRefinementService,
  RefinedPrompt,
} from './prompt-refinement.service';
import { RobustnessService } from '../common/robustness.service';
import { ValidationService } from '../common/validation.service';

@Injectable()
export class CreateService {
  private readonly logger = new Logger(CreateService.name);

  // Health monitoring properties
  private serviceHealth = {
    isHealthy: true,
    lastHealthCheck: Date.now(),
    successfulCreations: 0,
    failedCreations: 0,
    totalRequests: 0,
    averageCreationTimeMs: 0,
    lastCreationTimes: [] as number[],
  };

  constructor(
    private readonly promptRefinementService: PromptRefinementService,
    private readonly robustnessService: RobustnessService,
    private readonly validationService: ValidationService,
  ) {}

  async create(data: CreateRequestDto, folderPath: string): Promise<string> {
    const circuitBreakerName = 'plugin_creation';

    try {
      return await this.robustnessService.executeWithCircuitBreaker(
        circuitBreakerName,
        async () => {
          // Validate input data
          const validation =
            await this.validationService.validatePluginCreation({
              pluginName: data.name,
              prompt: data.prompt,
            });

          if (!validation.isValid) {
            const errorMsg = `Invalid plugin creation request: ${validation.errors?.join(', ')}`;
            this.robustnessService.recordError(
              'creation_validation',
              new Error(errorMsg),
            );
            throw new Error(errorMsg);
          }

          // Use sanitized data
          const sanitizedData = validation.sanitizedData || data;

          // Refine the prompt to better understand user requirements
          const refinedPrompt =
            await this.robustnessService.executeWithCircuitBreaker(
              'prompt_refinement',
              async () =>
                this.promptRefinementService.refinePrompt(
                  sanitizedData.prompt,
                  sanitizedData.pluginName,
                ),
              async () => {
                // Fallback when prompt refinement is unavailable
                return {
                  originalPrompt: sanitizedData.prompt,
                  refinedPrompt: sanitizedData.prompt,
                  pluginName: sanitizedData.pluginName,
                  detectedFeatures: ['basic-functionality'],
                  suggestedCommands: [],
                  suggestedEvents: [],
                  complexity: 'simple' as const,
                  packageName: `com.example.${sanitizedData.pluginName.toLowerCase()}`,
                  className:
                    sanitizedData.pluginName.charAt(0).toUpperCase() +
                    sanitizedData.pluginName.slice(1),
                } as RefinedPrompt;
              },
            );

          // Record successful operation
          this.robustnessService.recordSuccess('plugin_creation');

          this.logger.log(
            `Created folder at ${folderPath} for plugin '${sanitizedData.pluginName}' with ${refinedPrompt.detectedFeatures.length} features`,
          );

          return `Created folder at ${folderPath} for request with prompt: ${sanitizedData.prompt}. Refined analysis detected: ${refinedPrompt.detectedFeatures.join(', ')}`;
        },
        // Fallback when circuit breaker is open
        async () => {
          return `Plugin creation service is temporarily unavailable due to high load. Please try again in a few minutes.`;
        },
      );
    } catch (error) {
      this.logger.error(
        `Error in create service: ${error.message}`,
        error.stack,
      );
      this.robustnessService.recordFailure('plugin_creation', error);

      // Provide graceful degradation
      return `Created folder at ${folderPath} for request with prompt: ${data.prompt}. Note: Some advanced features may be limited due to system load.`;
    }
  }

  /**
   * Get refined prompt data for a given request
   */
  async getRefinedPrompt(data: CreateRequestDto): Promise<RefinedPrompt> {
    return await this.promptRefinementService.refinePrompt(
      data.prompt,
      data.name,
    );
  }

  /**
   * Get the health status of the CreateService
   * @returns Health status object with metrics
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastChecked: Date;
    metrics: {
      totalRequests: number;
      successRate: number;
      averageCreationTimeMs: number;
    };
  }> {
    // Update last health check time
    this.serviceHealth.lastHealthCheck = Date.now();

    // Calculate success rate
    const successRate =
      this.serviceHealth.totalRequests > 0
        ? this.serviceHealth.successfulCreations /
          this.serviceHealth.totalRequests
        : 1;

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (successRate < 0.6) {
      status = 'unhealthy';
    } else if (successRate < 0.8) {
      status = 'degraded';
    }

    // Calculate average creation time
    const avgTime =
      this.serviceHealth.lastCreationTimes.length > 0
        ? this.serviceHealth.lastCreationTimes.reduce(
            (sum, time) => sum + time,
            0,
          ) / this.serviceHealth.lastCreationTimes.length
        : 0;

    // If average creation time is too high, degrade status
    if (avgTime > 30000) {
      // 30 seconds
      status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
    }

    return {
      status,
      lastChecked: new Date(this.serviceHealth.lastHealthCheck),
      metrics: {
        totalRequests: this.serviceHealth.totalRequests,
        successRate: successRate * 100,
        averageCreationTimeMs: avgTime,
      },
    };
  }
}
