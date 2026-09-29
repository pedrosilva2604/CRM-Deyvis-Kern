import type { Response } from 'express';
import type { AppError } from '@/errors/app-errors';

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];

export function sendErrorResponse(res: Response, httpStatus: HttpStatusCode, error: AppError) {
  res.status(httpStatus).json({ error: error.message });
}

export function sendSuccessMessage(res: Response, httpStatus: HttpStatusCode, message: string) {
  res.status(httpStatus).json({ message });
}
