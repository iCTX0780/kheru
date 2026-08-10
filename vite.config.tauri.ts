import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { suppressBenignDevErrors } from './vite-plugin-suppress-benign-errors'

// Static SPA build target for the Tauri desktop app.
// Omits the nitro server plugin — the built client bundle is embedded in the
// Tauri webview directly, and there is no Node runtime at runtime.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['kokoro-js', '@huggingface/transformers'],
  },
  define: {
    __KHERU_TARGET__: JSON.stringify('tauri'),
  },
  plugins: [
    suppressBenignDevErrors(),
    tailwindcss(),
    tanstackStart({
      spa: { enabled: true },
    }),
    viteReact(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
  },
  server: {
    host: '127.0.0.1',
    port: 3000,
    watch: {
      ignored: ['**/data/**', '**/.output/**', '**/src-tauri/**'],
    },
  },
})
