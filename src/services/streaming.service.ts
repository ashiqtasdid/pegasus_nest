import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import * as zlib from 'zlib';

export interface StreamOptions {
  enableCompression?: boolean;
  chunkSize?: number;
  enableCaching?: boolean;
  cacheMaxAge?: number;
}

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);
  private readonly DEFAULT_CHUNK_SIZE = 64 * 1024; // 64KB chunks
  private readonly DEFAULT_CACHE_MAX_AGE = 3600; // 1 hour

  /**
   * Stream a file to the response with compression and caching support
   */
  async streamFile(
    filePath: string,
    response: Response,
    fileName?: string,
    options: StreamOptions = {},
  ): Promise<void> {
    try {
      // Validate file exists and get stats
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const stats = fs.statSync(filePath);
      const {
        enableCompression = true,
        chunkSize = this.DEFAULT_CHUNK_SIZE,
        enableCaching = true,
        cacheMaxAge = this.DEFAULT_CACHE_MAX_AGE,
      } = options;

      // Set basic headers
      const finalFileName = fileName || path.basename(filePath);
      const mimeType = this.getMimeType(filePath);

      response.setHeader('Content-Type', mimeType);
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="${finalFileName}"`,
      );

      // Set caching headers if enabled
      if (enableCaching) {
        response.setHeader('Cache-Control', `public, max-age=${cacheMaxAge}`);
        response.setHeader('ETag', `"${stats.mtime.getTime()}-${stats.size}"`);
        response.setHeader('Last-Modified', stats.mtime.toUTCString());
      }

      // Handle range requests for large files
      const range = response.req.headers.range;
      if (range && stats.size > chunkSize * 10) {
        await this.handleRangeRequest(filePath, response, range, stats);
        return;
      }

      // Create read stream
      const readStream = createReadStream(filePath, {
        highWaterMark: chunkSize,
      });

      // Apply compression if supported and enabled
      if (
        enableCompression &&
        this.supportsCompression(response.req.headers['accept-encoding'])
      ) {
        const compression = this.getBestCompression(
          response.req.headers['accept-encoding'],
        );
        if (compression) {
          response.setHeader('Content-Encoding', compression.encoding);
          await pipeline(readStream, compression.stream, response);
          this.logger.log(
            `Streamed compressed file: ${finalFileName} (${compression.encoding})`,
          );
          return;
        }
      }

      // Stream without compression
      response.setHeader('Content-Length', stats.size.toString());
      await pipeline(readStream, response);

      this.logger.log(
        `Streamed file: ${finalFileName} (${this.formatBytes(stats.size)})`,
      );
    } catch (error) {
      this.logger.error(`Error streaming file ${filePath}:`, error);
      if (!response.headersSent) {
        response.status(500).json({
          error: 'File streaming failed',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Handle HTTP range requests for large file downloads
   */
  private async handleRangeRequest(
    filePath: string,
    response: Response,
    range: string,
    stats: fs.Stats,
  ): Promise<void> {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;

    if (start >= stats.size || end >= stats.size) {
      response.status(416).setHeader('Content-Range', `bytes */${stats.size}`);
      return;
    }

    const chunkSize = end - start + 1;
    const readStream = createReadStream(filePath, { start, end });

    response.status(206);
    response.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Length', chunkSize.toString());

    await pipeline(readStream, response);

    this.logger.debug(
      `Streamed partial content: ${start}-${end}/${stats.size}`,
    );
  }

  /**
   * Stream multiple files as a compressed archive
   */
  async streamArchive(
    files: { path: string; name: string }[],
    response: Response,
    archiveName: string = 'archive.tar.gz',
  ): Promise<void> {
    try {
      const { Readable } = require('stream');
      const tar = require('tar-stream');

      const pack = tar.pack();
      const gzipStream = zlib.createGzip({ level: 6 });

      // Set response headers
      response.setHeader('Content-Type', 'application/gzip');
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="${archiveName}"`,
      );
      response.setHeader('Content-Encoding', 'gzip');

      // Add files to archive
      for (const file of files) {
        if (fs.existsSync(file.path)) {
          const stats = fs.statSync(file.path);
          const readStream = createReadStream(file.path);

          pack.entry({ name: file.name, size: stats.size }, readStream);
        } else {
          this.logger.warn(`File not found for archive: ${file.path}`);
        }
      }

      pack.finalize();

      // Stream the compressed archive
      await pipeline(pack, gzipStream, response);

      this.logger.log(
        `Streamed archive: ${archiveName} with ${files.length} files`,
      );
    } catch (error) {
      this.logger.error(`Error streaming archive:`, error);
      if (!response.headersSent) {
        response.status(500).json({
          error: 'Archive streaming failed',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Stream JSON data with optional compression
   */
  async streamJSON(
    data: any,
    response: Response,
    fileName?: string,
    compress: boolean = true,
  ): Promise<void> {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const { Readable } = require('stream');

      // Create readable stream from JSON
      const jsonStream = Readable.from(jsonString);

      // Set headers
      response.setHeader('Content-Type', 'application/json');
      if (fileName) {
        response.setHeader(
          'Content-Disposition',
          `attachment; filename="${fileName}"`,
        );
      }

      // Compress if requested and supported
      if (
        compress &&
        this.supportsCompression(response.req.headers['accept-encoding'])
      ) {
        const compression = this.getBestCompression(
          response.req.headers['accept-encoding'],
        );
        if (compression) {
          response.setHeader('Content-Encoding', compression.encoding);
          await pipeline(jsonStream, compression.stream, response);
          return;
        }
      }

      // Stream without compression
      response.setHeader(
        'Content-Length',
        Buffer.byteLength(jsonString).toString(),
      );
      await pipeline(jsonStream, response);
    } catch (error) {
      this.logger.error(`Error streaming JSON:`, error);
      if (!response.headersSent) {
        response.status(500).json({
          error: 'JSON streaming failed',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Get MIME type for file extension
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.jar': 'application/java-archive',
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.log': 'text/plain',
      '.xml': 'application/xml',
      '.yml': 'text/yaml',
      '.yaml': 'text/yaml',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Check if client supports compression
   */
  private supportsCompression(acceptEncoding: string | undefined): boolean {
    if (!acceptEncoding) return false;
    return (
      acceptEncoding.includes('gzip') ||
      acceptEncoding.includes('deflate') ||
      acceptEncoding.includes('br')
    );
  }

  /**
   * Get best compression method based on client support
   */
  private getBestCompression(
    acceptEncoding: string | undefined,
  ): { encoding: string; stream: any } | null {
    if (!acceptEncoding) return null;

    // Prefer brotli, then gzip, then deflate
    if (acceptEncoding.includes('br')) {
      return {
        encoding: 'br',
        stream: zlib.createBrotliCompress({
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 6,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: 1024 * 1024,
          },
        }),
      };
    }

    if (acceptEncoding.includes('gzip')) {
      return {
        encoding: 'gzip',
        stream: zlib.createGzip({ level: 6 }),
      };
    }

    if (acceptEncoding.includes('deflate')) {
      return {
        encoding: 'deflate',
        stream: zlib.createDeflate({ level: 6 }),
      };
    }

    return null;
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Get streaming statistics
   */
  getStreamingStats(): any {
    // This could be enhanced to track actual streaming metrics
    return {
      timestamp: new Date().toISOString(),
      defaultChunkSize: this.formatBytes(this.DEFAULT_CHUNK_SIZE),
      defaultCacheMaxAge: this.DEFAULT_CACHE_MAX_AGE,
      supportedCompressions: ['gzip', 'deflate', 'brotli'],
      supportedMimeTypes: [
        'application/java-archive',
        'application/zip',
        'application/gzip',
        'application/json',
        'text/plain',
      ],
    };
  }
}
