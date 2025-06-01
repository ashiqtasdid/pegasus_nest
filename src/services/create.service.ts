/* eslint-disable @typescript-eslint/require-await */
import { Injectable, Logger } from '@nestjs/common';
import { CreateRequestDto } from 'src/create/dto/create-request.dto';
import {
  PromptRefinementService,
  RefinedPrompt,
} from './prompt-refinement.service';

@Injectable()
export class CreateService {
  private readonly logger = new Logger(CreateService.name);

  constructor(
    private readonly promptRefinementService: PromptRefinementService,
  ) {}

  async create(data: CreateRequestDto, folderPath: string): Promise<string> {
    try {
      // Refine the prompt to better understand user requirements
      const refinedPrompt = await this.promptRefinementService.refinePrompt(
        data.prompt,
        data.name,
      );

      this.logger.log(
        `Created folder at ${folderPath} for plugin '${data.name}' with ${refinedPrompt.detectedFeatures.length} features`,
      );

      return `Created folder at ${folderPath} for request with prompt: ${data.prompt}. Refined analysis detected: ${refinedPrompt.detectedFeatures.join(', ')}`;
    } catch (error) {
      this.logger.error(`Error in create service: ${error.message}`);
      return `Created folder at ${folderPath} for request with prompt: ${data.prompt}`;
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
}
