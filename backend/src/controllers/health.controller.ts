import type { Request, Response } from 'express';
import { HttpStatus } from '@/infra/http-status';

export class HealthController {
  checkHealth = (_req: Request, res: Response) => {
    res.status(HttpStatus.OK).json({ status: 'ok' });
  };
}
