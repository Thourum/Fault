import type {
  Combine,
  Dedup,
  EmptyArrayToNever,
  IsLiteralArray,
  MemberListOf,
  MembersToUnion,
} from './result'

import { Err, Ok, Result } from './'
import {
  combineResultAsyncList,
  combineResultAsyncListWithAllErrors,
  type ExtractErrAsyncTypes,
  type ExtractOkAsyncTypes,
  type InferAsyncErrTypes,
  type InferAsyncOkTypes,
  type InferErrTypes,
  type InferOkTypes,
} from './_internals/utils'

export class ResultAsync<T, E> implements PromiseLike<Result<T, E>> {
  private _promise: Promise<Result<T, E>>

  constructor(res: Promise<Result<T, E>>) {
    this._promise = res
  }

  /**
   * Creates a `ResultAsync` from a `PromiseLike` that is known not to throw or reject.
   *
   * Use this when you are certain the promise will not throw or reject.
   * If the promise might reject, use {@link ResultAsync.fromPromise} instead.
   *
   * @param promise The promise to wrap
   * @returns A `ResultAsync` wrapping the promise result
   */
  static fromSafePromise<T, E = never>(promise: PromiseLike<T>): ResultAsync<T, E>
  /**
   * Creates a `ResultAsync` from a `Promise` that is known not to throw or reject.
   *
   * Use this when you are certain the promise will not throw or reject.
   * If the promise might reject, use {@link ResultAsync.fromPromise} instead.
   *
   * @param promise The promise to wrap
   * @returns A `ResultAsync` wrapping the promise result
   */
  static fromSafePromise<T, E = never>(promise: Promise<T>): ResultAsync<T, E> {
    const newPromise = promise.then((value: T) => new Ok<T, E>(value))

    return new ResultAsync(newPromise)
  }

  /**
   * Creates a `ResultAsync` from a `PromiseLike` that may reject or throw.
   *
   * The error handler function will be called if the promise rejects or throws,
   * allowing you to transform the error into a known type.
   *
   * @param promise The promise to wrap
   * @param errorFn Function to transform the error
   * @returns A `ResultAsync` that will be an `Ok` if the promise resolves, or an `Err` if it rejects/throws
   */
  static fromPromise<T, E>(promise: PromiseLike<T>, errorFn: (e: unknown) => E): ResultAsync<T, E>
  /**
   * Creates a `ResultAsync` from a `Promise` that may reject or throw.
   *
   * The error handler function will be called if the promise rejects or throws,
   * allowing you to transform the error into a known type.
   *
   * @param promise The promise to wrap
   * @param errorFn Function to transform the error
   * @returns A `ResultAsync` that will be an `Ok` if the promise resolves, or an `Err` if it rejects/throws
   */
  static fromPromise<T, E>(promise: Promise<T>, errorFn: (e: unknown) => E): ResultAsync<T, E> {
    const newPromise = promise
      .then((value: T) => new Ok<T, E>(value))
      .catch((e) => new Err<T, E>(errorFn(e)))

    return new ResultAsync(newPromise)
  }

  /**
   * Wraps an async function that may throw with try/catch, creating a new function
   * that returns a `ResultAsync` with `Ok` on success or `Err` on failure.
   *
   * This is safer than using {@link ResultAsync.fromPromise} with a function call,
   * because it catches synchronous throws as well as promise rejections.
   *
   * @param fn Async function to wrap
   * @param errorFn Optional function to transform thrown errors into a known type
   * @returns A new function with the same arguments but returning `ResultAsync`
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromThrowable<A extends readonly any[], R, E>(
    fn: (...args: A) => Promise<R>,
    errorFn?: (err: unknown) => E,
  ): (...args: A) => ResultAsync<R, E> {
    return (...args) => {
      return new ResultAsync(
        (async () => {
          try {
            return new Ok(await fn(...args))
          } catch (error) {
            return new Err(errorFn ? errorFn(error) : (error as E))
          }
        })(),
      )
    }
  }

  /**
   * Combines an array of `ResultAsync`s into a single `ResultAsync`.
   *
   * If all results are `Ok`, returns a `ResultAsync` containing an array of all the `Ok` values.
   * If any result is an `Err`, short-circuits and returns that `Err` value.
   *
   * This works with both homogeneous and heterogeneous arrays of `ResultAsync`s.
   *
   * @param asyncResultList The array of `ResultAsync`s to combine
   * @returns A `ResultAsync` combining all results
   */
  static combine<
    T extends readonly [ResultAsync<unknown, unknown>, ...ResultAsync<unknown, unknown>[]]
  >(asyncResultList: T): CombineResultAsyncs<T>
  /**
   * Combines an array of `ResultAsync`s into a single `ResultAsync`.
   *
   * If all results are `Ok`, returns a `ResultAsync` containing an array of all the `Ok` values.
   * If any result is an `Err`, short-circuits and returns that `Err` value.
   *
   * This works with both homogeneous and heterogeneous arrays of `ResultAsync`s.
   *
   * @param asyncResultList The array of `ResultAsync`s to combine
   * @returns A `ResultAsync` combining all results
   */
  static combine<T extends readonly ResultAsync<unknown, unknown>[]>(
    asyncResultList: T,
  ): CombineResultAsyncs<T>
  static combine<T extends readonly ResultAsync<unknown, unknown>[]>(
    asyncResultList: T,
  ): CombineResultAsyncs<T> {
    return (combineResultAsyncList(asyncResultList) as unknown) as CombineResultAsyncs<T>
  }

  /**
   * Combines an array of `ResultAsync`s into a single `ResultAsync`, collecting all errors.
   *
   * Unlike {@link ResultAsync.combine}, this does not short-circuit. Instead of returning
   * just the first error, it collects all error values into an array.
   *
   * If all results are `Ok`, returns a `ResultAsync` containing an array of all the `Ok` values
   * with an empty error array.
   * If any results are `Err`, returns a `ResultAsync` containing an `Err` with an array of all
   * the `Err` values.
   *
   * @param asyncResultList The array of `ResultAsync`s to combine
   * @returns A `ResultAsync` with either all `Ok` values or an array of all `Err` values
   */
  static combineWithAllErrors<
    T extends readonly [ResultAsync<unknown, unknown>, ...ResultAsync<unknown, unknown>[]]
  >(asyncResultList: T): CombineResultsWithAllErrorsArrayAsync<T>
  /**
   * Combines an array of `ResultAsync`s into a single `ResultAsync`, collecting all errors.
   *
   * Unlike {@link ResultAsync.combine}, this does not short-circuit. Instead of returning
   * just the first error, it collects all error values into an array.
   *
   * If all results are `Ok`, returns a `ResultAsync` containing an array of all the `Ok` values
   * with an empty error array.
   * If any results are `Err`, returns a `ResultAsync` containing an `Err` with an array of all
   * the `Err` values.
   *
   * @param asyncResultList The array of `ResultAsync`s to combine
   * @returns A `ResultAsync` with either all `Ok` values or an array of all `Err` values
   */
  static combineWithAllErrors<T extends readonly ResultAsync<unknown, unknown>[]>(
    asyncResultList: T,
  ): CombineResultsWithAllErrorsArrayAsync<T>
  static combineWithAllErrors<T extends readonly ResultAsync<unknown, unknown>[]>(
    asyncResultList: T,
  ): CombineResultsWithAllErrorsArrayAsync<T> {
    return combineResultAsyncListWithAllErrors(
      asyncResultList,
    ) as CombineResultsWithAllErrorsArrayAsync<T>
  }

  /**
   * Maps a `ResultAsync<T, E>` to `ResultAsync<U, E>` by applying a function to a contained `Ok`
   * value, leaving an `Err` value untouched.
   *
   * The mapping function can be synchronous or asynchronous (returning a `Promise<U>`).
   *
   * This function can be used to compose the results of multiple async operations.
   *
   * @param f The function to apply to the `Ok` value
   * @returns A new `ResultAsync` containing the mapped value or the original error
   */
  map<A>(f: (t: T) => A | Promise<A>): ResultAsync<A, E> {
    return new ResultAsync(
      this._promise.then(async (res: Result<T, E>) => {
        if (res.isErr()) {
          return new Err<A, E>(res.error)
        }

        return new Ok<A, E>(await f(res.value))
      }),
    )
  }

  /**
   * Passes the current value to a computation but ignores its result or errors.
   * If the computation throws, the error is ignored.
   *
   * Useful for side effects like logging or metrics that should not affect the main result.
   *
   * This method does not care about the result of the passed in computation.
   *
   * @param f The function to apply to the current value (for side effects)
   * @returns The original `ResultAsync` unchanged
   */
  andThrough<F>(f: (t: T) => Result<unknown, F> | ResultAsync<unknown, F>): ResultAsync<T, E | F> {
    return new ResultAsync(
      this._promise.then(async (res: Result<T, E>) => {
        if (res.isErr()) {
          return new Err<T, E>(res.error)
        }

        const newRes = await f(res.value)
        if (newRes.isErr()) {
          return new Err<T, F>(newRes.error)
        }
        return new Ok<T, F>(res.value)
      }),
    )
  }

  /**
   * Passes the current value to a function for side effects but still returns the same value.
   *
   * This is useful for operations like logging that should not affect the main chain.
   * If the function throws, the error is ignored.
   *
   * This method does not care about the result of the passed in computation.
   *
   * @param f The function to apply to the current value (for side effects)
   * @returns The original `ResultAsync` unchanged
   */
  andTee(f: (t: T) => unknown): ResultAsync<T, E> {
    return new ResultAsync(
      this._promise.then(async (res: Result<T, E>) => {
        if (res.isErr()) {
          return new Err<T, E>(res.error)
        }
        try {
          await f(res.value)
        } catch (e) {
          // Tee does not care about the error
        }
        return new Ok<T, E>(res.value)
      }),
    )
  }

  /**
   * Passes the current error value to a function for side effects but still returns the same error.
   *
   * This is useful for operations like error logging that should not affect the main chain.
   * If the function throws, the error is ignored.
   *
   * This method does not care about the result of the passed in computation.
   *
   * @param f The function to apply to the current error (for side effects)
   * @returns The original `ResultAsync` unchanged
   */
  orTee(f: (t: E) => unknown): ResultAsync<T, E> {
    return new ResultAsync(
      this._promise.then(async (res: Result<T, E>) => {
        if (res.isOk()) {
          return new Ok<T, E>(res.value)
        }
        try {
          await f(res.error)
        } catch (e) {
          // Tee does not care about the error
        }
        return new Err<T, E>(res.error)
      }),
    )
  }

  /**
   * Maps a `ResultAsync<T, E>` to `ResultAsync<T, F>` by applying a function to a contained `Err`
   * value, leaving an `Ok` value untouched.
   *
   * The mapping function can be synchronous or asynchronous (returning a `Promise<F>`).
   *
   * This function can be used to transform errors while passing through successful results.
   *
   * @param f The function to apply to the `Err` value
   * @returns A new `ResultAsync` containing the original value or the mapped error
   */
  mapErr<U>(f: (e: E) => U | Promise<U>): ResultAsync<T, U> {
    return new ResultAsync(
      this._promise.then(async (res: Result<T, E>) => {
        if (res.isOk()) {
          return new Ok<T, U>(res.value)
        }

        return new Err<T, U>(await f(res.error))
      }),
    )
  }

  /**
   * Chains a computation onto this `ResultAsync` that returns a `Result` or `ResultAsync`.
   *
   * If this `ResultAsync` is an `Ok`, applies the function and returns the resulting `ResultAsync`.
   * If this `ResultAsync` is an `Err`, returns that error.
   *
   * This is useful for chaining async operations where the next step might fail.
   * It flattens nested `ResultAsync` types.
   *
   * @param f The function that takes the `Ok` value and returns a `Result` or `ResultAsync`
   * @returns A new `ResultAsync`
   */
  andThen<R extends Result<unknown, unknown>>(
    f: (t: T) => R,
  ): ResultAsync<InferOkTypes<R>, InferErrTypes<R> | E>
  /**
   * Chains a computation onto this `ResultAsync` that returns an async `Result`.
   *
   * If this `ResultAsync` is an `Ok`, applies the function and returns the resulting `ResultAsync`.
   * If this `ResultAsync` is an `Err`, returns that error.
   *
   * This is useful for chaining async operations where the next step might fail.
   * It flattens nested `ResultAsync` types.
   *
   * @param f The function that takes the `Ok` value and returns a `ResultAsync`
   * @returns A new `ResultAsync`
   */
  andThen<R extends ResultAsync<unknown, unknown>>(
    f: (t: T) => R,
  ): ResultAsync<InferAsyncOkTypes<R>, InferAsyncErrTypes<R> | E>
  /**
   * Chains a computation onto this `ResultAsync` that returns a `Result` or `ResultAsync`.
   *
   * If this `ResultAsync` is an `Ok`, applies the function and returns the resulting `ResultAsync`.
   * If this `ResultAsync` is an `Err`, returns that error.
   *
   * This is useful for chaining async operations where the next step might fail.
   * It flattens nested `ResultAsync` types.
   *
   * @param f The function that takes the `Ok` value and returns a `Result` or `ResultAsync`
   * @returns A new `ResultAsync`
   */
  andThen<U, F>(f: (t: T) => Result<U, F> | ResultAsync<U, F>): ResultAsync<U, E | F>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  andThen(f: any): any {
    return new ResultAsync(
      this._promise.then((res) => {
        if (res.isErr()) {
          return new Err<never, E>(res.error)
        }

        const newValue = f(res.value)
        return newValue instanceof ResultAsync ? newValue._promise : newValue
      }),
    )
  }

  /**
   * Takes an `Err` value and maps it to a `ResultAsync`, allowing for error recovery.
   *
   * If this `ResultAsync` is an `Ok`, returns it unchanged.
   * If this `ResultAsync` is an `Err`, applies the function to recover.
   *
   * This is useful for fallback operations or error recovery.
   *
   * @param f The function that takes the `Err` value and returns a `Result` or `ResultAsync`
   * @returns A new `ResultAsync`
   */
  orElse<R extends Result<unknown, unknown>>(
    f: (e: E) => R,
  ): ResultAsync<InferOkTypes<R> | T, InferErrTypes<R>>
  /**
   * Takes an `Err` value and maps it to an async `ResultAsync`, allowing for error recovery.
   *
   * If this `ResultAsync` is an `Ok`, returns it unchanged.
   * If this `ResultAsync` is an `Err`, applies the function to recover.
   *
   * This is useful for fallback operations or error recovery.
   *
   * @param f The function that takes the `Err` value and returns a `ResultAsync`
   * @returns A new `ResultAsync`
   */
  orElse<R extends ResultAsync<unknown, unknown>>(
    f: (e: E) => R,
  ): ResultAsync<InferAsyncOkTypes<R> | T, InferAsyncErrTypes<R>>
  /**
   * Takes an `Err` value and maps it to a `ResultAsync`, allowing for error recovery.
   *
   * If this `ResultAsync` is an `Ok`, returns it unchanged.
   * If this `ResultAsync` is an `Err`, applies the function to recover.
   *
   * This is useful for fallback operations or error recovery.
   *
   * @param f The function that takes the `Err` value and returns a `Result` or `ResultAsync`
   * @returns A new `ResultAsync`
   */
  orElse<U, A>(f: (e: E) => Result<U, A> | ResultAsync<U, A>): ResultAsync<U | T, A>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  orElse(f: any): any {
    return new ResultAsync(
      this._promise.then(async (res: Result<T, E>) => {
        if (res.isErr()) {
          return f(res.error)
        }

        return new Ok<T, unknown>(res.value)
      }),
    )
  }

  /**
   * Executes one of two functions based on whether this `ResultAsync` is an `Ok` or `Err`.
   *
   * The functions don't need to return a `Result`, but both must have the same return type.
   * The result is unwrapped and returned directly.
   *
   * @param ok The function to execute if this is an `Ok`
   * @param _err The function to execute if this is an `Err`
   * @returns A promise resolving to the result of executing one of the functions
   */
  match<A, B = A>(ok: (t: T) => A, _err: (e: E) => B): Promise<A | B> {
    return this._promise.then((res) => res.match(ok, _err))
  }

  /**
   * Unwraps the `Ok` value or returns the default if this is an `Err`.
   *
   * @param t The default value to return if this is an `Err`
   * @returns A promise resolving to either the `Ok` value or the default
   */
  unwrapOr<A>(t: A): Promise<T | A> {
    return this._promise.then((res) => res.unwrapOr(t))
  }

  /**
   * @deprecated will be removed in 9.0.0.
   *
   * You can use `safeTry` without this method.
   * @example
   * ```typescript
   * safeTry(async function* () {
   *   const okValue = yield* yourResult
   * })
   * ```
   * Emulates Rust's `?` operator in `safeTry`'s body. See also `safeTry`.
   */
  async *safeUnwrap(): AsyncGenerator<Err<never, E>, T> {
    return yield* await this._promise.then((res) => res.safeUnwrap())
  }

  // Makes ResultAsync implement PromiseLike<Result>
  then<A, B>(
    successCallback?: (res: Result<T, E>) => A | PromiseLike<A>,
    failureCallback?: (reason: unknown) => B | PromiseLike<B>,
  ): PromiseLike<A | B> {
    return this._promise.then(successCallback, failureCallback)
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<Err<never, E>, T> {
    const result = await this._promise

    if (result.isErr()) {
      // @ts-expect-error -- This is structurally equivalent and safe
      yield errAsync(result.error)
    }

    // @ts-expect-error -- This is structurally equivalent and safe
    return result.value
  }
}

/**
 * Creates a `ResultAsync` wrapping an `Ok` value.
 *
 * This is a convenience function for creating a successful `ResultAsync`.
 *
 * @param value The value to wrap
 * @returns A `ResultAsync` containing the `Ok` value
 */
export function okAsync<T, E = never>(value: T): ResultAsync<T, E>
/**
 * Creates a `ResultAsync` wrapping an `Ok` void value.
 *
 * This is a convenience function for creating a successful `ResultAsync` that returns void.
 *
 * @param value undefined
 * @returns A `ResultAsync` containing the `Ok` void value
 */
export function okAsync<T extends void = void, E = never>(value: void): ResultAsync<void, E>
export function okAsync<T, E = never>(value: T): ResultAsync<T, E> {
  return new ResultAsync(Promise.resolve(new Ok<T, E>(value)))
}

/**
 * Creates a `ResultAsync` wrapping an `Err` value.
 *
 * This is a convenience function for creating a failed `ResultAsync`.
 *
 * @param err The error value to wrap
 * @returns A `ResultAsync` containing the `Err` value
 */
export function errAsync<T = never, E = unknown>(err: E): ResultAsync<T, E>
/**
 * Creates a `ResultAsync` wrapping an `Err` void value.
 *
 * This is a convenience function for creating a failed `ResultAsync` with void error.
 *
 * @param err undefined
 * @returns A `ResultAsync` containing the `Err` void value
 */
export function errAsync<T = never, E extends void = void>(err: void): ResultAsync<T, void>
export function errAsync<T = never, E = unknown>(err: E): ResultAsync<T, E> {
  return new ResultAsync(Promise.resolve(new Err<T, E>(err)))
}

/**
 * Alias for {@link ResultAsync.fromPromise}
 */
export const fromPromise = ResultAsync.fromPromise
/**
 * Alias for {@link ResultAsync.fromSafePromise}
 */
export const fromSafePromise = ResultAsync.fromSafePromise

/**
 * Alias for {@link ResultAsync.fromThrowable}
 */
export const fromAsyncThrowable = ResultAsync.fromThrowable

// Combines the array of async results into one result.
export type CombineResultAsyncs<
  T extends readonly ResultAsync<unknown, unknown>[]
> = IsLiteralArray<T> extends 1
  ? TraverseAsync<UnwrapAsync<T>>
  : ResultAsync<ExtractOkAsyncTypes<T>, ExtractErrAsyncTypes<T>[number]>

// Combines the array of async results into one result with all errors.
export type CombineResultsWithAllErrorsArrayAsync<
  T extends readonly ResultAsync<unknown, unknown>[]
> = IsLiteralArray<T> extends 1
  ? TraverseWithAllErrorsAsync<UnwrapAsync<T>>
  : ResultAsync<ExtractOkAsyncTypes<T>, ExtractErrAsyncTypes<T>[number][]>

// Unwraps the inner `Result` from a `ResultAsync` for all elements.
type UnwrapAsync<T> = IsLiteralArray<T> extends 1
  ? Writable<T> extends [infer H, ...infer Rest]
    ? H extends PromiseLike<infer HI>
      ? HI extends Result<unknown, unknown>
        ? [Dedup<HI>, ...UnwrapAsync<Rest>]
        : never
      : never
    : []
  : // If we got something too general such as ResultAsync<X, Y>[] then we
  // simply need to map it to ResultAsync<X[], Y[]>. Yet `ResultAsync`
  // itself is a union therefore it would be enough to cast it to Ok.
  T extends Array<infer A>
  ? A extends PromiseLike<infer HI>
    ? HI extends Result<infer L, infer R>
      ? Ok<L, R>[]
      : never
    : never
  : never

// Traverse through the tuples of the async results and create one
// `ResultAsync` where the collected tuples are merged.
type TraverseAsync<T, Depth extends number = 5> = IsLiteralArray<T> extends 1
  ? Combine<T, Depth> extends [infer Oks, infer Errs]
    ? ResultAsync<EmptyArrayToNever<Oks>, MembersToUnion<Errs>>
    : never
  : // The following check is important if we somehow reach to the point of
  // checking something similar to ResultAsync<X, Y>[]. In this case we don't
  // know the length of the elements, therefore we need to traverse the X and Y
  // in a way that the result should contain X[] and Y[].
  T extends Array<infer I>
  ? // The MemberListOf<I> here is to include all possible types. Therefore
    // if we face (ResultAsync<X, Y> | ResultAsync<A, B>)[] this type should
    // handle the case.
    Combine<MemberListOf<I>, Depth> extends [infer Oks, infer Errs]
    ? // The following `extends unknown[]` checks are just to satisfy the TS.
      // we already expect them to be an array.
      Oks extends unknown[]
      ? Errs extends unknown[]
        ? ResultAsync<EmptyArrayToNever<Oks[number][]>, MembersToUnion<Errs[number][]>>
        : ResultAsync<EmptyArrayToNever<Oks[number][]>, Errs>
      : // The rest of the conditions are to satisfy the TS and support
      // the edge cases which are not really expected to happen.
      Errs extends unknown[]
      ? ResultAsync<Oks, MembersToUnion<Errs[number][]>>
      : ResultAsync<Oks, Errs>
    : never
  : never

// This type is similar to the `TraverseAsync` while the errors are also
// collected in a list. For the checks/conditions made here, see that type
// for the documentation.
type TraverseWithAllErrorsAsync<T, Depth extends number = 5> = TraverseAsync<
  T,
  Depth
> extends ResultAsync<infer Oks, infer Errs>
  ? ResultAsync<Oks, Errs[]>
  : never

// Converts a reaodnly array into a writable array
type Writable<T> = T extends ReadonlyArray<unknown> ? [...T] : T
