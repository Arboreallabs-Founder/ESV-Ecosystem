'use server'

import { requireAuth } from '@/lib/guards'

export async function createInvestor(formData: FormData) {
  const { supabase } = await requireAuth()

  const { error } = await supabase.from('investors').insert({
    fund_name: formData.get('fund_name') as string,
    contact_name: formData.get('contact_name') as string,
    contact_email: formData.get('contact_email') as string,
    thesis: (formData.get('thesis') as string) || null,
    stage_pref: (formData.get('stage_pref') as string) || null,
    cheque_size_min: formData.get('cheque_size_min') ? Number(formData.get('cheque_size_min')) : null,
    cheque_size_max: formData.get('cheque_size_max') ? Number(formData.get('cheque_size_max')) : null,
  })

  if (error) throw error
  // No revalidatePath — router.refresh() in InvestorTable handles the UI.
}
