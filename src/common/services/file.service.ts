import { Injectable } from '@nestjs/common';

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

/**
 * Generic file input normalization: Buffer or Multer-style object → { buffer, mimeType, originalName }.
 * Reusable across modules (upload APIs, webhooks, etc.).
 */
@Injectable()
export class FileService {
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
}
