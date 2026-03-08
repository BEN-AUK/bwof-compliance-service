import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InfraService } from './infra.service';

/**
 * Generic Supabase Storage bucket operations: upload, signed URL, remove, path building.
 * Default bucket from STORAGE_BUCKET env (default "documents"); optional bucket override for multi-bucket use.
 */
@Injectable()
export class BucketService {
  private readonly defaultBucket: string;

  constructor(
    private readonly infra: InfraService,
    private readonly config: ConfigService,
  ) {
    this.defaultBucket =
      this.config.get<string>('STORAGE_BUCKET') ?? 'documents';
  }

  private resolveBucket(bucket?: string): string {
    return bucket ?? this.defaultBucket;
  }

  /**
   * Upload a buffer to the given path in the bucket.
   */
  async upload(
    path: string,
    buffer: Buffer,
    options: {
      contentType: string;
      bucket: string;
      upsert?: boolean;
    },
  ): Promise<void> {
    const supabase = this.infra.getSupabaseAdmin();

    const blob = new Blob([new Uint8Array(buffer)], {
      type: options.contentType,
    });

    const { error } = await supabase.storage
      .from(options.bucket)
      .upload(path, blob, {
        contentType: options.contentType,
        upsert: options.upsert ?? false,
        duplex: 'half'
      });
  
    if (error) {
      // 【核心修复 3】改进错误捕获，提取更深层的网络错误原因
      const errorMessage = error.message || 'Unknown Storage Error';
      const cause = (error as any).originalError?.cause || (error as any).cause || '';
      
      throw new InternalServerErrorException(
        `bucket.upload_failed: ${errorMessage} ${cause}`.trim(),
      );
    }
  }

  /**
   * Create a short-lived signed URL; bucket must be private.
   */
  async createSignedUrl(
    path: string,
    expirySeconds: number,
    bucket?: string,
  ): Promise<{ signedUrl: string }> {
    const supabase = this.infra.getSupabaseAdmin();
    const bucketName = this.resolveBucket(bucket);
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(path, expirySeconds);
    if (error) {
      throw new InternalServerErrorException(
        `bucket.signed_url_failed: ${error.message}`,
      );
    }
    if (!data?.signedUrl) {
      throw new InternalServerErrorException('bucket.signed_url_empty');
    }
    return { signedUrl: data.signedUrl };
  }

  /**
   * Remove one or more objects from the bucket.
   */
  async remove(
    paths: string | string[],
    bucket?: string,
  ): Promise<void> {
    const supabase = this.infra.getSupabaseAdmin();
    const bucketName = this.resolveBucket(bucket);
    const pathList = Array.isArray(paths) ? paths : [paths];
    const { error } = await supabase.storage
      .from(bucketName)
      .remove(pathList);
    if (error) {
      throw new InternalServerErrorException(
        `bucket.remove_failed: ${error.message}`,
      );
    }
  }

  /**
   * Build a unique storage path: safe filename + timestamp/random suffix.
   * Reusable across modules for consistent path generation.
   */
  buildUniquePath(prefix: string, originalName: string): string {
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128);
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const ext = safeName.includes('.') ? safeName.split('.').pop() ?? '' : '';
    const base = ext ? safeName.slice(0, -(ext.length + 1)) : safeName;
    return `${prefix}/${base}-${unique}${ext ? `.${ext}` : ''}`.replace(/\/+/g, '/');
  }
}
