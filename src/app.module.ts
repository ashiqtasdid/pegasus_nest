import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CreateController } from './create/create.controller';
import { MinecraftServerController } from './controllers/minecraft-server.controller';
import { ServerDashboardController } from './controllers/server-dashboard.controller';
import { HealthController } from './controllers/health.controller';
import { ValidationController } from './controllers/validation.controller';
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
import { LoggingService } from './common/logging.service';
import { ChatClassificationService } from './services/chat-classification.service';
import { MinecraftServerService } from './services/minecraft-server.service';
import { UserManagementService } from './services/user-management.service';
import { MinecraftBackupService } from './services/minecraft-backup.service';
import { MinecraftStatusGateway } from './gateways/minecraft-status.gateway';
import { AgentFeedbackGateway } from './gateways/agent-feedback.gateway';
import { PluginStatusGateway } from './gateways/plugin-status.gateway';
import { EnhancedPromptEngineeringService } from './services/enhanced-prompt-engineering.service';
import { QualityAnalyticsService } from './services/quality-analytics.service';
import { AgentOrchestratorService } from './services/agent-orchestrator.service';
import { PluginFeatureValidationService } from './services/plugin-feature-validation.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
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
  controllers: [
    CreateController,
    AppController,
    MinecraftServerController,
    ServerDashboardController,
    HealthController,
    ValidationController,
  ],
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
    LoggingService,
    ChatClassificationService,
    MinecraftServerService,
    UserManagementService,
    MinecraftBackupService,
    MinecraftStatusGateway,
    AgentFeedbackGateway,
    PluginStatusGateway,
    EnhancedPromptEngineeringService,
    QualityAnalyticsService,
    AgentOrchestratorService,
    PluginFeatureValidationService,
  ],
})
export class AppModule {}
