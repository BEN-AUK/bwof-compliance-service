import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../../common/services/ai.service';
import { BucketService } from '../../../common/services/bucket.service';
import { FileService, type FileUploadInput } from '../../../common/services/file.service';
import { parseJsonWithSchema } from '../../../common/utils/parse-json-with-schema';
import { z } from 'zod';

// =============================================================================
// Interface definitions (Interface-First) — AI response JSON schema, no any
// =============================================================================

/**
 * Strict type for AI document/image analysis result.
 * Matches response_format / responseMimeType: application/json output.
 */
export interface IFileAnalyzeResult {
  /** Document/image type, e.g. "bwof_certificate" | "inspection_report" | "unknown" */
  documentType: string;
  /** Brief summary (1-3 sentences) */
  summary: string;
  /** Confidence score, range [0, 1] */
  confidenceScore: number;
  /** Optional extracted key-value pairs */
  extractedFields?: Record<string, string>;
}

/** Zod schema for AI document/image analysis JSON; used with parseJsonWithSchema. */
const FileAnalyzeResultSchema = z.object({
  documentType: z.string().default('unknown'),
  summary: z.string().default(''),
  confidenceScore: z.number().min(0).max(1).default(0),
  extractedFields: z.record(z.string()).optional(),
});

/** Returned when upload and analyze succeeds: storage path + analysis */
export interface IUploadAndAnalyzeResult {
  storagePath: string;
  signedUrlExpiresAt: number;
  analysis: IFileAnalyzeResult;
}

/** Re-export for callers that use this module as entry point for upload types */
export type { FileUploadInput } from '../../../common/services/file.service';

// =============================================================================
// File Upload + AI Parse Common Service
// =============================================================================

/**
 * Handles file upload to Supabase Storage and AI parsing.
 * - Uploads to private bucket, generates short-lived Signed URL.
 * - Uses Gemini; prompts loaded from config file (path configurable).
 * - On AI failure or timeout: deletes uploaded file to avoid orphans.
 */
@Injectable()
export class FileUploadAiService {
  private readonly logger = new Logger(FileUploadAiService.name);

  /** AI request timeout (ms), from env AI_REQUEST_TIMEOUT_MS (default 30000) */
  private readonly aiRequestTimeoutMs: number;
  /** Signed URL expiry (seconds), from env SIGNED_URL_EXPIRY_SECONDS (default 300) */
  private readonly signedUrlExpirySeconds: number;
  /** Gemini model ID, from env GEMINI_MODEL (default gemini-2.0-flash) */
  private readonly geminiModel: string;

  constructor(
    private readonly ai: AiService,
    private readonly bucket: BucketService,
    private readonly file: FileService,
    private readonly config: ConfigService,
  ) {
    this.aiRequestTimeoutMs =
      Number(this.config.get<string>('AI_REQUEST_TIMEOUT_MS')) || 30_000;
    this.signedUrlExpirySeconds =
      Number(this.config.get<string>('SIGNED_URL_EXPIRY_SECONDS')) || 300;
    this.geminiModel =
      this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
  }

  /**
   * Main entry: accepts Buffer or Multer-style file, uploads to private bucket,
   * generates Signed URL, runs Gemini parse (prompt by promptId from YAML), returns analysis.
   * Deletes uploaded file on failure.
   */
  async uploadAndAnalyze(
    file: FileUploadInput,
    options?: {
      /** Storage path prefix, e.g. "temp/{userId}", unique filename appended */
      pathPrefix?: string;
      /** Prompt ID, key in config/prompts.yaml, e.g. "documentAnalyzer" */
      promptId?: string;
    },
  ): Promise<IUploadAndAnalyzeResult> {
    const pathPrefix = options?.pathPrefix ?? 'temp';
    const promptId = options?.promptId ?? 'documentAnalyzer';
    const { prompt: systemPrompt, userInstruction } =
      await this.ai.getPromptAndUserInstructionById(promptId);
    const { buffer, mimeType, originalName } = this.file.normalizeFileInput(file);
    const storagePath = this.bucket.buildUniquePath(pathPrefix, originalName);

    let uploadSucceeded = false;
    try {
      // 1) Upload to private bucket
      await this.bucket.upload(storagePath, buffer, { contentType: mimeType });
      uploadSucceeded = true;
      this.logger.log(`Uploaded: ${storagePath}`);

      // 2) Generate short-lived Signed URL (bucket must be private)
      await this.bucket.createSignedUrl(storagePath, this.signedUrlExpirySeconds);
      const expiresAt = Date.now() + this.signedUrlExpirySeconds * 1000;

      // 3) Call Gemini parse (with timeout), force JSON output; pass buffer to avoid AI fetching URL
      const analysis = await this.analyzeWithGemini(
        buffer,
        mimeType,
        systemPrompt,
        userInstruction,
      );

      return {
        storagePath,
        signedUrlExpiresAt: expiresAt,
        analysis,
      };
    } catch (err) {
      this.logger.error(
        `uploadAndAnalyze failed: ${String(err)}`,
        (err as Error)?.stack,
      );
      if (uploadSucceeded) {
        try {
          await this.bucket.remove(storagePath);
          this.logger.log(`Cleaned up orphan file: ${storagePath}`);
        } catch (e) {
          this.logger.warn(
            `Failed to cleanup storage path ${storagePath}: ${String(e)}`,
          );
        }
      }
      throw err;
    }
  }

  /**
   * Call Gemini Vision with inlineData (base64), force JSON output, with timeout and parse.
   */
  private async analyzeWithGemini(
    buffer: Buffer,
    mimeType: string,
    systemPrompt: string,
    userInstruction: string,
  ): Promise<IFileAnalyzeResult> {
    const raw = await this.ai.generateContent({
      systemPrompt,
      userInstruction,
      extraParts: [
        {
          inlineData: {
            mimeType: mimeType || 'application/octet-stream',
            data: buffer.toString('base64'),
          },
        },
      ],
      model: this.geminiModel,
      timeoutMs: this.aiRequestTimeoutMs,
      responseMimeType: 'application/json',
    });

    return parseJsonWithSchema<IFileAnalyzeResult>(
      raw,
      FileAnalyzeResultSchema as z.ZodType<IFileAnalyzeResult>,
      'file_upload_ai.invalid_ai_json',
    );
  }

}
