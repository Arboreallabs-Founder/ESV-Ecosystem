import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/* The form submissions behind a company — what the founder actually wrote, question by question.
   The accepted submission's tagged answers are also copied into the profile's own fields
   (apply_entry_to_company, 20261012000000); this keeps the full original, including the answers
   that have no profile field (business stage, services they want, previous rounds). */

export type ApplicationAnswer = {
  question: string
  answer: string
  /** form_nodes.field_key — what the answer means. Null for untagged questions. */
  key: string | null
  /** form_nodes.contact_field — name / email / phone. */
  contact: string | null
  order: number
}

export type CompanyApplication = {
  id: string
  submittedAt: string
  submitterName: string | null
  submitterEmail: string | null
  formName: string | null
  /** Who they came through — a partner, or a team member's link. */
  via: string | null
  answers: ApplicationAnswer[]
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

export const fetchCompanyApplications = cache(async (companyId: string): Promise<CompanyApplication[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pipeline_entries')
    .select(`
      id, submitted_at, submitter_name, submitter_email,
      form:forms!form_id(title, display_name),
      partner:franchise_partners!sourced_by_partner_id(name),
      associate:users!sourced_by_associate_id(name),
      answers:pipeline_entry_answers(answer_text, node:form_nodes!node_id(question_text, field_key, contact_field, position_y))
    `)
    .eq('company_id', companyId)
    .not('form_id', 'is', null)
    .order('submitted_at', { ascending: false })
  if (error) {
    // Surfaced, not swallowed — but the profile still renders without the section.
    console.error('[company-applications] read failed:', error.message)
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((e) => {
    const form = one(e.form) as { title: string | null; display_name: string | null } | null
    const partner = one(e.partner) as { name: string | null } | null
    const associate = one(e.associate) as { name: string | null } | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const answers: ApplicationAnswer[] = ((e.answers ?? []) as any[])
      .map((a) => {
        const node = one(a.node) as { question_text: string | null; field_key: string | null; contact_field: string | null; position_y: number | null } | null
        return {
          question: node?.question_text ?? '',
          answer: (a.answer_text ?? '').trim(),
          key: node?.field_key ?? null,
          contact: node?.contact_field ?? null,
          order: node?.position_y ?? 0,
        }
      })
      .filter((a) => a.answer)
      .sort((x, y) => x.order - y.order)

    return {
      id: e.id,
      submittedAt: e.submitted_at,
      submitterName: e.submitter_name,
      submitterEmail: e.submitter_email,
      formName: form?.display_name || form?.title || null,
      via: partner?.name ? `Partner: ${partner.name}` : associate?.name ? `${associate.name}'s link` : null,
      answers,
    }
  }).filter((a) => a.answers.length > 0)
})
