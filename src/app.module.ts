import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CreateController } from './create/create.controller';
import { ChatController } from './chat/chat.controller';
import { CreateService } from './services/create.service';
import { FileCompilerService } from './services/file-compiler.service';
import { GeminiService } from './services/gemini.service';
import { CodeCompilerService } from './services/code-compiler.service';
import { ChatStorageService } from './services/chat-storage.service';
import { PluginOperationsService } from './services/plugin-operations.service';

@Module({
  imports: [],
  controllers: [AppController, CreateController, ChatController],
  providers: [
    AppService,
    CreateService,
    FileCompilerService,
    GeminiService,
    CodeCompilerService,
    ChatStorageService,
    PluginOperationsService,
  ],
})
export class AppModule {}
