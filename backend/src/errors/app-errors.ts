import { HttpStatus, type HttpStatusCode } from '@/infra/http-status';

export abstract class AppError extends Error {
  abstract readonly statusCode: HttpStatusCode;
  readonly extraResponseFields: Record<string, string> = {};

  constructor(message: string, technicalCause?: unknown) {
    super(message, technicalCause === undefined ? undefined : { cause: technicalCause });
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

export class DeletedLeadHoldsContactError extends ConflictError {
  readonly extraResponseFields: Record<string, string>;

  constructor(message: string, deletedLeadId: string) {
    super(message);
    this.extraResponseFields = { deletedLeadId };
  }
}

export class DatabaseUnavailableError extends AppError {
  readonly statusCode = HttpStatus.SERVICE_UNAVAILABLE;
}
