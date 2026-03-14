import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { LogExecutionTime } from '../../../common/decorators';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../../common/services/ai.service';
import { BucketService } from '../../../common/services/bucket.service';
import { FileService, type FileUploadInput } from '../../../common/services/file.service';
import {
  DocumentUtil,
  parseJsonWithSchema,
  type DocumentInput,
} from '../../../common/utils';
import {
  DocumentIndexSchema,
  type BuildingCompliance,
  type DocumentIndex,
  type EnrichedBuildingCompliance,
} from '../dto/cs-document-analyze-response';
import { BuildingComplianceSchemaService } from './building-compliance-schema.service';
import { IdFuzzyMatchService } from './id-fuzzy-match.service';
import { PDFDocument } from 'pdf-lib';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';

export type {
  BuildingCompliance,
  DocumentIndex,
  EnrichedBuildingCompliance,
  IUploadAndAnalyzeResult,
} from '../dto/cs-document-analyze-response';
export type { FileUploadInput } from '../../../common/services/file.service';

// =============================================================================
// CS Document Analyze Service
// =============================================================================

/**
 * Handles file upload to Supabase Storage and AI parsing.
 * - Uploads to private bucket, generates short-lived Signed URL.
 * - Uses Gemini; prompts loaded from config file (path configurable).
 * - On AI failure or timeout: deletes uploaded file to avoid orphans.
 */
@Injectable()
export class CsDocumentAnalyzeService {
  private readonly logger = new Logger(CsDocumentAnalyzeService.name);

  /** AI request timeout (ms), from env AI_REQUEST_TIMEOUT_MS (default 30000) */
  private readonly aiRequestTimeoutMs: number;
  /** Signed URL expiry (seconds), from env SIGNED_URL_EXPIRY_SECONDS (default 300) */
  private readonly signedUrlExpirySeconds: number;

  private readonly pdfMimeType: string = 'application/pdf';

  constructor(
    private readonly ai: AiService,
    private readonly bucket: BucketService,
    private readonly file: FileService,
    private readonly config: ConfigService,
    private readonly schemaService: BuildingComplianceSchemaService,
    private readonly idFuzzyMatch: IdFuzzyMatchService,
  ) {
    this.aiRequestTimeoutMs =
      Number(this.config.get<string>('AI_REQUEST_TIMEOUT_MS')) || 30_000;
    this.signedUrlExpirySeconds =
      Number(this.config.get<string>('SIGNED_URL_EXPIRY_SECONDS')) || 300;
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
      const bucket = this.config.get<string>('STORAGE_BUCKET') ?? 'documents';
      await this.bucket.upload(storagePath, buffer, {
        contentType: mimeType,
        bucket,
      });
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
   * Run AI analysis on file (Gemini Vision, prompt csBuildingAnalyzer from YAML).
   * PDF only: Indexer -> Slicer -> Extractor pipeline.
   * Does not upload; use together with upload() if you need storage.
   * Returns enriched result with sub_category_match (id + confidence), frequency_dict_id.
   */
  async analyze(file: FileUploadInput): Promise<EnrichedBuildingCompliance> {
    let { buffer, mimeType } = this.file.normalizeFileInput(file);
    const fileSizeBytes = buffer.length;
    const fileSizeKb = (fileSizeBytes / 1024).toFixed(2);
    this.logger.log(
      `Analyze started, file size: ${fileSizeBytes} bytes (${fileSizeKb} KB)`,
    );

    if (mimeType !== this.pdfMimeType) {
      throw new BadRequestException('file_upload_ai.only_pdf_supported');
    }

    const { useTextPath, extractedText } =
      await DocumentUtil.extractTextAndDecidePath(buffer);
    this.logger.log(
      useTextPath ? 'text path (no vision)' : 'vision path (scanned/low text)',
    );
    const index: DocumentIndex = await this.runIndexer(
      useTextPath ? { type: 'text', content: extractedText } : { type: 'buffer', content: buffer },
    );

    if (!index.isComplianceSchedule) {
      const message =
        (typeof index.rejection_reason === 'string' && index.rejection_reason.trim())
          ? index.rejection_reason.trim()
          : 'file_upload_ai.not_a_compliance_schedule';
      throw new BadRequestException(message);
    }

    const pageIndicesSet =
      DocumentUtil.collectPageIndicesFromRanges(index);
    if (pageIndicesSet.size === 0) {
      throw new BadRequestException('file_upload_ai.indexer_empty_pages');
    }

    const { slicedBuffer, pageCount } = await this.slicePdf(
      buffer,
      pageIndicesSet,
    );
    this.logger.log(`Slicer stage completed: ${pageCount} pages`);


    const result = await this.runExtractor(
      useTextPath ? { type: 'text', content: extractedText } : { type: 'buffer', content: slicedBuffer },
    );

    return this.idFuzzyMatch.enrichWithMatchedIds(result);
  }

  @LogExecutionTime({ label: 'Indexer' })
  private async runIndexer(input: DocumentInput): Promise<DocumentIndex> {
    const { prompt: systemPrompt, userInstruction, model } =
      await this.ai.getPromptAndUserInstructionById('csBuildingScanner');

    const { finalUserInstruction, extraParts } = DocumentUtil.getAIModelParams(
      input,
      userInstruction,
      { pdfMimeType: this.pdfMimeType },
    );

    let raw: string;
    try {
      raw = await this.ai.generateContent({
        systemPrompt,
        userInstruction: finalUserInstruction,
        extraParts,
        model,
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

    return parseJsonWithSchema<DocumentIndex>(
      raw,
      DocumentIndexSchema as z.ZodType<DocumentIndex>,
      'file_upload_ai.invalid_indexer_json',
    );
  }

  private async slicePdf(
    buffer: Buffer,
    pageIndicesSet: Set<number>,
  ): Promise<{ slicedBuffer: Buffer; pageCount: number }> {

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
    return { slicedBuffer: resultBuffer, pageCount: pageIndices.length };
  }


  @LogExecutionTime({
    label: 'Extractor',
    context: (args) =>
      (args[0] as DocumentInput)?.type === 'buffer'
        ? `input size: ${(args[0] as { type: 'buffer'; content: Buffer }).content.length} bytes`
        : 'input type: text',
  })
  private async runExtractor(input: DocumentInput): Promise<BuildingCompliance> {
    const { prompt: systemPrompt, userInstruction, model } =
      await this.ai.getPromptAndUserInstructionById('csBuildingAnalyzer');

    const { finalUserInstruction, extraParts } = DocumentUtil.getAIModelParams(
      input,
      userInstruction,
      { pdfMimeType: this.pdfMimeType },
    );

    const schema = this.schemaService.getSchema();

    let raw: string;
    try {
      raw = await this.ai.generateContent({
        systemPrompt,
        userInstruction: finalUserInstruction,
        extraParts,
        model,
        timeoutMs: this.aiRequestTimeoutMs,
        responseMimeType: 'application/json',
        responseJsonSchema: zodToJsonSchema(schema, {
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

    return parseJsonWithSchema<BuildingCompliance>(
      raw,
      schema as z.ZodType<BuildingCompliance>,
      'file_upload_ai.invalid_ai_json',
    );
  }
}
