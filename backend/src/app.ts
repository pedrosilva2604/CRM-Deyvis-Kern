import express, { type Express, type Router } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import type { ErrorMiddleware } from '@/middlewares/error.middleware';

export interface AppConfig {
  corsOrigin: string;
  jsonBodyLimit: string;
  production: boolean;
}

export class App {
  readonly express: Express = express();

  constructor(
    private readonly config: AppConfig,
    private readonly routes: Router,
    private readonly errorMiddleware: ErrorMiddleware,
  ) {
    this.configureSecurity();
    this.configureParsers();
    this.configureLogging();
    this.registerRoutes();
    this.registerErrorHandler();
  }

  private configureSecurity() {
    this.express.disable('x-powered-by');
    this.express.set('trust proxy', 'loopback');
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
