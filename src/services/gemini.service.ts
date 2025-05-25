import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class GeminiService {
  private openai: OpenAI;
  private readonly logger = new Logger(GeminiService.name);

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY || "YOUR_API_KEY";
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      defaultHeaders: {
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
        'X-Title': process.env.SITE_NAME || 'Pegasus API',
      },
    });
    
    this.logger.log('OpenRouter service initialized');
  }

  /**
   * Process content with AI through OpenRouter
   * @param prompt The prompt to send to the AI
   * @param filePath Optional path to a file containing additional context
   * @returns Promise with the response from the AI
   */
  async processWithGemini(prompt: string, filePath?: string): Promise<string> {
    try {
      let finalPrompt = prompt;

      // Add this block to handle the file content reading
      if (filePath && fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        finalPrompt += `\n\nHere's the file content for reference:\n${fileContent}`;
      }

      this.logger.log('Sending request to OpenRouter...');
      
      // Using only deepseek/deepseek-prover-v2 model as requested
      this.logger.log('Using model: deepseek/deepseek-prover-v2');
      
      const response = await this.openai.chat.completions.create({
        model: 'anthropic/claude-3.7-sonnet',
        messages: [
          {
            role: 'user',
            content: finalPrompt,
          },
        ],
      });

      // Extract text from OpenRouter's response format
      const responseText = response.choices[0]?.message?.content;
      if (responseText) {
        this.logger.log('Successfully received response from deepseek/deepseek-prover-v2');
        return responseText;
      } else {
        throw new Error('Model returned empty response');
      }
    } catch (error) {
      this.logger.error(`OpenRouter API error: ${error.message}`);
      
      // Improve error reporting for common issues
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        throw new Error(`Connection error: Please check your internet connection and firewall settings.`);
      } else if (error.response?.status === 401) {
        throw new Error('Authentication error: Invalid API key. Please check your OPENROUTER_API_KEY.');
      } else if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`AI processing failed: ${error.message}`);
      }
    }
  }
}