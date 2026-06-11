/**
 * Credential storage for the modelschemas CLI:
 * ~/.config/modelschemas/credentials.json, chmod 0600.
 */
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { JWK } from 'jose'

export interface AgentCredentials {
  type: 'agent'
  baseUrl: string
  agentId: string
  hostId: string
  /** Ed25519 private key (JWK) used to mint per-request JWTs. */
  privateKeyJwk: JWK
}

export interface ApiKeyCredentials {
  type: 'api-key'
  baseUrl: string
  apiKey: string
}

export type Credentials = AgentCredentials | ApiKeyCredentials

export function credentialsPath(): string {
  return join(
    process.env.MODELSCHEMAS_CONFIG_DIR ??
      join(homedir(), '.config', 'modelschemas'),
    'credentials.json',
  )
}

export function saveCredentials(credentials: Credentials): string {
  const path = credentialsPath()
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, JSON.stringify(credentials, null, 2) + '\n')
  chmodSync(path, 0o600)
  return path
}

export function loadCredentials(): Credentials | null {
  const path = credentialsPath()
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Credentials
  } catch {
    return null
  }
}
