import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { ESV_WORDMARK_DATA_URI } from '@/lib/documents/wordmark'

/*
 * Assembles the Deal Book (20261124000000):
 *
 *   Cover → About Us → Contents → each deal's IM → Back page
 *
 * The cover, About Us, contents and back page are the designs uploaded on /deal-book. The cover
 * gets today's date stamped on it, the contents page gets the deal list and page numbers stamped
 * on (as many contents pages as the list needs, each on the uploaded design), and every page but
 * the cover and back page gets its page number. Where a design hasn't been uploaded yet, a plain
 * ESV-branded stand-in is drawn instead.
 *
 * Where things are stamped is in STAMP below: positions are measured from the bottom-left of the
 * page in points (72 = one inch, A4 is 595 × 842). Adjust them to fit the final designs.
 */

export const STAMP = {
  /** Date on the cover: horizontally centred, this far up from the bottom edge. */
  coverDate: { yFromBottom: 120, size: 13 },
  /** First contents entry, measured down from the top edge; then one line every `lineGap`. */
  contents: { topOffset: 230, leftMargin: 72, rightMargin: 72, lineGap: 26, size: 12, perPage: 20 },
  /** Page number: centred, this far up from the bottom edge. */
  pageNumber: { yFromBottom: 24, size: 9 },
}

const INK = rgb(0.17, 0.17, 0.23)
const MUTED = rgb(0.45, 0.42, 0.40)
const PURPLE = rgb(0.455, 0.373, 0.992)

export type BookDeal = { title: string; pdf: Uint8Array }
export type BookDesigns = {
  cover: Uint8Array | null
  about: Uint8Array | null
  contents: Uint8Array | null
  back: Uint8Array | null
}

/** "24 November 2026", in IST. */
export function bookDate(d = new Date()): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

async function load(bytes: Uint8Array, what: string): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: true })
  } catch {
    throw new Error(`${what} couldn't be read as a PDF. Re-export it as a standard PDF and upload it again.`)
  }
}

/** Copy every page of `src` onto the end of `out`; returns the new pages. */
async function append(out: PDFDocument, src: PDFDocument): Promise<PDFPage[]> {
  const pages = await out.copyPages(src, src.getPageIndices())
  pages.forEach((p) => out.addPage(p))
  return pages
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let t = text
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxWidth) t = t.slice(0, -1)
  return `${t}…`
}

/** A blank A4 page with the ESV wordmark, for a design that hasn't been uploaded yet. */
async function standInPage(out: PDFDocument, title: string | null, fonts: { bold: PDFFont; regular: PDFFont }) {
  const page = out.addPage([595.28, 841.89])
  const { width, height } = page.getSize()
  try {
    const png = await out.embedPng(ESV_WORDMARK_DATA_URI)
    const w = 150
    const h = (png.height / png.width) * w
    page.drawImage(png, { x: (width - w) / 2, y: height - 110 - h, width: w, height: h })
  } catch { /* wordmark is decoration; a page without it is still a page */ }
  if (title) {
    const size = 24
    page.drawText(title, {
      x: (width - fonts.bold.widthOfTextAtSize(title, size)) / 2, y: height / 2,
      size, font: fonts.bold, color: INK,
    })
  }
  page.drawRectangle({ x: 72, y: 60, width: width - 144, height: 1.2, color: PURPLE })
  return page
}

export async function buildDealBook(opts: {
  designs: BookDesigns
  deals: BookDeal[]
  /** "Named" or "No-name", printed under the title on a stand-in cover. */
  versionLabel: string
  date?: Date
}): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  out.setTitle(`ESV Deal Book (${opts.versionLabel})`)
  out.setAuthor('Earlyseed Ventures')
  out.setCreator('ESV Ecosystem')
  const regular = await out.embedFont(StandardFonts.Helvetica)
  const bold = await out.embedFont(StandardFonts.HelveticaBold)
  const fonts = { regular, bold }

  // Load the IMs first: their page counts decide every page number after the contents.
  const deals = await Promise.all(opts.deals.map(async (d) => ({ title: d.title, doc: await load(d.pdf, `The IM for ${d.title}`) })))

  // ── 1. Cover ──────────────────────────────────────────────────────────────
  let cover: PDFPage
  if (opts.designs.cover) {
    const src = await load(opts.designs.cover, 'The cover design')
    const [first] = await out.copyPages(src, [0])
    cover = out.addPage(first)
  } else {
    cover = await standInPage(out, 'Deal Book', fonts)
    const sub = opts.versionLabel === 'No-name' ? 'No-name edition' : ''
    if (sub) {
      const { width, height } = cover.getSize()
      cover.drawText(sub, { x: (width - regular.widthOfTextAtSize(sub, 12)) / 2, y: height / 2 - 28, size: 12, font: regular, color: MUTED })
    }
  }
  {
    const date = bookDate(opts.date)
    const { width } = cover.getSize()
    const s = STAMP.coverDate.size
    cover.drawText(date, { x: (width - regular.widthOfTextAtSize(date, s)) / 2, y: STAMP.coverDate.yFromBottom, size: s, font: regular, color: INK })
  }

  // ── 2. About Us ───────────────────────────────────────────────────────────
  if (opts.designs.about) await append(out, await load(opts.designs.about, 'The About Us design'))
  else await standInPage(out, 'About Us', fonts)

  // ── 3. Contents (as many pages as the list needs) ─────────────────────────
  const contentsPageCount = Math.max(1, Math.ceil(deals.length / STAMP.contents.perPage))
  const contentsDesign = opts.designs.contents ? await load(opts.designs.contents, 'The contents design') : null
  const contentsPages: PDFPage[] = []
  for (let i = 0; i < contentsPageCount; i++) {
    if (contentsDesign) {
      const [p] = await out.copyPages(contentsDesign, [0])
      contentsPages.push(out.addPage(p))
    } else {
      contentsPages.push(await standInPage(out, null, fonts))
    }
  }

  // ── 4. The IMs ────────────────────────────────────────────────────────────
  const starts: number[] = []
  for (const d of deals) {
    starts.push(out.getPageCount() + 1)  // 1-based page number of the IM's first page
    await append(out, d.doc)
  }

  // ── 5. Back page ──────────────────────────────────────────────────────────
  const backFrom = out.getPageCount()  // 0-based index of the back page's first page
  if (opts.designs.back) await append(out, await load(opts.designs.back, 'The back page design'))
  else await standInPage(out, null, fonts)

  // Contents entries, now that every start page is known.
  const c = STAMP.contents
  contentsPages.forEach((page, pi) => {
    const { width, height } = page.getSize()
    if (!contentsDesign && pi === 0) {
      page.drawText('Contents', { x: c.leftMargin, y: height - c.topOffset + 36, size: 22, font: bold, color: INK })
    }
    deals.slice(pi * c.perPage, (pi + 1) * c.perPage).forEach((d, i) => {
      const y = height - c.topOffset - i * c.lineGap
      const num = String(starts[pi * c.perPage + i])
      const numW = bold.widthOfTextAtSize(num, c.size)
      const maxTitle = width - c.leftMargin - c.rightMargin - numW - 24
      const title = fitText(`${pi * c.perPage + i + 1}.  ${d.title}`, regular, c.size, maxTitle)
      page.drawText(title, { x: c.leftMargin, y, size: c.size, font: regular, color: INK })
      // Dotted leader between the title and its page number.
      const from = c.leftMargin + regular.widthOfTextAtSize(title, c.size) + 6
      const to = width - c.rightMargin - numW - 6
      for (let x = from; x < to; x += 5) page.drawText('.', { x, y, size: c.size, font: regular, color: MUTED })
      page.drawText(num, { x: width - c.rightMargin - numW, y, size: c.size, font: bold, color: INK })
    })
  })

  // Page numbers on everything but the cover and the back page.
  const pages = out.getPages()
  pages.forEach((page, i) => {
    if (i === 0 || i >= backFrom) return
    const label = String(i + 1)
    const { width } = page.getSize()
    const s = STAMP.pageNumber.size
    page.drawText(label, { x: (width - regular.widthOfTextAtSize(label, s)) / 2, y: STAMP.pageNumber.yFromBottom, size: s, font: regular, color: MUTED })
  })

  return out.save()
}
