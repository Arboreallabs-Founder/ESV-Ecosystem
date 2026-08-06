import { cache } from 'react'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { formShareUrl } from '@/lib/site-url'

/* Share links: the personalised /f/[token] URLs people hand to founders, plus what each one
   actually produced.

   Attribution already exists — pipeline_entries.form_link_id records which link a submission came
   through — it just had nowhere to be seen. That is what makes per-link analytics possible without
   any new tracking. */

export type ShareLinkStats = {
  submissions: number
  accepted: number
  rejected: number
  /** Submitted but not yet accepted or rejected. */
  inReview: number
  lastSubmissionAt: string | null
}

export type ShareLink = {
  id: string
  token: string
  label: string | null
  created_at: string
  form: { id: string; title: string; published: boolean; pipelineName: string | null } | null
  creator: { id: string; name: string | null } | null
  url: string
  /** Data-URI PNG, generated server-side. */
  qr: string
  stats: ShareLinkStats
}

export type ShareableForm = {
  id: string
  title: string
  published: boolean
  pipelineName: string | null
  /** Live links already issued against this form, across everyone. */
  linkCount: number
}

export { formShareUrl as shareUrlFor } from '@/lib/site-url'

/** Forms that can have links issued against them. Drafts included, flagged, so the UI can explain. */
export const fetchShareableForms = cache(async (): Promise<ShareableForm[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('forms')
    .select('id, title, published, pipeline:pipelines(name), links:form_links(id)')
    .order('title')

  return (data ?? []).map((f) => {
    const row = f as unknown as {
      id: string; title: string; published: boolean
      pipeline: { name: string } | { name: string }[] | null
      links: Array<{ id: string }> | null
    }
    const pipeline = Array.isArray(row.pipeline) ? row.pipeline[0] : row.pipeline
    return {
      id: row.id,
      title: row.title,
      published: row.published,
      pipelineName: pipeline?.name ?? null,
      linkCount: row.links?.length ?? 0,
    }
  })
})

/**
 * Share links with their results.
 *
 * `mine` narrows to the caller's own links — the default view, since the point is "how is *my*
 * link doing". Leaders can widen to the whole org.
 */
export const fetchShareLinks = cache(async (userId: string, mine: boolean): Promise<ShareLink[]> => {
  const supabase = await createClient()

  let query = supabase
    .from('form_links')
    .select('id, token, label, created_at, created_by, form:forms(id, title, published, pipeline:pipelines(name)), creator:users!created_by(id, name)')
    .order('created_at', { ascending: false })
  if (mine) query = query.eq('created_by', userId)

  const { data: links, error } = await query
  if (error || !links?.length) return []

  const ids = links.map((l) => (l as { id: string }).id)

  // One pass for attribution rather than a query per link.
  const { data: entries } = await supabase
    .from('pipeline_entries')
    .select('form_link_id, submitted_at, stage:pipeline_stages(stage_type)')
    .in('form_link_id', ids)

  const stats = new Map<string, ShareLinkStats>()
  for (const id of ids) {
    stats.set(id, { submissions: 0, accepted: 0, rejected: 0, inReview: 0, lastSubmissionAt: null })
  }
  for (const e of (entries ?? []) as unknown as Array<{
    form_link_id: string | null
    submitted_at: string | null
    stage: { stage_type: string } | { stage_type: string }[] | null
  }>) {
    if (!e.form_link_id) continue
    const s = stats.get(e.form_link_id)
    if (!s) continue
    s.submissions++
    const stage = Array.isArray(e.stage) ? e.stage[0] : e.stage
    if (stage?.stage_type === 'accepted') s.accepted++
    else if (stage?.stage_type === 'rejected') s.rejected++
    else s.inReview++
    if (e.submitted_at && (!s.lastSubmissionAt || e.submitted_at > s.lastSubmissionAt)) {
      s.lastSubmissionAt = e.submitted_at
    }
  }

  // QR generation is CPU-bound but tiny; doing it here keeps the client free of a QR library.
  return Promise.all(links.map(async (l) => {
    const row = l as unknown as {
      id: string; token: string; label: string | null; created_at: string
      form: { id: string; title: string; published: boolean; pipeline: { name: string } | { name: string }[] | null }
        | Array<{ id: string; title: string; published: boolean; pipeline: { name: string } | { name: string }[] | null }> | null
      creator: { id: string; name: string | null } | { id: string; name: string | null }[] | null
    }
    const form = Array.isArray(row.form) ? row.form[0] : row.form
    const pipeline = form ? (Array.isArray(form.pipeline) ? form.pipeline[0] : form.pipeline) : null
    const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator
    const url = formShareUrl(row.token)

    return {
      id: row.id,
      token: row.token,
      label: row.label,
      created_at: row.created_at,
      form: form
        ? { id: form.id, title: form.title, published: form.published, pipelineName: pipeline?.name ?? null }
        : null,
      creator: creator ?? null,
      url,
      qr: await QRCode.toDataURL(url, {
        width: 512,
        margin: 1,
        // Brand ink on white. White rather than crema because a QR printed on anything other
        // than white loses contrast, and contrast is the whole job.
        color: { dark: '#2C2C3AFF', light: '#FFFFFFFF' },
        errorCorrectionLevel: 'M',
      }),
      stats: stats.get(row.id) ?? {
        submissions: 0, accepted: 0, rejected: 0, inReview: 0, lastSubmissionAt: null,
      },
    }
  }))
})
