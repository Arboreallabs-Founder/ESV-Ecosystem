import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { DocumentType, IssuedDocument } from '@/lib/types'

/* The document catalogue and the permission matrix.

   Issuance rights are read from `document_permissions` rather than a role array in code — that is
   the point of the table. Granting middle management increment letters later is an UPDATE, not a
   deploy. See docs/DOCUMENTS.md. */

export const fetchDocumentTypes = cache(async (): Promise<DocumentType[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('document_types')
    .select('*')
    .eq('active', true)
    .order('sort_order')
  return (data ?? []) as unknown as DocumentType[]
})

/** Document codes the given role may issue, as a Set for cheap lookup in render paths. */
export const fetchIssuableCodes = cache(async (role: string): Promise<Set<string>> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('document_permissions')
    .select('document_code')
    .eq('role', role)
    .eq('can_issue', true)
  return new Set((data ?? []).map((r) => (r as { document_code: string }).document_code))
})

const ISSUED_SELECT = `
  *,
  document_type:document_types(name, category),
  subject:subject_user_id(name, photo_url),
  issuer:issued_by(name)
`

/** Everything issued, newest first. RLS narrows this to own documents for non-leads. */
export const fetchIssuedDocuments = cache(async (limit = 200): Promise<IssuedDocument[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('issued_documents')
    .select(ISSUED_SELECT)
    .order('issued_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as unknown as IssuedDocument[]
})

export const fetchDocumentsForUser = cache(async (userId: string): Promise<IssuedDocument[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('issued_documents')
    .select(ISSUED_SELECT)
    .eq('subject_user_id', userId)
    .order('issued_at', { ascending: false })
  return (data ?? []) as unknown as IssuedDocument[]
})
