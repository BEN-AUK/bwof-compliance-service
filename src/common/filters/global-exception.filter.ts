import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type Response } from 'express';
import type { ApiResponse } from '../interceptors/transform.interceptor';

/**
 * 全局异常过滤器：捕获未处理异常，统一返回 { code, message, data } 格式。
 * message 使用 i18n Key（如 error.xxx），便于后续接入 nestjs-i18n 根据 Accept-Language 翻译。
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, code, message } = this.normalizeException(exception);

    this.logger.warn(
      `Unhandled exception: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    const body: ApiResponse<null> = {
      code: code ?? status,
      message,
      data: null,
    };

    response.status(status).json(body);
  }

  private normalizeException(exception: unknown): {
    status: number;
    code?: number;
    message: string;
  } {
    if (exception && typeof exception === 'object' && 'getStatus' in exception) {
      const ex = exception as unknown as {
        getStatus?: () => number;
        message?: string;
      };
      const status =
        typeof ex.getStatus === 'function'
          ? ex.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;
      const msg =
        typeof ex.message === 'string' ? ex.message : 'error.unknown';
      return { status, code: status, message: msg };
    }

    if (exception instanceof Error) {
      return {
        status: HttpStatus.BAD_GATEWAY,
        message: 'error.bad_gateway',
      };
    }

    return {
      status: HttpStatus.BAD_GATEWAY,
      message: 'error.unknown',
    };
  }
}
