import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // React family must stay together — react-dom depends on scheduler,
            // splitting them causes circular chunk errors at runtime
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/') ||
              id.includes('node_modules/react-is/')
            ) return 'vendor-react';
            if (id.includes('node_modules/reactflow/') || id.includes('node_modules/@reactflow/')) return 'vendor-flow';
            if (id.includes('node_modules/motion/') || id.includes('node_modules/framer-motion/')) return 'vendor-motion';
            if (id.includes('node_modules/')) return 'vendor-misc';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      allowedHosts: [
        'studio.minnagency.com',
        'minn-creative-studio-491780181711.europe-west1.run.app',
        'localhost'
      ]
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      // Backend tests declare `// @vitest-environment node` per-file (default here is jsdom)
      include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}', 'backend/**/*.{test,spec}.ts'],
      exclude: ['**/node_modules/**', '**/dist/**'],
    }
  };
});
