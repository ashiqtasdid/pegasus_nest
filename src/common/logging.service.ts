import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Log level enum
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * Log entry interface
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  correlationId?: string;
  userId?: string;
  requestId?: string;
  data?: any;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Service for enhanced structured logging across the application
 */
@Injectable()
export class LoggingService {
  private readonly logger = new Logger(LoggingService.name);
  private readonly logDirectory: string;
  private readonly maxLogFileSize = 10 * 1024 * 1024; // 10MB
  private readonly maxLogFiles = 5;
  private activeLogFile: string;
  private correlationIds = new Map<string, string>();

  constructor() {
    this.logDirectory = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
    this.activeLogFile = this.getActiveLogFile();
    this.log(
      'LoggingService initialized with structured logging',
      LogLevel.INFO,
    );
  }

  /**
   * Log a message with structured metadata
   */
  log(
    message: string,
    level: LogLevel = LogLevel.INFO,
    metadata: {
      context?: string;
      correlationId?: string;
      userId?: string;
      requestId?: string;
      data?: any;
      error?: Error;
    } = {},
  ): void {
    try {
      const timestamp = new Date().toISOString();

      // Build structured log entry
      const logEntry: LogEntry = {
        timestamp,
        level,
        message,
        context: metadata.context,
        correlationId: metadata.correlationId,
        userId: metadata.userId,
        requestId: metadata.requestId,
        data: metadata.data,
      };

      // Add error information if present
      if (metadata.error) {
        logEntry.error = {
          message: metadata.error.message,
          stack: metadata.error.stack,
          code: (metadata.error as any).code,
        };
      }

      // Write to console with appropriate level
      this.logToConsole(logEntry);

      // Write to file
      this.writeToFile(logEntry);

      // For fatal errors, trigger additional notifications
      if (level === LogLevel.FATAL) {
        this.notifyFatalError(logEntry);
      }
    } catch (error) {
      // Fallback to basic logging if structured logging fails
      console.error('Logging service error:', error);
      console.log(`[${level.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: any): void {
    this.log(message, LogLevel.DEBUG, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: any): void {
    this.log(message, LogLevel.INFO, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: any): void {
    this.log(message, LogLevel.WARN, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, metadata?: any): void {
    this.log(message, LogLevel.ERROR, { ...metadata, error });
  }

  /**
   * Log fatal message
   */
  fatal(message: string, error?: Error, metadata?: any): void {
    this.log(message, LogLevel.FATAL, { ...metadata, error });
  }

  /**
   * Create a correlation ID for tracking related operations
   */
  createCorrelationId(requestId?: string): string {
    const correlationId =
      requestId ||
      `corr-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    return correlationId;
  }

  /**
   * Set correlation ID for the current context
   */
  setCorrelationId(id: string, context: string): void {
    this.correlationIds.set(context, id);
  }

  /**
   * Get correlation ID for the current context
   */
  getCorrelationId(context: string): string | undefined {
    return this.correlationIds.get(context);
  }

  /**
   * Create a child logger with context
   */
  createContextLogger(context: string): {
    debug: (message: string, metadata?: any) => void;
    info: (message: string, metadata?: any) => void;
    warn: (message: string, metadata?: any) => void;
    error: (message: string, error?: Error, metadata?: any) => void;
    fatal: (message: string, error?: Error, metadata?: any) => void;
  } {
    return {
      debug: (message: string, metadata?: any) =>
        this.log(message, LogLevel.DEBUG, { ...metadata, context }),
      info: (message: string, metadata?: any) =>
        this.log(message, LogLevel.INFO, { ...metadata, context }),
      warn: (message: string, metadata?: any) =>
        this.log(message, LogLevel.WARN, { ...metadata, context }),
      error: (message: string, error?: Error, metadata?: any) =>
        this.log(message, LogLevel.ERROR, { ...metadata, error, context }),
      fatal: (message: string, error?: Error, metadata?: any) =>
        this.log(message, LogLevel.FATAL, { ...metadata, error, context }),
    };
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * Get or create active log file
   */
  private getActiveLogFile(): string {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const logFile = path.join(this.logDirectory, `app-${timestamp}.log`);

    try {
      fs.writeFileSync(logFile, '', { flag: 'a' });
      this.rotateLogFiles();
      return logFile;
    } catch (error) {
      console.error('Failed to create log file:', error);
      return path.join(os.tmpdir(), `app-${timestamp}.log`);
    }
  }

  /**
   * Rotate log files if needed
   */
  private rotateLogFiles(): void {
    try {
      // Check if current log file exceeds size limit
      if (
        fs.existsSync(this.activeLogFile) &&
        fs.statSync(this.activeLogFile).size > this.maxLogFileSize
      ) {
        const timestamp = new Date()
          .toISOString()
          .replace(/:/g, '-')
          .split('.')[0];
        this.activeLogFile = path.join(
          this.logDirectory,
          `app-${timestamp}.log`,
        );
      }

      // Remove old log files if too many
      const logFiles = fs
        .readdirSync(this.logDirectory)
        .filter((file) => file.startsWith('app-') && file.endsWith('.log'))
        .map((file) => ({
          name: file,
          path: path.join(this.logDirectory, file),
          time: fs.statSync(path.join(this.logDirectory, file)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      if (logFiles.length > this.maxLogFiles) {
        logFiles.slice(this.maxLogFiles).forEach((file) => {
          try {
            fs.unlinkSync(file.path);
          } catch (error) {
            console.error(`Failed to delete old log file ${file.path}:`, error);
          }
        });
      }
    } catch (error) {
      console.error('Failed to rotate log files:', error);
    }
  }

  /**
   * Write log entry to file
   */
  private writeToFile(entry: LogEntry): void {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.activeLogFile, logLine);

      // Check if we need to rotate log files
      if (fs.statSync(this.activeLogFile).size > this.maxLogFileSize) {
        this.rotateLogFiles();
      }
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Log to console with appropriate level and color
   */
  private logToConsole(entry: LogEntry): void {
    const { level, message, context, correlationId } = entry;
    let logFn: Function;
    let prefix: string;

    switch (level) {
      case LogLevel.DEBUG:
        logFn = console.debug;
        prefix = '\x1b[34mDEBUG\x1b[0m'; // Blue
        break;
      case LogLevel.INFO:
        logFn = console.info;
        prefix = '\x1b[32mINFO\x1b[0m'; // Green
        break;
      case LogLevel.WARN:
        logFn = console.warn;
        prefix = '\x1b[33mWARN\x1b[0m'; // Yellow
        break;
      case LogLevel.ERROR:
        logFn = console.error;
        prefix = '\x1b[31mERROR\x1b[0m'; // Red
        break;
      case LogLevel.FATAL:
        logFn = console.error;
        prefix = '\x1b[35mFATAL\x1b[0m'; // Magenta
        break;
      default:
        logFn = console.log;
        prefix = '\x1b[37mLOG\x1b[0m'; // White
    }

    const contextStr = context ? `[\x1b[36m${context}\x1b[0m]` : '';
    const corrIdStr = correlationId ? `[\x1b[90m${correlationId}\x1b[0m]` : '';

    logFn(
      `[${entry.timestamp}] ${prefix} ${contextStr} ${corrIdStr} ${message}`,
    );

    if (entry.error) {
      console.error(
        `\x1b[31m${entry.error.stack || entry.error.message}\x1b[0m`,
      );
    }

    if (entry.data && Object.keys(entry.data).length > 0) {
      console.log('\x1b[90mMetadata:\x1b[0m', entry.data);
    }
  }

  /**
   * Notify about fatal errors
   */
  private notifyFatalError(entry: LogEntry): void {
    // In a production system, this would send alerts via email, SMS, etc.
    console.error('\x1b[41m\x1b[37m FATAL ERROR NOTIFICATION \x1b[0m');
    console.error(
      '\x1b[41m\x1b[37m This would trigger alerts in production \x1b[0m',
    );
    console.error('\x1b[41m\x1b[37m', entry.message, '\x1b[0m');
  }
}
