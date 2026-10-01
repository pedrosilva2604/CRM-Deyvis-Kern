import type { Request, Response } from 'express';
import { USER_SUCCESS_MESSAGES } from '@/constants/success-messages';
import { HttpStatus, sendSuccessMessage } from '@/infra/http-status';
import type { RequestContextExtractor } from '@/infra/request-context-extractor';
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
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    const users = await this.userService.listUsers(loggedUserContext);
    res.status(HttpStatus.OK).json(users);
  };

  registerUser = async (req: Request, res: Response) => {
    const newUserRegistration: RegisterUserInput = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.userService.registerUser(newUserRegistration, loggedUserContext);
    sendSuccessMessage(res, HttpStatus.CREATED, USER_SUCCESS_MESSAGES.CREATED);
  };

  updateUser = async (req: Request<UserIdParams>, res: Response) => {
    const userChanges: UpdateUserInput = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.userService.updateUser({ targetUserId: req.params.id, data: userChanges }, loggedUserContext);
    sendSuccessMessage(res, HttpStatus.OK, USER_SUCCESS_MESSAGES.UPDATED);
  };

  activateUser = async (req: Request<UserIdParams>, res: Response) => {
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.userService.activateUser({ targetUserId: req.params.id }, loggedUserContext);
    sendSuccessMessage(res, HttpStatus.OK, USER_SUCCESS_MESSAGES.ACTIVATED);
  };

  deactivateUser = async (req: Request<UserIdParams>, res: Response) => {
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.userService.deactivateUser({ targetUserId: req.params.id }, loggedUserContext);
    sendSuccessMessage(res, HttpStatus.OK, USER_SUCCESS_MESSAGES.DEACTIVATED);
  };

  updateUserPassword = async (req: Request<UserIdParams>, res: Response) => {
    const newPasswordRequest: UpdateUserPasswordInput = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.userService.updateUserPassword({ targetUserId: req.params.id, data: newPasswordRequest }, loggedUserContext);
    sendSuccessMessage(res, HttpStatus.OK, USER_SUCCESS_MESSAGES.PASSWORD_CHANGED);
  };

  deleteUser = async (req: Request<UserIdParams>, res: Response) => {
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.userService.deleteUser({ targetUserId: req.params.id }, loggedUserContext);
    sendSuccessMessage(res, HttpStatus.OK, USER_SUCCESS_MESSAGES.DELETED);
  };
}
