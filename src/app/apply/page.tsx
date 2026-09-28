import { createClient } from '@/lib/supabase/server'
import { renderPublicForm } from '@/app/f/[token]/render-public-form'

/**
 * The general founder link: /apply, for the ESV website and the company LinkedIn page. Same form as
 * everyone's /apply/<name> link, but credited to nobody (see 20261013000000). If it can't be found,
 * the page falls through to the same "we don't recognise this link" screen a bad token gets.
 */
export default async function GeneralApplyPage() {
  const supabase = await createClient()
  const { data: token } = await supabase.rpc('resolve_general_founder_link')
  return renderPublicForm(typeof token === 'string' ? token : '')
}
