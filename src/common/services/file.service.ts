import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InfraService } from './infra.service';

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
  private readonly storageBucket: string;

  constructor(
    private readonly infra: InfraService,
    private readonly config: ConfigService,
  ) {
    this.storageBucket =
      this.config.get<string>('STORAGE_BUCKET') ?? 'documents';
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
   * Uses Supabase Storage SDK direct download (no signed URL + fetch).
   */
  async resolveToBuffer(storagePath: string): Promise<ResolvedBufferSource> {
    const supabase = this.infra.getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(this.storageBucket)
      .download(storagePath);

    if (error) {
      this.logger.warn(`Storage download failed: ${error.message}`, error);
      throw new InternalServerErrorException(
        `file.resolve_storage_download_failed: ${error.message}`,
      );
    }
    if (data == null) {
      throw new InternalServerErrorException(
        'file.resolve_storage_empty_response',
      );
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      throw new InternalServerErrorException(
        'file.resolve_storage_empty_file',
      );
    }

    const mimeType =
      (data.type?.trim().length ?? 0) > 0
        ? (data.type as string)
        : this.getMimeTypeFromExtension(storagePath);
    this.logger.debug(`mine type: ${mimeType} bytes`);
    this.logger.debug(`Resolved storage file to buffer: ${buffer.length} bytes`);
    return { buffer, mimeType };
  }

  private getMimeTypeFromExtension(storagePath: string): string {
    const ext = this.getExtension(storagePath);
    return ext
      ? EXT_TO_MIMETYPE[ext.toLowerCase()] ?? 'application/octet-stream'
      : 'application/octet-stream';
  }

  private getExtension(storagePath: string): string {
    const base = storagePath.replace(/^.*[\\/]/, '');
    const idx = base.lastIndexOf('.');
    return idx > 0 ? base.slice(idx + 1) : '';
  }
}
