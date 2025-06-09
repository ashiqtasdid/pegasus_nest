import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { RobustnessService } from '../common/robustness.service';
import { AgentOrchestratorService } from '../services/agent-orchestrator.service';
import { GeminiService } from '../services/gemini.service';
import { CodeCompilerService } from '../services/code-compiler.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly robustnessService: RobustnessService,
    private readonly agentOrchestratorService: AgentOrchestratorService,
    private readonly geminiService: GeminiService,
    private readonly codeCompilerService: CodeCompilerService,
  ) {}

  @Get()
  async getHealthStatus() {
    try {
      const status = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
      };

      return status;
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Health check failed',
          timestamp: new Date().toISOString(),
          error: error.message,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get('detailed')
  async getDetailedHealthStatus() {
    try {
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024),
      };

      // Get circuit breaker states
      const circuitBreakerStates =
        this.robustnessService.getCircuitBreakerStates();

      // Get agent orchestrator status
      const agentStatus = await this.getAgentOrchestratorStatus();

      const status = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
        },
        memory: {
          usage: memoryUsageMB,
          limit: process.env.NODE_OPTIONS?.includes('--max-old-space-size')
            ? process.env.NODE_OPTIONS.match(/--max-old-space-size=(\d+)/)?.[1]
            : 'default',
        },
        circuitBreakers: circuitBreakerStates,
        agents: agentStatus,
        performance: {
          cpuUsage: process.cpuUsage(),
          resourceUsage: process.resourceUsage ? process.resourceUsage() : null,
        },
      };

      return status;
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Detailed health check failed',
          timestamp: new Date().toISOString(),
          error: error.message,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get('circuit-breakers')
  async getCircuitBreakerStatus() {
    try {
      const states = this.robustnessService.getCircuitBreakerStates();
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        circuitBreakers: states,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Circuit breaker status check failed',
          timestamp: new Date().toISOString(),
          error: error.message,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get('agents')
  async getAgentStatus() {
    try {
      const agentStatus = await this.getAgentOrchestratorStatus();
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        agents: agentStatus,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Agent status check failed',
          timestamp: new Date().toISOString(),
          error: error.message,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get('performance')
  async getPerformanceMetrics() {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      const metrics = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          heapUsagePercentage: Math.round(
            (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
          ),
          external: memoryUsage.external,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        resourceUsage: process.resourceUsage ? process.resourceUsage() : null,
        eventLoop: {
          delay: await this.measureEventLoopDelay(),
        },
      };

      return {
        status: 'ok',
        metrics,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Performance metrics check failed',
          timestamp: new Date().toISOString(),
          error: error.message,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private async getAgentOrchestratorStatus() {
    try {
      // Test the main agent orchestrator service with a simple health check
      const agentStatus = [];

      try {
        const startTime = Date.now();

        // Test basic availability of the service
        const isServiceAvailable = this.agentOrchestratorService !== undefined;

        if (isServiceAvailable) {
          // Simple test - just check if we can access the service without calling any heavy methods
          const responseTime = Date.now() - startTime;

          agentStatus.push({
            name: 'AgentOrchestratorService',
            status: 'healthy',
            responseTime,
            lastCheck: new Date().toISOString(),
            details: {
              serviceLoaded: true,
              mainMethod: 'createPluginWithMaxAccuracy',
              description: 'High-accuracy plugin creation service',
            },
          });
        } else {
          agentStatus.push({
            name: 'AgentOrchestratorService',
            status: 'unhealthy',
            error: 'Service not loaded',
            lastCheck: new Date().toISOString(),
          });
        }
      } catch (error) {
        agentStatus.push({
          name: 'AgentOrchestratorService',
          status: 'unhealthy',
          error: error.message,
          lastCheck: new Date().toISOString(),
        });
      }

      return agentStatus;
    } catch (error) {
      return [
        {
          name: 'AgentOrchestratorService',
          status: 'error',
          error: error.message,
          lastCheck: new Date().toISOString(),
        },
      ];
    }
  }

  private async measureEventLoopDelay(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
        resolve(delay);
      });
    });
  }
}
