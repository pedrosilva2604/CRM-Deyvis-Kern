import type { NextFunction, Request, Response } from 'express';
import type { ZodType, ZodTypeDef } from 'zod';
import type { AppError } from '@/errors/app-errors';

type InvalidInputError = () => AppError;

const VALIDATED_QUERY_KEY = 'validatedQuery';

export function readValidatedQuery<TQuery>(res: Response): TQuery {
  return res.locals[VALIDATED_QUERY_KEY] as TQuery;
}

export class ValidationMiddleware {
  validateBody =
    <T>(schema: ZodType<T, ZodTypeDef, unknown>, invalidInputError?: InvalidInputError) =>
    (req: Request, _res: Response, next: NextFunction) => {
      const result = schema.safeParse(req.body);
      if (!result.success) throw invalidInputError ? invalidInputError() : result.error;
      req.body = result.data;
      next();
    };

  validateParams =
    <T>(schema: ZodType<T, ZodTypeDef, unknown>) =>
    (req: Request, _res: Response, next: NextFunction) => {
      const result = schema.safeParse(req.params);
      if (!result.success) throw result.error;
      next();
    };

  validateQuery =
    <T>(schema: ZodType<T, ZodTypeDef, unknown>) =>
    (req: Request, res: Response, next: NextFunction) => {
      const result = schema.safeParse(req.query);
      if (!result.success) throw result.error;
      res.locals[VALIDATED_QUERY_KEY] = result.data;
      next();
    };
}
