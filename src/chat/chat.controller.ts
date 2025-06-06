import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ChatRequestDto } from '../create/dto/chat-request.dto';
import { PluginChatService } from '../services/plugin-chat.service';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly pluginChatService: PluginChatService) {}

  @Post('send')
  async sendChatMessage(
    @Body() chatData: ChatRequestDto,
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      // Validate required parameters
      if (!chatData.pluginName) {
        return {
          success: false,
          error: 'Plugin name is required',
        };
      }

      console.log(
        `Chat request received for plugin: ${chatData.pluginName}, message: ${chatData.message}`,
      );

      const response =
        await this.pluginChatService.getChatResponseWithRefinement(
          chatData.message,
          chatData.pluginName,
        );

      return {
        success: true,
        response: response,
      };
    } catch (error) {
      console.error('Chat endpoint error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }

  @Get('history')
  async getChatHistory(
    @Query('conversationId') conversationId?: string,
    @Query('pluginName') pluginName?: string,
  ): Promise<{ success: boolean; history?: any[]; error?: string }> {
    try {
      // For now, return empty history - you can implement actual history storage later
      return {
        success: true,
        history: [],
      };
    } catch (error) {
      console.error('Chat history error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }
}
