// Generates public/sitemap.xml and public/robots.txt from VITE_SITE_URL so the
// origin lives in exactly one place (.env) rather than being search-and-replaced.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB = dirname(dirname(fileURLToPath(import.meta.url)))

function siteUrl() {
  if (process.env.VITE_SITE_URL) return process.env.VITE_SITE_URL.replace(/\/$/, '')
  const env = readFileSync(join(WEB, '.env'), 'utf8')
  const match = env.match(/^VITE_SITE_URL\s*=\s*(\S+)/m)
  if (!match) {
    console.error('[gen-sitemap] VITE_SITE_URL is not set in the environment or .env')
    process.exit(1)
  }
  return match[1].replace(/\/$/, '')
}

const ROUTES = [
  ['/', '1.0'],
  ['/sounds', '0.9'],
  ['/sounds/library', '0.9'],
  ['/sounds/convert', '0.9'],
  ['/sounds/setup', '0.8'],
  ['/osd', '0.9'],
]

const origin = siteUrl()
const today = new Date().toISOString().slice(0, 10)

const urls = ROUTES.map(
  ([path, priority]) =>
    `  <url>\n    <loc>${origin}${path}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${priority}</priority>\n  </url>`,
).join('\n')

writeFileSync(
  join(WEB, 'public', 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
)

writeFileSync(
  join(WEB, 'public', 'robots.txt'),
  [
    'User-agent: *',
    'Allow: /',
    '',
    '# /sounds/my is per-browser IndexedDB state — nothing there to index.',
    'Disallow: /sounds/my',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n'),
)

console.log(`[gen-sitemap] sitemap.xml + robots.txt for ${origin}`)
