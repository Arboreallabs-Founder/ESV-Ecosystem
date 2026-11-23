'use client'

import { createClient } from '@/lib/supabase/client'

/** Upload a PDF straight to the private deal-book bucket under the org's folder; returns its path.
    Direct from the browser because an IM can be larger than a server request allows. */
export async function uploadDealBookPdf(orgId: string, folder: string, file: File): Promise<string> {
  if (file.type && file.type !== 'application/pdf') throw new Error('Please choose a PDF.')
  if (file.size > 50 * 1024 * 1024) throw new Error('That PDF is over 50 MB. Compress it and try again.')
  const supabase = createClient()
  const path = `${orgId}/${folder}/${crypto.randomUUID()}.pdf`
  const { error } = await supabase.storage.from('deal-book').upload(path, file, { contentType: 'application/pdf', upsert: false })
  if (error) throw new Error('The upload failed. Check your connection and try again.')
  return path
}

/** A short-lived link to view an uploaded PDF. */
export async function viewDealBookPdf(path: string) {
  const supabase = createClient()
  const { data } = await supabase.storage.from('deal-book').createSignedUrl(path, 300)
  if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
}
