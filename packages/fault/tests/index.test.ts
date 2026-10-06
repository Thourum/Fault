import {
  err,
  Err,
  errAsync,
  ok,
  Ok,
  okAsync,
  Result,
  ResultAsync,
} from '../src'

import { describe, expect, it, mock } from 'bun:test'

describe('Result.Ok', () => {
  it('Creates an Ok value', () => {
    const okVal = ok(12)

    expect(okVal.isOk()).toBe(true)
    expect(okVal.isErr()).toBe(false)
    expect(okVal).toBeInstanceOf(Ok)
  })

  it('Creates an Ok value with null', () => {
    const okVal = ok(null)

    expect(okVal.isOk()).toBe(true)
    expect(okVal.isErr()).toBe(false)
    expect(okVal._unsafeUnwrap()).toBe(null)
  })

  it('Creates an Ok value with undefined', () => {
    const okVal = ok(undefined)

    expect(okVal.isOk()).toBe(true)
    expect(okVal.isErr()).toBe(false)
    expect(okVal._unsafeUnwrap()).toBeUndefined()
  })

  it('Maps over an Ok value', () => {
    const okVal = ok(12)
    const mapFn = mock((number) => number.toString())

    const mapped = okVal.map(mapFn)

    expect(mapped.isOk()).toBe(true)
    expect(mapped._unsafeUnwrap()).toBe('12')
    expect(mapFn).toHaveBeenCalledTimes(1)
  })

  it('Skips `mapErr`', () => {
    const mapErrorFunc = mock((_error) => 'mapped error value')

    const notMapped = ok(12).mapErr(mapErrorFunc)

    expect(notMapped.isOk()).toBe(true)
    expect(mapErrorFunc).not.toHaveBeenCalledTimes(1)
  })

  describe('andThen', () => {
    it('Maps to an Ok', () => {
      const okVal = ok(12)

      const flattened = okVal.andThen((_number) => {
        // ...
        // complex logic
        // ...
        return ok({ data: 'why not' })
      })

      expect(flattened.isOk()).toBe(true)
      expect(flattened._unsafeUnwrap()).toStrictEqual({ data: 'why not' })
    })

    it('Maps to an Err', () => {
      const okval = ok(12)

      const flattened = okval.andThen((_number) => {
        // ...
        // complex logic
        // ...
        return err('Whoopsies!')
      })

      expect(flattened.isOk()).toBe(false)

      const nextFn = mock((_val) => ok('noop'))

      flattened.andThen(nextFn)

      expect(nextFn).not.toHaveBeenCalled()
    })
  })

  describe('andCheck', () => {
    it('Calls the passed function but returns an original ok', () => {
      const okVal = ok(12)
      const passedFn = mock((_number) => ok(undefined))

      const thrued = okVal.andCheck(passedFn)
      expect(thrued.isOk()).toBe(true)
      expect(passedFn).toHaveBeenCalledTimes(1)
      expect(thrued._unsafeUnwrap()).toStrictEqual(12)
    })

    it('Maps to an Err', () => {
      const checked = ok(12).andCheck(() => err('Whoopsies!'))
      expect(checked._unsafeUnwrapErr()).toBe('Whoopsies!')
    })
  })

  describe('andInspect', () => {
    it('Calls the passed function but returns an original ok', () => {
      const okVal = ok(12)
      const passedFn = mock((_number) => {})

      const teed = okVal.andInspect(passedFn)

      expect(teed.isOk()).toBe(true)
      expect(passedFn).toHaveBeenCalledTimes(1)
      expect(teed._unsafeUnwrap()).toStrictEqual(12)
    })
    it('returns an original ok even when the passed function fails', () => {
      const okVal = ok(12)
      const passedFn = mock((_number) => {
        throw new Error('OMG!')
      })

      const teed = okVal.andInspect(passedFn)

      expect(teed.isOk()).toBe(true)
      expect(passedFn).toHaveBeenCalledTimes(1)
      expect(teed._unsafeUnwrap()).toStrictEqual(12)
    })
  })

  describe('orInspect', () => {
    it('Calls the passed function but returns an original err', () => {
      const errVal = err(12)
      const passedFn = mock((_number) => {})

      const teed = errVal.orInspect(passedFn)

      expect(teed.isErr()).toBe(true)
      expect(passedFn).toHaveBeenCalledTimes(1)
      expect(teed._unsafeUnwrapErr()).toStrictEqual(12)
    })
    it('returns an original err even when the passed function fails', () => {
      const errVal = err(12)
      const passedFn = mock((_number) => {
        throw new Error('OMG!')
      })

      const teed = errVal.orInspect(passedFn)

      expect(teed.isErr()).toBe(true)
      expect(passedFn).toHaveBeenCalledTimes(1)
      expect(teed._unsafeUnwrapErr()).toStrictEqual(12)
    })
  })

  describe('asyncAndCheck', () => {
    it('Calls the passed function but returns an original ok as Async', async () => {
      const okVal = ok(12)
      const passedFn = mock((_number) => okAsync(undefined))

      const teedAsync = okVal.asyncAndCheck(passedFn)
      expect(teedAsync).toBeInstanceOf(ResultAsync)
      const teed = await teedAsync
      expect(teed.isOk()).toBe(true)
      expect(passedFn).toHaveBeenCalledTimes(1)
      expect(teed._unsafeUnwrap()).toStrictEqual(12)
    })

    it('Maps to an Err', async () => {
      const checked = await ok(12).asyncAndCheck(() => errAsync('Whoopsies!'))
      expect(checked._unsafeUnwrapErr()).toBe('Whoopsies!')
    })
  })
  describe('orElse', () => {
    it('Skips orElse on an Ok value', () => {
      const okVal = ok(12)
      const errorCallback = mock((_errVal) => err<number, string>('It is now a string'))

      expect(okVal.orElse(errorCallback)).toEqual(ok(12))
      expect(errorCallback).not.toHaveBeenCalled()
    })
  })

  it('unwrapOr and return the Ok value', () => {
    const okVal = ok(12)
    expect(okVal.unwrapOr(1)).toEqual(12)
  })

  it('Maps to a ResultAsync', async () => {
    const okVal = ok(12)

    const flattened = okVal.asyncAndThen((_number) => {
      // ...
      // complex async logic
      // ...
      return okAsync({ data: 'why not' })
    })

    expect(flattened).toBeInstanceOf(ResultAsync)

    const newResult = await flattened

    expect(newResult.isOk()).toBe(true)
    expect(newResult._unsafeUnwrap()).toStrictEqual({ data: 'why not' })
  })

  it('Maps to a promise', async () => {
    const asyncMapper = mock((_val) => {
      // ...
      // complex logic
      // ..

      // db queries
      // network calls
      // disk io
      // etc ...
      return Promise.resolve('Very Nice!')
    })

    const okVal = ok(12)

    const promise = okVal.asyncMap(asyncMapper)

    expect(promise).toBeInstanceOf(ResultAsync)

    const newResult = await promise

    expect(newResult.isOk()).toBe(true)
    expect(asyncMapper).toHaveBeenCalledTimes(1)
    expect(newResult._unsafeUnwrap()).toStrictEqual('Very Nice!')
  })

  it('Matches on an Ok', () => {
    const okMapper = mock((_val) => 'weeeeee')
    const errMapper = mock((_val) => 'wooooo')

    const matched = ok(12).match(okMapper, errMapper)

    expect(matched).toBe('weeeeee')
    expect(okMapper).toHaveBeenCalledTimes(1)
    expect(errMapper).not.toHaveBeenCalled()
  })

  it('Can read the value after narrowing', () => {
    const fallible: () => Result<string, number> = () => ok('safe to read')
    const val = fallible()

    // After this check we val is narrowed to Ok<string, number>. Without this
    // line TypeScript will not allow accessing val.value.
    if (val.isErr()) return

    expect(val.value).toBe('safe to read')
  })
})

describe('Result.Err', () => {
  it('Creates an Err value', () => {
    const errVal = err('I have you now.')

    expect(errVal.isOk()).toBe(false)
    expect(errVal.isErr()).toBe(true)
    expect(errVal).toBeInstanceOf(Err)
  })

  it('Skips `map`', () => {
    const errVal = err('I am your father')

    const mapper = mock((_value) => 'noooo')

    const hopefullyNotMapped = errVal.map(mapper)

    expect(hopefullyNotMapped.isErr()).toBe(true)
    expect(mapper).not.toHaveBeenCalled()
    expect(hopefullyNotMapped._unsafeUnwrapErr()).toEqual(errVal._unsafeUnwrapErr())
  })

  it('Maps over an Err', () => {
    const errVal = err('Round 1, Fight!')

    const mapper = mock((error: string) => error.replace('1', '2'))

    const mapped = errVal.mapErr(mapper)

    expect(mapped.isErr()).toBe(true)
    expect(mapper).toHaveBeenCalledTimes(1)
    expect(mapped._unsafeUnwrapErr()).not.toEqual(errVal._unsafeUnwrapErr())
  })

  it('unwrapOr and return the default value', () => {
    const okVal = err<number, string>('Oh nooo')
    expect(okVal.unwrapOr(1)).toEqual(1)
  })

  it('Skips over andThen', () => {
    const errVal = err('Yolo')

    const mapper = mock((_val) => ok<string, string>('yooyo'))

    const hopefullyNotFlattened = errVal.andThen(mapper)

    expect(hopefullyNotFlattened.isErr()).toBe(true)
    expect(mapper).not.toHaveBeenCalled()
    expect(errVal._unsafeUnwrapErr()).toEqual('Yolo')
  })

  it('Skips over andCheck', () => {
    const errVal = err('Yolo')

    const mapper = mock((_val) => ok<void, string>(undefined))

    const hopefullyNotFlattened = errVal.andCheck(mapper)

    expect(hopefullyNotFlattened.isErr()).toBe(true)
    expect(mapper).not.toHaveBeenCalled()
    expect(errVal._unsafeUnwrapErr()).toEqual('Yolo')
  })

  it('Skips over andInspect', () => {
    const errVal = err('Yolo')

    const mapper = mock((_val) => {})

    const hopefullyNotFlattened = errVal.andInspect(mapper)

    expect(hopefullyNotFlattened.isErr()).toBe(true)
    expect(mapper).not.toHaveBeenCalled()
    expect(errVal._unsafeUnwrapErr()).toEqual('Yolo')
  })

  it('Skips over asyncAndCheck but returns ResultAsync instead', async () => {
    const errVal = err('Yolo')

    const mapper = mock((_val) => okAsync<string, unknown>('Async'))

    const hopefullyNotFlattened = errVal.asyncAndCheck(mapper)
    expect(hopefullyNotFlattened).toBeInstanceOf(ResultAsync)

    const result = await hopefullyNotFlattened
    expect(result.isErr()).toBe(true)
    expect(mapper).not.toHaveBeenCalled()
    expect(result._unsafeUnwrapErr()).toEqual('Yolo')
  })

  it('Transforms error into ResultAsync within `asyncAndThen`', async () => {
    const errVal = err('Yolo')

    const asyncMapper = mock((_val) => okAsync<string, string>('yooyo'))

    const hopefullyNotFlattened = errVal.asyncAndThen(asyncMapper)

    expect(hopefullyNotFlattened).toBeInstanceOf(ResultAsync)
    expect(asyncMapper).not.toHaveBeenCalled()

    const syncResult = await hopefullyNotFlattened
    expect(syncResult._unsafeUnwrapErr()).toEqual('Yolo')
  })

  it('Does not invoke callback within `asyncMap`', async () => {
    const asyncMapper = mock((_val) => {
      // ...
      // complex logic
      // ..

      // db queries
      // network calls
      // disk io
      // etc ...
      return Promise.resolve('Very Nice!')
    })

    const errVal = err('nooooooo')

    const promise = errVal.asyncMap(asyncMapper)

    expect(promise).toBeInstanceOf(ResultAsync)

    const sameResult = await promise

    expect(sameResult.isErr()).toBe(true)
    expect(asyncMapper).not.toHaveBeenCalled()
    expect(sameResult._unsafeUnwrapErr()).toEqual(errVal._unsafeUnwrapErr())
  })

  it('Matches on an Err', () => {
    const okMapper = mock((_val) => 'weeeeee')
    const errMapper = mock((_val) => 'wooooo')

    const matched = err(12).match(okMapper, errMapper)

    expect(matched).toBe('wooooo')
    expect(okMapper).not.toHaveBeenCalled()
    expect(errMapper).toHaveBeenCalledTimes(1)
  })

  it('Throws when you unwrap an Err', () => {
    const errVal = err('woopsies')

    expect(() => {
      errVal._unsafeUnwrap()
    }).toThrowError()
  })

  describe('orElse', () => {
    it('invokes the orElse callback on an Err value', () => {
      const okVal = err('BOOOM!')
      const errorCallback = mock((_errVal) => err(true))

      expect(okVal.orElse(errorCallback)).toEqual(err(true))
      expect(errorCallback).toHaveBeenCalledTimes(1)
    })
  })
})

describe('Result.fromThrowable', () => {
  it('Creates a function that returns an OK result when the inner function does not throw', () => {
    const hello = (): string => 'hello'
    const safeHello = Result.fromThrowable(hello)

    const result = hello()
    const safeResult = safeHello()

    expect(safeResult).toBeInstanceOf(Ok)
    expect(result).toEqual(safeResult._unsafeUnwrap())
  })

  // Added for issue #300 -- the test here is not so much that expectations are met as that the test compiles.
  it('Accepts an inner function which takes arguments', () => {
    const hello = (fname: string): string => `hello, ${fname}`
    const safeHello = Result.fromThrowable(hello)

    const result = hello('Dikembe')
    const safeResult = safeHello('Dikembe')

    expect(safeResult).toBeInstanceOf(Ok)
    expect(result).toEqual(safeResult._unsafeUnwrap())
  })

  it('Creates a function that returns an err when the inner function throws', () => {
    const thrower = (): string => {
      throw new Error()
    }

    // type: () => Result<string, unknown>
    // received types from thrower fn, no errorFn is provides therefore Err type is unknown
    const safeThrower = Result.fromThrowable(thrower)
    const result = safeThrower()

    expect(result).toBeInstanceOf(Err)
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(Error)
  })

  it('Accepts an error handler as a second argument', () => {
    const thrower = (): string => {
      throw new Error()
    }
    type MessageObject = { message: string }
    const toMessageObject = (): MessageObject => ({ message: 'error' })

    // type: () => Result<string, MessageObject>
    // received types from thrower fn and errorFn return type
    const safeThrower = Result.fromThrowable(thrower, toMessageObject)
    const result = safeThrower()

    expect(result.isOk()).toBe(false)
    expect(result.isErr()).toBe(true)
    expect(result).toBeInstanceOf(Err)
    expect(result._unsafeUnwrapErr()).toEqual({ message: 'error' })
  })

})

describe('Utils', () => {
  describe('`Result.combine`', () => {
    describe('Synchronous `combine`', () => {
      it('Combines a list of results into an Ok value', () => {
        const resultList = [ok(123), ok(456), ok(789)]

        const result = Result.combine(resultList)

        expect(result.isOk()).toBe(true)
        expect(result._unsafeUnwrap()).toEqual([123, 456, 789])
      })

      it('Combines a list of results into an Err value', () => {
        const resultList: Result<number, string>[] = [
          ok(123),
          err('boooom!'),
          ok(456),
          err('ahhhhh!'),
        ]

        const result = Result.combine(resultList)

        expect(result.isErr()).toBe(true)
        expect(result._unsafeUnwrapErr()).toBe('boooom!')
      })

      it('Combines heterogeneous lists', () => {
        type HeterogenousList = [
          Result<string, string>,
          Result<number, number>,
          Result<boolean, boolean>,
        ]

        const heterogenousList: HeterogenousList = [ok('Yooooo'), ok(123), ok(true)]

        type ExpecteResult = Result<[string, number, boolean], string | number | boolean>

        const result: ExpecteResult = Result.combine(heterogenousList)

        expect(result._unsafeUnwrap()).toEqual(['Yooooo', 123, true])
      })

      it('Does not destructure / concatenate arrays', () => {
        type HomogenousList = [Result<string[], boolean>, Result<number[], string>]

        const homogenousList: HomogenousList = [ok(['hello', 'world']), ok([1, 2, 3])]

        type ExpectedResult = Result<[string[], number[]], boolean | string>

        const result: ExpectedResult = Result.combine(homogenousList)

        expect(result._unsafeUnwrap()).toEqual([
          ['hello', 'world'],
          [1, 2, 3],
        ])
      })
    })

    describe('`ResultAsync.combine`', () => {
      it('Combines a list of async results into an Ok value', async () => {
        const asyncResultList = [okAsync(123), okAsync(456), okAsync(789)]

        const resultAsync: ResultAsync<number[], never[]> = ResultAsync.combine(asyncResultList)

        expect(resultAsync).toBeInstanceOf(ResultAsync)

        const result = await ResultAsync.combine(asyncResultList)

        expect(result.isOk()).toBe(true)
        expect(result._unsafeUnwrap()).toEqual([123, 456, 789])
      })

      it('Combines a list of results into an Err value', async () => {
        const resultList: ResultAsync<number, string>[] = [
          okAsync(123),
          errAsync('boooom!'),
          okAsync(456),
          errAsync('ahhhhh!'),
        ]

        const result = await ResultAsync.combine(resultList)

        expect(result.isErr()).toBe(true)
        expect(result._unsafeUnwrapErr()).toBe('boooom!')
      })

      it('Combines heterogeneous lists', async () => {
        type HeterogenousList = [
          ResultAsync<string, string>,
          ResultAsync<number, number>,
          ResultAsync<boolean, boolean>,
          ResultAsync<number[], string>,
        ]

        const heterogenousList: HeterogenousList = [
          okAsync('Yooooo'),
          okAsync(123),
          okAsync(true),
          okAsync([1, 2, 3]),
        ]

        type ExpecteResult = Result<[string, number, boolean, number[]], string | number | boolean>

        const result: ExpecteResult = await ResultAsync.combine(heterogenousList)

        expect(result._unsafeUnwrap()).toEqual(['Yooooo', 123, true, [1, 2, 3]])
      })
    })
  })
  describe('`Result.combineWithAllErrors`', () => {
    describe('Synchronous `combineWithAllErrors`', () => {
      it('Combines a list of results into an Ok value', () => {
        const resultList = [ok(123), ok(456), ok(789)]

        const result = Result.combineWithAllErrors(resultList)

        expect(result.isOk()).toBe(true)
        expect(result._unsafeUnwrap()).toEqual([123, 456, 789])
      })

      it('Combines a list of results into an Err value', () => {
        const resultList: Result<number, string>[] = [
          ok(123),
          err('boooom!'),
          ok(456),
          err('ahhhhh!'),
        ]

        const result = Result.combineWithAllErrors(resultList)

        expect(result.isErr()).toBe(true)
        expect(result._unsafeUnwrapErr()).toEqual(['boooom!', 'ahhhhh!'])
      })

      it('Combines heterogeneous lists', () => {
        type HeterogenousList = [
          Result<string, string>,
          Result<number, number>,
          Result<boolean, boolean>,
        ]

        const heterogenousList: HeterogenousList = [ok('Yooooo'), ok(123), ok(true)]

        type ExpecteResult = Result<[string, number, boolean], (string | number | boolean)[]>

        const result: ExpecteResult = Result.combineWithAllErrors(heterogenousList)

        expect(result._unsafeUnwrap()).toEqual(['Yooooo', 123, true])
      })

      it('Does not destructure / concatenate arrays', () => {
        type HomogenousList = [Result<string[], boolean>, Result<number[], string>]

        const homogenousList: HomogenousList = [ok(['hello', 'world']), ok([1, 2, 3])]

        type ExpectedResult = Result<[string[], number[]], (boolean | string)[]>

        const result: ExpectedResult = Result.combineWithAllErrors(homogenousList)

        expect(result._unsafeUnwrap()).toEqual([
          ['hello', 'world'],
          [1, 2, 3],
        ])
      })
    })
    describe('`ResultAsync.combineWithAllErrors`', () => {
      it('Combines a list of async results into an Ok value', async () => {
        const asyncResultList = [okAsync(123), okAsync(456), okAsync(789)]

        const result = await ResultAsync.combineWithAllErrors(asyncResultList)

        expect(result.isOk()).toBe(true)
        expect(result._unsafeUnwrap()).toEqual([123, 456, 789])
      })

      it('Combines a list of results into an Err value', async () => {
        const asyncResultList: ResultAsync<number, string>[] = [
          okAsync(123),
          errAsync('boooom!'),
          okAsync(456),
          errAsync('ahhhhh!'),
        ]

        const result = await ResultAsync.combineWithAllErrors(asyncResultList)

        expect(result.isErr()).toBe(true)
        expect(result._unsafeUnwrapErr()).toEqual(['boooom!', 'ahhhhh!'])
      })

      it('Combines heterogeneous lists', async () => {
        type HeterogenousList = [
          ResultAsync<string, string>,
          ResultAsync<number, number>,
          ResultAsync<boolean, boolean>,
        ]

        const heterogenousList: HeterogenousList = [okAsync('Yooooo'), okAsync(123), okAsync(true)]

        type ExpecteResult = Result<[string, number, boolean], (string | number | boolean)[]>

        const result: ExpecteResult = await ResultAsync.combineWithAllErrors(heterogenousList)

        expect(result._unsafeUnwrap()).toEqual(['Yooooo', 123, true])
      })
    })

  })
})

describe('ResultAsync', () => {
  it('Is awaitable to a Result', async () => {
    // For a success value
    const asyncVal = okAsync(12)
    expect(asyncVal).toBeInstanceOf(ResultAsync)

    const val = await asyncVal

    expect(val).toBeInstanceOf(Ok)
    expect(val._unsafeUnwrap()).toEqual(12)

    // For an error
    const asyncErr = errAsync('Wrong format')
    expect(asyncErr).toBeInstanceOf(ResultAsync)

    const err = await asyncErr

    expect(err).toBeInstanceOf(Err)
    expect(err._unsafeUnwrapErr()).toEqual('Wrong format')
  })

  describe('acting as a Promise<Result>', () => {
    it('Is chainable like any Promise', async () => {
      // For a success value
      const asyncValChained = okAsync(12).then((res) => {
        if (res.isOk()) {
          return res.value + 2
        }
      })

      expect(asyncValChained).toBeInstanceOf(Promise)
      const val = await asyncValChained
      expect(val).toEqual(14)

      // For an error
      const asyncErrChained = errAsync('Oops').then((res) => {
        if (res.isErr()) {
          return res.error + '!'
        }
      })

      expect(asyncErrChained).toBeInstanceOf(Promise)
      const err = await asyncErrChained
      expect(err).toEqual('Oops!')
    })

  })

  describe('map', () => {
    it('Maps a value using a synchronous function', async () => {
      const asyncVal = okAsync(12)

      const mapSyncFn = mock((number) => number.toString())

      const mapped = asyncVal.map(mapSyncFn)

      expect(mapped).toBeInstanceOf(ResultAsync)

      const newVal = await mapped

      expect(newVal.isOk()).toBe(true)
      expect(newVal._unsafeUnwrap()).toBe('12')
      expect(mapSyncFn).toHaveBeenCalledTimes(1)
    })

    it('Maps a value using an asynchronous function', async () => {
      const asyncVal = okAsync(12)

      const mapAsyncFn = mock((number) => Promise.resolve(number.toString()))

      const mapped = asyncVal.map(mapAsyncFn)

      expect(mapped).toBeInstanceOf(ResultAsync)

      const newVal = await mapped

      expect(newVal.isOk()).toBe(true)
      expect(newVal._unsafeUnwrap()).toBe('12')
      expect(mapAsyncFn).toHaveBeenCalledTimes(1)
    })

    it('Skips an error', async () => {
      const asyncErr = errAsync<number, string>('Wrong format')

      const mapSyncFn = mock((number) => number.toString())

      const notMapped = asyncErr.map(mapSyncFn)

      expect(notMapped).toBeInstanceOf(ResultAsync)

      const newVal = await notMapped

      expect(newVal.isErr()).toBe(true)
      expect(newVal._unsafeUnwrapErr()).toBe('Wrong format')
      expect(mapSyncFn).toHaveBeenCalledTimes(0)
    })
  })

  describe('mapErr', () => {
    it('Maps an error using a synchronous function', async () => {
      const asyncErr = errAsync('Wrong format')

      const mapErrSyncFn = mock((str) => 'Error: ' + str)

      const mappedErr = asyncErr.mapErr(mapErrSyncFn)

      expect(mappedErr).toBeInstanceOf(ResultAsync)

      const newVal = await mappedErr

      expect(newVal.isErr()).toBe(true)
      expect(newVal._unsafeUnwrapErr()).toBe('Error: Wrong format')
      expect(mapErrSyncFn).toHaveBeenCalledTimes(1)
    })

    it('Maps an error using an asynchronous function', async () => {
      const asyncErr = errAsync('Wrong format')

      const mapErrAsyncFn = mock((str) => Promise.resolve('Error: ' + str))

      const mappedErr = asyncErr.mapErr(mapErrAsyncFn)

      expect(mappedErr).toBeInstanceOf(ResultAsync)

      const newVal = await mappedErr

      expect(newVal.isErr()).toBe(true)
      expect(newVal._unsafeUnwrapErr()).toBe('Error: Wrong format')
      expect(mapErrAsyncFn).toHaveBeenCalledTimes(1)
    })

    it('Skips a value', async () => {
      const asyncVal = okAsync(12)

      const mapErrSyncFn = mock((str) => 'Error: ' + str)

      const notMapped = asyncVal.mapErr(mapErrSyncFn)

      expect(notMapped).toBeInstanceOf(ResultAsync)

      const newVal = await notMapped

      expect(newVal.isOk()).toBe(true)
      expect(newVal._unsafeUnwrap()).toBe(12)
      expect(mapErrSyncFn).toHaveBeenCalledTimes(0)
    })
  })

  describe('andThen', () => {
    it('Maps a value using a function returning a ResultAsync', async () => {
      const asyncVal = okAsync(12)

      const andThenResultAsyncFn = mock(() => okAsync('good'))

      const mapped = asyncVal.andThen(andThenResultAsyncFn)

      expect(mapped).toBeInstanceOf(ResultAsync)

      const newVal = await mapped

      expect(newVal.isOk()).toBe(true)
      expect(newVal._unsafeUnwrap()).toBe('good')
      expect(andThenResultAsyncFn).toHaveBeenCalledTimes(1)
    })

    it('Maps a value using a function returning a Result', async () => {
      const asyncVal = okAsync(12)

      const andThenResultFn = mock(() => ok('good'))

      const mapped = asyncVal.andThen(andThenResultFn)

      expect(mapped).toBeInstanceOf(ResultAsync)

      const newVal = await mapped

      expect(newVal.isOk()).toBe(true)
      expect(newVal._unsafeUnwrap()).toBe('good')
      expect(andThenResultFn).toHaveBeenCalledTimes(1)
    })

    it('Skips an Error', async () => {
      const asyncVal = errAsync<string, string>('Wrong format')

      const andThenResultFn = mock(() => ok<string, string>('good'))

      const notMapped = asyncVal.andThen(andThenResultFn)

      expect(notMapped).toBeInstanceOf(ResultAsync)

      const newVal = await notMapped

      expect(newVal.isErr()).toBe(true)
      expect(newVal._unsafeUnwrapErr()).toBe('Wrong format')
      expect(andThenResultFn).toHaveBeenCalledTimes(0)
    })
  })

  describe('andCheck', () => {
    it('Returns the original value when map function returning ResultAsync succeeds', async () => {
      const asyncVal = okAsync(12)
      /*
        A couple examples of this function

        DB persistence (create or update)
        API calls (create or update)
      */
      const andCheckResultAsyncFn = mock(() => okAsync('good'))

      const thrued = asyncVal.andCheck(andCheckResultAsyncFn)

      expect(thrued).toBeInstanceOf(ResultAsync)

      const result = await thrued

      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toBe(12)
      expect(andCheckResultAsyncFn).toHaveBeenCalledTimes(1)
    })

    it('Maps to an error when map function returning ResultAsync fails', async () => {
      const asyncVal = okAsync(12)

      const andCheckResultAsyncFn = mock(() => errAsync('oh no!'))

      const thrued = asyncVal.andCheck(andCheckResultAsyncFn)

      expect(thrued).toBeInstanceOf(ResultAsync)

      const result = await thrued

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe('oh no!')
      expect(andCheckResultAsyncFn).toHaveBeenCalledTimes(1)
    })

    it('Returns the original value when map function returning Result succeeds', async () => {
      const asyncVal = okAsync(12)

      const andCheckResultFn = mock(() => ok('good'))

      const thrued = asyncVal.andCheck(andCheckResultFn)

      expect(thrued).toBeInstanceOf(ResultAsync)

      const newVal = await thrued

      expect(newVal.isOk()).toBe(true)
      expect(newVal._unsafeUnwrap()).toBe(12)
      expect(andCheckResultFn).toHaveBeenCalledTimes(1)
    })

    it('Maps to an error when map function returning Result fails', async () => {
      const asyncVal = okAsync(12)

      const andCheckResultFn = mock(() => err('oh no!'))

      const thrued = asyncVal.andCheck(andCheckResultFn)

      expect(thrued).toBeInstanceOf(ResultAsync)

      const newVal = await thrued

      expect(newVal.isErr()).toBe(true)
      expect(newVal._unsafeUnwrapErr()).toBe('oh no!')
      expect(andCheckResultFn).toHaveBeenCalledTimes(1)
    })

    it('Skips an Error', async () => {
      const asyncVal = errAsync<string, string>('Wrong format')

      const andCheckResultFn = mock(() => ok<string, string>('good'))

      const notMapped = asyncVal.andCheck(andCheckResultFn)

      expect(notMapped).toBeInstanceOf(ResultAsync)

      const newVal = await notMapped

      expect(newVal.isErr()).toBe(true)
      expect(newVal._unsafeUnwrapErr()).toBe('Wrong format')
      expect(andCheckResultFn).toHaveBeenCalledTimes(0)
    })
  })

  describe('andInspect', () => {
    it('Calls the passed function but returns an original ok', async () => {
      const okVal = okAsync(12)
      const passedFn = mock((_number) => {})

      const teed = await okVal.andInspect(passedFn)

      expect(teed.isOk()).toBe(true)
      expect(passedFn).toHaveBeenCalledTimes(1)
      expect(teed._unsafeUnwrap()).toStrictEqual(12)
    })
    it('returns an original ok even when the passed function fails', async () => {
      const okVal = okAsync(12)
      const passedFn = mock((_number) => {
        throw new Error('OMG!')
      })

      const teed = await okVal.andInspect(passedFn)

      expect(teed.isOk()).toBe(true)
      expect(passedFn).toHaveBeenCalledTimes(1)
      expect(teed._unsafeUnwrap()).toStrictEqual(12)
    })
  })

  describe('orInspect', () => {
    it('Calls the passed function but returns an original err', async () => {
      const errVal = errAsync(12)
      const passedFn = mock((_number) => {})

      const teed = await errVal.orInspect(passedFn)

      expect(teed.isErr()).toBe(true)
      expect(passedFn).toHaveBeenCalledTimes(1)
      expect(teed._unsafeUnwrapErr()).toStrictEqual(12)
    })
    it('returns an original err even when the passed function fails', async () => {
      const errVal = errAsync(12)
      const passedFn = mock((_number) => {
        throw new Error('OMG!')
      })

      const teed = await errVal.orInspect(passedFn)

      expect(teed.isErr()).toBe(true)
      expect(passedFn).toHaveBeenCalledTimes(1)
      expect(teed._unsafeUnwrapErr()).toStrictEqual(12)
    })
  })

  describe('orElse', () => {
    it('Skips orElse on an Ok value', async () => {
      const okVal = okAsync(12)
      const errorCallback = mock((_errVal) => errAsync<number, string>('It is now a string'))

      const result = await okVal.orElse(errorCallback)

      expect(result).toEqual(ok(12))

      expect(errorCallback).not.toHaveBeenCalled()
    })

    it('Invokes the orElse callback on an Err value', async () => {
      const myResult = errAsync('BOOOM!')
      const errorCallback = mock((_errVal) => errAsync(true))

      const result = await myResult.orElse(errorCallback)

      expect(result).toEqual(err(true))
      expect(errorCallback).toHaveBeenCalledTimes(1)
    })

    it('Accepts a regular Result in the callback', async () => {
      const myResult = errAsync('BOOOM!')
      const errorCallback = mock((_errVal) => err(true))

      const result = await myResult.orElse(errorCallback)

      expect(result).toEqual(err(true))
      expect(errorCallback).toHaveBeenCalledTimes(1)
    })
  })

  describe('match', () => {
    it('Matches on an Ok', async () => {
      const okMapper = mock((_val) => 'weeeeee')
      const errMapper = mock((_val) => 'wooooo')

      const matched = await okAsync(12).match(okMapper, errMapper)

      expect(matched).toBe('weeeeee')
      expect(okMapper).toHaveBeenCalledTimes(1)
      expect(errMapper).not.toHaveBeenCalled()
    })

    it('Matches on an Error', async () => {
      const okMapper = mock((_val) => 'weeeeee')
      const errMapper = mock((_val) => 'wooooo')

      const matched = await errAsync('bad').match(okMapper, errMapper)

      expect(matched).toBe('wooooo')
      expect(okMapper).not.toHaveBeenCalled()
      expect(errMapper).toHaveBeenCalledTimes(1)
    })
  })

  it('unwrapOr resolves the Ok value or the default for an Err', async () => {
    expect(await okAsync(12).unwrapOr(10)).toBe(12)
    expect(await errAsync<number, string>('failed').unwrapOr(10)).toBe(10)
  })

  describe('fromSafePromise', () => {
    it('Creates a ResultAsync from a Promise', async () => {
      const res = ResultAsync.fromSafePromise(Promise.resolve(12))

      expect(res).toBeInstanceOf(ResultAsync)

      const val = await res
      expect(val.isOk()).toBe(true)
      expect(val._unsafeUnwrap()).toEqual(12)
    })

  })

  describe('fromPromise', () => {
    it('Accepts an error handler as a second argument', async () => {
      const res = ResultAsync.fromPromise(Promise.reject('No!'), (e) => new Error('Oops: ' + e))

      expect(res).toBeInstanceOf(ResultAsync)

      const val = await res
      expect(val.isErr()).toBe(true)
      expect(val._unsafeUnwrapErr()).toEqual(Error('Oops: No!'))
    })

  })

  describe('ResultAsync.fromThrowable', () => {
    it('creates a new function that returns a ResultAsync', async () => {
      const example = ResultAsync.fromThrowable(async (a: number, b: number) => a + b)
      const res = example(4, 8)
      expect(res).toBeInstanceOf(ResultAsync)

      const val = await res
      expect(val.isOk()).toBe(true)
      expect(val._unsafeUnwrap()).toEqual(12)
    })

    it('handles synchronous errors', async () => {
      const example = ResultAsync.fromThrowable(() => {
        if (1 > 0) throw new Error('Oops: No!')

        return Promise.resolve(12)
      })

      const val = await example()
      expect(val.isErr()).toBe(true)

      expect(val._unsafeUnwrapErr()).toEqual(Error('Oops: No!'))
    })

    it('handles asynchronous errors', async () => {
      const example = ResultAsync.fromThrowable(async () => {
        if (1 > 0) throw new Error('Oops: No!')

        return 12
      })

      const val = await example()
      expect(val.isErr()).toBe(true)

      expect(val._unsafeUnwrapErr()).toEqual(Error('Oops: No!'))
    })

    it('Accepts an error handler as a second argument', async () => {
      const example = ResultAsync.fromThrowable(
        () => Promise.reject('No!'),
        (e) => new Error('Oops: ' + e),
      )

      const val = await example()
      expect(val.isErr()).toBe(true)

      const unwrapped = val._unsafeUnwrapErr()
      expect(unwrapped).toBeInstanceOf(Error)
      expect(unwrapped.message).toBe('Oops: No!')
    })

  })

})
