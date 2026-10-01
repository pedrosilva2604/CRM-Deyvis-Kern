import type { Request, Response } from 'express';
import { PROFILE_SUCCESS_MESSAGES } from '@/constants/success-messages';
import { HttpStatus, sendSuccessMessage } from '@/infra/http-status';
import type { RequestContextExtractor } from '@/infra/request-context-extractor';
import type { UpdateThemeInput } from '@/models/user.model';
import type { IProfileService } from '@/services/profile.service';

export class ProfileController {
  constructor(
    private readonly profileService: IProfileService,
    private readonly requestContextExtractor: RequestContextExtractor,
  ) {}

  updateUserTheme = async (req: Request, res: Response) => {
    const chosenTheme: UpdateThemeInput = req.body;
    const loggedUser = this.requestContextExtractor.extractLoggedUser(req);
    await this.profileService.updateUserTheme(loggedUser, chosenTheme);
    sendSuccessMessage(res, HttpStatus.OK, PROFILE_SUCCESS_MESSAGES.THEME_UPDATED);
  };
}
