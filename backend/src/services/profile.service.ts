import type { AuthUser } from '@/models/auth.model';
import { toProfileOutput, type ProfileOutput, type UpdateThemeInput } from '@/models/user.model';
import type { IUserRepository } from '@/repositories/user.repository';

export interface IProfileService {
  updateUserTheme(authUser: AuthUser, input: UpdateThemeInput): Promise<ProfileOutput>;
}

export class ProfileService implements IProfileService {
  constructor(private readonly userRepository: IUserRepository) {}

  async updateUserTheme(authUser: AuthUser, { theme }: UpdateThemeInput): Promise<ProfileOutput> {
    const user = await this.userRepository.updateUserTheme(authUser.id, theme);
    return toProfileOutput(user);
  }
}
