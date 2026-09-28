import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const { API_PROXY_TARGET } = loadEnv(mode, process.cwd(), '');
  if (!API_PROXY_TARGET) throw new Error('Variável de ambiente ausente: API_PROXY_TARGET');

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      proxy: {
        '/api': API_PROXY_TARGET,
        '/socket.io': { target: API_PROXY_TARGET, ws: true },
      },
    },
  };
});
