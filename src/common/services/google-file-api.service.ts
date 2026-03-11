import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';

/** Result of uploading a file to Gemini Files API; use name/uri in generateContent. */
export interface GeminiFileResult {
  name: string;
  mimeType: string;
}

/**
 * Uploads a local file to Google Gemini Files API (streaming from disk).
 * Common capability for any module that needs to send files to Gemini.
 */
@Injectable()
export class GoogleFileApiService {
  private readonly logger = new Logger(GoogleFileApiService.name);

  constructor(private readonly ai: AiService) {}

  /**
   * Upload a file by local path. SDK reads from disk in a streaming fashion.
   * @param filePath - Absolute or relative path to the file on disk
   * @param mimeType - MIME type (e.g. application/pdf)
   */
  async upload(params: {
    filePath: string;
    mimeType: string;
    displayName?: string;
  }): Promise<GeminiFileResult> {
    const { filePath, mimeType } = params;
    const gemini = this.ai.getGemini();
    const file = await gemini.files.upload({
      file: filePath,
      config: { mimeType },
    });
    this.logger.log(`Uploaded to Gemini Files: ${file.name}`);
    return {
      name: file.name ?? '',
      mimeType: file.mimeType ?? mimeType,
    };
  }
}
