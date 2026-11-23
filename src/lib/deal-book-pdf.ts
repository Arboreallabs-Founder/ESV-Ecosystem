import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

/*
 * Assembles the Deal Book (20261124000000):
 *
 *   Cover → About Us → Contents → each deal's IM → Back page
 *
 * The four fixed pages come from the ESV IM Book template (src/lib/deal-book-assets/pages.pdf,
 * one page each, with the sample date and "Topic" lines removed), unless a replacement design has
 * been uploaded on /deal-book. The cover gets its title ("Active Deal Book") and today's date
 * stamped where the template's own title and sample date were; the contents page gets the deal list stamped on the template's centred lines (as many
 * contents pages as the list needs); every page but the cover and back page gets its page number.
 *
 * Positions in STAMP were measured from the template, in points from the bottom-left of an A4 page
 * (595 × 842). A replacement design should keep the same layout, or these need adjusting.
 */

export const STAMP = {
  /** Title on the cover, in Inter SemiBold: centred, where the template's own title sat. */
  coverTitle: { text: 'Active Deal Book', yFromBottom: 133.9, size: 20 },
  /** Date on the cover, in Arapey: centred, baseline this far up from the bottom edge. */
  coverDate: { yFromBottom: 83.3, size: 20 },
  /** Contents entries, in Inter: centred; first baseline this far down from the top, then one every `lineGap`. */
  contents: { firstBaselineFromTop: 169.1, lineGap: 35.76, size: 12, perPage: 17, maxWidth: 394 },
  /** Page number, in Inter: centred, this far up from the bottom edge. */
  pageNumber: { yFromBottom: 24, size: 9 },
  /** Named version only: "CONFIDENTIAL" on the cover (centred, letter-spaced) and in each numbered page's footer. */
  confidential: { coverYFromBottom: 46, coverSize: 9, coverTracking: 2.2, footerX: 100.6, footerSize: 8 },
}

const INK = rgb(0, 0, 0)
const MUTED = rgb(0.45, 0.42, 0.40)

/** Template page order in pages.pdf. */
const TEMPLATE = { cover: 0, about: 1, contents: 2, back: 3 } as const

export type BookDeal = { title: string; pdf: Uint8Array }
export type BookDesigns = {
  cover: Uint8Array | null
  about: Uint8Array | null
  contents: Uint8Array | null
  back: Uint8Array | null
}
/** The bundled template and its fonts; see deal-book-assets.ts. */
export type BookAssets = { pages: Uint8Array; inter: Uint8Array; interSemiBold: Uint8Array; arapey: Uint8Array }

/** "24 November 2026", in IST. Used in the file name. */
export function bookDate(d = new Date()): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

/** "24/11/2026", in IST, the template's cover format. */
export function coverDate(d = new Date()): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

async function load(bytes: Uint8Array, what: string): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: true })
  } catch {
    throw new Error(`${what} couldn't be read as a PDF. Re-export it as a standard PDF and upload it again.`)
  }
}

/** Copy every page of `src` onto the end of `out`; returns the new pages. */
async function append(out: PDFDocument, src: PDFDocument, indices = src.getPageIndices()): Promise<PDFPage[]> {
  const pages = await out.copyPages(src, indices)
  pages.forEach((p) => out.addPage(p))
  return pages
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let t = text
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxWidth) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

/** Characters the embedded fonts can't draw (emoji, some scripts) are dropped rather than crashing the build. */
function drawable(text: string, font: PDFFont): string {
  const ok = new Set(font.getCharacterSet())
  return Array.from(text).filter((ch) => ok.has(ch.codePointAt(0)!)).join('').replace(/\s+/g, ' ').trim() || '?'
}

/** Letter-spaced text centred on the page; pdf-lib has no tracking option, so it goes a glyph at a time. */
function centredSpaced(page: PDFPage, text: string, y: number, font: PDFFont, size: number, tracking: number, color = INK) {
  const chars = Array.from(text)
  const total = chars.reduce((w, ch) => w + font.widthOfTextAtSize(ch, size), 0) + tracking * (chars.length - 1)
  let x = (page.getSize().width - total) / 2
  for (const ch of chars) {
    page.drawText(ch, { x, y, size, font, color })
    x += font.widthOfTextAtSize(ch, size) + tracking
  }
}

function centred(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK) {
  const { width } = page.getSize()
  page.drawText(text, { x: (width - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color })
}

export async function buildDealBook(opts: {
  designs: BookDesigns
  deals: BookDeal[]
  assets: BookAssets
  /** "Named" or "No-name"; goes in the PDF's metadata title. */
  versionLabel: string
  /** Mark the book Confidential: on the cover and in every numbered page's footer. */
  confidential?: boolean
  date?: Date
}): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  out.registerFontkit(fontkit)
  out.setTitle(`ESV ${STAMP.coverTitle.text} (${opts.versionLabel}${opts.confidential ? ', Confidential' : ''})`)
  out.setAuthor('Earlyseed Ventures')
  out.setCreator('ESV Ecosystem')
  // Inter is a CFF font; pdf-lib's subsetter mangles those, so it goes in whole.
  const inter = await out.embedFont(opts.assets.inter, { subset: false })
  const interSemiBold = await out.embedFont(opts.assets.interSemiBold, { subset: false })
  const arapey = await out.embedFont(opts.assets.arapey, { subset: true })
  const template = await PDFDocument.load(opts.assets.pages)

  // Load the IMs first: their page counts decide every page number after the contents.
  const deals = await Promise.all(opts.deals.map(async (d) => ({ title: d.title, doc: await load(d.pdf, `The IM for ${d.title}`) })))

  /** The uploaded design's pages if there is one, else the template's page. */
  async function fixed(slot: keyof BookDesigns, what: string, firstOnly: boolean): Promise<PDFPage[]> {
    const bytes = opts.designs[slot]
    if (!bytes) return append(out, template, [TEMPLATE[slot]])
    const src = await load(bytes, what)
    return append(out, src, firstOnly ? [0] : src.getPageIndices())
  }

  // ── 1. Cover, with its title and today's date ─────────────────────────────
  const [cover] = await fixed('cover', 'The cover design', true)
  const t = STAMP.coverTitle
  centred(cover, t.text, t.yFromBottom, interSemiBold, t.size)
  centred(cover, coverDate(opts.date), STAMP.coverDate.yFromBottom, arapey, STAMP.coverDate.size)
  const conf = STAMP.confidential
  if (opts.confidential) centredSpaced(cover, 'CONFIDENTIAL', conf.coverYFromBottom, inter, conf.coverSize, conf.coverTracking)

  // ── 2. About Us ───────────────────────────────────────────────────────────
  await fixed('about', 'The About Us design', false)

  // ── 3. Contents (as many pages as the list needs) ─────────────────────────
  const c = STAMP.contents
  const contentsPages: PDFPage[] = []
  for (let i = 0; i < Math.max(1, Math.ceil(deals.length / c.perPage)); i++) {
    contentsPages.push(...(await fixed('contents', 'The contents design', true)))
  }

  // ── 4. The IMs ────────────────────────────────────────────────────────────
  const starts: number[] = []
  for (const d of deals) {
    starts.push(out.getPageCount() + 1)  // 1-based page number of the IM's first page
    await append(out, d.doc)
  }

  // ── 5. Back page ──────────────────────────────────────────────────────────
  const backFrom = out.getPageCount()  // 0-based index of the back page's first page
  await fixed('back', 'The back page design', false)

  // Contents entries, now that every start page is known: "Title   7", centred as one line.
  contentsPages.forEach((page, pi) => {
    const { width, height } = page.getSize()
    deals.slice(pi * c.perPage, (pi + 1) * c.perPage).forEach((d, i) => {
      const y = height - c.firstBaselineFromTop - i * c.lineGap
      const num = String(starts[pi * c.perPage + i])
      const gap = 14
      const numW = inter.widthOfTextAtSize(num, c.size)
      const title = fitText(drawable(d.title, inter), inter, c.size, c.maxWidth - numW - gap)
      const titleW = inter.widthOfTextAtSize(title, c.size)
      const x = (width - (titleW + gap + numW)) / 2
      page.drawText(title, { x, y, size: c.size, font: inter, color: INK })
      page.drawText(num, { x: x + titleW + gap, y, size: c.size, font: inter, color: MUTED })
    })
  })

  // Page numbers on everything but the cover and the back page.
  out.getPages().forEach((page, i) => {
    if (i === 0 || i >= backFrom) return
    centred(page, String(i + 1), STAMP.pageNumber.yFromBottom, inter, STAMP.pageNumber.size, MUTED)
    if (opts.confidential) {
      page.drawText('Confidential', { x: conf.footerX, y: STAMP.pageNumber.yFromBottom, size: conf.footerSize, font: inter, color: MUTED })
    }
  })

  return out.save()
}
