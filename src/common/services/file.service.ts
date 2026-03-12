import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

/** Result of resolving a storage path to an in-memory buffer. */
export interface ResolvedBufferSource {
  buffer: Buffer;
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
   * Resolve a Storage path (bucket object key) to an in-memory buffer and mimeType.
   * Downloads via signed URL and collects the response body into a Buffer.
   */
  async resolveToBuffer(storagePath: string): Promise<ResolvedBufferSource> {
    const { signedUrl } = await this.bucket.createSignedUrl(
      storagePath,
      this.signedUrlExpirySeconds,
    );

    const ext = this.getExtension(storagePath);
    const mimeType = ext
      ? EXT_TO_MIMETYPE[ext.toLowerCase()] ?? 'application/octet-stream'
      : 'application/octet-stream';

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

    const chunks: Buffer[] = [];
    const readable = Readable.fromWeb(body as import('stream/web').ReadableStream);
    for await (const chunk of readable) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    this.logger.debug(`Resolved storage file to buffer: ${buffer.length} bytes`);
    return { buffer, mimeType };
  }

  private getExtension(storagePath: string): string {
    const base = storagePath.replace(/^.*[\\/]/, '');
    const idx = base.lastIndexOf('.');
    return idx > 0 ? base.slice(idx + 1) : '';
  }
}
