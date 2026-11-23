// Test harness of TASK-018: renders the PipelineDiagram component to static html files, outside src/pages, so the address table and the built page list stay as they are.
// The component goes through the Astro container with a vite server (production mode, so no dev source attributes) under plain node. The harness writes one page per language
// and the one stylesheet that Base.astro and the component would bundle (tokens, base, pipeline, in that order), plus the self-hosted fonts, into a makeTempDir folder.
//   const { dir, pages, css } = await renderPipeline();  then serve dir with scripts/serve-dist.mjs and open `${url}${pages.en.path}`.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getViteConfig } from 'astro/config';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { createServer } from 'vite';
import { makeTempDir } from '../../temp-dirs.mjs';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const COMPONENT = '/src/components/marketing/PipelineDiagram.astro';
const STYLES = ['tokens.css', 'base.css', 'pipeline.css'];

/** The component html for each language, rendered through the container (one vite server, closed before this returns), and `pair`: two copies of the English component one after the other. */
export async function renderComponents(langs = ['en', 'tr']) {
  const config = await getViteConfig({}, { root, devToolbar: { enabled: false } })({ command: 'serve', mode: 'production' });
  const server = await createServer({ ...config, root, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'silent' });
  try {
    const { default: Component } = await server.ssrLoadModule(COMPONENT);
    const container = await AstroContainer.create();
    const out = {};
    for (const lang of langs) out[lang] = await container.renderToString(Component, { props: { lang } });
    out.pair = (await container.renderToString(Component, { props: { lang: 'en' } })) + (await container.renderToString(Component, { props: { lang: 'en' } })); // two copies in one page
    return out;
  } finally {
    // Astro compiles its dev server app in the background; closing before that settles logs a false error.
    await server[Symbol.for('astro.devServerAppReady')];
    await server.close();
  }
}

/** One static page around a component html: the same head the site pages have, the one linked stylesheet, no script. */
export function pageHtml(lang, component) {
  return `<!doctype html>\n<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pipeline diagram fixture</title><link rel="stylesheet" href="/site.css"></head><body><main><div class="wrap">${component}</div></main></body></html>\n`;
}

/** Render both languages into a fresh temp folder. Returns { dir, css, pair, pages: { en: { html, component, path }, tr: {...} } } (pair: two English copies as one html text); serve `dir` and open `url + pages.<lang>.path`. */
export async function renderPipeline({ langs = ['en', 'tr'] } = {}) {
  const components = await renderComponents(langs);
  const dir = makeTempDir('proofline-site-pipeline-');
  const css = STYLES.map((name) => readFileSync(join(root, 'src', 'styles', name), 'utf8')).join('\n');
  writeFileSync(join(dir, 'site.css'), css);
  cpSync(join(root, 'public', 'fonts'), join(dir, 'fonts'), { recursive: true });
  const pages = {};
  for (const lang of langs) {
    mkdirSync(join(dir, lang), { recursive: true });
    const html = pageHtml(lang, components[lang]);
    writeFileSync(join(dir, lang, 'index.html'), html);
    pages[lang] = { html, component: components[lang], path: `/${lang}/` };
  }
  return { dir, css, pages, pair: components.pair };
}
