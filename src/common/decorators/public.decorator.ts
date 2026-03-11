import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as public: SupabaseAuthGuard will skip JWT validation for this handler.
 * Use for webhooks or other endpoints called by services (e.g. Supabase Database Webhook).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
