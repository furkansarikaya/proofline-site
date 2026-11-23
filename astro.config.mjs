import { defineConfig } from 'astro/config';
import { indexing, logLines } from './src/lib/indexing.ts';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'never' },
  i18n: {
    locales: ['en', 'tr'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    {
      // Prints the indexing mode and the two verification states once per build, never a value (TASK-006, ADR 0005 point 6).
      name: 'proofline-indexing',
      hooks: { 'astro:build:start': () => { for (const line of logLines(indexing)) console.log(line); } },
    },
  ],
});
