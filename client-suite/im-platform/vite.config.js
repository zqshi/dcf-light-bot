import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  server: {
    port: 5200,
    proxy: {
      '/_matrix': {
        target: 'http://localhost:8008',
        changeOrigin: true
      },
      '/api/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        manualChunks: {
          'matrix-sdk': ['matrix-js-sdk'],
        }
      }
    }
  }
});
