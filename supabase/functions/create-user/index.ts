import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify caller auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user: callerUser } } = await callerClient.auth.getUser()
    if (!callerUser) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { data: callerData } = await callerClient
      .from('users')
      .select('role')
      .eq('id', callerUser.id)
      .single()

    if (!callerData || !['admin', 'founder'].includes(callerData.role)) {
      return new Response('Forbidden', { status: 403, headers: corsHeaders })
    }

    // Parse body
    const { email, password, name, role } = await req.json()
    if (!email || !password || !role) {
      return new Response(JSON.stringify({ error: 'email, password, and role are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // The caller is authorised as a tenant founder/admin above, and the role then travels straight
    // into a service-role write — which bypasses RLS entirely. Without this allowlist that made the
    // function a way to mint a super_admin, the platform role that bypasses organisation scoping.
    // The database refuses it too (migration 20260920); both exist because this one runs with the
    // service key and would otherwise be trusted by definition.
    const ASSIGNABLE_ROLES = ['founder', 'admin', 'associate', 'franchise_partner', 'general', 'hr']
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return new Response(JSON.stringify({ error: `"${role}" is not a role you can assign.` }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create user with service role
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name || '' },
    })

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update role + name in public.users (trigger creates the row, we update it)
    await adminClient
      .from('users')
      .update({ role, name: name || '' })
      .eq('id', newUser.user.id)

    return new Response(JSON.stringify({ id: newUser.user.id, email }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
