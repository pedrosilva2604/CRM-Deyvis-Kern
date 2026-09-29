import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function readDevProxyTarget(mode: string) {
  const { API_PROXY_TARGET } = loadEnv(mode, process.cwd(), '');
  if (!API_PROXY_TARGET) throw new Error('Variável de ambiente ausente: API_PROXY_TARGET');
  return API_PROXY_TARGET;
}

export default defineConfig(({ command, mode }) => {
  const isDevServer = command === 'serve';
  const devProxyTarget = isDevServer ? readDevProxyTarget(mode) : undefined;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: devProxyTarget
      ? {
          proxy: {
            '/api': devProxyTarget,
            '/socket.io': { target: devProxyTarget, ws: true },
          },
        }
      : undefined,
  };
});
