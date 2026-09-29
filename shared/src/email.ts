const MAXIMUM_EMAIL_LENGTH = 254;
const VALID_EMAIL = /^(?!\.)(?!.*\.\.)[a-z0-9._%+-]+(?<!\.)@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

export function normalizeEmail(rawEmail: string): string {
  return rawEmail.trim().toLowerCase();
}

export function isValidEmail(normalizedEmail: string): boolean {
  return normalizedEmail.length <= MAXIMUM_EMAIL_LENGTH && VALID_EMAIL.test(normalizedEmail);
}
