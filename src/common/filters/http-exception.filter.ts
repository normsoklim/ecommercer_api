import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status: number;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        exceptionResponse &&
        typeof exceptionResponse === 'object' &&
        'message' in exceptionResponse
      ) {
        message = (exceptionResponse as { message: unknown }).message as string;
      } else {
        message = exception.message ?? 'Internal server error';
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';

      // Log unexpected errors with full stack trace for debugging
      this.logger.error(
        `Unhandled exception: ${request.method} ${request.url}`,
        (exception as Error)?.stack ?? String(exception),
      );
    }

    this.logger.warn(
      `${request.method} ${request.url} ${status} ${message}`,
    );

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
