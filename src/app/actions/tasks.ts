'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/guards'

export async function createTask(formData: FormData) {
  const { supabase, userId } = await requireAuth()

  const { error } = await supabase.from('tasks').insert({
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || null,
    assignee_id: (formData.get('assignee_id') as string) || userId,
    due_date: (formData.get('due_date') as string) || null,
    priority: (formData.get('priority') as string) || 'Medium',
    status: 'To Do',
    created_by: userId,
  })

  if (error) throw error
  // No revalidatePath — router.refresh() in TaskBoard handles the UI.
}

export async function updateTaskStatus(taskId: string, status: string) {
  const { supabase } = await requireAuth()

  await supabase.from('tasks').update({ status }).eq('id', taskId)
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
}
