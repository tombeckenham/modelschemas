/**
 * Agent-auth protocol client for the CLI: discovery, registration
 * (autonomous by default, delegated via the device-authorization flow),
 * and per-request JWT minting (jtis are replay-protected server-side).
 */
import { SignJWT, exportJWK, generateKeyPair, importJWK } from 'jose'

import type { AgentCredentials } from './credentials.ts'

export interface Discovery {
  issuer: string
  default_location: string
  endpoints: Record<string, string>
}

export async function fetchDiscovery(baseUrl: string): Promise<Discovery> {
  const response = await fetch(`${baseUrl}/.well-known/agent-configuration`)
  if (!response.ok) {
    throw new Error(
      `discovery failed: ${String(response.status)} — is ${baseUrl} a modelschemas server?`,
    )
  }
  return (await response.json()) as Discovery
}

interface RegisterOutcome {
  credentials: Omit<AgentCredentials, 'type' | 'baseUrl'>
  status: string
  /** Present for delegated registrations needing user approval. */
  approval?: { verificationUri?: string; userCode?: string }
}

export async function registerAgent(
  baseUrl: string,
  options: { name: string; mode: 'autonomous' | 'delegated' },
): Promise<RegisterOutcome> {
  const discovery = await fetchDiscovery(baseUrl)
  const hostKeys = await generateKeyPair('Ed25519', { extractable: true })
  const agentKeys = await generateKeyPair('Ed25519', { extractable: true })
  const hostId = crypto.randomUUID()

  const hostJwt = await new SignJWT({
    aud: discovery.issuer,
    host_public_key: await exportJWK(hostKeys.publicKey),
    agent_public_key: await exportJWK(agentKeys.publicKey),
  })
    .setProtectedHeader({ alg: 'EdDSA', typ: 'host+jwt' })
    .setIssuer(hostId)
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime('5m')
    .sign(hostKeys.privateKey)

  const response = await fetch(discovery.endpoints.register ?? '', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hostJwt}`,
    },
    body: JSON.stringify({
      name: options.name,
      mode: options.mode,
      host_name: `${options.name} (modelschemas cli)`,
    }),
  })
  if (!response.ok) {
    throw new Error(
      `register failed: ${String(response.status)} ${await response.text()}`,
    )
  }
  const body = (await response.json()) as {
    agent_id?: string
    host_id?: string
    status?: string
    verification_uri?: string
    verification_uri_complete?: string
    user_code?: string
  }
  if (!body.agent_id) {
    throw new Error(`register returned no agent id: ${JSON.stringify(body)}`)
  }
  return {
    credentials: {
      agentId: body.agent_id,
      hostId: body.host_id ?? hostId,
      privateKeyJwk: await exportJWK(agentKeys.privateKey),
    },
    status: body.status ?? 'unknown',
    approval:
      body.verification_uri || body.user_code
        ? {
            verificationUri:
              body.verification_uri_complete ?? body.verification_uri,
            userCode: body.user_code,
          }
        : undefined,
  }
}

/** Poll agent status until active (delegated approval) or timeout. */
export async function waitForActivation(
  baseUrl: string,
  credentials: Omit<AgentCredentials, 'type' | 'baseUrl'>,
  timeoutSeconds = 300,
): Promise<boolean> {
  const discovery = await fetchDiscovery(baseUrl)
  const statusUrl = discovery.endpoints.status
  if (!statusUrl) return false
  const deadline = Date.now() + timeoutSeconds * 1000
  while (Date.now() < deadline) {
    const jwt = await mintAgentJwt(
      { type: 'agent', baseUrl, ...credentials },
      discovery,
    )
    const response = await fetch(statusUrl, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    if (response.ok) {
      const body = (await response.json()) as { status?: string }
      if (body.status === 'active') return true
    }
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  return false
}

export async function mintAgentJwt(
  credentials: AgentCredentials,
  discovery?: Discovery,
): Promise<string> {
  const resolved = discovery ?? (await fetchDiscovery(credentials.baseUrl))
  const key = await importJWK(credentials.privateKeyJwk, 'EdDSA')
  return new SignJWT({ aud: resolved.default_location })
    .setProtectedHeader({ alg: 'EdDSA', typ: 'agent+jwt' })
    .setIssuer(credentials.hostId)
    .setSubject(credentials.agentId)
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime('2m')
    .sign(key)
}
