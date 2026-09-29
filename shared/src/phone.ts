import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';

const COUNTRY_WHEN_NO_COUNTRY_CODE: CountryCode = 'BR';
const HOME_COUNTRY: CountryCode = 'BR';
const countryNameFormatter = new Intl.DisplayNames(['pt-BR'], { type: 'region' });
const ALLOWED_PHONE_CHARACTERS = /^\+?[\d\s().-]+$/;

export type LeadPhoneReading =
  | { status: 'empty' }
  | { status: 'valid'; internationalPhone: string; country: CountryCode | undefined }
  | { status: 'invalid'; reason: string };

function describeInvalidPhone(trimmedPhone: string) {
  if (trimmedPhone.startsWith('+')) return `Telefone inválido para o país informado: "${trimmedPhone}"`;
  return `Telefone inválido: "${trimmedPhone}" (números de fora do Brasil precisam começar com + e o código do país)`;
}

export function readLeadPhone(rawPhone: string): LeadPhoneReading {
  const trimmedPhone = rawPhone.trim();
  if (trimmedPhone === '') return { status: 'empty' };

  if (!ALLOWED_PHONE_CHARACTERS.test(trimmedPhone)) {
    return { status: 'invalid', reason: `Telefone com caracteres não permitidos: "${trimmedPhone}"` };
  }

  const parsedPhone = parsePhoneNumberFromString(trimmedPhone, COUNTRY_WHEN_NO_COUNTRY_CODE);
  if (!parsedPhone?.isValid()) return { status: 'invalid', reason: describeInvalidPhone(trimmedPhone) };

  return { status: 'valid', internationalPhone: parsedPhone.number, country: parsedPhone.country };
}

export function formatPhoneForDisplay(internationalPhone: string): string {
  const parsedPhone = parsePhoneNumberFromString(internationalPhone);
  if (!parsedPhone) return internationalPhone;
  return parsedPhone.country === HOME_COUNTRY ? parsedPhone.formatNational() : parsedPhone.formatInternational();
}

export function isHomeCountry(phoneCountry: string | null): boolean {
  return phoneCountry === HOME_COUNTRY;
}

export function describeCountry(phoneCountry: string | null): string {
  if (!phoneCountry) return 'País não identificado';
  return countryNameFormatter.of(phoneCountry) ?? phoneCountry;
}
