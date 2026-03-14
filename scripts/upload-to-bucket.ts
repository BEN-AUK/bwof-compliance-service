import { config } from 'dotenv';
import { resolve } from 'path';
import { createReadStream, statSync, existsSync } from 'fs';
import * as tus from 'tus-js-client';

// 1. 加载配置
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const DEFAULT_FILE = 'resource/building compliance/cs_sample.pdf';
const BUCKET_NAME = 'cs_documents';

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const filePath = process.argv[2] ?? DEFAULT_FILE;
  const resolvedPath = resolve(process.cwd(), filePath);

  if (!existsSync(resolvedPath)) {
    console.error(`❌ File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const stats = statSync(resolvedPath);
  const originalName = filePath.replace(/^.*[\\/]/, '');
  
  const endpoint = `${url.replace(/\/$/, '')}/storage/v1/upload/resumable`;

  console.log('================ TUS SURVIVAL MODE ================');
  console.log(`[FILE]: ${originalName}`);
  console.log(`[SIZE]: ${(stats.size / 1024).toFixed(2)} KB`);
  console.log(`[ENDPOINT]: ${endpoint}`);
  console.log('====================================================');

  const fileStream = createReadStream(resolvedPath);

  const upload = new tus.Upload(fileStream, {
    endpoint,
    retryDelays: [0, 1000, 3000, 5000, 10000, 20000], 
    headers: {
      'Authorization': `Bearer ${key}`,
      'x-upsert': 'true',
    },
    uploadSize: stats.size,
    metadata: {
      bucketName: BUCKET_NAME,
      objectName: `temp/${Date.now()}-${originalName}`,
      contentType: 'application/pdf',
    },
    // 强制极端分片以规避 DPI 拦截
    chunkSize: 64 * 1024, // 64KB
    parallelUploads: 1, 
    
    onError: (error) => {
      console.error('\n❌ [TUS FATAL ERROR]');
      console.error('Message:', error.message);
      
      // 修复：使用类型断言访问 TUS 特有属性
      const detailedError = error as any;
      if (detailedError.originalRequest) {
        console.log('HTTP Status:', detailedError.originalRequest.status);
        // 部分环境下 _offset 属性在内部请求对象中
        const offset = detailedError.originalRequest._offset ?? 'unknown';
        console.error('Failed at Offset:', offset);
      }
      
      process.exit(1);
    },
    onProgress: (bytesSent, bytesTotal) => {
      const percentage = ((bytesSent / bytesTotal) * 100).toFixed(2);
      process.stdout.write(`\r[PROGRESS]: ${percentage}% (${bytesSent}/${bytesTotal} bytes)`);
    },
    onSuccess: () => {
      console.log('\n\n✅ [SUCCESS] File uploaded successfully via TUS.');
      process.exit(0);
    },
  });

  upload.findPreviousUploads().then((previousUploads) => {
    if (previousUploads.length) {
      upload.resumeFromPreviousUpload(previousUploads[0]);
    }
    console.log('[TUS] Starting/Resuming upload...');
    upload.start();
  });
}

main().catch((err) => {
  console.error('\n[SYSTEM CRASH]', err);
  process.exit(1);
});