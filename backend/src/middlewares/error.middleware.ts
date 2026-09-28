import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, NotFoundError } from '@/errors/app-errors';
import { REQUEST_ERRORS } from '@/errors/errors.constants';

interface BodyParserError {
  type: string;
}

const BODY_PARSER_ERRORS: Record<string, { status: number; message: string }> = {
  'entity.parse.failed': { status: 400, message: REQUEST_ERRORS.INVALID_JSON },
  'entity.too.large': { status: 413, message: REQUEST_ERRORS.PAYLOAD_TOO_LARGE },
};

export class ErrorMiddleware {
  handleNotFound = (_req: Request, _res: Response, _next: NextFunction) => {
    throw new NotFoundError(REQUEST_ERRORS.RESOURCE_NOT_FOUND);
  };

  handleError = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) return this.sendAppError(err, res);
    if (err instanceof ZodError) return this.sendValidationError(err, res);
    if (this.isBodyParserError(err)) return this.sendBodyParserError(err, res);
    return this.sendUnexpectedError(err, res);
  };

  private sendAppError(err: AppError, res: Response) {
    res.status(err.statusCode).json({ error: err.message });
  }

  private sendValidationError(err: ZodError, res: Response) {
    const { fieldErrors, formErrors } = err.flatten();
    res.status(400).json({
      error: REQUEST_ERRORS.VALIDATION_FAILED,
      issues: fieldErrors,
      ...(formErrors.length > 0 && { messages: formErrors }),
    });
  }

  private isBodyParserError(err: unknown): err is BodyParserError {
    return typeof err === 'object' && err !== null && (err as BodyParserError).type in BODY_PARSER_ERRORS;
  }

  private sendBodyParserError(err: BodyParserError, res: Response) {
    const { status, message } = BODY_PARSER_ERRORS[err.type]!;
    res.status(status).json({ error: message });
  }

  private sendUnexpectedError(err: unknown, res: Response) {
    console.error(err instanceof Error ? err.stack : err);
    res.status(500).json({ error: REQUEST_ERRORS.INTERNAL });
  }
}
