import { DrizzleQueryError, TransactionRollbackError } from 'drizzle-orm/errors'
import { ResultAsync } from '../result-async'
import { Fault } from '../fault'
import { isPostgresError, parsePgError } from '../pg/index'

// Duck-typed codes include node errors; pg also emits code-less connection terminations.
const isPgOrConnectionError = (error: unknown): error is Error =>
    isPostgresError(error) || (error instanceof Error && /Connection terminated/i.test(error.message))

const driverCauseOf = (error: unknown): unknown => {
    let inner = error instanceof Error ? error.cause : undefined
    while (inner instanceof DrizzleQueryError) inner = inner.cause
    return inner
}

const pgCauseOf = (error: unknown): Error | undefined => {
    const inner = driverCauseOf(error)
    if (isPgOrConnectionError(inner)) return inner
    if (!(error instanceof DrizzleQueryError) && isPgOrConnectionError(error)) return error
    return undefined
}

/** Map a Drizzle/pg rejection into Fault; query SQL/params stay in metadata, with the outer rejection as cause. */
export function DatabaseError(cause: unknown): Fault {
    const pg = pgCauseOf(cause)
    if (pg) {
        const fault = parsePgError(pg).withCause(cause)
        if (cause instanceof DrizzleQueryError) return fault.withMetadata({ query: cause.query, params: cause.params })
        return fault
    }

    if (cause instanceof TransactionRollbackError) {
        return new Fault(cause).withTag('TRANSACTION_ROLLBACK_ERROR').withCause(cause)
    }

    if (cause instanceof DrizzleQueryError) {
        // Drizzle's own message embeds query and params; only use the driver's message.
        const driver = driverCauseOf(cause)
        const message = driver instanceof Error ? driver.message : 'Failed query'
        return new Fault(message)
            .withTag('DATABASE_ERROR')
            .withMetadata({ query: cause.query, params: cause.params })
            .withCause(cause)
    }

    if (cause instanceof Error) return new Fault(cause).withTag('DATABASE_ERROR').withCause(cause)
    return new Fault(String(cause)).withTag('DATABASE_ERROR').withCause(cause)
}

/** Wrap a drizzle query promise into ResultAsync<T, Fault>. */
export function safeDb<T>(dbPromise: Promise<T>): ResultAsync<T, Fault> {
    return ResultAsync.fromPromise(dbPromise, DatabaseError)
}
