import type { Request, Response } from 'express';
import { USER_SUCCESS_MESSAGES } from '@/constants/success-messages';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/errors/app-errors';
import { HttpStatus, sendErrorResponse, sendSuccessMessage } from '@/lib/http-status';
import type { RequestContextExtractor } from '@/lib/request-context-extractor';
import type {
  RegisterUserInput,
  UpdateUserInput,
  UpdateUserPasswordInput,
  UserIdParams,
} from '@/models/user.model';
import type { IUserService } from '@/services/user.service';

export class UserController {
  constructor(
    private readonly userService: IUserService,
    private readonly requestContextExtractor: RequestContextExtractor,
  ) {}

  listUsers = async (req: Request, res: Response) => {
    try {
      const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
      const users = await this.userService.listUsers(loggedUserContext);
      res.status(HttpStatus.OK).json(users);
    } catch (error) {
      if (error instanceof ForbiddenError) return sendErrorResponse(res, HttpStatus.FORBIDDEN, error);
      throw error;
    }
  };

  registerUser = async (req: Request, res: Response) => {
    try {
      const newUserRegistration: RegisterUserInput = req.body;
      const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
      await this.userService.registerUser(newUserRegistration, loggedUserContext);
      sendSuccessMessage(res, HttpStatus.CREATED, USER_SUCCESS_MESSAGES.CREATED);
    } catch (error) {
      if (error instanceof ForbiddenError) return sendErrorResponse(res, HttpStatus.FORBIDDEN, error);
      if (error instanceof ConflictError) return sendErrorResponse(res, HttpStatus.CONFLICT, error);
      throw error;
    }
  };

  updateUser = async (req: Request<UserIdParams>, res: Response) => {
    try {
      const userChanges: UpdateUserInput = req.body;
      const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
      await this.userService.updateUser({ targetUserId: req.params.id, data: userChanges }, loggedUserContext);
      sendSuccessMessage(res, HttpStatus.OK, USER_SUCCESS_MESSAGES.UPDATED);
    } catch (error) {
      if (error instanceof ForbiddenError) return sendErrorResponse(res, HttpStatus.FORBIDDEN, error);
      if (error instanceof NotFoundError) return sendErrorResponse(res, HttpStatus.NOT_FOUND, error);
      if (error instanceof ConflictError) return sendErrorResponse(res, HttpStatus.CONFLICT, error);
      if (error instanceof BadRequestError) return sendErrorResponse(res, HttpStatus.BAD_REQUEST, error);
      throw error;
    }
  };

  activateUser = async (req: Request<UserIdParams>, res: Response) => {
    try {
      const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
      await this.userService.activateUser({ targetUserId: req.params.id }, loggedUserContext);
      sendSuccessMessage(res, HttpStatus.OK, USER_SUCCESS_MESSAGES.ACTIVATED);
    } catch (error) {
      if (error instanceof ForbiddenError) return sendErrorResponse(res, HttpStatus.FORBIDDEN, error);
      if (error instanceof NotFoundError) return sendErrorResponse(res, HttpStatus.NOT_FOUND, error);
      throw error;
    }
  };

  deactivateUser = async (req: Request<UserIdParams>, res: Response) => {
    try {
      const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
      await this.userService.deactivateUser({ targetUserId: req.params.id }, loggedUserContext);
      sendSuccessMessage(res, HttpStatus.OK, USER_SUCCESS_MESSAGES.DEACTIVATED);
    } catch (error) {
      if (error instanceof ForbiddenError) return sendErrorResponse(res, HttpStatus.FORBIDDEN, error);
      if (error instanceof NotFoundError) return sendErrorResponse(res, HttpStatus.NOT_FOUND, error);
      if (error instanceof BadRequestError) return sendErrorResponse(res, HttpStatus.BAD_REQUEST, error);
      throw error;
    }
  };

  updateUserPassword = async (req: Request<UserIdParams>, res: Response) => {
    try {
      const newPasswordRequest: UpdateUserPasswordInput = req.body;
      const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
      await this.userService.updateUserPassword({ targetUserId: req.params.id, data: newPasswordRequest }, loggedUserContext);
      sendSuccessMessage(res, HttpStatus.OK, USER_SUCCESS_MESSAGES.PASSWORD_CHANGED);
    } catch (error) {
      if (error instanceof ForbiddenError) return sendErrorResponse(res, HttpStatus.FORBIDDEN, error);
      if (error instanceof NotFoundError) return sendErrorResponse(res, HttpStatus.NOT_FOUND, error);
      throw error;
    }
  };

  deleteUser = async (req: Request<UserIdParams>, res: Response) => {
    try {
      const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
      await this.userService.deleteUser({ targetUserId: req.params.id }, loggedUserContext);
      sendSuccessMessage(res, HttpStatus.OK, USER_SUCCESS_MESSAGES.DELETED);
    } catch (error) {
      if (error instanceof ForbiddenError) return sendErrorResponse(res, HttpStatus.FORBIDDEN, error);
      if (error instanceof NotFoundError) return sendErrorResponse(res, HttpStatus.NOT_FOUND, error);
      if (error instanceof BadRequestError) return sendErrorResponse(res, HttpStatus.BAD_REQUEST, error);
      throw error;
    }
  };
}
