import type { APIRoute } from 'astro';
import { robotsTxt } from '../lib/indexing.ts';

// Written as dist/robots.txt in both modes (closed: Disallow everything; indexable: allow all and the sitemap address).
export const GET: APIRoute = () => new Response(robotsTxt(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
