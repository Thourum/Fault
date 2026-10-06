import { describe, expect, it } from 'bun:test'
import { DrizzleQueryError, TransactionRollbackError } from 'drizzle-orm/errors'
import { DatabaseError as PgDatabaseError } from 'pg'
import { safeDb, DatabaseError } from '../src/drizzle'

const pgUnique = Object.assign(new PgDatabaseError('dup', 1, 'error'), { code: '23505', detail: 'Key (email)=(x) already exists.' })

describe('DatabaseError', () => {
  it('DrizzleQueryError wrapping pg error → parsed pg fault with query metadata and outer cause', () => {
    const query = new DrizzleQueryError('select * from users where email = $1', ['secret@example.com'], pgUnique)
    const f = DatabaseError(query)
    expect(f.tag).toBe('UNIQUE_CONSTRAINT_ERROR')
    expect(f.message).toBe('This email is already in use. Please choose a different value.')
    expect(f.metadata).toMatchObject({ query: query.query, params: query.params, pgCode: '23505' })
    expect(f.cause).toBe(query)
  })
  it('TransactionRollbackError wrapping pg error → parsed pg fault', () => {
    const e = new TransactionRollbackError()
    ;(e as Error & { cause?: unknown }).cause = pgUnique
    expect(DatabaseError(e).tag).toBe('UNIQUE_CONSTRAINT_ERROR')
  })
  it('TransactionRollbackError without pg cause → TRANSACTION_ROLLBACK_ERROR with its message', () => {
    const e = new TransactionRollbackError()
    const f = DatabaseError(e)
    expect(f.tag).toBe('TRANSACTION_ROLLBACK_ERROR')
    expect(f.message).toBe('Rollback')
    expect(f.statusCode).toBe(500)
    expect(f.cause).toBe(e)
  })
  it('plain Error → DATABASE_ERROR with driver message and cause', () => {
    const e = new Error('connection pool exhausted')
    const f = DatabaseError(e)
    expect(f.tag).toBe('DATABASE_ERROR')
    expect(f.message).toBe('connection pool exhausted')
    expect(f.cause).toBe(e)
  })
  it('non-Error → DATABASE_ERROR with String(cause) message', () => {
    const f = DatabaseError('weird')
    expect(f.tag).toBe('DATABASE_ERROR')
    expect(f.message).toBe('weird')
  })
  it('DrizzleQueryError → inner driver message, SQL only in metadata', () => {
    const query = new DrizzleQueryError('insert into users (email) values ($1)', ['a@b.com'], new Error('driver failed'))
    const f = DatabaseError(query)
    expect(f.tag).toBe('DATABASE_ERROR')
    expect(f.message).toBe('driver failed')
    expect(f.metadata).toMatchObject({ query: query.query, params: query.params })
    expect(f.cause).toBe(query)
  })
  it('DrizzleQueryError without inner cause → fixed message without SQL', () => {
    const f = DatabaseError(new DrizzleQueryError('insert into users values ($1)', ['secret']))
    expect(f.message).toBe('Failed query')
    expect(f.metadata).toMatchObject({ query: 'insert into users values ($1)', params: ['secret'] })
  })
  it('nested DrizzleQueryErrors use the driver message without leaking SQL', () => {
    const inner = new DrizzleQueryError('select secret', [], new Error('boom'))
    const outer = new DrizzleQueryError('insert into users values ($1)', ['secret'], inner)
    const f = DatabaseError(outer)
    expect(f.message).toBe('boom')
    expect(f.message).not.toContain('select secret')
    expect(f.message).not.toContain('insert into users')
    expect(f.metadata).toMatchObject({ query: outer.query, params: outer.params })
    expect(f.cause).toBe(outer)
  })
  it('DrizzleQueryError wrapping node system error → CONNECTION_ERROR and outer cause', () => {
    const refused = Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })
    const query = new DrizzleQueryError('q', [], refused)
    const f = DatabaseError(query)
    expect(f.tag).toBe('CONNECTION_ERROR')
    expect(f.metadata).toMatchObject({ query: 'q', params: [], pgCode: 'ECONNREFUSED' })
    expect(f.cause).toBe(query)
  })
  it('bare node system error → CONNECTION_ERROR', () => {
    expect(DatabaseError(Object.assign(new Error('x'), { code: 'ECONNREFUSED' })).tag).toBe('CONNECTION_ERROR')
  })
  it('code-less connection termination in a Drizzle query → CONNECTION_ERROR', () => {
    const query = new DrizzleQueryError('select $1', ['secret'], new Error('Connection terminated unexpectedly'))
    const f = DatabaseError(query)
    expect(f.tag).toBe('CONNECTION_ERROR')
    expect(f.metadata).toMatchObject({ query: 'select $1', params: ['secret'] })
    expect(f.cause).toBe(query)
  })
  it('connection-like SQL params do not leak into the message or change the tag', () => {
    const query = new DrizzleQueryError('select $1', ['Connection terminated secret'], new Error('driver failed'))
    const f = DatabaseError(query)
    expect(f.tag).toBe('DATABASE_ERROR')
    expect(f.message).toBe('driver failed')
    expect(f.metadata).toMatchObject({ query: query.query, params: query.params })
    expect(f.cause).toBe(query)
  })
})

describe('safeDb', () => {
  it('preserves the value of a resolved query as Ok', async () => {
    const rows = [{ id: 1 }]
    expect((await safeDb(Promise.resolve(rows)))._unsafeUnwrap()).toBe(rows)
  })
  it('maps rejection through DatabaseError', async () => {
    const r = await safeDb(Promise.reject(new DrizzleQueryError('q', [], pgUnique)))
    expect(r._unsafeUnwrapErr().tag).toBe('UNIQUE_CONSTRAINT_ERROR')
  })
})
