import { PrismaClient } from '@prisma/client';
import { App } from '@/app';
import { env } from '@/config/env';
import { AuthController } from '@/controllers/auth.controller';
import { HealthController } from '@/controllers/health.controller';
import { PasswordController } from '@/controllers/password.controller';
import { ProfileController } from '@/controllers/profile.controller';
import { UserController } from '@/controllers/user.controller';
import { SystemClock } from '@/lib/clock';
import { SmtpMailer } from '@/lib/mailer';
import { ExpressRequestContextExtractor } from '@/lib/request-context-extractor';
import { HttpOnlySessionCookie } from '@/lib/session-cookie';
import { SocketGateway } from '@/lib/socket';
import { AuthMiddleware } from '@/middlewares/auth.middleware';
import { ErrorMiddleware } from '@/middlewares/error.middleware';
import { RateLimitMiddleware } from '@/middlewares/rate-limit.middleware';
import { ValidationMiddleware } from '@/middlewares/validation.middleware';
import { PrismaAuditLogRepository } from '@/repositories/audit-log.repository';
import { PrismaPasswordResetTokenRepository } from '@/repositories/password-reset-token.repository';
import { PrismaSessionRepository } from '@/repositories/session.repository';
import { UserRepository } from '@/repositories/user.repository';
import { AppRoutes } from '@/routes';
import { AuthRoutes } from '@/routes/auth.routes';
import { ProfileRoutes } from '@/routes/profile.routes';
import { UserRoutes } from '@/routes/user.routes';
import { AuditService } from '@/services/audit.service';
import { AuthService } from '@/services/auth.service';
import { MailService } from '@/services/mail.service';
import { BcryptPasswordHasher } from '@/services/password-hasher.service';
import { PasswordResetService } from '@/services/password-reset.service';
import { ProfileService } from '@/services/profile.service';
import { SessionService } from '@/services/session.service';
import { JwtTokenService } from '@/services/token.service';
import { UserService } from '@/services/user.service';

const prisma = new PrismaClient();
const clock = new SystemClock();
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

const userRepository = new UserRepository(prisma);
const sessionRepository = new PrismaSessionRepository(prisma);
const passwordResetTokenRepository = new PrismaPasswordResetTokenRepository(prisma);
const auditLogRepository = new PrismaAuditLogRepository(prisma);

const passwordHasher = new BcryptPasswordHasher(env.BCRYPT_ROUNDS);
const tokenService = new JwtTokenService(env.JWT_SECRET);
const auditService = new AuditService(auditLogRepository);
const mailService = new MailService(mailer, env.APP_NAME);
const sessionService = new SessionService(sessionRepository, tokenService, clock, env.SESSION_TTL_HOURS);
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

const authMiddleware = new AuthMiddleware(sessionService, sessionCookie);
const errorMiddleware = new ErrorMiddleware();
const validationMiddleware = new ValidationMiddleware();
const rateLimitMiddleware = new RateLimitMiddleware({
  windowMinutes: env.RATE_LIMIT_WINDOW_MINUTES,
  apiLimit: env.API_RATE_LIMIT,
  loginLimit: env.LOGIN_RATE_LIMIT,
  forgotPasswordLimit: env.FORGOT_PASSWORD_RATE_LIMIT,
  resetPasswordLimit: env.RESET_PASSWORD_RATE_LIMIT,
});

const healthController = new HealthController();
const authController = new AuthController(authService, requestContextExtractor, sessionCookie);
const passwordController = new PasswordController(passwordResetService, requestContextExtractor);
const userController = new UserController(userService, requestContextExtractor);
const profileController = new ProfileController(profileService, requestContextExtractor);

const appRoutes = new AppRoutes(
  healthController,
  {
    auth: new AuthRoutes(authController, passwordController, rateLimitMiddleware, validationMiddleware),
    profile: new ProfileRoutes(profileController, validationMiddleware),
    users: new UserRoutes(userController, authMiddleware, validationMiddleware),
  },
  authMiddleware,
  rateLimitMiddleware,
);

export const app = new App(
  { corsOrigin: env.CORS_ORIGIN, jsonBodyLimit: env.JSON_BODY_LIMIT, production: env.NODE_ENV === 'production' },
  appRoutes.router,
  errorMiddleware,
);
export const socketGateway = new SocketGateway(sessionService, sessionCookie, env.CORS_ORIGIN);
