import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({
      rollupConfig: {
        external: [
          /^@sentry\//,
          'kokoro-js',
          '@huggingface/transformers',
          'onnxruntime-node',
          'sharp',
        ],
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  server: {
    host: '127.0.0.1',
    port: 3000,
    watch: {
      // Generated audio, cache, and JSON metadata must not trigger dev full reloads.
      ignored: ['**/data/**', '**/.output/**'],
    },
  },
})

export default config
