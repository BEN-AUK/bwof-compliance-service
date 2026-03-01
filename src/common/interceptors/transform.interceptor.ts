import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Response } from 'express';

/** 统一 API 响应体格式 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T | null;
}

/**
 * 统一标准化 API 返回格式：{ code, message, data }。
 * 正常响应时 code 与 HTTP 状态码一致，message 可后续接入 i18n。
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const res = context.switchToHttp().getResponse<Response>();
    const statusCode = res.statusCode;

    return next.handle().pipe(
      map((payload) => ({
        code: statusCode,
        message: 'OK',
        data: payload ?? null,
      })),
    );
  }
}
