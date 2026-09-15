import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

type ExceptionResponseShape = {
  message?: string | string[];
  error?: string;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        const responseShape = exceptionResponse as ExceptionResponseShape;
        message = responseShape.message ?? exception.message;
        error = responseShape.error ?? error;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint violation → 409; record not found → 404.
      if (exception.code === 'P2002') {
        statusCode = HttpStatus.CONFLICT;
        message = 'Resource already exists';
        error = 'Conflict';
      } else if (exception.code === 'P2025') {
        statusCode = HttpStatus.NOT_FOUND;
        message = 'Resource not found';
        error = 'Not Found';
      } else {
        this.logger.error(
          `Prisma error ${exception.code}: ${exception.message}`,
          exception.stack,
        );
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.message, exception.stack);
    }

    response.status(statusCode).json({
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
