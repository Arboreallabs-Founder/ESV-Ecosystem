'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createPartner(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase.from('franchise_partners').insert({
    name: formData.get('name') as string,
    contact_name: formData.get('contact_name') as string,
    contact_email: formData.get('contact_email') as string,
    agreement_type: (formData.get('agreement_type') as string) || 'Standard',
    fixed_fee: Number(formData.get('fixed_fee')) || 0,
    fee_split_pct: Number(formData.get('fee_split_pct')) || 20,
  })

  if (error) throw error
  revalidatePath('/admin/partners')
}

export async function linkPartnerToUser(userId: string, partnerId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('users')
    .update({ franchise_partner_id: partnerId })
    .eq('id', userId)

  if (error) throw error
  revalidatePath('/admin/partners')
  revalidatePath('/admin/users')
}
