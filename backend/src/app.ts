import express, { type Express, type Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import type { ErrorMiddleware } from '@/middlewares/error.middleware';
import type { RequestIdMiddleware } from '@/middlewares/request-id.middleware';

export interface AppConfig {
  corsOrigin: string;
  jsonBodyLimit: string;
  trustedProxies: string | number;
  production: boolean;
}

export class App {
  readonly express: Express = express();

  constructor(
    private readonly config: AppConfig,
    private readonly routes: Router,
    private readonly errorMiddleware: ErrorMiddleware,
    private readonly requestIdMiddleware: RequestIdMiddleware,
  ) {
    this.identifyRequests();
    this.configureSecurity();
    this.configureParsers();
    this.configureLogging();
    this.registerRoutes();
    this.registerErrorHandler();
  }

  private identifyRequests() {
    this.express.use(this.requestIdMiddleware.assignRequestId);
  }

  private configureSecurity() {
    this.express.disable('x-powered-by');
    this.express.set('trust proxy', this.config.trustedProxies);
    this.express.use(helmet());
    this.express.use(cors({ origin: this.config.corsOrigin, credentials: true }));
  }

  private configureParsers() {
    this.express.use(express.json({ limit: this.config.jsonBodyLimit }));
  }

  private configureLogging() {
    this.express.use(morgan(this.config.production ? 'combined' : 'dev'));
  }

  private registerRoutes() {
    this.express.use('/api', this.routes);
  }

  private registerErrorHandler() {
    this.express.use(this.errorMiddleware.handleNotFound);
    this.express.use(this.errorMiddleware.handleError);
  }
}
