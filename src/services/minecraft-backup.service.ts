import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MinecraftServerService } from './minecraft-server.service';
import { UserManagementService } from './user-management.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import archiver from 'archiver';
import extract from 'extract-zip';
import { createReadStream, createWriteStream } from 'fs';

interface BackupConfig {
  userId: string;
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  retentionDays: number;
  includePlugins: boolean;
  includeLogs: boolean;
  compression: 'zip' | 'tar.gz';
  maxBackupSize: number; // in MB
}

interface BackupInfo {
  id: string;
  userId: string;
  filename: string;
  size: number;
  createdAt: Date;
  type: 'manual' | 'automatic';
  status: 'creating' | 'completed' | 'failed';
  error?: string;
}

@Injectable()
export class MinecraftBackupService {
  private readonly logger = new Logger(MinecraftBackupService.name);
  private readonly backupConfigs = new Map<string, BackupConfig>();
  private readonly activeBackups = new Map<string, BackupInfo>();
  private readonly backupHistory = new Map<string, BackupInfo[]>();

  constructor(
    private readonly minecraftServerService: MinecraftServerService,
    private readonly userManagementService: UserManagementService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeDefaultConfigs();
  }

  private async initializeDefaultConfigs(): Promise<void> {
    try {
      const userResult = await this.userManagementService.getUsers();
      const users = userResult.users || [];
      for (const user of users) {
        if (user.hasMinecraftServer) {
          this.backupConfigs.set(user.id, {
            userId: user.id,
            enabled: true,
            frequency: 'daily',
            retentionDays: 7,
            includePlugins: true,
            includeLogs: false,
            compression: 'zip',
            maxBackupSize: 1000, // 1GB
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to initialize backup configs:', error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async performScheduledBackups(): Promise<void> {
    try {
      for (const [userId, config] of this.backupConfigs.entries()) {
        if (!config.enabled) continue;

        const shouldBackup = await this.shouldPerformBackup(userId, config);
        if (shouldBackup) {
          await this.createBackup(userId, 'automatic');
        }
      }
    } catch (error) {
      this.logger.error('Error during scheduled backups:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldBackups(): Promise<void> {
    try {
      for (const [userId, config] of this.backupConfigs.entries()) {
        await this.cleanupUserBackups(userId, config.retentionDays);
      }
    } catch (error) {
      this.logger.error('Error during backup cleanup:', error);
    }
  }

  async createBackup(
    userId: string,
    type: 'manual' | 'automatic' = 'manual',
  ): Promise<string> {
    if (this.activeBackups.has(userId)) {
      throw new Error('Backup already in progress for this user');
    }

    const config = this.backupConfigs.get(userId);
    if (!config) {
      throw new Error('Backup configuration not found for user');
    }

    const backupId = `backup-${userId}-${Date.now()}`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `minecraft-server-${userId}-${timestamp}.${config.compression}`;

    const backupInfo: BackupInfo = {
      id: backupId,
      userId,
      filename,
      size: 0,
      createdAt: new Date(),
      type,
      status: 'creating',
    };

    this.activeBackups.set(userId, backupInfo);

    try {
      this.logger.log(`Starting ${type} backup for user ${userId}`);

      // Notify about backup start
      await this.eventEmitter.emitAsync('backup.started', {
        userId,
        backupId,
        type,
      });

      // Create backup directory if it doesn't exist
      const backupDir = await this.ensureBackupDirectory(userId);
      const backupPath = path.join(backupDir, filename);

      // Create the backup
      await this.createBackupArchive(userId, backupPath, config);

      // Update backup info
      const stats = await fs.stat(backupPath);
      backupInfo.size = stats.size;
      backupInfo.status = 'completed';

      // Add to history
      this.addToBackupHistory(userId, backupInfo);

      this.logger.log(
        `Backup completed for user ${userId}: ${filename} (${this.formatFileSize(backupInfo.size)})`,
      );

      // Notify about backup completion
      await this.eventEmitter.emitAsync('backup.completed', {
        userId,
        backupId,
        filename,
        size: backupInfo.size,
        type,
      });

      return backupId;
    } catch (error) {
      this.logger.error(`Backup failed for user ${userId}:`, error);

      backupInfo.status = 'failed';
      backupInfo.error = error.message;

      await this.eventEmitter.emitAsync('backup.failed', {
        userId,
        backupId,
        error: error.message,
        type,
      });

      throw error;
    } finally {
      this.activeBackups.delete(userId);
    }
  }

  async restoreBackup(userId: string, backupId: string): Promise<void> {
    const backupHistory = this.backupHistory.get(userId) || [];
    const backup = backupHistory.find((b) => b.id === backupId);

    if (!backup) {
      throw new Error('Backup not found');
    }

    if (backup.status !== 'completed') {
      throw new Error('Cannot restore incomplete backup');
    }

    try {
      this.logger.log(
        `Starting restore for user ${userId} from backup ${backupId}`,
      );

      // Stop the server first
      await this.minecraftServerService.stopServer(userId);

      // Notify about restore start
      await this.eventEmitter.emitAsync('restore.started', {
        userId,
        backupId,
      });

      const serverDir = path.join(
        process.cwd(),
        'data',
        'minecraft-servers',
        userId,
      );
      const backupDir = path.join(serverDir, 'backups');
      const backupPath = path.join(backupDir, backup.filename);

      // Create a temporary restore directory
      const tempRestoreDir = path.join(serverDir, 'temp_restore');
      await fs.mkdir(tempRestoreDir, { recursive: true });

      try {
        // Extract backup
        await this.extractBackup(backupPath, tempRestoreDir);

        // Backup current server data (just in case)
        const rollbackDir = path.join(serverDir, 'rollback');
        await fs.mkdir(rollbackDir, { recursive: true });

        const currentFiles = ['world', 'server.properties', 'plugins'];
        for (const file of currentFiles) {
          const sourcePath = path.join(serverDir, file);
          const targetPath = path.join(rollbackDir, file);

          try {
            await fs.access(sourcePath);
            await this.copyRecursive(sourcePath, targetPath);
          } catch (error) {
            // File doesn't exist, skip
          }
        }

        // Restore files from backup
        const restoreFiles = await fs.readdir(tempRestoreDir);
        for (const file of restoreFiles) {
          const sourcePath = path.join(tempRestoreDir, file);
          const targetPath = path.join(serverDir, file);

          // Remove existing file/directory
          try {
            await fs.rm(targetPath, { recursive: true, force: true });
          } catch (error) {
            // File doesn't exist, continue
          }

          // Copy from restore
          await this.copyRecursive(sourcePath, targetPath);
        }

        this.logger.log(`Restore completed for user ${userId}`);

        // Start the server
        await this.minecraftServerService.startServer(userId);

        // Notify about restore completion
        await this.eventEmitter.emitAsync('restore.completed', {
          userId,
          backupId,
        });
      } finally {
        // Cleanup temporary directory
        await fs.rm(tempRestoreDir, { recursive: true, force: true });
      }
    } catch (error) {
      this.logger.error(`Restore failed for user ${userId}:`, error);

      await this.eventEmitter.emitAsync('restore.failed', {
        userId,
        backupId,
        error: error.message,
      });

      throw error;
    }
  }

  async getBackupConfig(userId: string): Promise<BackupConfig | null> {
    return this.backupConfigs.get(userId) || null;
  }

  async updateBackupConfig(
    userId: string,
    config: Partial<BackupConfig>,
  ): Promise<void> {
    const currentConfig = this.backupConfigs.get(userId) || {
      userId,
      enabled: true,
      frequency: 'daily',
      retentionDays: 7,
      includePlugins: true,
      includeLogs: false,
      compression: 'zip',
      maxBackupSize: 1000,
    };

    const newConfig = { ...currentConfig, ...config };
    this.backupConfigs.set(userId, newConfig);

    // Save to persistent storage (you might want to implement this)
    await this.saveBackupConfig(userId, newConfig);

    this.logger.log(`Backup configuration updated for user ${userId}`);
  }

  async getBackupHistory(userId: string): Promise<BackupInfo[]> {
    return this.backupHistory.get(userId) || [];
  }

  async deleteBackup(userId: string, backupId: string): Promise<void> {
    const backupHistory = this.backupHistory.get(userId) || [];
    const backupIndex = backupHistory.findIndex((b) => b.id === backupId);

    if (backupIndex === -1) {
      throw new Error('Backup not found');
    }

    const backup = backupHistory[backupIndex];
    const backupDir = path.join(
      process.cwd(),
      'data',
      'minecraft-servers',
      userId,
      'backups',
    );
    const backupPath = path.join(backupDir, backup.filename);

    try {
      await fs.unlink(backupPath);
      backupHistory.splice(backupIndex, 1);
      this.backupHistory.set(userId, backupHistory);

      this.logger.log(`Deleted backup ${backupId} for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to delete backup ${backupId}:`, error);
      throw error;
    }
  }

  async getBackupStatus(userId: string): Promise<BackupInfo | null> {
    return this.activeBackups.get(userId) || null;
  }

  private async shouldPerformBackup(
    userId: string,
    config: BackupConfig,
  ): Promise<boolean> {
    const history = this.backupHistory.get(userId) || [];
    const lastBackup = history
      .filter((b) => b.status === 'completed')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (!lastBackup) return true;

    const now = new Date();
    const lastBackupTime = lastBackup.createdAt;
    const timeDiff = now.getTime() - lastBackupTime.getTime();

    switch (config.frequency) {
      case 'hourly':
        return timeDiff >= 60 * 60 * 1000; // 1 hour
      case 'daily':
        return timeDiff >= 24 * 60 * 60 * 1000; // 24 hours
      case 'weekly':
        return timeDiff >= 7 * 24 * 60 * 60 * 1000; // 7 days
      case 'monthly':
        return timeDiff >= 30 * 24 * 60 * 60 * 1000; // 30 days
      default:
        return false;
    }
  }

  private async ensureBackupDirectory(userId: string): Promise<string> {
    const backupDir = path.join(
      process.cwd(),
      'data',
      'minecraft-servers',
      userId,
      'backups',
    );
    await fs.mkdir(backupDir, { recursive: true });
    return backupDir;
  }

  private async createBackupArchive(
    userId: string,
    backupPath: string,
    config: BackupConfig,
  ): Promise<void> {
    const serverDir = path.join(
      process.cwd(),
      'data',
      'minecraft-servers',
      userId,
    );

    return new Promise((resolve, reject) => {
      const output = createWriteStream(backupPath);
      const archive = archiver(config.compression === 'zip' ? 'zip' : 'tar', {
        zlib: { level: 9 }, // Maximum compression
        gzip: config.compression === 'tar.gz',
      });

      output.on('close', () => {
        this.logger.debug(
          `Backup archive created: ${archive.pointer()} total bytes`,
        );
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // Add world data (essential)
      const worldPath = path.join(serverDir, 'world');
      archive.directory(worldPath, 'world');

      // Add server properties
      archive.file(path.join(serverDir, 'server.properties'), {
        name: 'server.properties',
      });

      // Add plugins if configured
      if (config.includePlugins) {
        const pluginsPath = path.join(serverDir, 'plugins');
        archive.directory(pluginsPath, 'plugins');
      }

      // Add logs if configured
      if (config.includeLogs) {
        const logsPath = path.join(serverDir, 'logs');
        archive.directory(logsPath, 'logs');
      }

      // Add other important files
      const additionalFiles = [
        'whitelist.json',
        'ops.json',
        'banned-players.json',
        'banned-ips.json',
      ];
      for (const file of additionalFiles) {
        const filePath = path.join(serverDir, file);
        try {
          archive.file(filePath, { name: file });
        } catch (error) {
          // File might not exist, continue
        }
      }

      archive.finalize();
    });
  }

  private async extractBackup(
    backupPath: string,
    extractPath: string,
  ): Promise<void> {
    try {
      await extract(backupPath, { dir: extractPath });
    } catch (error) {
      this.logger.error(`Failed to extract backup:`, error);
      throw error;
    }
  }

  private async copyRecursive(source: string, target: string): Promise<void> {
    const stats = await fs.stat(source);

    if (stats.isDirectory()) {
      await fs.mkdir(target, { recursive: true });
      const files = await fs.readdir(source);

      for (const file of files) {
        const sourcePath = path.join(source, file);
        const targetPath = path.join(target, file);
        await this.copyRecursive(sourcePath, targetPath);
      }
    } else {
      await fs.copyFile(source, target);
    }
  }

  private async cleanupUserBackups(
    userId: string,
    retentionDays: number,
  ): Promise<void> {
    const cutoffDate = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    );
    const history = this.backupHistory.get(userId) || [];

    const backupsToDelete = history.filter(
      (backup) =>
        backup.createdAt < cutoffDate && backup.status === 'completed',
    );

    for (const backup of backupsToDelete) {
      try {
        await this.deleteBackup(userId, backup.id);
      } catch (error) {
        this.logger.error(`Failed to cleanup backup ${backup.id}:`, error);
      }
    }

    if (backupsToDelete.length > 0) {
      this.logger.log(
        `Cleaned up ${backupsToDelete.length} old backups for user ${userId}`,
      );
    }
  }

  private addToBackupHistory(userId: string, backup: BackupInfo): void {
    const history = this.backupHistory.get(userId) || [];
    history.push(backup);

    // Keep only the last 100 backups in memory
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }

    this.backupHistory.set(userId, history);
  }

  private async saveBackupConfig(
    userId: string,
    config: BackupConfig,
  ): Promise<void> {
    // Implementation for saving to persistent storage
    // This could be a database, file, etc.
    const configPath = path.join(
      process.cwd(),
      'data',
      'backup-configs',
      `${userId}.json`,
    );
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  }

  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
