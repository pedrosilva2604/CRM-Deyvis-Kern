import type { Response } from 'express';
import type { AppError } from '@/errors/app-errors';
import { REQUEST_ERRORS } from '@/errors/errors.constants';

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];

export function sendErrorResponse(res: Response, httpStatus: HttpStatusCode, error: AppError) {
  res.status(httpStatus).json({ error: error.message, ...error.extraResponseFields });
}

export function sendSuccessMessage(res: Response, httpStatus: HttpStatusCode, message: string) {
  res.status(httpStatus).json({ message });
}

export function sendUnexpectedErrorResponse(res: Response, unexpectedError: unknown) {
  console.error(unexpectedError instanceof Error ? unexpectedError.stack : unexpectedError);
  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: REQUEST_ERRORS.INTERNAL });
}
