import { createClient } from '@/lib/supabase/server'
import { renderPublicForm } from '@/app/f/[token]/render-public-form'

/**
 * Readable founder-form link: /apply/sakshay. Resolves the slug to its link's token and renders the
 * same page /f/<token> does (see 20261011000000). An unknown slug resolves to nothing and falls
 * through to the same "we don't recognise this link" screen a bad token gets.
 */
export default async function ApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: token } = await supabase.rpc('resolve_referral_slug', { p_slug: slug })
  return renderPublicForm(typeof token === 'string' ? token : '')
}
