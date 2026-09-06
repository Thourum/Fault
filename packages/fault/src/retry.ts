import { ResultAsync } from './result-async'
import type { Result } from './result'

export interface RetryOptions<E> {
    /** Total attempts, including the first. */
    times: number
    /** Fixed delay between attempts in ms. Default 0. */
    delayMs?: number
    /** Retry only when this returns true for the error. Default: always. */
    when?: (error: E) => boolean
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Re-run `fn` while it returns Err (and `when(err)` holds), up to `times` attempts.
 * `fn` must return a ResultAsync and must not throw synchronously; wrap with `ResultAsync.fromThrowable` if it can.
 */
export function retry<T, E>(fn: () => ResultAsync<T, E>, opts: RetryOptions<E>): ResultAsync<T, E> {
    const { times, delayMs = 0, when = () => true } = opts
    const run = async (): Promise<Result<T, E>> => {
        let last: Result<T, E> = await fn()
        for (let attempt = 1; attempt < times && last.isErr() && when(last.error); attempt++) {
            if (delayMs > 0) await sleep(delayMs)
            last = await fn()
        }
        return last
    }
    return new ResultAsync(run())
}
