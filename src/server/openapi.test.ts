import { describe, expect, it } from 'vitest'
import { Validator } from '@cfworker/json-schema'

import type { Schema } from '@cfworker/json-schema'
import metaSchema from './fixtures/oas-3.1-meta-schema.json'
import { openApiDocument } from './openapi.ts'

describe('openApiDocument', () => {
  it('validates against the OpenAPI 3.1 meta-schema', () => {
    const validator = new Validator(metaSchema as Schema, '2020-12', false)
    const result = validator.validate(openApiDocument)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('gives every operation a unique operationId', () => {
    const ids: Array<string> = []
    for (const pathItem of Object.values(openApiDocument.paths)) {
      for (const operation of Object.values(pathItem)) {
        ids.push((operation as { operationId: string }).operationId)
      }
    }
    expect(ids.length).toBeGreaterThanOrEqual(12)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-zA-Z][a-zA-Z0-9]*$/)
  })
})
