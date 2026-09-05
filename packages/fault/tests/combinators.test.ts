import { describe, expect, it } from 'bun:test'
import { ok, err, okAsync, errAsync } from '../src'

describe('andInspect', () => {
  it('runs f on Ok and passes value through', () => {
    let seen: number | undefined
    const r = ok(2).andInspect((v) => { seen = v })
    expect(seen).toBe(2)
    expect(r._unsafeUnwrap()).toBe(2)
  })
  it('swallows errors thrown by f', () => {
    const r = ok(2).andInspect(() => { throw new Error('boom') })
    expect(r.isOk()).toBe(true)
  })
  it('skips f on Err', () => {
    let called = false
    const r = err('e').andInspect(() => { called = true })
    expect(called).toBe(false)
    expect(r._unsafeUnwrapErr()).toBe('e')
  })
  it('works on ResultAsync', async () => {
    let seen: number | undefined
    const r = await okAsync(3).andInspect(async (v) => { seen = v })
    expect(seen).toBe(3)
    expect(r._unsafeUnwrap()).toBe(3)
  })
})

describe('orInspect', () => {
  it('runs f on Err and passes error through', () => {
    let seen: string | undefined
    const r = err('e').orInspect((e) => { seen = e })
    expect(seen).toBe('e')
    expect(r._unsafeUnwrapErr()).toBe('e')
  })
  it('swallows errors thrown by f', () => {
    const r = err('e').orInspect(() => { throw new Error('boom') })
    expect(r.isErr()).toBe(true)
  })
  it('skips f on Ok', () => {
    let called = false
    ok(1).orInspect(() => { called = true })
    expect(called).toBe(false)
  })
  it('works on ResultAsync', async () => {
    let seen: string | undefined
    const r = await errAsync('e').orInspect(async (e) => { seen = e })
    expect(seen).toBe('e')
    expect(r._unsafeUnwrapErr()).toBe('e')
  })
})

describe('andCheck', () => {
  it('keeps original value when f returns Ok', () => {
    const r = ok(5).andCheck(() => ok('ignored'))
    expect(r._unsafeUnwrap()).toBe(5)
  })
  it('fails with Err from f', () => {
    const r = ok(5).andCheck(() => err('checkfail'))
    expect(r._unsafeUnwrapErr()).toBe('checkfail')
  })
  it('skips f on Err', () => {
    let called = false
    const r = err('e').andCheck(() => { called = true; return ok(1) })
    expect(called).toBe(false)
    expect(r._unsafeUnwrapErr()).toBe('e')
  })
  it('works on ResultAsync with ResultAsync-returning f', async () => {
    const r = await okAsync(5).andCheck(() => errAsync('cf'))
    expect(r._unsafeUnwrapErr()).toBe('cf')
    const r2 = await okAsync(5).andCheck(() => okAsync('x'))
    expect(r2._unsafeUnwrap()).toBe(5)
  })
})
