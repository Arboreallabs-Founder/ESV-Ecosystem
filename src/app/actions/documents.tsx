'use server'

import { revalidatePath } from 'next/cache'
import { renderToBuffer } from '@react-pdf/renderer'
import { requireRole } from '@/lib/guards'
import { Letterhead } from '@/lib/documents/letterhead'
import { TEMPLATES, missingRequirements, type DocContext } from '@/lib/documents/templates'
import {
  generateVerifyToken, verifyUrlFor, formatLetterDate, storeRenderedDocument, signedDocumentUrl,
} from '@/lib/documents/engine'
import type { EmployeeCompensation, EmployeeProfile, SignatureMode } from '@/lib/types'

/* Issuing a document.

   Order matters and is the design: allocate the id → insert the row → render the PDF *with that
   id printed inside it* → store → hash. Rendering first would produce a letter that cannot state
   its own reference number; hashing anything but the stored bytes would produce a fingerprint
   that doesn't match what people actually hold. */

const ISSUER_ROLES = ['founder', 'admin', 'hr'] as const

/**
 * Whose name appears in the signature block.
 *
 * A constant for now — the founder confirmed a single signatory, and the form asked for it
 * explicitly. When it becomes per-document it belongs in `document_types`, not here.
 */
const SIGNATORY = {
  name: 'Monica Gupta',
  designation: 'Chief Executive Officer',
}

export type IssueDocumentInput = {
  documentCode: string
  subjectUserId: string
  /** Issuer-supplied values matching the template's field spec. */
  extras?: Record<string, string>
  /** For compensation letters: which package to state. Defaults to the one in force today. */
  compensationId?: string | null
}

export type IssuedDocumentResult = {
  id: string
  humanId: string
  verifyUrl: string
}

export async function issueDocument(input: IssueDocumentInput): Promise<IssuedDocumentResult> {
  const { supabase, userId, orgId, role } = await requireRole([...ISSUER_ROLES])
  if (!orgId) throw new Error('No organization found for this account.')

  const template = TEMPLATES[input.documentCode]
  if (!template) throw new Error('That document type cannot be generated yet.')

  // Permission comes from the matrix, not a hardcoded list — that is the point of the table.
  // RLS enforces it again on insert; this exists so a refusal is a readable message.
  const { data: permission } = await supabase
    .from('document_permissions')
    .select('can_issue')
    .eq('org_id', orgId)
    .eq('document_code', input.documentCode)
    .eq('role', role)
    .maybeSingle()
  if (!permission?.can_issue) {
    throw new Error(`Your role is not permitted to issue a ${template.title}.`)
  }

  const { data: docType } = await supabase
    .from('document_types')
    .select('name, signature_mode')
    .eq('code', input.documentCode)
    .single()
  if (!docType) throw new Error('Unknown document type.')

  // ── Gather the data the letter will assert ──
  const [{ data: subject }, { data: profile }] = await Promise.all([
    supabase.from('users').select('id, name, email, designation').eq('id', input.subjectUserId).single(),
    supabase.from('employee_profiles').select('*').eq('user_id', input.subjectUserId).maybeSingle(),
  ])
  if (!subject) throw new Error('That person could not be found.')

  let compensation: EmployeeCompensation | null = null
  if (template.requiresCompensation) {
    const query = supabase
      .from('employee_compensation')
      .select('*')
      .eq('user_id', input.subjectUserId)
      .order('effective_from', { ascending: false })
    const { data: comp } = input.compensationId
      ? await query.eq('id', input.compensationId).limit(1)
      : await query.limit(1)
    compensation = (comp?.[0] as unknown as EmployeeCompensation) ?? null
  }

  const typedProfile = (profile as unknown as EmployeeProfile) ?? null

  const missing = missingRequirements(input.documentCode, typedProfile, compensation)
  if (missing.length > 0) {
    throw new Error(
      `Cannot issue this letter — the employee profile is missing: ${missing.join(', ')}.`,
    )
  }

  const extras = input.extras ?? {}
  for (const field of template.fields ?? []) {
    if (field.required && !extras[field.name]?.trim()) {
      throw new Error(`${field.label} is required for a ${template.title}.`)
    }
  }

  const issuedAt = new Date()
  const ctx: DocContext = {
    name: subject.name ?? subject.email,
    legalName: typedProfile?.legal_name || subject.name || subject.email,
    designation: subject.designation || 'Team Member',
    profile: typedProfile,
    compensation,
    extras,
    issueDate: formatLetterDate(issuedAt),
  }

  // ── Allocate the reference number, then create the row ──
  const { data: humanId, error: idError } = await supabase
    .rpc('next_document_human_id', { p_org_id: orgId, p_code: input.documentCode })
  if (idError || !humanId) throw new Error(`Could not allocate a document number: ${idError?.message ?? 'unknown error'}`)

  const verifyToken = generateVerifyToken()
  const signatureMode = docType.signature_mode as SignatureMode

  // The payload is a snapshot: the letter asserts facts as at today, and must not change when the
  // underlying records do.
  const payload = {
    name: ctx.name,
    legal_name: ctx.legalName,
    designation: ctx.designation,
    profile: typedProfile,
    compensation,
    extras,
    signatory: SIGNATORY,
  }

  const { data: row, error: insertError } = await supabase
    .from('issued_documents')
    .insert({
      org_id: orgId,
      document_code: input.documentCode,
      subject_user_id: input.subjectUserId,
      human_id: humanId as string,
      verify_token: verifyToken,
      payload,
      signature_mode: signatureMode,
      issued_by: userId,
      issued_at: issuedAt.toISOString(),
    })
    .select('id')
    .single()
  if (insertError) throw insertError

  // ── Render with the id printed inside, then store and hash ──
  const verifyUrl = verifyUrlFor(verifyToken)
  const element = (
    <Letterhead
      humanId={humanId as string}
      issueDate={ctx.issueDate}
      title={template.title}
      signatureMode={signatureMode}
      signatoryName={SIGNATORY.name}
      signatoryDesignation={SIGNATORY.designation}
      verifyUrl={verifyUrl}
    >
      {template.body(ctx)}
    </Letterhead>
  )

  try {
    const pdf = await renderToBuffer(element)
    await storeRenderedDocument(supabase, orgId, row.id as string, pdf)
  } catch (err) {
    // The row survives with no artifact, which the UI shows as "generation failed". Deleting it
    // would silently free the reference number for reuse — two different letters could then end
    // up bearing the same id, which is far worse than a visible failed row.
    throw new Error(
      `Document ${humanId} was recorded but the PDF could not be generated: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  revalidatePath('/hr')
  return { id: row.id as string, humanId: humanId as string, verifyUrl }
}

/** Short-lived signed URL for an issued document. The bucket is private. */
export async function getDocumentUrl(documentId: string): Promise<string | null> {
  const { supabase } = await requireRole(['founder', 'admin', 'hr', 'associate', 'general'])
  // RLS decides whether this row is visible — leads see everything, everyone else their own.
  const { data } = await supabase
    .from('issued_documents')
    .select('storage_path')
    .eq('id', documentId)
    .maybeSingle()
  if (!data?.storage_path) return null
  return signedDocumentUrl(supabase, data.storage_path as string)
}

/**
 * Withdraw a document without erasing it.
 *
 * Revoked rather than deleted on purpose: the verification page must be able to say "this was
 * withdrawn". A link that 404s is indistinguishable from a forgery, which is the opposite of
 * what the verification exists to establish.
 */
export async function revokeDocument(documentId: string, reason: string): Promise<void> {
  const { supabase, userId } = await requireRole([...ISSUER_ROLES])
  const text = reason.trim()
  if (!text) throw new Error('A reason is required to revoke a document.')

  const { error } = await supabase
    .from('issued_documents')
    .update({ revoked_at: new Date().toISOString(), revoked_by: userId, revoked_reason: text })
    .eq('id', documentId)
  if (error) throw error

  revalidatePath('/hr')
}
