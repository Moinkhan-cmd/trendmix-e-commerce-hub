import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: '::',
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('react') || id.includes('scheduler')) {
            return 'react-vendor';
          }

          if (id.includes('react-router')) {
            return 'router-vendor';
          }

          if (id.includes('@tanstack/react-query')) {
            return 'query-vendor';
          }

          if (id.includes('/firebase/') || id.includes('/@firebase/')) {
            if (id.includes('firestore')) return 'firebase-firestore-vendor';
            return 'firebase-vendor';
          }

          if (id.includes('/recharts/') || id.includes('/victory-')) {
            return 'charts-vendor';
          }

          if (id.includes('/zod/')) {
            return 'zod-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
}));
