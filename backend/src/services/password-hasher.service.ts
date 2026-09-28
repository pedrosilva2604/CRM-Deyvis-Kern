import bcrypt from 'bcryptjs';

export interface IPasswordHasher {
  hashPassword(plain: string): Promise<string>;
  passwordMatches(plain: string, hash: string | undefined): Promise<boolean>;
}

export class BcryptPasswordHasher implements IPasswordHasher {
  private readonly dummyHash: string;

  constructor(private readonly rounds: number) {
    this.dummyHash = bcrypt.hashSync(crypto.randomUUID(), rounds);
  }

  async hashPassword(plain: string): Promise<string> {
    return await bcrypt.hash(plain, this.rounds);
  }

  async passwordMatches(plain: string, hash: string | undefined): Promise<boolean> {
    const matched = await bcrypt.compare(plain, hash ?? this.dummyHash);
    return matched && hash !== undefined;
  }
}
