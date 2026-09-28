import type { Request, Response } from 'express';
import type { RequestContextExtractor } from '@/lib/request-context-extractor';
import type { UpdateThemeInput } from '@/models/user.model';
import type { IProfileService } from '@/services/profile.service';

export class ProfileController {
  constructor(
    private readonly profileService: IProfileService,
    private readonly request: RequestContextExtractor,
  ) {}

  updateUserTheme = async (req: Request, res: Response) => {
    const input: UpdateThemeInput = req.body;
    const user = await this.profileService.updateUserTheme(this.request.extractAuthUser(req), input);
    res.status(200).json(user);
  };
}
