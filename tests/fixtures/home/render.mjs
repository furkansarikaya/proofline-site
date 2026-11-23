// Test helper of TASK-019: renders src/components/marketing/Home.astro for one language, with the content file of that language, given pin facts and a pair list.
// It uses the production-mode Vite server and the Astro container, as tests/fixtures/pipeline/render.mjs does, and holds no product behaviour.
//   const renderer = await openRenderer();  const html = await renderer.renderHome({ lang, facts, pairs });  await renderer.close();
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getViteConfig } from 'astro/config';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { createServer } from 'vite';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const HOME = '/src/components/marketing/Home.astro';
const content = (lang) => `/src/content/pages/${lang}/home.md`;

/** One Vite server and one container; `renderHome` can be called many times, `close` shuts the server (after Astro's background compile settled). */
export async function openRenderer() {
  const config = await getViteConfig({}, { root, devToolbar: { enabled: false } })({ command: 'serve', mode: 'production' });
  const server = await createServer({ ...config, root, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
  const container = await AstroContainer.create();
  return {
    /** The html of the Home component: `facts` are the pin facts, `pairs` the registered page pairs. */
    async renderHome({ lang, facts, pairs }) {
      const { default: Home } = await server.ssrLoadModule(HOME);
      const { frontmatter } = await server.ssrLoadModule(content(lang));
      return container.renderToString(Home, { props: { lang, content: frontmatter, facts, pairs } });
    },
    async close() {
      await server[Symbol.for('astro.devServerAppReady')];
      await server.close();
    },
  };
}
