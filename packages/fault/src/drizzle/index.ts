import { DrizzleError, DrizzleQueryError, TransactionRollbackError } from 'drizzle-orm/errors'
import { DatabaseError as PgDatabaseError } from 'pg'
import { ResultAsync } from '../result-async'
import { Fault } from '../fault'
import { parsePgError } from '../pg/index'

const pgCauseOf = (e: unknown): PgDatabaseError | undefined => {
    const cause = (e as { cause?: unknown } | undefined)?.cause
    return cause instanceof PgDatabaseError ? cause : undefined
}

/** Map any drizzle/pg/unknown rejection into a Fault. */
export function DatabaseError(cause: unknown): Fault {
    const pg = pgCauseOf(cause)
    if (pg) return parsePgError(pg)

    const label =
        cause instanceof TransactionRollbackError ? 'Transaction rollback error'
        : cause instanceof DrizzleQueryError ? 'Drizzle query error'
        : cause instanceof DrizzleError ? 'Drizzle error'
        : cause instanceof Error ? 'Database error'
        : 'Unknown database error'

    const message = cause instanceof Error ? cause.message : String(cause)
    return new Fault(message).withTag('DATABASE_ERROR').withDescription(label, message).withCause(cause)
}

/** Wrap a drizzle query promise into ResultAsync<T, Fault>. */
export function safeDb<T>(dbPromise: Promise<T>): ResultAsync<T, Fault> {
    return ResultAsync.fromPromise(dbPromise, DatabaseError)
}
