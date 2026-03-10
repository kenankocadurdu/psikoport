import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const details =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const responseObj =
      details && typeof details === 'object' && !Array.isArray(details)
        ? (details as Record<string, unknown>)
        : undefined;

    const code =
      exception instanceof HttpException
        ? (typeof responseObj?.code === 'string'
            ? responseObj.code
            : this.getErrorCode(exception))
        : 'INTERNAL_ERROR';

    const message =
      exception instanceof HttpException
        ? (typeof responseObj?.message === 'string'
            ? responseObj.message
            : exception.message)
        : 'An unexpected error occurred';

    const body: ApiErrorResponse & { error?: { requiresCaptcha?: boolean } } = {
      success: false,
      error: {
        code,
        message: typeof message === 'string' ? message : 'Request failed',
        ...(details && typeof details === 'object' && !('success' in details)
          ? { details }
          : {}),
        ...(status === 429 ? { requiresCaptcha: true } : {}),
      },
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (status === 401 && request.path?.includes('/auth/')) {
      this.logger.warn(
        `Auth 401: ${request.method} ${request.path} - ${message}`,
      );
    }

    response.status(status).json(body);
  }

  private getErrorCode(exception: HttpException): string {
    const status = exception.getStatus();
    const codeMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'INTERNAL_ERROR',
    };
    return codeMap[status] ?? `HTTP_${status}`;
  }
}
