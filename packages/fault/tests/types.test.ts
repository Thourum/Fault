import { describe, expectTypeOf, it } from 'bun:test'
import {
  err,
  errAsync,
  Fault,
  fromAsyncThrowable,
  fromPromise,
  fromThrowable,
  ok,
  okAsync,
  Result,
  ResultAsync,
  type Err,
  retry,
  safeTry,
  type FaultTag,
} from '../src'
import { safeFetch, safeFetchJSON } from '../src/fetch'

describe('Result types', () => {
  it('infers map and mapErr values and preserves the opposite branch', () => {
    const mapped = ok<number, 'initial'>(1).map((value) => String(value))
    const mappedErr = err<number, 'initial'>('initial').mapErr((error) => error.length)
    expectTypeOf(mapped).toEqualTypeOf<Result<string, 'initial'>>()
    expectTypeOf(mappedErr).toEqualTypeOf<Result<number, number>>()
  })

  it('combines andThen and andCheck errors without losing the success type', () => {
    const chained = ok<number, 'initial'>(1).andThen((value) =>
      value > 0 ? ok<string, 'next'>('yes') : err<string, 'next'>('next'))
    const checked = ok<number, 'initial'>(1).andCheck(() => err<never, 'next'>('next'))
    expectTypeOf(chained).toEqualTypeOf<Result<string, 'initial' | 'next'>>()
    expectTypeOf(checked).toEqualTypeOf<Result<number, 'initial' | 'next'>>()
  })

  it('infers recovery, matching and default values', () => {
    const recovered = err<number, 'initial'>('initial').orElse(() => ok<string, 'next'>('yes'))
    const matched = ok<number, string>(1).match((value) => value + 1, (error) => error)
    const defaulted = err<number, string>('no').unwrapOr(false)
    expectTypeOf(recovered).toEqualTypeOf<Result<number | string, 'next'>>()
    expectTypeOf(matched).toEqualTypeOf<number | string>()
    expectTypeOf(defaulted).toEqualTypeOf<number | boolean>()
  })

  it('infers literal string errors but widens object errors', () => {
    expectTypeOf(err('failed')).toEqualTypeOf<Err<never, 'failed'>>()
    expectTypeOf(err({ code: 400 })).toEqualTypeOf<Err<never, { code: number }>>()
  })

  it('infers async operations started from a synchronous Result', () => {
    const chained = ok<number, 'initial'>(1).asyncAndThen(() => okAsync<string, 'next'>('yes'))
    const checked = ok<number, 'initial'>(1).asyncAndCheck(() => errAsync<never, 'next'>('next'))
    const mapped = ok<number, 'initial'>(1).asyncMap(async (value) => String(value))
    expectTypeOf(chained).toEqualTypeOf<ResultAsync<string, 'initial' | 'next'>>()
    expectTypeOf(checked).toEqualTypeOf<ResultAsync<number, 'initial' | 'next'>>()
    expectTypeOf(mapped).toEqualTypeOf<ResultAsync<string, 'initial'>>()
  })

  it('preserves heterogeneous tuple positions and error unions in combine', () => {
    const combined = Result.combine([
      ok<number, 'first'>(1), err<string, 'second'>('second'), ok<boolean, 'third'>(true),
    ])
    expectTypeOf(combined).toEqualTypeOf<Result<[number, string, boolean], 'first' | 'second' | 'third'>>()
  })

  it('distinguishes arrays and empty tuples in combine', () => {
    const list: Result<string, 'error'>[] = [ok('yes')]
    const array = Result.combine(list)
    expectTypeOf(array).toEqualTypeOf<Result<string[], 'error'>>()
    const empty: [] = []
    expectTypeOf(Result.combine(empty)).toEqualTypeOf<Result<never, never>>()
  })

  it('collects typed errors without flattening heterogeneous values', () => {
    const combined = Result.combineWithAllErrors([
      ok<number[], 'first'>([1]), err<string[], 'second'>('second'),
    ])
    const array: Result<string, 'error'>[] = [ok('yes')]
    expectTypeOf(combined).toEqualTypeOf<Result<[number[], string[]], ('first' | 'second')[]>>()
    expectTypeOf(Result.combineWithAllErrors(array)).toEqualTypeOf<Result<string[], 'error'[]>>()
  })

  it('infers yielded successes and unions of yielded and returned errors', () => {
    const result = safeTry(function* () {
      const value = yield* ok<number, 'first'>(1)
      expectTypeOf(value).toEqualTypeOf<number>()
      yield* err<never, 'second'>('second')
      return ok<string, 'third'>('yes')
    })
    expectTypeOf(result).toEqualTypeOf<Result<string, 'first' | 'second' | 'third'>>()
  })

  it('preserves function arguments and error mapping in fromThrowable', () => {
    const wrapped = fromThrowable((value: number, text: string) => `${value}${text}`, () => new Fault('no'))
    expectTypeOf(wrapped).toEqualTypeOf<(value: number, text: string) => Result<string, Fault>>()
  })
})

describe('ResultAsync types', () => {
  it('infers map and mapErr for synchronous and asynchronous callbacks', () => {
    const mapped = okAsync<number, 'initial'>(1).map(async (value) => String(value))
    const mappedErr = errAsync<number, 'initial'>('initial').mapErr(async (error) => error.length)
    expectTypeOf(mapped).toEqualTypeOf<ResultAsync<string, 'initial'>>()
    expectTypeOf(mappedErr).toEqualTypeOf<ResultAsync<number, number>>()
  })

  it('infers andThen with Result, ResultAsync and mixed callbacks', () => {
    const synchronous = okAsync<number, 'initial'>(1).andThen(() => ok<string, 'next'>('yes'))
    const asynchronous = okAsync<number, 'initial'>(1).andThen(() => okAsync<string, 'next'>('yes'))
    const mixed = okAsync<number, 'initial'>(1).andThen((value) =>
      value > 0 ? ok<string, 'next'>('yes') : errAsync<string, 'next'>('next'))
    expectTypeOf(synchronous).toEqualTypeOf<ResultAsync<string, 'initial' | 'next'>>()
    expectTypeOf(asynchronous).toEqualTypeOf<ResultAsync<string, 'initial' | 'next'>>()
    expectTypeOf(mixed).toEqualTypeOf<ResultAsync<string, 'initial' | 'next'>>()
  })

  it('infers checking and recovery from synchronous and asynchronous results', () => {
    const checked = okAsync<number, 'initial'>(1).andCheck(() => errAsync<never, 'next'>('next'))
    const recoveredSync = errAsync<number, 'initial'>('initial').orElse(() => ok<string, 'next'>('yes'))
    const recoveredAsync = errAsync<number, 'initial'>('initial').orElse(() => okAsync<string, 'next'>('yes'))
    expectTypeOf(checked).toEqualTypeOf<ResultAsync<number, 'initial' | 'next'>>()
    expectTypeOf(recoveredSync).toEqualTypeOf<ResultAsync<number | string, 'next'>>()
    expectTypeOf(recoveredAsync).toEqualTypeOf<ResultAsync<number | string, 'next'>>()
  })

  it('infers promises returned by match and unwrapOr', () => {
    const matched = okAsync<number, string>(1).match((value) => value + 1, (error) => error)
    const defaulted = errAsync<number, string>('no').unwrapOr(false)
    expectTypeOf(matched).toEqualTypeOf<Promise<number | string>>()
    expectTypeOf(defaulted).toEqualTypeOf<Promise<number | boolean>>()
  })

  it('preserves heterogeneous tuple positions in combine and collects errors in combineWithAllErrors', () => {
    const list = [okAsync<number, 'first'>(1), errAsync<string, 'second'>('second')] as const
    expectTypeOf(ResultAsync.combine(list)).toEqualTypeOf<ResultAsync<[number, string], 'first' | 'second'>>()
    expectTypeOf(ResultAsync.combineWithAllErrors(list)).toEqualTypeOf<ResultAsync<[number, string], ('first' | 'second')[]>>()
  })

  it('infers arrays and empty tuples in async combinations', () => {
    const list: ResultAsync<number, 'error'>[] = [okAsync(1)]
    expectTypeOf(ResultAsync.combine(list)).toEqualTypeOf<ResultAsync<number[], 'error'>>()
    expectTypeOf(ResultAsync.combineWithAllErrors(list)).toEqualTypeOf<ResultAsync<number[], 'error'[]>>()
    const empty: [] = []
    expectTypeOf(ResultAsync.combine(empty)).toEqualTypeOf<ResultAsync<never, never>>()
  })

  it('infers yielded values and errors in an async safeTry generator', () => {
    const result = safeTry(async function* () {
      const value = yield* okAsync<number, 'first'>(1)
      expectTypeOf(value).toEqualTypeOf<number>()
      yield* errAsync<never, 'second'>('second')
      return okAsync<string, 'third'>('yes')
    })
    expectTypeOf(result).toEqualTypeOf<ResultAsync<string, 'first' | 'second' | 'third'>>()
  })

  it('infers fromPromise, fromSafePromise and fromAsyncThrowable', () => {
    const promise = fromPromise(Promise.resolve(1), () => new Fault('no'))
    const safe = ResultAsync.fromSafePromise(Promise.resolve(1))
    const wrapped = fromAsyncThrowable(async (value: number) => String(value), () => new Fault('no'))
    expectTypeOf(promise).toEqualTypeOf<ResultAsync<number, Fault>>()
    expectTypeOf(safe).toEqualTypeOf<ResultAsync<number, never>>()
    expectTypeOf(wrapped).toEqualTypeOf<(value: number) => ResultAsync<string, Fault>>()
  })
})

describe('Fault types', () => {
  it('keeps builder chains typed as Fault and narrows the tag contract', () => {
    const fault = new Fault('no').withTag('NOT_FOUND').withDetails('detail')
      .withMetadata({ retryable: false }).withCause(new Error('cause'))
    expectTypeOf(fault).toEqualTypeOf<Fault>()
    expectTypeOf(fault.tag).toEqualTypeOf<FaultTag | undefined>()
    expectTypeOf<Parameters<typeof fault.withTag>[0]>().toEqualTypeOf<FaultTag>()
  })

  it('types retry and fetch boundaries with Fault errors', () => {
    const retried = retry(() => errAsync<number, 'failed'>('failed'), { times: 1 })
    expectTypeOf(retried).toEqualTypeOf<ResultAsync<number, 'failed' | Fault>>()
    expectTypeOf<ReturnType<typeof safeFetch>>().toEqualTypeOf<ResultAsync<Response, Fault>>()
    expectTypeOf<ReturnType<typeof safeFetchJSON<{ id: number }>>>()
      .toEqualTypeOf<ResultAsync<{ id: number }, Fault>>()
  })
})
