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
} from '../../../common/utils';
import {
  BuildingComplianceSchema,
  DocumentIndexSchema,
  type BuildingCompliance,
  type DocumentIndex,
} from '../dto/cs-document-analyze-response';
import { PDFDocument } from 'pdf-lib';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';

export type { BuildingCompliance, DocumentIndex, IUploadAndAnalyzeResult } from '../dto/cs-document-analyze-response';
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
   * Run AI analysis on file (Gemini Vision, prompt csBuildingAnalyzer from YAML).
   * PDF only: Indexer -> Slicer -> Extractor pipeline.
   * Does not upload; use together with upload() if you need storage.
   */
  async analyze(file: FileUploadInput): Promise<BuildingCompliance> {
    const { buffer, mimeType } = this.file.normalizeFileInput(file);
    const fileSizeBytes = buffer.length;
    const fileSizeKb = (fileSizeBytes / 1024).toFixed(2);
    this.logger.log(
      `Analyze started, file size: ${fileSizeBytes} bytes (${fileSizeKb} KB)`,
    );

    const isPdf = mimeType === 'application/pdf';

    if (!isPdf) {
      throw new BadRequestException('file_upload_ai.only_pdf_supported');
    }
    let { extractedText, encodedContent } = await this.getFileContent(buffer, mimeType);
    const index = await this.runIndexer(extractedText, encodedContent);

    const pageIndicesFromRanges =
      DocumentUtil.collectPageIndicesFromRanges(index);
    if (pageIndicesFromRanges.size === 0) {
      throw new BadRequestException('file_upload_ai.indexer_empty_pages');
    }

    if (!encodedContent) {
      const { buffer: slicedBuffer, pageCount } = await this.slicePdf(
        buffer,
        index,
      );
      this.logger.log(`Slicer stage completed: ${pageCount} pages`);
      encodedContent = [
        {
          inlineData: {
            mimeType: mimeType || 'application/octet-stream',
            data: slicedBuffer.toString('base64'),
          },
        },
      ];
    }

    const result = await this.runExtractor(
      extractedText, encodedContent,
    );

    return result;
  }

  private async getFileContent(
    buffer: Buffer,
    mimeType: string,
  ): Promise<{
    extractedText: string, encodedContent:
    | Array<{
      inlineData: { mimeType: string; data: string };
    }>
    | undefined;
  }
  > {
    let extractedText = '';
    if (mimeType === 'application/pdf') {
      try {
        extractedText =
          await DocumentUtil.extractTextWithPageMarkers(buffer);
      } catch (err) {
        this.logger.error(
          `extractTextWithPageMarkers failed: ${String(err)}`,
          (err as Error)?.stack,
        );
        throw err;
      }
    }

    const useTextPath = extractedText.length > 200;
    this.logger.log(
      useTextPath
        ? 'text path (no vision)'
        : 'vision path (scanned/low text)',
    );

    const encodedContent = useTextPath
      ? undefined
      : [
        {
          inlineData: {
            mimeType: mimeType || 'application/octet-stream',
            data: buffer.toString('base64'),
          },
        },
      ];

    return { extractedText, encodedContent };
  }

  @LogExecutionTime({ label: 'Indexer' })
  private async runIndexer(
    extractedText: string,
    encodedContent: Array<{ inlineData: { mimeType: string; data: string } }> | undefined,
  ): Promise<DocumentIndex> {
    const { prompt: systemPrompt, userInstruction } =
      await this.ai.getPromptAndUserInstructionById('csBuildingScanner');

    const effectiveUserInstruction = encodedContent
      ? userInstruction
      : `${userInstruction}\n\n${extractedText}`;

    let raw: string;
    try {
      raw = await this.ai.generateContent({
        systemPrompt,
        userInstruction: effectiveUserInstruction,
        extraParts: encodedContent,
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

    return parseJsonWithSchema<DocumentIndex>(
      raw,
      DocumentIndexSchema as z.ZodType<DocumentIndex>,
      'file_upload_ai.invalid_indexer_json',
    );
  }

  private async slicePdf(
    buffer: Buffer,
    index: DocumentIndex,
  ): Promise<{ buffer: Buffer; pageCount: number }> {

    const pageIndicesSet = DocumentUtil.collectPageIndicesFromRanges(index);

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
    return { buffer: resultBuffer, pageCount: pageIndices.length };
  }


  @LogExecutionTime({
    label: 'Extractor',
    context: (args) =>
      `input size: ${(args[0] as Buffer)?.length ?? 0} bytes`,
  })
  private async runExtractor(
    extractedText: string,
    encodedContent:
      | Array<{ inlineData: { mimeType: string; data: string } }>
      | undefined,
  ): Promise<BuildingCompliance> {
    const { prompt: systemPrompt, userInstruction } =
      await this.ai.getPromptAndUserInstructionById('csBuildingAnalyzer');

    const effectiveUserInstruction = encodedContent
      ? userInstruction
      : `${userInstruction}\n\n${extractedText}`;

    let raw: string;
    try {
      raw = await this.ai.generateContent({
        systemPrompt,
        userInstruction: effectiveUserInstruction,
        extraParts: encodedContent,
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

    return parseJsonWithSchema<BuildingCompliance>(
      raw,
      BuildingComplianceSchema as z.ZodType<BuildingCompliance>,
      'file_upload_ai.invalid_ai_json',
    );
  }
}
