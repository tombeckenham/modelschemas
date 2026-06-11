import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  credentialsPath,
  loadCredentials,
  saveCredentials,
} from './credentials.ts'

const ORIGINAL = process.env.MODELSCHEMAS_CONFIG_DIR

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.MODELSCHEMAS_CONFIG_DIR
  else process.env.MODELSCHEMAS_CONFIG_DIR = ORIGINAL
})

describe('credentials storage', () => {
  it('round-trips credentials with 0600 permissions', () => {
    process.env.MODELSCHEMAS_CONFIG_DIR = mkdtempSync(
      join(tmpdir(), 'ms-cli-creds-'),
    )
    expect(loadCredentials()).toBeNull()

    const path = saveCredentials({
      type: 'api-key',
      baseUrl: 'http://localhost:3100',
      apiKey: 'test-key',
    })
    expect(path).toBe(credentialsPath())
    expect(statSync(path).mode & 0o777).toBe(0o600)
    expect(loadCredentials()).toEqual({
      type: 'api-key',
      baseUrl: 'http://localhost:3100',
      apiKey: 'test-key',
    })

    // Agent credentials round-trip including the private key JWK.
    saveCredentials({
      type: 'agent',
      baseUrl: 'http://localhost:3100',
      agentId: 'agent-1',
      hostId: 'host-1',
      privateKeyJwk: { kty: 'OKP', crv: 'Ed25519', d: 'x', x: 'y' },
    })
    const loaded = loadCredentials()
    expect(loaded?.type).toBe('agent')
    if (loaded?.type === 'agent') {
      expect(loaded.privateKeyJwk.crv).toBe('Ed25519')
    }
    // Raw file never readable beyond owner; sanity-check the JSON itself.
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(loaded)
  })

  it('returns null for corrupt credential files', () => {
    process.env.MODELSCHEMAS_CONFIG_DIR = mkdtempSync(
      join(tmpdir(), 'ms-cli-creds-'),
    )
    saveCredentials({
      type: 'api-key',
      baseUrl: 'http://x',
      apiKey: 'k',
    })
    writeFileSync(credentialsPath(), 'not json')
    expect(loadCredentials()).toBeNull()
  })
})
