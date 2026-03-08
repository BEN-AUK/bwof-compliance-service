import { PDFParse } from 'pdf-parse';

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
