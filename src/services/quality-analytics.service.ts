import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';

interface QualityMetrics {
  generationId: string;
  timestamp: Date;
  pluginName: string;
  compilationSuccess: boolean;
  compilationTime: number;
  qualityScore: number;
  aiSuggestions: string[];
  fixAttempts: number;
  finalSuccess: boolean;
  userPromptComplexity: 'simple' | 'medium' | 'complex';
  featuresDetected: string[];
  errors: string[];
}

interface QualityTrends {
  successRate: number;
  averageQualityScore: number;
  commonFailurePatterns: string[];
  improvementTrends: number[];
  modelPerformance: {
    [model: string]: {
      successRate: number;
      averageScore: number;
    };
  };
}

@Injectable()
export class QualityAnalyticsService {
  private readonly logger = new Logger(QualityAnalyticsService.name);
  private readonly metricsHistory: QualityMetrics[] = [];
  private readonly maxHistorySize = 1000;

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.initializeService();
  }

  private initializeService(): void {
    this.loadHistoricalData();
    this.setupEventListeners();
  }

  /**
   * Record a plugin generation attempt with comprehensive metrics
   */
  recordGenerationAttempt(metrics: QualityMetrics): void {
    this.metricsHistory.push(metrics);

    // Maintain history size limit
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    this.persistMetrics(metrics);
    this.analyzePatterns();

    this.logger.log(
      `Recorded quality metrics for ${metrics.pluginName}: Score ${metrics.qualityScore}`,
    );
  }

  /**
   * Analyze current quality trends and patterns
   */
  analyzeTrends(): QualityTrends {
    const recentMetrics = this.metricsHistory.slice(-100); // Last 100 generations

    const successRate =
      recentMetrics.filter((m) => m.finalSuccess).length / recentMetrics.length;
    const averageQualityScore =
      recentMetrics.reduce((sum, m) => sum + m.qualityScore, 0) /
      recentMetrics.length;

    // Identify common failure patterns
    const failurePatterns = this.identifyFailurePatterns(
      recentMetrics.filter((m) => !m.finalSuccess),
    );

    // Calculate improvement trends over time
    const improvementTrends = this.calculateImprovementTrends();

    // Analyze model performance
    const modelPerformance = this.analyzeModelPerformance(recentMetrics);

    return {
      successRate,
      averageQualityScore,
      commonFailurePatterns: failurePatterns,
      improvementTrends,
      modelPerformance,
    };
  }

  /**
   * Get recommendations for improving accuracy based on patterns
   */
  getAccuracyRecommendations(): string[] {
    const trends = this.analyzeTrends();
    const recommendations: string[] = [];

    if (trends.successRate < 0.8) {
      recommendations.push(
        'Success rate below 80% - consider enhancing prompt refinement',
      );
    }

    if (trends.averageQualityScore < 0.7) {
      recommendations.push(
        'Quality scores low - review AI validation criteria',
      );
    }

    // Add pattern-specific recommendations
    trends.commonFailurePatterns.forEach((pattern) => {
      switch (pattern) {
        case 'compilation_errors':
          recommendations.push(
            'High compilation failures - enhance auto-fix rules',
          );
          break;
        case 'missing_imports':
          recommendations.push(
            'Import issues detected - update import detection logic',
          );
          break;
        case 'plugin_yml_errors':
          recommendations.push(
            'Plugin.yml issues - strengthen template validation',
          );
          break;
      }
    });

    return recommendations;
  }

  private identifyFailurePatterns(failures: QualityMetrics[]): string[] {
    const patterns = new Map<string, number>();

    failures.forEach((failure) => {
      failure.errors.forEach((error) => {
        if (error.includes('compilation'))
          patterns.set(
            'compilation_errors',
            (patterns.get('compilation_errors') || 0) + 1,
          );
        if (error.includes('import'))
          patterns.set(
            'missing_imports',
            (patterns.get('missing_imports') || 0) + 1,
          );
        if (error.includes('plugin.yml'))
          patterns.set(
            'plugin_yml_errors',
            (patterns.get('plugin_yml_errors') || 0) + 1,
          );
      });
    });

    return Array.from(patterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern]) => pattern);
  }

  private calculateImprovementTrends(): number[] {
    const periods = 5; // Analyze last 5 periods of 20 generations each
    const trends: number[] = [];

    for (let i = 0; i < periods; i++) {
      const start = this.metricsHistory.length - (periods - i) * 20;
      const end = start + 20;
      const periodMetrics = this.metricsHistory.slice(Math.max(0, start), end);

      if (periodMetrics.length > 0) {
        const successRate =
          periodMetrics.filter((m) => m.finalSuccess).length /
          periodMetrics.length;
        trends.push(successRate);
      }
    }

    return trends;
  }

  private analyzeModelPerformance(metrics: QualityMetrics[]): {
    [model: string]: { successRate: number; averageScore: number };
  } {
    // This would analyze performance by AI model used
    // For now, return Claude Sonnet 4 performance
    return {
      'claude-sonnet-4': {
        successRate:
          metrics.filter((m) => m.finalSuccess).length / metrics.length,
        averageScore:
          metrics.reduce((sum, m) => sum + m.qualityScore, 0) / metrics.length,
      },
    };
  }

  private analyzePatterns(): void {
    // Emit events for pattern detection
    const trends = this.analyzeTrends();

    if (trends.successRate < 0.7) {
      this.eventEmitter.emit('quality.alert', {
        type: 'low_success_rate',
        value: trends.successRate,
        recommendations: this.getAccuracyRecommendations(),
      });
    }
  }

  private persistMetrics(metrics: QualityMetrics): void {
    const metricsFile = path.join(
      process.cwd(),
      'logs',
      'quality-metrics.jsonl',
    );

    try {
      fs.appendFileSync(metricsFile, JSON.stringify(metrics) + '\n');
    } catch (error) {
      this.logger.error(`Failed to persist metrics: ${error.message}`);
    }
  }

  private loadHistoricalData(): void {
    const metricsFile = path.join(
      process.cwd(),
      'logs',
      'quality-metrics.jsonl',
    );

    try {
      if (fs.existsSync(metricsFile)) {
        const data = fs.readFileSync(metricsFile, 'utf-8');
        const lines = data.trim().split('\n');

        lines.slice(-this.maxHistorySize).forEach((line) => {
          try {
            const metrics = JSON.parse(line);
            this.metricsHistory.push(metrics);
          } catch (parseError) {
            this.logger.warn(
              `Failed to parse metrics line: ${parseError.message}`,
            );
          }
        });

        this.logger.log(
          `Loaded ${this.metricsHistory.length} historical quality metrics`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to load historical data: ${error.message}`);
    }
  }

  private setupEventListeners(): void {
    this.eventEmitter.on('plugin.generated', (data) => {
      // Auto-record metrics when plugins are generated
      this.logger.debug('Plugin generation event received');
    });
  }

  /**
   * Get comprehensive quality dashboard data
   */
  getQualityDashboard(): {
    overview: QualityTrends;
    recentGenerations: QualityMetrics[];
    recommendations: string[];
    alerts: string[];
  } {
    const trends = this.analyzeTrends();
    const recent = this.metricsHistory.slice(-10);
    const recommendations = this.getAccuracyRecommendations();

    const alerts: string[] = [];
    if (trends.successRate < 0.8) alerts.push('Success rate below target');
    if (trends.averageQualityScore < 0.7)
      alerts.push('Quality scores need improvement');

    return {
      overview: trends,
      recentGenerations: recent,
      recommendations,
      alerts,
    };
  }
}
