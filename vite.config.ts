import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Where the app is served from: '/' for Docker and dev; GitHub Pages sets BLOKADE_BASE=/BloKade/.
const base = process.env.BLOKADE_BASE ?? '/'
if (!base.startsWith('/') || !base.endsWith('/')) {
  throw new Error(`BLOKADE_BASE must start and end with "/", got "${base}"`)
}

export default defineConfig({
  base,
  plugins: [react()],
  worker: { format: 'es' },
  // The OpenCascade WASM loader must not be pre-bundled; it locates its .wasm via an explicit URL.
  optimizeDeps: { exclude: ['replicad-opencascadejs'] },
  test: {
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: [
        'src/document/**', 'src/history/**', 'src/store/**', 'src/plugins/**',
        'src/geometry/**', 'src/persistence/**', 'src/app/**', 'src/learn/**', 'src/help/**',
        'src/kade/**',
      ],
      exclude: [
        '**/*.test.*', '**/testing/**', '**/*.tsx',
        'src/geometry/geometry.worker.ts', 'src/geometry/oc-browser.ts', 'src/geometry/spawn.ts',
        'src/app/useGeometrySync.ts', 'src/app/useAutosave.ts', 'src/app/deps.ts', 'src/app/download.ts',
        'src/kade/blob-loader.ts',
      ],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 75 },
    },
  },
})
