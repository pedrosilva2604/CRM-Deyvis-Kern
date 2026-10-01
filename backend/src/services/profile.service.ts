import { NotFoundError, UnauthorizedError } from '@/errors/app-errors';
import { AUTH_ERRORS } from '@/errors/errors.constants';
import type { AuthUser } from '@/models/auth.model';
import { toProfileOutput, type ProfileOutput, type UpdateThemeInput } from '@/models/user.model';
import type { IUserRepository } from '@/repositories/user.repository';

export interface IProfileService {
  updateUserTheme(loggedUser: AuthUser, chosenTheme: UpdateThemeInput): Promise<ProfileOutput>;
}

export class ProfileService implements IProfileService {
  constructor(private readonly userRepository: IUserRepository) {}

  async updateUserTheme(loggedUser: AuthUser, { theme }: UpdateThemeInput): Promise<ProfileOutput> {
    try {
      const user = await this.userRepository.updateUserTheme(loggedUser.id, theme);
      return toProfileOutput(user);
    } catch (error) {
      if (error instanceof NotFoundError) throw new UnauthorizedError(AUTH_ERRORS.INVALID_SESSION);
      throw error;
    }
  }
}
