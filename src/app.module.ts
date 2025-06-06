import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CreateController } from './create/create.controller';
import { HealthController } from './health/health.controller';
import { CreateService } from './services/create.service';
import { FileCompilerService } from './services/file-compiler.service';
import { GeminiService } from './services/gemini.service';
import { CodeCompilerService } from './services/code-compiler.service';
import { PluginOperationsService } from './services/plugin-operations.service';
import { PluginChatService } from './services/plugin-chat.service';
import { PromptRefinementService } from './services/prompt-refinement.service';
import { RobustnessService } from './common/robustness.service';
import { ValidationService } from './common/validation.service';
import { SecurityService } from './common/security.service';
import { HealthMonitoringService } from './common/health-monitoring.service';
import { LoggingService } from './common/logging.service';
import { PerformanceMonitoringService } from './common/performance-monitoring.service';
import { ChatClassificationService } from './services/chat-classification.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
  ],
  controllers: [CreateController, HealthController, AppController],
  providers: [
    AppService,
    CreateService,
    FileCompilerService,
    GeminiService,
    CodeCompilerService,
    PluginOperationsService,
    PluginChatService,
    PromptRefinementService,
    RobustnessService,
    ValidationService,
    SecurityService,
    HealthMonitoringService,
    LoggingService,
    PerformanceMonitoringService,
    ChatClassificationService,
  ],
})
export class AppModule {}
