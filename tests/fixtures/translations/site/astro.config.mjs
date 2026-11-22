// Fixture site of tests/translations.test.mjs (TASK-004): the root config's output, routing and i18n options, the real public/ folder,
// and a build cache the test points at its own temp directory (PROOFLINE_FIXTURE_CACHE) so no cache lands in the repository.
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'never' },
  i18n: {
    locales: ['en', 'tr'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
  publicDir: '../../../../public',
  cacheDir: process.env.PROOFLINE_FIXTURE_CACHE,
});
