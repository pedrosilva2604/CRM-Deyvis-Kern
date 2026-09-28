export interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  user: { active: boolean };
}
