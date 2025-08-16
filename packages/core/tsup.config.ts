import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'agents/index': 'src/agents/index.ts',
    'operators/index': 'src/operators/index.ts',
    'models/index': 'src/models/index.ts',
    'types/index': 'src/types/index.ts'
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  external: ['electron']
})
