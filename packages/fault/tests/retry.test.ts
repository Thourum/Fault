import { describe, expect, it } from 'bun:test'
import { okAsync, errAsync, ResultAsync } from '../src'
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
  it('returns a ResultAsync (chainable)', async () => {
    const r = retry(failing(0), { times: 1 })
    expect(r).toBeInstanceOf(ResultAsync)
    expect((await r.map((v) => v + 1))._unsafeUnwrap()).toBe(43)
  })
  it('rejects when fn throws synchronously', async () => {
    await expect(Promise.resolve(retry(() => { throw new Error('x') }, { times: 2 }))).rejects.toThrow('x')
  })
})
