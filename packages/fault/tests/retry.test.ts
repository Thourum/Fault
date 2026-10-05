import { describe, expect, it } from 'bun:test'
import { okAsync, errAsync, Fault, ResultAsync } from '../src'
import { retry } from '../src/retry'

const failing = (failures: number) => {
  let n = 0
  return () => (n++ < failures ? errAsync<number, string>(`fail${n}`) : okAsync<number, string>(42))
}

describe('retry', () => {
  it('returns first Ok without retrying', async () => {
    let calls = 0
    const r = await retry(() => { calls++; return okAsync(1) }, { times: 3 })
    expect(r._unsafeUnwrap()).toBe(1); expect(calls).toBe(1)
  })
  it('succeeds on nth attempt', async () => {
    const r = await retry(failing(2), { times: 3 })
    expect(r._unsafeUnwrap()).toBe(42)
  })
  it('returns last Err after exhausting attempts', async () => {
    const r = await retry(failing(5), { times: 3 })
    expect(r._unsafeUnwrapErr()).toBe('fail3')
  })
  it('stops early when predicate is false', async () => {
    let calls = 0
    const r = await retry(() => { calls++; return errAsync<number, string>('fatal') }, { times: 5, when: (e) => e !== 'fatal' })
    expect(r._unsafeUnwrapErr()).toBe('fatal'); expect(calls).toBe(1)
  })
  it('waits delayMs between attempts', async () => {
    // bun:test has no fake-timer API; a lower-bound wall-clock check is deterministic enough
    // (spec §5 says "fake timers" — this is the deliberate substitute).
    const t0 = Date.now()
    await retry(failing(2), { times: 3, delayMs: 30 })
    expect(Date.now() - t0).toBeGreaterThanOrEqual(55)
  })
  it('returns Err Fault with the thrown cause and stops when fn throws', async () => {
    const cause = new Error('x')
    let calls = 0
    const result = await retry(() => { calls++; throw cause }, { times: 3 })
    expect(result.isErr()).toBe(true)
    const fault = result._unsafeUnwrapErr()
    expect(fault).toBeInstanceOf(Fault)
    if (!(fault instanceof Fault)) throw new Error('Expected Fault')
    expect(fault.tag).toBe('UNKNOWN_ERROR')
    expect(fault.cause).toBe(cause)
    expect(calls).toBe(1)
  })
  it('keeps the original cause when a thrown value cannot be stringified', async () => {
    const cause = Object.create(null)
    const result = await retry(() => { throw cause }, { times: 3 })
    const fault = result._unsafeUnwrapErr()
    expect(fault).toBeInstanceOf(Fault)
    if (!(fault instanceof Fault)) throw new Error('Expected Fault')
    expect(fault.message).toBe('Unknown error')
    expect(fault.cause).toBe(cause)
  })
  it('returns Err Fault when fn returns a rejecting ResultAsync', async () => {
    const cause = 'rejected'
    const result = await retry(() => new ResultAsync<number, string>(Promise.reject(cause)), { times: 3 })
    const fault = result._unsafeUnwrapErr()
    expect(fault).toBeInstanceOf(Fault)
    if (!(fault instanceof Fault)) throw new Error('Expected Fault')
    expect(fault.cause).toBe(cause)
  })
  it('returns Err Fault when when throws and stops retrying', async () => {
    const cause = new Error('predicate failed')
    let calls = 0
    const result = await retry(() => { calls++; return errAsync<number, string>('try again') }, {
      times: 3, when: () => { throw cause },
    })
    const fault = result._unsafeUnwrapErr()
    expect(fault).toBeInstanceOf(Fault)
    if (!(fault instanceof Fault)) throw new Error('Expected Fault')
    expect(fault.cause).toBe(cause)
    expect(calls).toBe(1)
  })
})
