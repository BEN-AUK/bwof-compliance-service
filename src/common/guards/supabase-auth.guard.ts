import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createClient, type User } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/** 附加到 Request 上的用户信息，供后续 RLS 透传（set_config('request.jwt.claims', ...)）使用 */
export interface RequestUser {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
      accessToken?: string;
    }
  }
}

/**
 * Supabase JWT 认证守卫：验证前端传来的 Supabase JWT，并将用户信息挂载到 request，
 * 为后续在数据库会话中透传 RLS 上下文（request.jwt.claims）做准备。
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.get<boolean>(
      IS_PUBLIC_KEY,
      context.getHandler(),
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    const token = this.extractBearerToken(authHeader);

    if (!token) {
      throw new UnauthorizedException('auth.missing_token');
    }

    const user = await this.verifySupabaseJwt(token);
    request.user = user;
    request.accessToken = token;
    return true;
  }

  private extractBearerToken(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice(7).trim() || null;
  }

  private async verifySupabaseJwt(accessToken: string): Promise<RequestUser> {
    const url = this.config.get<string>('SUPABASE_URL');
    const anonKey = this.config.get<string>('SUPABASE_ANON_KEY');

    if (!url || !anonKey) {
      throw new UnauthorizedException('auth.config_missing');
    }

    const supabase = createClient(url, anonKey);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      throw new UnauthorizedException('auth.invalid_token');
    }

    return this.toRequestUser(user as User);
  }

  private toRequestUser(user: User): RequestUser {
    return {
      id: user.id,
      email: user.email ?? undefined,
      app_metadata: user.app_metadata as Record<string, unknown> | undefined,
      user_metadata: user.user_metadata as Record<string, unknown> | undefined,
    };
  }
}
