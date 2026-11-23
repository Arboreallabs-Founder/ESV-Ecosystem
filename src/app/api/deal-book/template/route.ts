import { NextResponse, type NextRequest } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { getUser } from '@/lib/user'
import { loadDealBookAssets } from '@/lib/deal-book-assets'

/*
 * GET /api/deal-book/template?slot=cover|about|contents|back → that page of the bundled ESV IM Book
 * template, shown in the browser. With no slot, all four pages. Internal users only, like the book.
 */
export const runtime = 'nodejs'

const INTERNAL = ['founder', 'admin', 'associate', 'general', 'hr']
const PAGE = { cover: 0, about: 1, contents: 2, back: 3 } as const

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user || !INTERNAL.includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
  }
  const slot = req.nextUrl.searchParams.get('slot')
  if (slot && !(slot in PAGE)) return NextResponse.json({ error: 'Unknown page.' }, { status: 400 })

  const { pages } = await loadDealBookAssets()
  let bytes: Uint8Array = pages
  if (slot) {
    const src = await PDFDocument.load(pages)
    const out = await PDFDocument.create()
    const [p] = await out.copyPages(src, [PAGE[slot as keyof typeof PAGE]])
    out.addPage(p)
    bytes = await out.save()
  }
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="ESV IM Book template${slot ? ` - ${slot}` : ''}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
