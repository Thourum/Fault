import { Fault } from './fault'
import { ResultAsync } from './result-async'
import { err, type Result } from './result'

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
 * Throws from `fn` or `when`, and rejected ResultAsync values, become Err Faults
 * with the thrown value as cause and stop retrying immediately.
 */
export function retry<T, E>(fn: () => ResultAsync<T, E>, opts: RetryOptions<E>): ResultAsync<T, E | Fault> {
    const run = async (): Promise<Result<T, E | Fault>> => {
        try {
            const { times, delayMs = 0, when = () => true } = opts
            let last: Result<T, E> = await fn()
            for (let attempt = 1; attempt < times && last.isErr() && when(last.error); attempt++) {
                if (delayMs > 0) await sleep(delayMs)
                last = await fn()
            }
            return last
        } catch (thrown) {
            let initial: Error | string
            try {
                initial = thrown instanceof Error ? thrown : String(thrown)
            } catch {
                initial = 'Unknown error'
            }
            return err(new Fault(initial).withCause(thrown))
        }
    }
    return new ResultAsync(run())
}
