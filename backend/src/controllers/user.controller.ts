import type { Request, Response } from 'express';
import type { RequestContextExtractor } from '@/lib/request-context-extractor';
import type {
  RegisterUserInput,
  UpdateUserInput,
  UpdateUserPasswordInput,
  UpdateUserStatusInput,
  UserIdParams,
} from '@/models/user.model';
import type { IUserService } from '@/services/user.service';

export class UserController {
  constructor(
    private readonly userService: IUserService,
    private readonly request: RequestContextExtractor,
  ) {}

  listUsers = async (req: Request, res: Response) => {
    const users = await this.userService.listUsers(this.request.extractAuthenticatedContext(req));
    res.status(200).json(users);
  };

  registerUser = async (req: Request, res: Response) => {
    const input: RegisterUserInput = req.body;
    const user = await this.userService.registerUser(input, this.request.extractAuthenticatedContext(req));
    res.status(201).json(user);
  };

  updateUser = async (req: Request<UserIdParams>, res: Response) => {
    const { id } = req.params;
    const data: UpdateUserInput = req.body;
    const user = await this.userService.updateUser(
      { targetUserId: id, data },
      this.request.extractAuthenticatedContext(req),
    );
    res.status(200).json(user);
  };

  updateUserStatus = async (req: Request<UserIdParams>, res: Response) => {
    const { id } = req.params;
    const data: UpdateUserStatusInput = req.body;
    const user = await this.userService.updateUserStatus(
      { targetUserId: id, data },
      this.request.extractAuthenticatedContext(req),
    );
    res.status(200).json(user);
  };

  updateUserPassword = async (req: Request<UserIdParams>, res: Response) => {
    const { id } = req.params;
    const data: UpdateUserPasswordInput = req.body;
    await this.userService.updateUserPassword({ targetUserId: id, data }, this.request.extractAuthenticatedContext(req));
    res.status(204).send();
  };

  deleteUser = async (req: Request<UserIdParams>, res: Response) => {
    const { id } = req.params;
    await this.userService.deleteUser({ targetUserId: id }, this.request.extractAuthenticatedContext(req));
    res.status(204).send();
  };
}
