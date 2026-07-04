import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Клиент ходит на /api → проксируется на API-сервер (порт 4000).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:4000',
    },
  },
});
