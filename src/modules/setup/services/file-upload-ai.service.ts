import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../../common/services/ai.service';
import { BucketService } from '../../../common/services/bucket.service';
import { FileService, type FileUploadInput } from '../../../common/services/file.service';
import { parseJsonWithSchema } from '../../../common/utils/parse-json-with-schema';
import { PDFParse } from 'pdf-parse';
import { PDFDocument } from 'pdf-lib';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';

// =============================================================================
// Indexer output: page ranges (0-based for pdf-lib)
// =============================================================================

/** [start, end] inclusive 0-based page range. Uses array (not tuple) so zodToJsonSchema produces items: object, which Gemini accepts. */
const PageRangeSchema = z
  .array(z.number().int().min(0))
  .length(2)
  .describe('[start, end]');

/** Indexer output: arrays of [start, end] ranges for metadata and SS details (0-based for pdf-lib) */
const DocumentIndexSchema = z.object({
  metadata_ranges: z
    .array(PageRangeSchema)
    .describe('Array of [start, end] ranges'),
  ss_ranges: z
    .array(PageRangeSchema)
    .describe('Array of [start, end] ranges'),
});

export type DocumentIndex = z.infer<typeof DocumentIndexSchema>;

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
   * For PDF: Indexer -> Slicer -> Extractor pipeline. For non-PDF: direct Extractor.
   * Does not upload; use together with upload() if you need storage.
   */
  async analyze(
    file: FileUploadInput,
    options?: { promptId?: string },
  ): Promise<BuildingCompliance> {
    const promptId = options?.promptId ?? 'documentAnalyzer';
    const { buffer, mimeType } = this.file.normalizeFileInput(file);
    const fileSizeBytes = buffer.length;
    const fileSizeKb = (fileSizeBytes / 1024).toFixed(2);
    this.logger.log(
      `Analyze started, file size: ${fileSizeBytes} bytes (${fileSizeKb} KB)`,
    );

    const isPdf = mimeType === 'application/pdf';

    if (!isPdf) {
      return this.runExtractor(buffer, mimeType, promptId);
    }

    this.logger.log('Indexer stage started');
    const index = await this.runIndexer(buffer, mimeType);
    this.logger.log(
      `Indexer stage completed: metadata_ranges=${index.metadata_ranges.length}, ss_ranges=${index.ss_ranges.length}`,
    );

    const pageIndicesFromRanges = this.collectPageIndicesFromRanges(index);
    if (pageIndicesFromRanges.size === 0) {
      throw new BadRequestException('file_upload_ai.indexer_empty_pages');
    }

    this.logger.log('Slicer stage started');
    const { buffer: slicedBuffer, pageCount } = await this.slicePdf(
      buffer,
      index,
    );
    this.logger.log(`Slicer stage completed: ${pageCount} pages`);

    this.logger.log('Extractor stage started');
    const result = await this.runExtractor(
      slicedBuffer,
      'application/pdf',
      promptId,
    );
    this.logger.log('Extractor stage completed');
    return result;
  }

  /**
   * Extract text from PDF with page markers for 0-based page indexing.
   * Output format: "--- PAGE 0 ---\n[text]\n--- PAGE 1 ---\n[text]..."
   * Used by the Indexer fast path (digital PDFs); scanned PDFs get little/no text.
   */
  private async extractTextWithPageMarkers(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const textResult = await parser.getText({ pageJoiner: '' });
      const parts = textResult.pages.map((p) => {
        const pageIndex = p.num - 1;
        return `--- PAGE ${pageIndex} ---\n${p.text}`;
      });
      return parts.join('\n');
    } finally {
      await parser.destroy();
    }
  }

  private async runIndexer(
    buffer: Buffer,
    mimeType: string,
  ): Promise<DocumentIndex> {
    const { prompt: systemPrompt, userInstruction } =
      await this.ai.getPromptAndUserInstructionById('documentIndexer');

    let extractedText: string;
    try {
      extractedText = await this.extractTextWithPageMarkers(buffer);
    } catch (err) {
      this.logger.error(
        `Indexer extractTextWithPageMarkers failed: ${String(err)}`,
        (err as Error)?.stack,
      );
      throw err;
    }

    const useTextPath = extractedText.length > 200;
    if (useTextPath) {
      this.logger.log('Indexer: text path (no vision)');
    } else {
      this.logger.log('Indexer: vision path (scanned/low text)');
    }

    const effectiveUserInstruction = useTextPath
      ? `${userInstruction}\n\n${extractedText}`
      : userInstruction;
    const extraParts = useTextPath
      ? undefined
      : [
          {
            inlineData: {
              mimeType: mimeType || 'application/octet-stream',
              data: buffer.toString('base64'),
            },
          },
        ];

    let raw: string;
    const indexerStartMs = Date.now();
    try {
      raw = await this.ai.generateContent({
        systemPrompt,
        userInstruction: effectiveUserInstruction,
        extraParts,
        model: this.geminiModel,
        timeoutMs: this.aiRequestTimeoutMs,
        responseMimeType: 'application/json',
        responseJsonSchema: zodToJsonSchema(DocumentIndexSchema, {
          target: 'openApi3',
          $refStrategy: 'none',
        }) as object,
      });
    } catch (err) {
      this.logger.error(
        `Indexer AI generateContent failed: ${String(err)}`,
        (err as Error)?.stack,
      );
      throw err;
    }
    const indexerElapsedMs = Date.now() - indexerStartMs;
    this.logger.log(`Indexer AI call completed in ${indexerElapsedMs} ms`);

    return parseJsonWithSchema<DocumentIndex>(
      raw,
      DocumentIndexSchema as z.ZodType<DocumentIndex>,
      'file_upload_ai.invalid_indexer_json',
    );
  }

  /**
   * From index ranges, collect every page index in [start, end] plus end+1 (buffer) per block.
   */
  private collectPageIndicesFromRanges(index: DocumentIndex): Set<number> {
    const pageIndicesSet = new Set<number>();
    const addRange = (ranges: readonly (readonly number[])[]) => {
      for (const [start, end] of ranges) {
        for (let i = start; i <= end; i++) {
          pageIndicesSet.add(i);
        }
        pageIndicesSet.add(end + 1);
      }
    };
    addRange(index.metadata_ranges);
    addRange(index.ss_ranges);
    return pageIndicesSet;
  }

  private async slicePdf(
    buffer: Buffer,
    index: DocumentIndex,
  ): Promise<{ buffer: Buffer; pageCount: number }> {
    const startMs = Date.now();

    const pageIndicesSet = this.collectPageIndicesFromRanges(index);

    const sourceDoc = await PDFDocument.load(buffer);
    const totalPages = sourceDoc.getPageCount();

    const pageIndices = [...pageIndicesSet]
      .filter((i) => i >= 0 && i < totalPages)
      .sort((a, b) => a - b);

    if (pageIndices.length === 0) {
      throw new BadRequestException('file_upload_ai.no_relevant_pages');
    }

    const targetDoc = await PDFDocument.create();
    const copiedPages = await targetDoc.copyPages(sourceDoc, pageIndices);
    for (const page of copiedPages) {
      targetDoc.addPage(page);
    }

    const resultBuffer = Buffer.from(await targetDoc.save());
    const elapsedMs = Date.now() - startMs;
    this.logger.log(`slicePdf completed in ${elapsedMs} ms (${pageIndices.length} pages)`);
    return { buffer: resultBuffer, pageCount: pageIndices.length };
  }

  private async runExtractor(
    buffer: Buffer,
    mimeType: string,
    promptId: string,
  ): Promise<BuildingCompliance> {
    const { prompt: systemPrompt, userInstruction } =
      await this.ai.getPromptAndUserInstructionById(promptId);

    let extractedText = '';
    if (mimeType === 'application/pdf') {
      try {
        extractedText = await this.extractTextWithPageMarkers(buffer);
      } catch (err) {
        this.logger.error(
          `Extractor extractTextWithPageMarkers failed: ${String(err)}`,
          (err as Error)?.stack,
        );
        throw err;
      }
    }

    const useTextPath = extractedText.length > 200;
    if (useTextPath) {
      this.logger.log('Extractor: text path (no vision)');
    } else {
      this.logger.log('Extractor: vision path (scanned)');
    }

    const effectiveUserInstruction = useTextPath
      ? `${userInstruction}\n\n${extractedText}`
      : userInstruction;
    const extraParts = useTextPath
      ? undefined
      : [
          {
            inlineData: {
              mimeType: mimeType || 'application/octet-stream',
              data: buffer.toString('base64'),
            },
          },
        ];

    let raw: string;
    const extractorStartMs = Date.now();
    try {
      raw = await this.ai.generateContent({
        systemPrompt,
        userInstruction: effectiveUserInstruction,
        extraParts,
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
        `Extractor AI generateContent failed: ${String(err)}`,
        (err as Error)?.stack,
      );
      throw err;
    }
    const extractorElapsedMs = Date.now() - extractorStartMs;
    this.logger.log(
      `Extractor AI call completed in ${extractorElapsedMs} ms (input size: ${buffer.length} bytes)`,
    );

    this.logger.log(`raw response: ${raw}`);

    return parseJsonWithSchema<BuildingCompliance>(
      raw,
      BuildingComplianceSchema as z.ZodType<BuildingCompliance>,
      'file_upload_ai.invalid_ai_json',
    );
  }
}
