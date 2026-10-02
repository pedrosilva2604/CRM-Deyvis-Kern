import { App } from '@/app';
import { env } from '@/config/env';
import { AuthController } from '@/controllers/auth.controller';
import { HealthController } from '@/controllers/health.controller';
import { LeadImportController } from '@/controllers/lead-import.controller';
import { LeadIndicatorsController } from '@/controllers/lead-indicators.controller';
import { NotificationController } from '@/controllers/notification.controller';
import { PipelineController } from '@/controllers/pipeline.controller';
import { LeadController } from '@/controllers/lead.controller';
import { PasswordController } from '@/controllers/password.controller';
import { ProfileController } from '@/controllers/profile.controller';
import { UserController } from '@/controllers/user.controller';
import { TimeZoneBusinessCalendar } from '@/infra/business-calendar';
import { SystemClock } from '@/infra/clock';
import { SmtpMailer } from '@/infra/mailer';
import { Argon2PasswordHasher } from '@/infra/password-hasher';
import { RedisRealtimeEventRelay, RedisRealtimePublisher } from '@/infra/realtime-events';
import { createQueueProducerRedisClient, createWorkerRedisClient } from '@/infra/redis-connection';
import { ExpressRequestContextExtractor } from '@/infra/request-context-extractor';
import { HttpOnlySessionCookie } from '@/infra/session-cookie';
import { SessionTerminationBroadcaster } from '@/infra/session-termination';
import { SocketGateway } from '@/infra/socket';
import { AuthMiddleware } from '@/middlewares/auth.middleware';
import { CsvUploadMiddleware } from '@/middlewares/csv-upload.middleware';
import { ErrorMiddleware } from '@/middlewares/error.middleware';
import { RequestIdMiddleware } from '@/middlewares/request-id.middleware';
import { RateLimitMiddleware } from '@/middlewares/rate-limit.middleware';
import { ValidationMiddleware } from '@/middlewares/validation.middleware';
import { BullMqLeadImportQueue } from '@/queues/lead-import.queue';
import { PrismaAuditLogRepository } from '@/repositories/audit-log.repository';
import { createDatabaseClient } from '@/repositories/database-client';
import { LeadImportRepository } from '@/repositories/lead-import.repository';
import { LeadIndicatorsRepository } from '@/repositories/lead-indicators.repository';
import { NotificationRepository } from '@/repositories/notification.repository';
import { LeadRepository } from '@/repositories/lead.repository';
import { PipelineCardRepository } from '@/repositories/pipeline-card.repository';
import { PipelineRepository } from '@/repositories/pipeline.repository';
import { PrismaPasswordResetTokenRepository } from '@/repositories/password-reset-token.repository';
import { PrismaSessionRepository } from '@/repositories/session.repository';
import { UserRepository } from '@/repositories/user.repository';
import { AppRoutes } from '@/routes';
import { AuthRoutes } from '@/routes/auth.routes';
import { LeadRoutes } from '@/routes/lead.routes';
import { NotificationRoutes } from '@/routes/notification.routes';
import { PipelineRoutes } from '@/routes/pipeline.routes';
import { ProfileRoutes } from '@/routes/profile.routes';
import { UserRoutes } from '@/routes/user.routes';
import { AuditService } from '@/services/audit.service';
import { AuthService } from '@/services/auth.service';
import { LeadImportService } from '@/services/lead-import.service';
import { LeadIndicatorsService } from '@/services/lead-indicators.service';
import { LeadService } from '@/services/lead.service';
import { MailService } from '@/services/mail.service';
import { NotificationService } from '@/services/notification.service';
import { PasswordResetService } from '@/services/password-reset.service';
import { PipelineChangeAnnouncer } from '@/services/pipeline-change-announcer';
import { PipelineService } from '@/services/pipeline.service';
import { ProfileService } from '@/services/profile.service';
import { SessionService } from '@/services/session.service';
import { JwtTokenService } from '@/services/token.service';
import { UserService } from '@/services/user.service';

export const prisma = createDatabaseClient(env.DATABASE_URL);
export const queueRedisClient = createQueueProducerRedisClient(env.REDIS_URL);
export const leadImportQueue = new BullMqLeadImportQueue(queueRedisClient, {
  attempts: env.LEAD_IMPORT_JOB_ATTEMPTS,
  retryDelayMs: env.LEAD_IMPORT_RETRY_DELAY_MS,
});
const clock = new SystemClock();
const businessCalendar = new TimeZoneBusinessCalendar(clock, env.APP_TIME_ZONE);
const mailer = new SmtpMailer({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  user: env.SMTP_USER,
  pass: env.SMTP_PASS,
  from: env.SMTP_FROM,
});
const sessionCookie = new HttpOnlySessionCookie({ name: env.SESSION_COOKIE_NAME, secure: env.SESSION_COOKIE_SECURE });
const requestContextExtractor = new ExpressRequestContextExtractor();
const sessionTerminationBroadcaster = new SessionTerminationBroadcaster();

const userRepository = new UserRepository(prisma);
const sessionRepository = new PrismaSessionRepository(prisma);
const passwordResetTokenRepository = new PrismaPasswordResetTokenRepository(prisma);
const auditLogRepository = new PrismaAuditLogRepository(prisma);
const leadRepository = new LeadRepository(prisma);
const leadIndicatorsRepository = new LeadIndicatorsRepository(prisma);
const leadImportRepository = new LeadImportRepository(prisma);
const pipelineRepository = new PipelineRepository(prisma);
const pipelineCardRepository = new PipelineCardRepository(prisma);
const notificationRepository = new NotificationRepository(prisma);

const passwordHasher = new Argon2PasswordHasher({
  memoryKib: env.ARGON2_MEMORY_KIB,
  iterations: env.ARGON2_ITERATIONS,
  parallelism: env.ARGON2_PARALLELISM,
});
const tokenService = new JwtTokenService(env.JWT_SECRET);
const realtimePublisher = new RedisRealtimePublisher(queueRedisClient);
const notificationService = new NotificationService(notificationRepository, realtimePublisher, clock, {
  readRetentionDays: env.NOTIFICATION_READ_RETENTION_DAYS,
});
const auditService = new AuditService(auditLogRepository);
const mailService = new MailService(mailer, env.APP_NAME);
const sessionService = new SessionService(
  sessionRepository,
  tokenService,
  clock,
  env.SESSION_TTL_HOURS,
  sessionTerminationBroadcaster,
);
const authService = new AuthService(userRepository, passwordHasher, sessionService, auditService);
const userService = new UserService(userRepository, passwordHasher, sessionService, auditService);
const passwordResetService = new PasswordResetService(
  userRepository,
  passwordResetTokenRepository,
  userService,
  mailService,
  auditService,
  clock,
  { appUrl: env.APP_URL, tokenTtlMinutes: env.PASSWORD_RESET_TTL_MINUTES },
);
const profileService = new ProfileService(userRepository);
const leadService = new LeadService(
  leadRepository,
  userRepository,
  auditService,
  businessCalendar,
  clock,
);
const leadIndicatorsService = new LeadIndicatorsService(leadIndicatorsRepository, businessCalendar);
const leadImportService = new LeadImportService(leadImportRepository, pipelineRepository, leadImportQueue, auditService, businessCalendar, {
  maximumRows: env.LEAD_IMPORT_MAX_ROWS,
});

const pipelineChangeAnnouncer = new PipelineChangeAnnouncer(pipelineRepository, realtimePublisher);
const pipelineService = new PipelineService(
  pipelineRepository,
  pipelineCardRepository,
  leadRepository,
  notificationService,
  pipelineChangeAnnouncer,
  auditService,
  clock,
);

const authMiddleware = new AuthMiddleware(sessionService, sessionCookie);
const errorMiddleware = new ErrorMiddleware();
const validationMiddleware = new ValidationMiddleware();
const csvUploadMiddleware = new CsvUploadMiddleware(env.LEAD_IMPORT_MAX_FILE_BYTES);
const rateLimitMiddleware = new RateLimitMiddleware({
  windowMinutes: env.RATE_LIMIT_WINDOW_MINUTES,
  apiLimit: env.API_RATE_LIMIT,
  loginLimit: env.LOGIN_RATE_LIMIT,
  forgotPasswordLimit: env.FORGOT_PASSWORD_RATE_LIMIT,
  resetPasswordLimit: env.RESET_PASSWORD_RATE_LIMIT,
  leadImportLimit: env.LEAD_IMPORT_RATE_LIMIT,
  loggedUserApiLimit: env.USER_API_RATE_LIMIT,
});

const healthController = new HealthController();
const authController = new AuthController(authService, requestContextExtractor, sessionCookie);
const passwordController = new PasswordController(passwordResetService, requestContextExtractor);
const userController = new UserController(userService, requestContextExtractor);
const profileController = new ProfileController(profileService, requestContextExtractor);
const leadController = new LeadController(leadService, requestContextExtractor);
const leadIndicatorsController = new LeadIndicatorsController(leadIndicatorsService);
const leadImportController = new LeadImportController(leadImportService, requestContextExtractor);
const notificationController = new NotificationController(notificationService, requestContextExtractor);
const pipelineController = new PipelineController(pipelineService, requestContextExtractor);

const appRoutes = new AppRoutes(
  healthController,
  {
    auth: new AuthRoutes(authController, passwordController, rateLimitMiddleware, validationMiddleware),
    profile: new ProfileRoutes(profileController, validationMiddleware),
    users: new UserRoutes(userController, authMiddleware, validationMiddleware),
    leads: new LeadRoutes(
      leadController,
      leadIndicatorsController,
      leadImportController,
      authMiddleware,
      validationMiddleware,
      csvUploadMiddleware,
      rateLimitMiddleware,
    ),
    notifications: new NotificationRoutes(notificationController, validationMiddleware),
    pipelines: new PipelineRoutes(pipelineController, leadImportController, validationMiddleware, csvUploadMiddleware, rateLimitMiddleware),
  },
  authMiddleware,
  rateLimitMiddleware,
);

export const app = new App(
  {
    corsOrigin: env.CORS_ORIGIN,
    jsonBodyLimit: env.JSON_BODY_LIMIT,
    trustedProxies: env.TRUST_PROXY,
    production: env.NODE_ENV === 'production',
  },
  appRoutes.router,
  errorMiddleware,
  new RequestIdMiddleware(),
);
export const socketGateway = new SocketGateway(sessionService, sessionCookie, sessionTerminationBroadcaster, env.CORS_ORIGIN);
export const realtimeEventRelay = new RedisRealtimeEventRelay(createWorkerRedisClient(env.REDIS_URL), socketGateway);
