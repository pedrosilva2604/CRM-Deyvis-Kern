function required(name: keyof ImportMetaEnv) {
  const value = import.meta.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return String(value);
}

function requiredPositiveInteger(name: keyof ImportMetaEnv) {
  const value = Number(required(name));
  if (!Number.isInteger(value) || value <= 0) throw new Error(`Variável de ambiente precisa ser um inteiro positivo: ${name}`);
  return value;
}

export const env = {
  appName: required('VITE_APP_NAME'),
  fakeApiEnabled: import.meta.env.DEV && import.meta.env.VITE_ENABLE_API_MOCKS === 'true',
  leadImportMaximumRows: requiredPositiveInteger('VITE_LEAD_IMPORT_MAX_ROWS'),
  leadImportMaximumFileBytes: requiredPositiveInteger('VITE_LEAD_IMPORT_MAX_FILE_BYTES'),
};
