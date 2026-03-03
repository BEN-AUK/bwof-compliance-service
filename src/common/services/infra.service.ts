import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared infra service providing Supabase admin client for Storage and other server-side ops.
 * For AI (Gemini) and prompts, use AiService instead.
 */
@Injectable()
export class InfraService {
  private readonly logger = new Logger(InfraService.name);
  private readonly supabaseUrl: string;
  private readonly supabaseServiceKey: string;
  private supabaseAdmin: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {
    this.supabaseUrl = this.config.get<string>('SUPABASE_URL') ?? '';
    this.supabaseServiceKey =
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!this.supabaseUrl || !this.supabaseServiceKey) {
      this.logger.warn(
        'Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY), Storage will be unavailable',
      );
    }
  }

  /** Supabase admin client for Storage and other server-side ops. Bucket must be private. */
  getSupabaseAdmin(): SupabaseClient {
    if (!this.supabaseAdmin) {
      if (!this.supabaseUrl || !this.supabaseServiceKey) {
        throw new InternalServerErrorException('infra.supabase_not_configured');
      }
      this.supabaseAdmin = createClient(
        this.supabaseUrl,
        this.supabaseServiceKey,
        { auth: { persistSession: false } },
      );
    }
    return this.supabaseAdmin;
  }

}
