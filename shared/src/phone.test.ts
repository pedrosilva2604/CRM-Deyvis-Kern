import { describe, expect, it } from 'vitest';
import { formatPhoneForDisplay, readLeadPhone } from './phone';

describe('readLeadPhone', () => {
  it.each([
    ['(11) 98765-4321'],
    ['11 98765 4321'],
    ['11987654321'],
    ['+55 11 98765-4321'],
  ])('entende o celular brasileiro escrito como "%s"', (rawPhone) => {
    expect(readLeadPhone(rawPhone)).toEqual({ status: 'valid', internationalPhone: '+5511987654321', country: 'BR' });
  });

  it('entende número estrangeiro que começa com + e o código do país', () => {
    expect(readLeadPhone('+351 912 345 678')).toMatchObject({ status: 'valid', internationalPhone: '+351912345678', country: 'PT' });
  });

  it('trata texto em branco como telefone vazio', () => {
    expect(readLeadPhone('   ')).toEqual({ status: 'empty' });
  });

  it('recusa letras e outros caracteres fora de um telefone', () => {
    expect(readLeadPhone('11 9876-ABCD')).toMatchObject({ status: 'invalid', reason: expect.stringContaining('caracteres não permitidos') });
  });

  it('recusa número curto demais e explica como escrever número estrangeiro', () => {
    expect(readLeadPhone('123')).toMatchObject({ status: 'invalid', reason: expect.stringContaining('precisam começar com +') });
  });
});

describe('formatPhoneForDisplay', () => {
  it('mostra número brasileiro no formato nacional e estrangeiro no internacional', () => {
    expect(formatPhoneForDisplay('+5511987654321')).toBe('(11) 98765-4321');
    expect(formatPhoneForDisplay('+14155550132')).toBe('+1 415 555 0132');
  });
});
