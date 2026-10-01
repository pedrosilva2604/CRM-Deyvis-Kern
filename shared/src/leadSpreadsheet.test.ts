import { describe, expect, it } from 'vitest';
import { readLeadSpreadsheet, type LeadSpreadsheetReading } from './leadSpreadsheet';

const TODAY = new Date(2026, 8, 30);
const LIMITS = { maximumRows: 10_000 };

function readContent(csvText: string) {
  const reading = readLeadSpreadsheet(csvText, TODAY, LIMITS);
  if (reading.status !== 'read') throw new Error(`planilha recusada: ${reading.reason}`);
  return reading.content;
}

function readRejection(csvText: string, limits = LIMITS): string {
  const reading: LeadSpreadsheetReading = readLeadSpreadsheet(csvText, TODAY, limits);
  if (reading.status !== 'unreadable') throw new Error('a planilha deveria ser recusada');
  return reading.reason;
}

describe('readLeadSpreadsheet', () => {
  it('lê uma planilha do Excel com BOM e ponto e vírgula, normalizando telefone, país e e-mail', () => {
    const content = readContent('﻿Nome;Telefone;E-mail;Data\nMaria Silva;(11) 98765-4321;MARIA@Exemplo.com;15/03/2026');

    expect(content.rowsToImport).toEqual([
      {
        rowNumber: 2,
        name: 'Maria Silva',
        phone: '+5511987654321',
        phoneCountry: 'BR',
        email: 'maria@exemplo.com',
        enteredOn: '2026-03-15',
      },
    ]);
  });

  it('reconhece número estrangeiro com o código do país', () => {
    const [row] = readContent('Nome,Telefone\nPedro Lima,+1 415 555 0132').rowsToImport;

    expect(row).toMatchObject({ phone: '+14155550132', phoneCountry: 'US' });
  });

  it('deixa a data vazia como null para o servidor usar o dia da importação', () => {
    const [row] = readContent('Nome,Telefone,Data\nAna Souza,11987654321,').rowsToImport;

    expect(row?.enteredOn).toBeNull();
  });

  it('lista todos os problemas de uma linha inválida, com o número da linha da planilha', () => {
    const content = readContent('Nome,Telefone,Email,Data\nAna,123,email-ruim,31/02/2026');

    expect(content.rowsToImport).toHaveLength(0);
    expect(content.invalidRows).toEqual([
      {
        rowNumber: 2,
        problems: [
          expect.stringContaining('Telefone inválido'),
          'E-mail inválido: "email-ruim"',
          expect.stringContaining('Data que não existe'),
        ],
      },
    ]);
  });

  it('mantém só a primeira linha quando telefone ou e-mail se repetem na planilha', () => {
    const content = readContent(
      [
        'Nome,Telefone,Email',
        'Maria Silva,(11) 98765-4321,maria@exemplo.com',
        'Maria Repetida,11 98765 4321,',
        'Outra Maria,(21) 98888-7777,MARIA@exemplo.com',
      ].join('\n'),
    );

    expect(content.rowsToImport.map((row) => row.rowNumber)).toEqual([2]);
    expect(content.duplicateRows).toEqual([
      { rowNumber: 3, sameAsRowNumber: 2, matchedBy: 'phone' },
      { rowNumber: 4, sameAsRowNumber: 2, matchedBy: 'email' },
    ]);
  });

  it('respeita aspas com separador e quebra de linha dentro do campo', () => {
    const content = readContent('Nome,Telefone,Observação\n"Silva, Ana",11987654321,"linha com\nquebra"');

    expect(content.rowsToImport).toHaveLength(0);
    expect(content.invalidRows[0]?.problems[0]).toContain('caracteres não permitidos');
  });

  it('ignora colunas que não conhece e avisa quais foram', () => {
    const content = readContent('Nome,Telefone,Observação,Cidade\nAna Souza,11987654321,vip,Recife');

    expect(content.ignoredHeaders).toEqual(['Observação', 'Cidade']);
  });

  it('recusa planilha sem a coluna obrigatória de telefone', () => {
    expect(readRejection('Nome,Email\nAna,ana@exemplo.com')).toBe('A planilha precisa ter a coluna de telefone');
  });

  it('recusa planilha com duas colunas para o mesmo campo', () => {
    expect(readRejection('Nome,Telefone,Celular\nAna,11987654321,11999998888')).toContain('mais de uma coluna de telefone');
  });

  it('recusa planilha vazia e planilha só com o cabeçalho', () => {
    expect(readRejection('')).toBe('A planilha está vazia');
    expect(readRejection('Nome,Telefone')).toBe('A planilha só tem o cabeçalho, sem leads');
  });

  it('recusa aspas sem fechamento', () => {
    expect(readRejection('Nome,Telefone\n"Ana,11999998888')).toContain('Aspas sem fechamento');
  });

  it('para de ler assim que passa do limite de linhas', () => {
    const tooManyRows = ['Nome,Telefone', ...Array.from({ length: 4 }, (_, index) => `Lead ${index},1198765432${index}`)].join('\n');

    expect(readRejection(tooManyRows, { maximumRows: 3 })).toContain('limite de 3 leads');
  });

  it('para de ler uma linha com colunas demais (proteção contra arquivo malicioso)', () => {
    const tooManyColumns = `Nome,Telefone${',extra'.repeat(60)}\nAna,11987654321`;

    expect(readRejection(tooManyColumns)).toContain('mais de 50 colunas');
  });
});
