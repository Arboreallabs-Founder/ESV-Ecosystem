import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { BookAssets } from '@/lib/deal-book-pdf'

/*
 * The Deal Book's bundled files (src/lib/deal-book-assets/):
 *   pages.pdf          the ESV IM Book template: cover, About Us, contents, back page
 *   Inter-Regular.otf  contents entries and page numbers (SIL Open Font License)
 *   Arapey-Regular.ttf the cover date (SIL Open Font License)
 * next.config.ts traces this folder into the /api/deal-book function.
 */
const DIR = path.join(process.cwd(), 'src', 'lib', 'deal-book-assets')

let cached: Promise<BookAssets> | null = null

export function loadDealBookAssets(): Promise<BookAssets> {
  cached ??= Promise.all([
    readFile(path.join(DIR, 'pages.pdf')),
    readFile(path.join(DIR, 'Inter-Regular.otf')),
    readFile(path.join(DIR, 'Arapey-Regular.ttf')),
  ]).then(([pages, inter, arapey]) => ({
    pages: new Uint8Array(pages), inter: new Uint8Array(inter), arapey: new Uint8Array(arapey),
  })).catch((e) => { cached = null; throw e })
  return cached
}
