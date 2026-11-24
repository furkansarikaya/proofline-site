// Helpers of the contact page (TASK-026, ADR 0010): the page addresses, the four addresses of the owner (the product owner's values, PRD note N-6) and the check of the content files.
// The addresses are typed here once and nowhere else: the page files and the component read them from this module, and the tests compare them character for character.
// Erasable TypeScript only and relative imports spelled with `.ts`, so Vite (the Astro build) and Node type stripping (`node --test`) load this one file, as they load get-started.ts.
import type { Lang } from './meta.ts';

/** The address of the page in each language (ADR 0002 point 1); the pair is registered in translations.ts. */
export const CONTACT_PAGE: Readonly<Record<Lang, string>> = { en: '/contact/', tr: '/tr/iletisim/' };

/** The e-mail address of the owner, shown as the text of the e-mail link. */
export const EMAIL_ADDRESS = 'furkannsarikaya@gmail.com';

/** The four addresses of the owner, in the order of the page: GitHub profile, LinkedIn profile, Medium profile and the mailto link (no query string, no form). */
export const OWNER = {
  github: 'https://github.com/furkansarikaya',
  linkedin: 'https://www.linkedin.com/in/furkansarikaya',
  medium: 'https://furkansarikaya.medium.com/',
  email: `mailto:${EMAIL_ADDRESS}`,
} as const;

export interface ContactContent {
  readonly title: string;
  readonly lead: string;
  readonly paragraph: string;
  readonly links: { readonly github: string; readonly linkedin: string; readonly medium: string; readonly email: string };
}

/** Every key of a contact content file is text with something in it (the Turkish file also holds `translatedFrom`, which the stamp command writes and the layout reads). */
export const TEXT_KEYS: readonly string[] = ['title', 'lead', 'paragraph', 'links.github', 'links.linkedin', 'links.medium', 'links.email'];

/** Checks that every key of a contact content file is text that is not empty or only white space, so a typo can never print an empty row; throws `contact content: missing <key>`. */
export function readContactContent(frontmatter: unknown): ContactContent {
  const at = (path: string): unknown => path.split('.').reduce<unknown>((value, key) => (value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined), frontmatter);
  for (const key of TEXT_KEYS) {
    const value = at(key);
    if (typeof value !== 'string' || value.trim() === '') throw new Error(`contact content: missing ${key}`);
  }
  return frontmatter as ContactContent;
}
