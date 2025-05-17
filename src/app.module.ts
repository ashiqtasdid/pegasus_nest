import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CreateController } from './create/create.controller';
import { CreateService } from './services/create.service';
import { FileCompilerService } from './services/file-compiler.service';
import { GeminiService } from './services/gemini.service';
import { CodeCompilerService } from './services/code-compiler.service';

@Module({
  imports: [],
  controllers: [AppController, CreateController],
  providers: [AppService, CreateService, FileCompilerService, GeminiService, CodeCompilerService
  ],
})
export class AppModule { }
