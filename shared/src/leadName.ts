const MINIMUM_LETTERS_IN_NAME = 2;
const MAXIMUM_NAME_LENGTH = 120;
const ALLOWED_NAME_CHARACTERS = /^[\p{L}\p{M}\d '’.&-]+$/u;
const LETTER = /\p{L}/gu;
const LINK_OR_EMAIL = /(https?:\/\/|www\.|@)/i;

export function normalizeLeadName(rawName: string): string {
  return rawName.trim().replace(/\s+/g, ' ');
}

export function findProblemWithLeadName(normalizedName: string): string | null {
  if (normalizedName === '') return 'Nome vazio';
  if (normalizedName.length > MAXIMUM_NAME_LENGTH) return `Nome com mais de ${MAXIMUM_NAME_LENGTH} caracteres`;
  if (LINK_OR_EMAIL.test(normalizedName)) return `Nome com link ou e-mail: "${normalizedName}"`;
  if (!ALLOWED_NAME_CHARACTERS.test(normalizedName)) return `Nome com caracteres não permitidos: "${normalizedName}"`;
  const letterCount = normalizedName.match(LETTER)?.length ?? 0;
  if (letterCount < MINIMUM_LETTERS_IN_NAME) return `Nome precisa ter pelo menos ${MINIMUM_LETTERS_IN_NAME} letras: "${normalizedName}"`;
  return null;
}
