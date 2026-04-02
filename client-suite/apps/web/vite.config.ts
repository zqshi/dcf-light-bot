import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/client-suite/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
  server: {
    port: 5176,
    host: '127.0.0.1',
    proxy: {
      // Proxy API calls to DCF backend during dev
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      // Proxy Matrix Client API to local Synapse
      '/_matrix': {
        target: 'http://127.0.0.1:8008',
        changeOrigin: true,
      },
      '/_synapse': {
        target: 'http://127.0.0.1:8008',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      // E2EE is disabled — replace crypto-wasm with a no-op stub to avoid
      // loading the 5.3MB .wasm binary that Vite cannot bundle correctly.
      '@matrix-org/matrix-sdk-crypto-wasm': new URL(
        './src/infrastructure/matrix/crypto-wasm-stub.ts',
        import.meta.url,
      ).pathname,
    },
  },
  optimizeDeps: {
    // matrix-js-sdk uses dynamic imports that confuse esbuild pre-bundling
    exclude: ['@matrix-org/matrix-sdk-crypto-wasm'],
  },
  build: {
    rollupOptions: {
      // Ensure the stub is used in production builds too
      external: [],
    },
  },
});
