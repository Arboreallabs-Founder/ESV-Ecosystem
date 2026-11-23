import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/user'
import { buildDealBook, bookDate, type BookDesigns } from '@/lib/deal-book-pdf'
import { DEAL_BOOK_BUCKET, fetchDealBook } from '@/lib/deal-book'
import { loadDealBookAssets } from '@/lib/deal-book-assets'

/*
 * GET /api/deal-book?version=named|noname → the Deal Book PDF, assembled now. The named
 * version is marked Confidential.
 * Add &preview=1 to open it in the browser instead of downloading; a preview is built even when no
 * deal has an IM yet, so the fixed pages can be checked on their own.
 *
 * Every internal user may download (decided 2026-11-23). Built on request rather than stored, so
 * it always has today's date and the latest IMs. Files are read through the caller's own session,
 * so storage RLS applies.
 */
export const runtime = 'nodejs'
export const maxDuration = 120

const INTERNAL = ['founder', 'admin', 'associate', 'general', 'hr']

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user || !INTERNAL.includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
  }
  const noname = req.nextUrl.searchParams.get('version') === 'noname'
  const preview = req.nextUrl.searchParams.get('preview') === '1'
  const supabase = await createClient()

  const download = async (path: string | null): Promise<Uint8Array | null> => {
    if (!path) return null
    const { data, error } = await supabase.storage.from(DEAL_BOOK_BUCKET).download(path)
    if (error || !data) throw new Error(`A file in the Deal Book couldn't be read (${path.split('/').pop()}).`)
    return new Uint8Array(await data.arrayBuffer())
  }

  try {
    const { rows, settings } = await fetchDealBook()
    const inBook = rows.filter((r) => r.position !== null)
    // Each version uses only deals that have the right IM; the rest are skipped, not failed.
    const usable = inBook.filter((r) => (noname ? r.im?.noname_path : r.im?.named_path))
    if (usable.length === 0 && !preview) {
      return NextResponse.json(
        { error: noname ? 'No deal in the book has a no-name IM yet.' : 'No deal in the book has an IM yet.' },
        { status: 400 },
      )
    }

    const designs: BookDesigns = {
      cover: await download(settings.cover_path),
      about: await download(settings.about_path),
      contents: await download(settings.contents_path),
      back: await download(settings.back_path),
    }
    const deals = await Promise.all(usable.map(async (r, i) => ({
      title: noname ? (r.im?.codename?.trim() || `Opportunity ${i + 1}`) : r.title,
      pdf: (await download(noname ? r.im!.noname_path : r.im!.named_path))!,
    })))

    const pdf = await buildDealBook({ designs, deals, assets: await loadDealBookAssets(), versionLabel: noname ? 'No-name' : 'Named', confidential: !noname })
    const name = `ESV Active Deal Book${noname ? ' (No-name)' : ' (Confidential)'} - ${bookDate()}.pdf`
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${preview ? 'inline' : 'attachment'}; filename="${name}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[deal-book] build failed:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'The Deal Book could not be built.' }, { status: 500 })
  }
}
