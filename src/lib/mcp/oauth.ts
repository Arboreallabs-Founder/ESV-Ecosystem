/**
 * OAuth wiring for the MCP endpoint (MCP authorization spec / RFC 9728).
 *
 * Ecosystem is only the *resource server*. Supabase Auth's OAuth 2.1 server is the authorization
 * server: it registers Claude as a client, runs the code + PKCE flow, and issues ordinary Supabase
 * access tokens for the user — which is why the existing RLS applies to them unchanged. The one
 * piece of the flow that lives here is the consent screen (/oauth/consent).
 */

export const MCP_PATH = '/api/mcp'

export function resourceUrl(origin: string) {
  return `${origin}${MCP_PATH}`
}

export function protectedResourceMetadataUrl(origin: string) {
  return `${origin}/.well-known/oauth-protected-resource${MCP_PATH}`
}

export function authorizationServerUrl() {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '')}/auth/v1`
}

/**
 * The public origin of this deployment. Behind Vercel the request URL is already the public host;
 * x-forwarded-* covers any proxy that rewrites it.
 */
export function publicOrigin(req: Request) {
  const url = new URL(req.url)
  const host = req.headers.get('x-forwarded-host') ?? url.host
  const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  return `${proto}://${host}`
}
