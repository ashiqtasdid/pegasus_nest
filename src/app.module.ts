import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CreateController } from './create/create.controller';
import { HealthController } from './health/health.controller';
import { MinecraftServerController } from './controllers/minecraft-server.controller';
import { ServerDashboardController } from './controllers/server-dashboard.controller';
import { CreateService } from './services/create.service';
import { FileCompilerService } from './services/file-compiler.service';
import { GeminiService } from './services/gemini.service';
import { CodeCompilerService } from './services/code-compiler.service';
import { PluginOperationsService } from './services/plugin-operations.service';
import { PluginChatService } from './services/plugin-chat.service';
import { PromptRefinementService } from './services/prompt-refinement.service';
import { MemoryMonitorService } from './services/memory-monitor.service';
import { StreamingService } from './services/streaming.service';
import { PerformanceTrackingService } from './services/performance-tracking.service';
import { PerformanceMiddleware } from './middleware/performance.middleware';
import { RobustnessService } from './common/robustness.service';
import { ValidationService } from './common/validation.service';
import { SecurityService } from './common/security.service';
import { HealthMonitoringService } from './common/health-monitoring.service';
import { LoggingService } from './common/logging.service';
import { PerformanceMonitoringService } from './common/performance-monitoring.service';
import { ChatClassificationService } from './services/chat-classification.service';
import { MinecraftServerService } from './services/minecraft-server.service';
import { UserManagementService } from './services/user-management.service';
import { MinecraftMonitoringService } from './services/minecraft-monitoring.service';
import { MinecraftBackupService } from './services/minecraft-backup.service';
import { MinecraftStatusGateway } from './gateways/minecraft-status.gateway';

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
    HealthController,
    AppController,
    MinecraftServerController,
    ServerDashboardController,
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
    MemoryMonitorService,
    StreamingService,
    PerformanceTrackingService,
    RobustnessService,
    ValidationService,
    SecurityService,
    HealthMonitoringService,
    LoggingService,
    PerformanceMonitoringService,
    ChatClassificationService,
    MinecraftServerService,
    UserManagementService,
    MinecraftMonitoringService,
    MinecraftBackupService,
    MinecraftStatusGateway,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PerformanceMiddleware).forRoutes('*'); // Apply to all routes
  }
}
