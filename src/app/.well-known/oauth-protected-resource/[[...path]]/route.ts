import { authorizationServerUrl, publicOrigin, resourceUrl } from '@/lib/mcp/oauth'

/**
 * OAuth protected-resource metadata (RFC 9728) for /api/mcp.
 *
 * Served at both /.well-known/oauth-protected-resource and …/api/mcp: the spec puts it at the
 * path-suffixed URL, and some clients only try the root. This is how Claude learns that Supabase
 * Auth is where it should send the person to sign in.
 */
export function GET(req: Request) {
  const origin = publicOrigin(req)
  return Response.json(
    {
      resource: resourceUrl(origin),
      authorization_servers: [authorizationServerUrl()],
      bearer_methods_supported: ['header'],
      resource_name: 'ESV Ecosystem',
    },
    { headers: { 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' } },
  )
}
