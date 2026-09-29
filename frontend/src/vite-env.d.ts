interface ImportMetaEnv {
  readonly VITE_APP_NAME: string;
  readonly VITE_ENABLE_API_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
