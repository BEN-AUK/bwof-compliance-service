import { PDFParse } from 'pdf-parse';

/** AI 输入的两种来源：纯文本路径 或 原始 PDF buffer */
export type DocumentInput =
  | { type: 'text'; content: string }
  | { type: 'buffer'; content: Buffer };

/** Index with [start, end] page ranges (0-based, inclusive) */
export interface DocumentIndexLike {
  metadata_ranges: readonly (readonly number[])[];
  ss_ranges: readonly (readonly number[])[];
}

/**
 * Document utilities: PDF text extraction and page range collection.
 */
export class DocumentUtil {
  /**
   * Extract text from PDF with page markers for 0-based page indexing.
   * Output format: "--- PAGE 0 ---\n[text]\n--- PAGE 1 ---\n[text]..."
   * Used by the Indexer fast path (digital PDFs); scanned PDFs get little/no text.
   */
  static async extractTextWithPageMarkers(buffer: Buffer): Promise<string> {
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

  /**
   * 将 DocumentInput 转为 AI generateContent 所需格式。
   * 返回 finalUserInstruction 和 extraParts（Gemini inlineData 或 undefined）。
   */
  static getAIModelParams(
    input: DocumentInput,
    userInstruction: string,
    options: { pdfMimeType?: string } = {},
  ): {
    finalUserInstruction: string;
    extraParts: Array<{ inlineData: { mimeType: string; data: string } }> | undefined;
  } {
    const finalUserInstruction =
      input.type === 'text'
        ? `${userInstruction}\n\n${input.content}`
        : userInstruction;

    const extraParts =
      input.type === 'buffer'
        ? [
            {
              inlineData: {
                mimeType: options.pdfMimeType ?? 'application/pdf',
                data: input.content.toString('base64'),
              },
            },
          ]
        : undefined;

    return { finalUserInstruction, extraParts };
  }

  /**
   * Extract text from PDF and decide text vs vision path by text length.
   * useTextPath=true when extracted text length > minTextLength (digital PDFs);
   * useTextPath=false when low/no text (scanned PDFs).
   */
  static async extractTextAndDecidePath(
    buffer: Buffer,
    options?: { minTextLength?: number },
  ): Promise<{ useTextPath: boolean; extractedText: string }> {
    const minTextLength = options?.minTextLength ?? 200;
    const extractedText = await DocumentUtil.extractTextWithPageMarkers(buffer);
    const useTextPath = extractedText.length > minTextLength;
    return { useTextPath, extractedText };
  }

  /**
   * From index ranges, collect every page index in [start, end] plus end+1 (buffer) per block.
   */
  static collectPageIndicesFromRanges(
    index: DocumentIndexLike,
  ): Set<number> {
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
}
