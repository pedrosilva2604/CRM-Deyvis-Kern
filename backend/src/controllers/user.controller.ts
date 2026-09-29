import type { Request, Response } from 'express';
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
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    const users = await this.userService.listUsers(loggedUserContext);
    res.status(200).json(users);
  };

  registerUser = async (req: Request, res: Response) => {
    const newUserRegistration: RegisterUserInput = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    const registeredUser = await this.userService.registerUser(newUserRegistration, loggedUserContext);
    res.status(201).json(registeredUser);
  };

  updateUser = async (req: Request<UserIdParams>, res: Response) => {
    const data: UpdateUserInput = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    const updatedUser = await this.userService.updateUser({ targetUserId: req.params.id, data }, loggedUserContext);
    res.status(200).json(updatedUser);
  };

  activateUser = async (req: Request<UserIdParams>, res: Response) => {
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    const activatedUser = await this.userService.activateUser({ targetUserId: req.params.id }, loggedUserContext);
    res.status(200).json(activatedUser);
  };

  deactivateUser = async (req: Request<UserIdParams>, res: Response) => {
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    const deactivatedUser = await this.userService.deactivateUser({ targetUserId: req.params.id }, loggedUserContext);
    res.status(200).json(deactivatedUser);
  };

  updateUserPassword = async (req: Request<UserIdParams>, res: Response) => {
    const data: UpdateUserPasswordInput = req.body;
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.userService.updateUserPassword({ targetUserId: req.params.id, data }, loggedUserContext);
    res.status(204).send();
  };

  deleteUser = async (req: Request<UserIdParams>, res: Response) => {
    const loggedUserContext = this.requestContextExtractor.extractLoggedUserContext(req);
    await this.userService.deleteUser({ targetUserId: req.params.id }, loggedUserContext);
    res.status(204).send();
  };
}
