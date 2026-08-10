import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // These are server-side Payload API integration tests, not component
    // tests — no DOM is involved. jsdom was left over from copying this
    // config elsewhere, and its polyfills make the `file-type` package
    // (used by Payload's upload MIME-type validation) misdetect file
    // buffers, breaking any test that uploads media once a collection
    // restricts `mimeTypes`.
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
  },
})
