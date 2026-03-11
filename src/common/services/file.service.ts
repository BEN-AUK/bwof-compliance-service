import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { BucketService } from './bucket.service';

/**
 * Multer-style file input (Express.Multer.File compatible), avoids Express namespace.
 * Accepts Buffer or { buffer, mimetype?, originalname? }.
 */
export type FileUploadInput =
  | Buffer
  | {
      buffer: Buffer;
      mimetype?: string;
      originalname?: string;
    };

export interface NormalizedFileInput {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}

/** Result of resolving a storage path to a local file ready for upload. */
export interface ResolvedUploadSource {
  path: string;
  mimeType: string;
}

const EXT_TO_MIMETYPE: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  txt: 'text/plain',
  json: 'application/json',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
};

/**
 * Generic file input normalization and storage path resolution.
 * Reusable across modules (upload APIs, webhooks, queue processors, etc.).
 */
@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private readonly signedUrlExpirySeconds: number;

  constructor(
    private readonly bucket: BucketService,
    private readonly config: ConfigService,
  ) {
    this.signedUrlExpirySeconds =
      Number(this.config.get<string>('SIGNED_URL_EXPIRY_SECONDS')) || 300;
  }

  /**
   * Normalize Buffer or Multer-style object to a consistent shape for upload/storage.
   */
  normalizeFileInput(file: FileUploadInput): NormalizedFileInput {
    if (Buffer.isBuffer(file)) {
      return {
        buffer: file,
        mimeType: 'application/octet-stream',
        originalName: `upload-${Date.now()}`,
      };
    }
    return {
      buffer: file.buffer,
      mimeType: file.mimetype ?? 'application/octet-stream',
      originalName: file.originalname ?? `upload-${Date.now()}`,
    };
  }

  /**
   * Resolve a Storage path (bucket object key) to a local temp file path and mimeType.
   * Uses streaming download to avoid loading the full file into memory.
   * Caller is responsible for deleting the temp file after use.
   */
  async resolveToUploadSource(
    storagePath: string,
  ): Promise<ResolvedUploadSource> {
    const { signedUrl } = await this.bucket.createSignedUrl(
      storagePath,
      this.signedUrlExpirySeconds,
    );

    const ext = this.getExtension(storagePath);
    const mimeType = ext
      ? EXT_TO_MIMETYPE[ext.toLowerCase()] ?? 'application/octet-stream'
      : 'application/octet-stream';
    const tempPath = join(
      tmpdir(),
      `gemini-upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext ? `.${ext}` : ''}`,
    );

    try {
      const response = await fetch(signedUrl);
      if (!response.ok) {
        throw new InternalServerErrorException(
          `file.resolve_storage_fetch_failed: ${response.status} ${response.statusText}`,
        );
      }
      const body = response.body;
      if (!body) {
        throw new InternalServerErrorException(
          'file.resolve_storage_empty_response_body',
        );
      }
      const writable = createWriteStream(tempPath);
      await pipeline(
        Readable.fromWeb(body as import('stream/web').ReadableStream),
        writable,
      );
      this.logger.debug(`Streamed storage file to temp: ${tempPath}`);
      return { path: tempPath, mimeType };
    } catch (err) {
      try {
        await unlink(tempPath).catch(() => {});
      } catch {
        // ignore cleanup failure
      }
      throw err;
    }
  }

  private getExtension(storagePath: string): string {
    const base = storagePath.replace(/^.*[\\/]/, '');
    const idx = base.lastIndexOf('.');
    return idx > 0 ? base.slice(idx + 1) : '';
  }
}
