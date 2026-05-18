import {defineConfig} from 'vite';
import {resolve} from 'path';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import {execSync} from 'child_process';

let gitSha = '';
let gitTime = '';
try {
  gitSha = execSync('git rev-parse --short HEAD').toString().trim();
  gitTime = execSync('git log -1 --format=%ci').toString().trim();
} catch (e) {
  console.error('Failed to get git info', e);
}

export default defineConfig({
  // depending on your application, base can also be "/"
  base: '',
  define: {
    'import.meta.env.VITE_GIT_SHA': JSON.stringify(gitSha),
    'import.meta.env.VITE_GIT_TIME': JSON.stringify(gitTime),
  },
  plugins: [
    react(),
    viteTsconfigPaths(),
    {
      name: 'transform-index-plugin',
      transformIndexHtml(html: string) {
        // Remove Google Analytics code if VITE_GOOGLE_ANALYTICS is set to 'false'
        if (process.env.VITE_GOOGLE_ANALYTICS?.trim() === 'false') {
          return html.replace(/<!-- GOOGLE_ANALYTICS_START -->[\s\S]*?<!-- GOOGLE_ANALYTICS_END -->/, '');
        }
      },
    },
  ],
  resolve: {
    alias: [
      {
        // Remove Google Analytics code if VITE_GOOGLE_ANALYTICS is set to 'false'
        // Handles both formats of import statements used in this project
        find: /\.?\.\/util\/analytics/, replacement: process.env.VITE_GOOGLE_ANALYTICS?.trim() === 'false'
          ? resolve(__dirname, 'src/util/analytics_noop.ts')
          : resolve(__dirname, 'src/util/analytics.ts')
      },
    ],
  },
  server: {
    // this ensures that the browser opens upon server start
    open: true,
    // this sets a default port to 3000
    port: 3000,
  },
});
