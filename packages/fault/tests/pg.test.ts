import { describe, expect, it } from 'bun:test'
import { DatabaseError } from 'pg'
import { parsePgError } from '../src/pg'

const pgErr = (code: string, extra: Partial<DatabaseError> = {}) =>
  Object.assign(new DatabaseError('pg failed', 1, 'error'), { code, ...extra })

describe('parsePgError', () => {
  it('23505 → UNIQUE_CONSTRAINT_ERROR with field from detail', () => {
    const f = parsePgError(pgErr('23505', { detail: 'Key (email)=(a@b.c) already exists.', constraint: 'users_email_key', table: 'users' }))
    expect(f.tag).toBe('UNIQUE_CONSTRAINT_ERROR')
    expect(f.metadata.field).toBe('email')
    expect(f.metadata.pgCode).toBe('23505')
    expect(f.statusCode).toBe(409)
  })
  it('23503 → FOREIGN_KEY_ERROR', () => expect(parsePgError(pgErr('23503', { detail: 'Key (user_id)=(1) is not present in table "users".' })).tag).toBe('FOREIGN_KEY_ERROR'))
  it('23502 → VALIDATION_ERROR with column', () => {
    const f = parsePgError(pgErr('23502', { column: 'name' }))
    expect(f.tag).toBe('VALIDATION_ERROR'); expect(f.metadata.field).toBe('name')
  })
  it('23514 → VALIDATION_ERROR', () => expect(parsePgError(pgErr('23514')).tag).toBe('VALIDATION_ERROR'))
  it.each(['42P01', '42703', '57014'])('%s → DATABASE_ERROR', (c) => expect(parsePgError(pgErr(c)).tag).toBe('DATABASE_ERROR'))
  it.each(['08000', '08001', '08003', '08004', '08006', '08007', '08P01', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'EAI_AGAIN'])('%s → CONNECTION_ERROR', (c) =>
    expect(parsePgError(pgErr(c)).tag).toBe('CONNECTION_ERROR'))
  it.each(['40001', '40P01'])('%s → TRANSACTION_ROLLBACK_ERROR', (c) => expect(parsePgError(pgErr(c)).tag).toBe('TRANSACTION_ROLLBACK_ERROR'))
  it('unknown code → DATABASE_ERROR with real driver message', () => {
    const error = pgErr('99999')
    const fault = parsePgError(error)
    expect(fault.tag).toBe('DATABASE_ERROR')
    expect(fault.message).toBe('pg failed')
    expect(fault.cause).toBe(error)
  })
  it.each(['Connection terminated unexpectedly', 'Connection terminated due connection timeout'])('code-less %s → CONNECTION_ERROR', (message) => {
    const error = new Error(message)
    const fault = parsePgError(error)
    expect(fault.tag).toBe('CONNECTION_ERROR')
    expect(fault.cause).toBe(error)
  })
  it('only code-less termination messages become connection faults', () => {
    const error = Object.assign(new Error('Connection terminated'), { code: '99999' })
    const fault = parsePgError(error)
    expect(fault.tag).toBe('DATABASE_ERROR')
    expect(fault.message).toBe('Connection terminated')
  })
  it('non-pg error → DATABASE_ERROR with real driver message', () => {
    const error = new Error('driver failed')
    const fault = parsePgError(error)
    expect(fault.tag).toBe('DATABASE_ERROR')
    expect(fault.message).toBe('driver failed')
    expect(fault.cause).toBe(error)
  })
})
