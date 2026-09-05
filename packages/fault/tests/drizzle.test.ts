import { describe, expect, it } from 'bun:test'
import { DrizzleError, DrizzleQueryError, TransactionRollbackError } from 'drizzle-orm/errors'
import { DatabaseError as PgDatabaseError } from 'pg'
import { safeDb, DatabaseError } from '../src/drizzle'

const pgUnique = Object.assign(new PgDatabaseError('dup', 1, 'error'), { code: '23505', detail: 'Key (email)=(x) already exists.' })

describe('DatabaseError', () => {
  it('DrizzleQueryError wrapping pg error → parsed pg fault', () => {
    const f = DatabaseError(new DrizzleQueryError('select 1', [], pgUnique))
    expect(f.tag).toBe('UNIQUE_CONSTRAINT_ERROR')
  })
  it('TransactionRollbackError wrapping pg error → parsed pg fault', () => {
    const e = new TransactionRollbackError()
    ;(e as Error & { cause?: unknown }).cause = pgUnique
    expect(DatabaseError(e).tag).toBe('UNIQUE_CONSTRAINT_ERROR')
  })
  it('TransactionRollbackError without pg cause → DATABASE_ERROR with cause', () => {
    const e = new TransactionRollbackError()
    const f = DatabaseError(e)
    expect(f.tag).toBe('DATABASE_ERROR'); expect(f.cause).toBe(e)
  })
  it('DrizzleError → DATABASE_ERROR', () => {
    expect(DatabaseError(new DrizzleError({ message: 'x' })).tag).toBe('DATABASE_ERROR')
  })
  it('plain Error → DATABASE_ERROR with cause', () => {
    const e = new Error('conn')
    const f = DatabaseError(e)
    expect(f.tag).toBe('DATABASE_ERROR'); expect(f.cause).toBe(e)
  })
  it('non-Error → DATABASE_ERROR with String(cause) message', () => {
    expect(DatabaseError('weird').message).toBe('weird')
  })
  it('DrizzleQueryError wrapping node system error → CONNECTION_ERROR', () => {
    const refused = Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })
    const f = DatabaseError(new DrizzleQueryError('q', [], refused))
    expect(f.tag).toBe('CONNECTION_ERROR'); expect(f.cause).toBe(refused)
  })
  it('bare node system error → CONNECTION_ERROR', () => {
    expect(DatabaseError(Object.assign(new Error('x'), { code: 'ECONNREFUSED' })).tag).toBe('CONNECTION_ERROR')
  })
})

describe('safeDb', () => {
  it('resolves Ok', async () => expect((await safeDb(Promise.resolve([1])))._unsafeUnwrap()).toEqual([1]))
  it('maps rejection through DatabaseError', async () => {
    const r = await safeDb(Promise.reject(new DrizzleQueryError('q', [], pgUnique)))
    expect(r._unsafeUnwrapErr().tag).toBe('UNIQUE_CONSTRAINT_ERROR')
  })
})
