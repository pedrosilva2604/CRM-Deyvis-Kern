import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'X-Request-Id';

export class RequestIdMiddleware {
  assignRequestId = (req: Request, res: Response, next: NextFunction) => {
    req.requestId = randomUUID();
    res.setHeader(REQUEST_ID_HEADER, req.requestId);
    next();
  };
}
