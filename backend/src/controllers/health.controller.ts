import type { Request, Response } from 'express';

export class HealthController {
  checkHealth = (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  };
}
