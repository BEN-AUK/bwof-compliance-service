import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const DEFAULT_PROMPTS_CONFIG = 'config/prompts';

/**
 * Shared infra service: Supabase admin client, prompt config loading.
 * For AI generation and prompt-by-id lookup, use AiService.
 */
@Injectable()
export class InfraService {
  private readonly logger = new Logger(InfraService.name);
  private readonly supabaseUrl: string;
  private readonly supabaseServiceKey: string;
  private readonly promptsConfigPath: string;
  private supabaseAdmin: SupabaseClient | null = null;
  private promptsCache: Record<string, unknown> | null = null;

  constructor(private readonly config: ConfigService) {
    this.supabaseUrl = this.config.get<string>('SUPABASE_URL') ?? '';
    this.supabaseServiceKey =
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!this.supabaseUrl || !this.supabaseServiceKey) {
      this.logger.warn(
        'Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY), Storage will be unavailable',
      );
    }
    this.promptsConfigPath =
      this.config.get<string>('PROMPTS_CONFIG_FILE') ??
      join(process.cwd(), DEFAULT_PROMPTS_CONFIG);
  }

  /**
   * Load and merge all prompts from config path (file or directory).
   */
  async loadPrompts(): Promise<Record<string, unknown>> {
    if (this.promptsCache) return this.promptsCache;
    const resolvedPath =
      this.promptsConfigPath.startsWith('/') ||
      /^[A-Za-z]:[\\/]/.test(this.promptsConfigPath)
        ? this.promptsConfigPath
        : join(process.cwd(), this.promptsConfigPath);
    const info = await stat(resolvedPath).catch(() => null);
    if (!info) {
      throw new InternalServerErrorException(
        `ai.prompts_config_not_found: ${resolvedPath}`,
      );
    }
    const merged: Record<string, unknown> = {};
    if (info.isDirectory()) {
      const files = await readdir(resolvedPath);
      for (const f of files) {
        if (!f.endsWith('.yaml') && !f.endsWith('.yml')) continue;
        const content = await readFile(join(resolvedPath, f), 'utf-8');
        const parsed = parseYaml(content) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          Object.assign(merged, parsed);
        }
      }
    } else {
      const content = await readFile(resolvedPath, 'utf-8');
      const parsed = parseYaml(content) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') Object.assign(merged, parsed);
    }
    if (Object.keys(merged).length === 0) {
      throw new InternalServerErrorException(
        `ai.prompts_config_empty: ${resolvedPath}`,
      );
    }
    this.promptsCache = merged;
    return merged;
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
