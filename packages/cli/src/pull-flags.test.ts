import { describe, expect, it, vi } from 'vitest'

import { parsePullFlags } from './index.ts'

describe('parsePullFlags', () => {
  it('applies defaults', () => {
    expect(parsePullFlags({})).toEqual({
      outDir: 'src/modelschemas',
      types: true,
      optionalStyle: undefined,
    })
  })

  it('honours --out, --no-types, --optional', () => {
    expect(
      parsePullFlags({
        out: 'generated/schemas',
        'no-types': true,
        optional: 'undefined',
      }),
    ).toEqual({
      outDir: 'generated/schemas',
      types: false,
      optionalStyle: 'undefined',
    })
  })

  it('rejects an invalid --optional value', () => {
    const exit = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    parsePullFlags({ optional: 'maybe' })
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("invalid --optional 'maybe'"),
    )
    expect(exit).toHaveBeenCalledWith(1)
    exit.mockRestore()
    error.mockRestore()
  })
})
