import { defineConfig } from 'vite';
export default defineConfig({
  ssr: {
    target: 'webworker',
    noExternal: true,
    resolve: { conditions: ['workerd', 'worker', 'browser', 'import'] },
  },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    ssr: 'server/index.ts',
    outDir: 'work/server',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      external: [/^node:/, /^cloudflare:/],
      output: { entryFileNames: 'index.js', inlineDynamicImports: true },
    },
  },
});
