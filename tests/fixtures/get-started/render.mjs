// Test helper of TASK-021: renders src/components/marketing/GetStarted.astro for one language, with the content file of that language and given pin facts.
// It uses the production-mode Vite server and the Astro container, as tests/fixtures/home/render.mjs does, and holds no product behaviour.
//   const renderer = await openRenderer();  const html = await renderer.renderGetStarted({ lang, facts });  await renderer.close();
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getViteConfig } from 'astro/config';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { createServer } from 'vite';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const COMPONENT = '/src/components/marketing/GetStarted.astro';
const CONTENT = { en: '/src/content/pages/en/get-started.md', tr: '/src/content/pages/tr/baslarken.md' };
const PAGE_FILE = { en: '/src/pages/get-started/index.astro', tr: '/src/pages/tr/baslarken/index.astro' };

/** One Vite server and one container; `renderGetStarted` can be called many times, `close` shuts the server (after Astro's background compile settled). */
export async function openRenderer() {
  const config = await getViteConfig({}, { root, devToolbar: { enabled: false } })({ command: 'serve', mode: 'production' });
  const server = await createServer({ ...config, root, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
  const container = await AstroContainer.create();
  return {
    /** The html of the GetStarted component: `facts` are the pin facts; `content` replaces the content file of the language when given. */
    async renderGetStarted({ lang, facts, content }) {
      const { default: GetStarted } = await server.ssrLoadModule(COMPONENT);
      const { frontmatter } = await server.ssrLoadModule(CONTENT[lang]);
      return container.renderToString(GetStarted, { props: { lang, content: content ?? frontmatter, facts } });
    },
    /**
     * The html of the page FILE of a language (it passes its own props to Base and GetStarted), rendered with `cwd` as the working directory: the pages read the pin facts
     * and the translation stamp from there at build time. Returns the html and the build warnings printed while it rendered; a failing page rejects with its own error.
     */
    async renderPageFile({ lang, cwd }) {
      const { default: Page } = await server.ssrLoadModule(PAGE_FILE[lang]);
      const previous = process.cwd();
      const warnings = [];
      const warn = console.warn;
      console.warn = (...args) => { warnings.push(args.join(' ')); };
      process.chdir(cwd);
      try {
        return { html: await container.renderToString(Page), warnings };
      } finally {
        process.chdir(previous);
        console.warn = warn;
      }
    },
    async close() {
      await server[Symbol.for('astro.devServerAppReady')];
      await server.close();
    },
  };
}
