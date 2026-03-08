/**
 * Standalone script to upload a file to BUCKET via CsDocumentAnalyzeService.upload().
 *
 * Usage: npx ts-node -r tsconfig-paths/register scripts/upload-file.ts [filePath]
 *
 * Default file: resource/building compliance/difficault-1-exemplar-compliance-schedule.pdf
 * Example: npx ts-node -r tsconfig-paths/register scripts/upload-file.ts
 * Example: npx ts-node -r tsconfig-paths/register scripts/upload-file.ts "../resource/building compliance/difficault-1-exemplar-compliance-schedule.pdf"
 *
 * Requires .env / .env.local with Supabase credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.).
 */

import { NestFactory } from '@nestjs/core';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { AppModule } from '../src/app.module';
import { CsDocumentAnalyzeService } from '../src/modules/setup/services/cs-document-analyze.service';

const DEFAULT_FILE =
  'resource/building compliance/wrong_file.pdf';

const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

function getMimeType(filePath: string): string {
  const ext = filePath.replace(/^.*\./, '').toLowerCase();
  return EXT_TO_MIME[ext] ?? 'application/octet-stream';
}

async function main(): Promise<void> {
  const filePath = process.argv[2] ?? DEFAULT_FILE;
  const resolvedPath = resolve(process.cwd(), filePath);

  const buffer = await readFile(resolvedPath);
  const originalName = filePath.replace(/^.*[\\/]/, '');
  const mimetype = getMimeType(filePath);

  const app = await NestFactory.create(AppModule);
  const csDocumentAnalyze = app.get(CsDocumentAnalyzeService);

  try {
    const { storagePath } = await csDocumentAnalyze.upload(
      { buffer, mimetype, originalname: originalName },
      { pathPrefix: 'temp' },
    );
    console.log('Upload success. storagePath:', storagePath);
  } finally {
    await app.close();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
