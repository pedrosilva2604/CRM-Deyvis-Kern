function required(name: keyof ImportMetaEnv) {
  const value = import.meta.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return String(value);
}

export const env = {
  appName: required('VITE_APP_NAME'),
  fakeApiEnabled: import.meta.env.DEV && import.meta.env.VITE_ENABLE_API_MOCKS === 'true',
};
