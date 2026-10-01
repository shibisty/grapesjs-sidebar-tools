import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      // UMD global: window.grapesjsSidebarTools (the plugin function itself).
      name: 'grapesjsSidebarTools',
      fileName: (format) =>
        format === 'umd' ? 'grapesjs-sidebar-tools.umd.cjs' : 'grapesjs-sidebar-tools.js',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      // GrapesJS itself is never bundled: the plugin runs against
      // whatever grapesjs instance the host page already loaded.
      external: ['grapesjs'],
      output: {
        // The only runtime export is the plugin function, so the UMD
        // global is the function itself (not a { default } object).
        exports: 'default',
        globals: {
          grapesjs: 'grapesjs',
        },
      },
    },
    sourcemap: true,
  },
});
