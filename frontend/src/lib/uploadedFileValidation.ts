const ACCEPTED_FILE_EXTENSION = '.csv';
const NULL_BYTE = 0;

const BINARY_FILE_SIGNATURES: number[][] = [
  [0x50, 0x4b, 0x03, 0x04],
  [0xd0, 0xcf, 0x11, 0xe0],
  [0x25, 0x50, 0x44, 0x46],
];

function readFileExtension(fileName: string): string {
  const lastDotPosition = fileName.lastIndexOf('.');
  if (lastDotPosition === -1) return '';
  return fileName.slice(lastDotPosition).toLowerCase();
}

export function hasAcceptedFileExtension(fileName: string): boolean {
  return readFileExtension(fileName) === ACCEPTED_FILE_EXTENSION;
}

function startsWithSignature(fileBytes: Uint8Array, signature: number[]): boolean {
  return signature.every((signatureByte, position) => fileBytes[position] === signatureByte);
}

export function looksLikeBinaryFile(fileBytes: Uint8Array): boolean {
  if (BINARY_FILE_SIGNATURES.some((signature) => startsWithSignature(fileBytes, signature))) return true;
  return fileBytes.includes(NULL_BYTE);
}

export function decodeSpreadsheetText(fileBytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(fileBytes);
  } catch {
    return new TextDecoder('windows-1252').decode(fileBytes);
  }
}

export function measureUtf8Bytes(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}
