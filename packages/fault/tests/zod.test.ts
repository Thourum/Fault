import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { safeZodParse, fromZodError } from '../src/zod'

const user = z.object({ name: z.string(), age: z.number().min(18) })

describe('safeZodParse', () => {
  it('curried form returns Ok on valid data', () => {
    const r = safeZodParse(user)({ name: 'a', age: 20 })
    expect(r._unsafeUnwrap()).toEqual({ name: 'a', age: 20 })
  })
  it('direct form returns Ok on valid data', () => {
    expect(safeZodParse(user, { name: 'a', age: 20 }).isOk()).toBe(true)
  })
  it('returns VALIDATION_ERROR Fault with issues on invalid data', () => {
    const f = safeZodParse(user, { name: 1, age: 5 })._unsafeUnwrapErr()
    expect(f.tag).toBe('VALIDATION_ERROR')
    expect(f.metadata.issueCount).toBe(2)
    expect((f.metadata.fieldErrors as Record<string, unknown>).age).toBeDefined()
    expect(f.statusCode).toBe(400)
  })
})

describe('fromZodError', () => {
  it('builds Fault from ZodError and keeps it as cause', () => {
    const res = user.safeParse({})
    if (res.success) throw new Error('expected failure')
    const f = fromZodError(res.error)
    expect(f.tag).toBe('VALIDATION_ERROR')
    expect(f.message).toMatch(/^Validation failed: /)
    expect(f.cause).toBe(res.error)
  })
})
