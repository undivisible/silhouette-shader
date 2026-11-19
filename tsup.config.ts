import { readFile, writeFile } from 'node:fs/promises';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', react: 'src/SilhouetteShader.tsx' },
  format: ['esm'],
  platform: 'browser',
  target: 'es2022',
  outDir: 'lib',
  clean: true,
  splitting: true,
  dts: true,
  treeshake: { moduleSideEffects: false },
  // Rollup strips module directives. Only the React entry is a client boundary.
  async onSuccess() {
    const entry = 'lib/react.js';
    await writeFile(entry, '"use client";\n' + await readFile(entry, 'utf8'));
  },
  noExternal: [/^@tschk\//],
  external: ['react', 'react/jsx-runtime'],
});
