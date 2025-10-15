import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'EuclidWidget',
      fileName: 'widget.js',
      formats: ['iife']
    }
  }
});
