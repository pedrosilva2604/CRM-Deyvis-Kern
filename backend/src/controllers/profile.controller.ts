import type { Request, Response } from 'express';
import { PROFILE_SUCCESS_MESSAGES } from '@/constants/success-messages';
import { HttpStatus, sendSuccessMessage } from '@/lib/http-status';
import type { RequestContextExtractor } from '@/lib/request-context-extractor';
import type { UpdateThemeInput } from '@/models/user.model';
import type { IProfileService } from '@/services/profile.service';

export class ProfileController {
  constructor(
    private readonly profileService: IProfileService,
    private readonly requestContextExtractor: RequestContextExtractor,
  ) {}

  updateUserTheme = async (req: Request, res: Response) => {
    const chosenTheme: UpdateThemeInput = req.body;
    await this.profileService.updateUserTheme(this.requestContextExtractor.extractLoggedUser(req), chosenTheme);
    sendSuccessMessage(res, HttpStatus.OK, PROFILE_SUCCESS_MESSAGES.THEME_UPDATED);
  };
}
