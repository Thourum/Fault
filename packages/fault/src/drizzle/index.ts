import { DrizzleError, DrizzleQueryError, TransactionRollbackError } from 'drizzle-orm/errors'
import type { DatabaseError as PgDatabaseError } from 'pg'
import { ResultAsync } from '../result-async'
import { Fault } from '../fault'
import { isPostgresError, parsePgError } from '../pg/index'

// Duck-typed (Error with string `code`): node system errors like ECONNREFUSED are not pg.DatabaseError.
const pgCauseOf = (e: unknown): PgDatabaseError | undefined => {
    const inner = e instanceof Error ? e.cause : undefined
    if (isPostgresError(inner)) return inner
    if (isPostgresError(e)) return e
    return undefined
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
