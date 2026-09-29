const ACCEPTED_FILE_EXTENSION = '.csv';

function readFileExtension(fileName: string): string {
  const lastDotPosition = fileName.lastIndexOf('.');
  if (lastDotPosition === -1) return '';
  return fileName.slice(lastDotPosition).toLowerCase();
}

export function hasAcceptedFileExtension(fileName: string): boolean {
  return readFileExtension(fileName) === ACCEPTED_FILE_EXTENSION;
}
