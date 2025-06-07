import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class MemoryMonitorService {
  private readonly logger = new Logger(MemoryMonitorService.name);
  private readonly MEMORY_THRESHOLD_PERCENT = 80; // Alert when memory usage exceeds 80%
  private readonly HEAP_THRESHOLD_PERCENT = 75; // Alert when heap usage exceeds 75%

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkMemoryUsage() {
    try {
      const memoryUsage = process.memoryUsage();
      const systemMemory = this.getSystemMemoryInfo();

      // Convert bytes to MB for easier reading
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
      const externalMB = Math.round(memoryUsage.external / 1024 / 1024);
      const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);

      // Calculate heap usage percentage
      const heapUsagePercent =
        (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      // Log memory stats
      this.logger.log(
        `Memory Usage - Heap: ${heapUsedMB}MB/${heapTotalMB}MB (${heapUsagePercent.toFixed(1)}%), ` +
          `RSS: ${rssMB}MB, External: ${externalMB}MB, ` +
          `System Available: ${systemMemory.availableGB}GB`,
      );

      // Check for memory warnings
      if (heapUsagePercent > this.HEAP_THRESHOLD_PERCENT) {
        this.logger.warn(
          `HIGH HEAP USAGE WARNING: ${heapUsagePercent.toFixed(1)}% - Consider running garbage collection or investigating memory leaks`,
        );

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          this.logger.log('Forced garbage collection executed');
        }
      }

      if (systemMemory.usagePercent > this.MEMORY_THRESHOLD_PERCENT) {
        this.logger.warn(
          `HIGH SYSTEM MEMORY WARNING: ${systemMemory.usagePercent.toFixed(1)}% - System may be under memory pressure`,
        );
      }
    } catch (error) {
      this.logger.error('Error monitoring memory usage:', error);
    }
  }

  private getSystemMemoryInfo() {
    try {
      const os = require('os');
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;
      const usagePercent = (usedMemory / totalMemory) * 100;

      return {
        totalGB: Math.round((totalMemory / 1024 / 1024 / 1024) * 10) / 10,
        availableGB: Math.round((freeMemory / 1024 / 1024 / 1024) * 10) / 10,
        usedGB: Math.round((usedMemory / 1024 / 1024 / 1024) * 10) / 10,
        usagePercent: usagePercent,
      };
    } catch (error) {
      this.logger.error('Error getting system memory info:', error);
      return {
        totalGB: 0,
        availableGB: 0,
        usedGB: 0,
        usagePercent: 0,
      };
    }
  }

  // Method to get current memory stats (for health checks)
  getMemoryStats() {
    const memoryUsage = process.memoryUsage();
    const systemMemory = this.getSystemMemoryInfo();

    return {
      process: {
        heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsagePercent: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
        externalMB: Math.round(memoryUsage.external / 1024 / 1024),
      },
      system: systemMemory,
    };
  }

  // Method to force garbage collection (requires --expose-gc flag)
  forceGarbageCollection() {
    if (global.gc) {
      const beforeMemory = process.memoryUsage();
      global.gc();
      const afterMemory = process.memoryUsage();

      const freedMB = Math.round(
        (beforeMemory.heapUsed - afterMemory.heapUsed) / 1024 / 1024,
      );
      this.logger.log(
        `Garbage collection completed. Freed ${freedMB}MB of memory`,
      );

      return {
        success: true,
        freedMB: freedMB,
        beforeHeapMB: Math.round(beforeMemory.heapUsed / 1024 / 1024),
        afterHeapMB: Math.round(afterMemory.heapUsed / 1024 / 1024),
      };
    } else {
      this.logger.warn(
        'Garbage collection not available. Start with --expose-gc flag to enable.',
      );
      return {
        success: false,
        message:
          'Garbage collection not available. Start with --expose-gc flag to enable.',
      };
    }
  }
}
