/**
 * Standalone script to test FileUploadAiService.analyze().
 * Usage: npx ts-node -r tsconfig-paths/register scripts/analyze-file.ts <filePath> [promptId]
 * Example: npx ts-node -r tsconfig-paths/register scripts/analyze-file.ts ./sample.pdf documentAnalyzer
 *
 * Requires .env / .env.local with at least GEMINI_API_KEY and prompts config.
 */

import { NestFactory } from '@nestjs/core';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { AppModule } from '../src/app.module';
import { FileUploadAiService } from '../src/modules/setup/services/file-upload-ai.service';

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
  const filePath = process.argv[2];
  const promptId = process.argv[3] ?? 'documentAnalyzer';

  if (!filePath) {
    console.error('Usage: ts-node scripts/analyze-file.ts <filePath> [promptId]');
    console.error('Example: ts-node scripts/analyze-file.ts ./sample.pdf documentAnalyzer');
    process.exit(1);
  }

  const resolvedPath = resolve(process.cwd(), filePath);
  const buffer = await readFile(resolvedPath);
  const originalName = filePath.replace(/^.*[\\/]/, '');
  const mimetype = getMimeType(filePath);

  const app = await NestFactory.create(AppModule);
  const fileUploadAi = app.get(FileUploadAiService);

  try {
    const result = await fileUploadAi.analyze(
      { buffer, mimetype, originalname: originalName },
      { promptId },
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
