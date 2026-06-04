import { createClient } from '@/lib/supabase/server'
import FormRenderer from './FormRenderer'

interface FormData {
  link_id: string
  form_id: string
  form_title: string
  form_description: string | null
  pipeline_id: string | null
  first_stage_id: string | null
  nodes: Array<{
    id: string
    type: string
    subtype: string | null
    question_text: string | null
    answer_type: string | null
    options: Array<{ id: string; label: string; position: number }>
  }>
  edges: Array<{
    id: string
    source_node_id: string
    target_node_id: string
    condition_value: string | null
    condition_label: string | null
  }>
}

export default async function PublicFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_form_for_submission', { p_token: token })

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Form not available</h1>
          <p style={{ color: '#666', fontSize: '0.9375rem' }}>This link may have expired or the form is no longer published.</p>
        </div>
      </div>
    )
  }

  return <FormRenderer formData={data as FormData} />
}
