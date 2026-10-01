interface ImportMetaEnv {
  readonly VITE_APP_NAME: string;
  readonly VITE_ENABLE_API_MOCKS?: string;
  readonly VITE_LEAD_IMPORT_MAX_ROWS: string;
  readonly VITE_LEAD_IMPORT_MAX_FILE_BYTES: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
