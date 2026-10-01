import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, NotFoundError } from '@/errors/app-errors';
import { REQUEST_ERRORS } from '@/errors/errors.constants';
import { HttpStatus, sendErrorResponse, sendUnexpectedErrorResponse, type HttpStatusCode } from '@/infra/http-status';

interface BodyParserError {
  type: string;
}

const BODY_PARSER_ERRORS: Record<string, { status: HttpStatusCode; message: string }> = {
  'entity.parse.failed': { status: HttpStatus.BAD_REQUEST, message: REQUEST_ERRORS.INVALID_JSON },
  'entity.too.large': { status: HttpStatus.PAYLOAD_TOO_LARGE, message: REQUEST_ERRORS.PAYLOAD_TOO_LARGE },
  'charset.unsupported': { status: HttpStatus.UNSUPPORTED_MEDIA_TYPE, message: REQUEST_ERRORS.UNSUPPORTED_CONTENT },
  'encoding.unsupported': { status: HttpStatus.UNSUPPORTED_MEDIA_TYPE, message: REQUEST_ERRORS.UNSUPPORTED_CONTENT },
  'request.aborted': { status: HttpStatus.BAD_REQUEST, message: REQUEST_ERRORS.INCOMPLETE_REQUEST },
  'request.size.invalid': { status: HttpStatus.BAD_REQUEST, message: REQUEST_ERRORS.INCOMPLETE_REQUEST },
};

export class ErrorMiddleware {
  handleNotFound = (_req: Request, _res: Response, _next: NextFunction) => {
    throw new NotFoundError(REQUEST_ERRORS.RESOURCE_NOT_FOUND);
  };

  handleError = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) return sendErrorResponse(res, err.statusCode, err);
    if (err instanceof ZodError) return this.sendValidationError(err, res);
    if (this.isBodyParserError(err)) return this.sendBodyParserError(err, res);
    return sendUnexpectedErrorResponse(res, err);
  };

  private sendValidationError(err: ZodError, res: Response) {
    const { fieldErrors, formErrors } = err.flatten();
    res.status(HttpStatus.BAD_REQUEST).json({
      error: REQUEST_ERRORS.VALIDATION_FAILED,
      issues: fieldErrors,
      ...(formErrors.length > 0 && { messages: formErrors }),
    });
  }

  private isBodyParserError(err: unknown): err is BodyParserError {
    if (typeof err !== 'object' || err === null) return false;
    const errorType = (err as Partial<BodyParserError>).type;
    return typeof errorType === 'string' && Object.hasOwn(BODY_PARSER_ERRORS, errorType);
  }

  private sendBodyParserError(err: BodyParserError, res: Response) {
    const { status, message } = BODY_PARSER_ERRORS[err.type]!;
    res.status(status).json({ error: message });
  }
}
