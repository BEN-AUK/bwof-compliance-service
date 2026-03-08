/**
 * Standalone script: upload file to Supabase Storage bucket directly.
 * No project services – uses .env config and @supabase/supabase-js only.
 *
 * Usage: npx ts-node -r tsconfig-paths/register scripts/upload-to-bucket.ts [filePath]
 *
 * Default file: resource/building compliance/difficault-1-exemplar-compliance-schedule.pdf
 * Bucket name: temp
 *
 * Requires .env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { config } from 'dotenv';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_FILE =
  'resource/building compliance/wrong_file.pdf';
const BUCKET_NAME = 'temp';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

function buildUniquePath(prefix: string, originalName: string): string {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const ext = safeName.includes('.') ? safeName.split('.').pop() ?? '' : '';
  const base = ext ? safeName.slice(0, -(ext.length + 1)) : safeName;
  return `${prefix}/${base}-${unique}${ext ? `.${ext}` : ''}`.replace(
    /\/+/g,
    '/',
  );
}

function getMimeType(filePath: string): string {
  const ext = filePath.replace(/^.*\./, '').toLowerCase();
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
  };
  return map[ext] ?? 'application/octet-stream';
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const filePath = process.argv[2] ?? DEFAULT_FILE;
  const resolvedPath = resolve(process.cwd(), filePath);
  const buffer = await readFile(resolvedPath);
  const originalName = filePath.replace(/^.*[\\/]/, '');
  const contentType = getMimeType(filePath);
  const storagePath = buildUniquePath(BUCKET_NAME, originalName);
  const blob = new Blob([buffer], { type: contentType });
  //const supabase = createClient(url, key, { auth: { persistSession: false } });
  const fileBuffer = await readFile(resolvedPath);
  const uint8Array = new Uint8Array(fileBuffer);

  console.log('Uploading file to:', storagePath);

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
    global: {
      // [核心修复 2] 强制配置 fetch 参数，增加 keep-alive
      fetch: (url, options) => fetch(url, { ...options, keepalive: true })
    }
  });

  console.log(`Starting production-grade upload: ${storagePath}`);

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, uint8Array, { // 传入 Uint8Array
      contentType: getMimeType(filePath),
      upsert: false,
      // [核心修复 3] 某些环境下手动指定 duplex 模式
      // @ts-ignore
      duplex: 'half' 
    });

    if (error) {
      console.error('================ FINAL AUDIT FAILED ================');
      console.error('Code:', (error as any).status);
      console.error('Message:', error.message);
      process.exit(1);
    }

  console.log('Upload success. storagePath:', storagePath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
