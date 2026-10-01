import { randomBytes, randomUUID } from 'node:crypto';
import { argon2id, argon2Verify } from 'hash-wasm';

const ARGON2ID_PREFIX = '$argon2id$';
const SALT_BYTES = 16;
const HASH_BYTES = 32;

export interface IPasswordHasher {
  hashPassword(plain: string): Promise<string>;
  passwordMatches(plain: string, hash: string | undefined): Promise<boolean>;
}

export interface Argon2Config {
  memoryKib: number;
  iterations: number;
  parallelism: number;
}

export class Argon2PasswordHasher implements IPasswordHasher {
  private readonly dummyHash: Promise<string>;

  constructor(private readonly config: Argon2Config) {
    this.dummyHash = this.hashPassword(randomUUID());
  }

  async hashPassword(plain: string): Promise<string> {
    return await argon2id({
      password: plain,
      salt: randomBytes(SALT_BYTES),
      memorySize: this.config.memoryKib,
      iterations: this.config.iterations,
      parallelism: this.config.parallelism,
      hashLength: HASH_BYTES,
      outputType: 'encoded',
    });
  }

  async passwordMatches(plain: string, hash: string | undefined): Promise<boolean> {
    if (!hash?.startsWith(ARGON2ID_PREFIX)) return await this.simulateVerification(plain);
    return await argon2Verify({ password: plain, hash });
  }

  private async simulateVerification(plain: string): Promise<false> {
    await argon2Verify({ password: plain, hash: await this.dummyHash });
    return false;
  }
}
