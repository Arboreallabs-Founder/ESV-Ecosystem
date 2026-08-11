import { createClient } from '@/lib/supabase/server'
import FormRenderer from './FormRenderer'

interface FormData {
  link_id: string
  form_id: string
  form_title: string
  /** What the admin wants shown to the person filling it in. Null falls back to the title. */
  form_display_name: string | null
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

  // get_public_form wraps get_form_for_submission and folds in the display name. Same object,
  // same null-on-failure behaviour, so the error branch below is unchanged.
  let { data, error } = await supabase.rpc('get_public_form', { p_token: token })

  // If the code is live before the migration is, the wrapper does not exist yet and every public
  // form would go dark — for a page whose whole job is to be openable by a stranger. Fall back to
  // the function that has always been there; they just do not get a display name.
  if (error) {
    const legacy = await supabase.rpc('get_form_for_submission', { p_token: token })
    data = legacy.data
    error = legacy.error
  }

  if (error || !data) {
    // Say which problem it actually is. Links never expire — there is no expiry — so the old
    // "may have expired" copy sent people hunting for a link problem when the form had simply
    // been unpublished, which is fixable in seconds by whoever owns it.
    const { data: status } = await supabase.rpc('get_form_link_status', { p_token: token })

    const message =
      status === 'unpublished'
        ? 'This form is not currently accepting responses. The link is valid — ask whoever shared it to publish the form.'
        : status === 'no_pipeline'
          ? 'This form is not fully set up yet. Please let whoever shared it know.'
          : 'We don’t recognise this link. Check that you copied all of it, or ask whoever shared it for a new one.'

    const heading = status === 'unpublished' ? 'Not accepting responses yet' : 'Form not available'

    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: 420 }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{status === 'unpublished' ? '⏳' : '🔒'}</div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>{heading}</h1>
          <p style={{ color: '#666', fontSize: '0.9375rem', lineHeight: 1.55 }}>{message}</p>
        </div>
      </div>
    )
  }

  return <FormRenderer formData={data as FormData} />
}
