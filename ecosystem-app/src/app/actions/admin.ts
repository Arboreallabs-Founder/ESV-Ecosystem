'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateUserRole(userId: string, role: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: callerData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!callerData || !['founder', 'admin'].includes(callerData.role)) {
    throw new Error('Forbidden')
  }

  await supabase.from('users').update({ role }).eq('id', userId)
  revalidatePath('/admin/users')
}
