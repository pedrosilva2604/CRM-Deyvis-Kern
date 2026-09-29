import { HttpStatus, type HttpStatusCode } from '@/lib/http-status';

export abstract class AppError extends Error {
  abstract readonly statusCode: HttpStatusCode;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  readonly statusCode = HttpStatus.BAD_REQUEST;
}

export class UnauthorizedError extends AppError {
  readonly statusCode = HttpStatus.UNAUTHORIZED;
}

export class ForbiddenError extends AppError {
  readonly statusCode = HttpStatus.FORBIDDEN;
}

export class NotFoundError extends AppError {
  readonly statusCode = HttpStatus.NOT_FOUND;
}

export class ConflictError extends AppError {
  readonly statusCode = HttpStatus.CONFLICT;
}
