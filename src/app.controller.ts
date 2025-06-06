import { Controller, Get, Logger } from '@nestjs/common';
import { GeminiService } from './services/gemini.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  constructor(private readonly geminiService: GeminiService) {}

  @Get('api/optimization-stats')
  getOptimizationStats() {
    const stats = this.geminiService.getTokenUsageStats();
    return {
      message: '🚀 Pegasus Nest API Optimization Statistics',
      timestamp: new Date().toISOString(),
      performance: {
        totalRequests: stats.totalRequests,
        totalTokens: stats.totalTokens,
        averageTokensPerRequest: Math.round(stats.averageTokensPerRequest),
        cacheHitRate: `${stats.cacheHitRate.toFixed(1)}%`,
        cacheSize: stats.cacheSize,
        compressionSavings: `${stats.compressionSavings} characters saved`,
      },
      savings: {
        cacheHits: stats.cacheHits,
        cacheMisses: stats.cacheMisses,
        estimatedTokensSaved: stats.cacheHits * 100, // Rough estimate
        estimatedCostSavings: `$${(((stats.cacheHits * 100) / 1000000) * 2).toFixed(4)}`, // Rough cost estimate
      },
      status:
        stats.totalRequests > 0
          ? 'Optimization Active'
          : 'Waiting for requests',
    };
  }

  @Get('api/clear-cache')
  clearOptimizationCache() {
    this.geminiService.clearCache();
    return {
      message: '🧹 Optimization cache cleared successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
