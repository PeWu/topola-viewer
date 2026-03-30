import {defineConfig} from 'vite';
import {resolve} from 'path';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import {viteSingleFile} from 'vite-plugin-singlefile';  // ← ADDED

export default defineConfig({
  base: '',
  plugins: [
    react(),
    viteTsconfigPaths(),
    viteSingleFile(),  // ← ADDED: inlines all JS/CSS into index.html
    {
      name: 'transform-index-plugin',
      transformIndexHtml(html: string) {
        if (process.env.VITE_GOOGLE_ANALYTICS?.trim() === 'false') {
          return html.replace(/<!-- GOOGLE_ANALYTICS_START -->[\s\S]*?<!-- GOOGLE_ANALYTICS_END -->/, '');
        }
      },
    },
  ],
  resolve: {
    alias: [
      {
        find: /\.?\.\/util\/analytics/, replacement: process.env.VITE_GOOGLE_ANALYTICS?.trim() === 'false'
          ? resolve(__dirname, 'src/util/analytics_noop.ts')
          : resolve(__dirname, 'src/util/analytics.ts')
      },
    ],
  },
  build: {
    assetsInlineLimit: 100_000_000,  // ← ADDED: inline everything regardless of size
    chunkSizeWarningLimit: 100_000,  // ← ADDED: suppress chunk size warnings
    cssCodeSplit: false,             // ← ADDED: keep CSS in one chunk for inlining
  },
  server: {
    open: true,
    port: 3000,
  },
});
