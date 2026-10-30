import { defineConfig } from 'vite';
import worker from './vite.worker.config';
export default defineConfig({
  ...worker,
  build: { ...worker.build, ssr: 'tests/tasks-worker.ts', outDir: 'work/tasks' },
});
