import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI } from "@google/genai";
import * as dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class GeminiService {
  private genAI: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || "YOUR_API_KEY";
    this.genAI = new GoogleGenAI({ apiKey });
  }

  /**
   * Process content with Gemini AI
   * @param prompt The prompt to send to Gemini
   * @param filePath Optional path to a file containing additional context
   * @returns Promise with the response from Gemini
   */
  async processWithGemini(prompt: string, filePath?: string): Promise<string> {
    try {
      let finalPrompt = prompt;

      // Add this block to handle the file content reading
      if (filePath && fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        finalPrompt += `\n\nHere's the file content for reference:\n${fileContent}`;
      }

      const response = await this.genAI.models.generateContent({
        model: "gemini-2.5-pro-preview-05-06",
        contents: finalPrompt,
      });

      // Handle potential undefined text
      return response.text || "No response generated";
    } catch (error) {
      console.error('Error processing with Gemini:', error);
      throw new Error(`Gemini processing failed: ${error.message}`);
    }
  }
}