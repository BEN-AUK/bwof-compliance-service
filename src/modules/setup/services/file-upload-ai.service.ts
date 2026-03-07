import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../../common/services/ai.service';
import { BucketService } from '../../../common/services/bucket.service';
import { FileService, type FileUploadInput } from '../../../common/services/file.service';
import { parseJsonWithSchema } from '../../../common/utils/parse-json-with-schema';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';

// =============================================================================
// AI response JSON: single source of truth — Zod schema, type inferred
// =============================================================================

/** 检查计划：用于生成证据链空格 (Compliance Slots) */
const InspectionRequirementSchema = z.object({
  frequency: z.enum([
    'Daily',
    'Weekly',
    'Monthly',
    '3 Monthly',
    '6 Monthly',
    'Annually',
  ]),
  inspector_role: z.enum(['Owner', 'IQP', 'Agent']),
});

/** 特定系统清单：核心校验数组 */
const SpecifiedSystemSchema = z.object({
  ss_code: z.string(),
  system_name: z.string(),
  compliance_baseline: z.object({
    performance_standards: z.array(z.string()),
    extent: z.string(),
  }),
  inspection_schedules: z.array(InspectionRequirementSchema),
});

/** Zod schema for AI document/image analysis JSON; used with parseJsonWithSchema. */
const BuildingComplianceSchema = z.object({
  building_metadata: z.object({
    building_name: z.string(),
    address: z.string(),
    cs_number: z.string(),
    issue_date: z.string(),
    council_name: z.string(),
  }),
  specified_systems: z.array(SpecifiedSystemSchema),
});

/** Inferred type (single source of truth). */
export type BuildingCompliance = z.infer<typeof BuildingComplianceSchema>;

/** Returned when upload and analyze succeeds: storage path + analysis */
export type IUploadAndAnalyzeResult = {
  storagePath: string;
  analysis: BuildingCompliance;
};

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
      this.config.get<string>('GEMINI_MODEL') ?? 'gemini-2.5-flash';
  }

  /**
   * Upload file to private bucket. Returns the storage path.
   */
  async upload(
    file: FileUploadInput,
    options?: { pathPrefix?: string },
  ): Promise<{ storagePath: string }> {
    try {
      const pathPrefix = options?.pathPrefix ?? 'temp';
      const { buffer, mimeType, originalName } = this.file.normalizeFileInput(file);
      const storagePath = this.bucket.buildUniquePath(pathPrefix, originalName);
      await this.bucket.upload(storagePath, buffer, { contentType: mimeType });
      this.logger.log(`Uploaded: ${storagePath}`);
      return { storagePath };
    } catch (err) {
      this.logger.error(
        `upload failed: ${String(err)}`,
        (err as Error)?.stack,
      );
      throw err;
    }
  }

  /**
   * Run AI analysis on file (Gemini Vision, prompt by promptId from YAML).
   * Does not upload; use together with upload() if you need storage.
   */
  async analyze(
    file: FileUploadInput,
    options?: { promptId?: string },
  ): Promise<BuildingCompliance> {
    const promptId = options?.promptId ?? 'documentAnalyzer';
    const { prompt: systemPrompt, userInstruction } =
      await this.ai.getPromptAndUserInstructionById(promptId);
    const { buffer, mimeType } = this.file.normalizeFileInput(file);

    let raw: string;
    try {
      raw = await this.ai.generateContent({
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
        responseJsonSchema: zodToJsonSchema(BuildingComplianceSchema, {
          target: 'openApi3',
          $refStrategy: 'none',
        }) as object,
      });
    } catch (err) {
      this.logger.error(
        `AI generateContent failed: ${String(err)}`,
        (err as Error)?.stack,
      );
      throw err;
    }

    this.logger.log(`raw response: ${raw}`);

    return parseJsonWithSchema<BuildingCompliance>(
      raw,
      BuildingComplianceSchema as z.ZodType<BuildingCompliance>,
      'file_upload_ai.invalid_ai_json',
    );
  }
}
