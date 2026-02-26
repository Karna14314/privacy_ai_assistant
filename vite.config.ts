import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
export default defineConfig(async () => ({
  plugins: [react()],
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        skipLibCheck: true,
        noEmit: true,
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/components': resolve(__dirname, './src/components'),
      '@/stores': resolve(__dirname, './src/stores'),
      '@/types': resolve(__dirname, './src/types'),
      '@/styles': resolve(__dirname, './src/styles'),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  define: {
    'process.env': {},
    'process': {},
    'global': 'globalThis',
  },
  build: {
    target: 'chrome105',
    minify: 'esbuild',
    sourcemap: true,
  },
}))
