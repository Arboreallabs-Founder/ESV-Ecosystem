import { createHash, randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SignatureMode } from '@/lib/types'

/* The document engine: allocate an id, render once, store, hash, record.

   The ordering here is the whole design. A PDF is generated exactly once, the *stored bytes* are
   hashed, and that artifact is served forever. Regenerating on demand would produce a different
   hash every time — react-pdf subsets fonts and embeds a creation timestamp, so byte-identical
   output is not achievable — and every verification against the printed id would fail. */

export const DOCUMENTS_BUCKET = 'hr-documents'

/**
 * The token behind the QR code.
 *
 * 32 bytes of CSPRNG output, base64url. The human-readable id (ESV/2026/EVL/0042) is sequential
 * and therefore trivially enumerable, which is exactly why it is not what grants access to the
 * verification page — someone would increment it and read a colleague's letter.
 */
export function generateVerifyToken(): string {
  return randomBytes(32).toString('base64url')
}

export function sha256Hex(bytes: Uint8Array | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Where an issued document lives. Foldered by org so a bucket listing stays navigable. */
export function documentStoragePath(orgId: string, documentId: string): string {
  return `${orgId}/${documentId}.pdf`
}

/**
 * Public verification URL printed in the footer.
 *
 * Falls back to the production host: this string is baked into a PDF that outlives the process
 * that made it, so a localhost URL escaping into a letter sent to a bank would be permanent.
 */
export function verifyUrlFor(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
    || 'https://ecosystem-liart.vercel.app'
  return `${base}/verify/${token}`
}

/** Long-form date for the letter, pinned to IST like the rest of the app. */
export function formatLetterDate(iso: string | Date = new Date()): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric',
  }).format(d)
}

/** Indian-format currency for compensation documents. */
export function formatINR(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Rupees in words — salary certificates and F&F statements conventionally carry both, and a
 * figure written twice is far harder to alter convincingly on a printed letter.
 */
export function amountInWords(amount: number): string {
  const n = Math.floor(Math.abs(amount))
  if (n === 0) return 'Zero Rupees Only'

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  const under100 = (v: number): string =>
    v < 20 ? ones[v] : `${tens[Math.floor(v / 10)]}${v % 10 ? ' ' + ones[v % 10] : ''}`
  const under1000 = (v: number): string =>
    v < 100 ? under100(v)
      : `${ones[Math.floor(v / 100)]} Hundred${v % 100 ? ' ' + under100(v % 100) : ''}`

  // Indian grouping: crore, lakh, thousand, then the remainder.
  const parts: string[] = []
  const units: Array<[number, string]> = [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand']]
  let rest = n
  for (const [value, label] of units) {
    const count = Math.floor(rest / value)
    if (count > 0) { parts.push(`${under1000(count)} ${label}`); rest %= value }
  }
  if (rest > 0) parts.push(under1000(rest))

  return `${parts.join(' ')} Rupees Only`
}

export type IssueRecord = {
  id: string
  humanId: string
  verifyToken: string
  storagePath: string
  sha256: string
}

/**
 * Store a rendered PDF and stamp the issued_documents row with its path and hash.
 *
 * Split from row creation on purpose: the row is inserted first so the id and human id exist to
 * be *printed inside* the PDF, then the rendered bytes are attached. A failure here leaves a row
 * with no artifact, which the UI shows as "generation failed" — recoverable, and honest. The
 * alternative ordering would mean a PDF that cannot state its own reference number.
 */
export async function storeRenderedDocument(
  supabase: SupabaseClient,
  orgId: string,
  documentId: string,
  pdf: Buffer,
): Promise<{ storagePath: string; sha256: string }> {
  const storagePath = documentStoragePath(orgId, documentId)

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, pdf, {
      contentType: 'application/pdf',
      // Immutable by design — this artifact is never regenerated, so it can cache forever.
      cacheControl: '31536000',
      // No upsert: overwriting an issued document would silently invalidate its hash.
      upsert: false,
    })
  if (uploadError) throw new Error(`Could not store the document: ${uploadError.message}`)

  const digest = sha256Hex(pdf)

  const { error: updateError } = await supabase
    .from('issued_documents')
    .update({ storage_path: storagePath, sha256: digest })
    .eq('id', documentId)
  if (updateError) throw updateError

  return { storagePath, sha256: digest }
}

/** Signed URL for downloading an issued document. The bucket is private; nothing is guessable. */
export async function signedDocumentUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  const { data } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)
  return data?.signedUrl ?? null
}

export const SIGNATURE_MODE_NOTE: Record<SignatureMode, string> = {
  system: 'Issued without a signature. Its authenticity is established by the verification link.',
  visual: 'Carries the authorised signatory\'s signature image. Not a digital signature.',
  physical: 'Valid only once signed by hand by an authorised signatory.',
}
