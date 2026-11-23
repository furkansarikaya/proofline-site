import type { APIRoute } from 'astro';
import { indexing, pageAddresses, sitemapXml } from '../lib/indexing.ts';

// Only the keys of the glob are used: the page list comes from the `.astro` files of src/pages (endpoints, the 404 page and `_` files are left out).
const files = Object.keys(import.meta.glob('./**/*.astro'));

// A closed build answers with no body, so Astro writes no dist/sitemap.xml (it prints one "Skipped writing" warning).
export const GET: APIRoute = () => indexing.indexable
  ? new Response(sitemapXml(pageAddresses(files)), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
  : new Response(null, { status: 404 });
