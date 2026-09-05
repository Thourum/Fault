import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, chmodSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { safeJsonParse, safeJsonStringify, safeReadFile, safeWriteFile, safeEnv } from '../src/std'

describe('safeJsonParse', () => {
  it('parses valid JSON', () => expect(safeJsonParse<{ a: number }>('{"a":1}')._unsafeUnwrap()).toEqual({ a: 1 }))
  it('PARSE_ERROR on invalid JSON with cause', () => {
    const f = safeJsonParse('{')._unsafeUnwrapErr()
    expect(f.tag).toBe('PARSE_ERROR'); expect(f.cause).toBeInstanceOf(SyntaxError)
  })
})

describe('safeJsonStringify', () => {
  it('stringifies', () => expect(safeJsonStringify({ a: 1 })._unsafeUnwrap()).toBe('{"a":1}'))
  it('PARSE_ERROR on cycles', () => {
    const o: Record<string, unknown> = {}; o.self = o
    expect(safeJsonStringify(o)._unsafeUnwrapErr().tag).toBe('PARSE_ERROR')
  })
  it('PARSE_ERROR on BigInt', () => expect(safeJsonStringify({ n: 1n })._unsafeUnwrapErr().tag).toBe('PARSE_ERROR'))
})

describe('fs helpers', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fault-std-'))
  afterEach(() => { try { chmodSync(join(dir, 'locked'), 0o644) } catch {} })

  it('write then read round-trips', async () => {
    const p = join(dir, 'a.txt')
    expect((await safeWriteFile(p, 'hi')).isOk()).toBe(true)
    expect((await safeReadFile(p))._unsafeUnwrap()).toBe('hi')
  })
  it('NOT_FOUND on missing file', async () => {
    const f = (await safeReadFile(join(dir, 'nope')))._unsafeUnwrapErr()
    expect(f.tag).toBe('NOT_FOUND'); expect(f.metadata.code).toBe('ENOENT'); expect(f.metadata.path).toBe(join(dir, 'nope'))
  })
  it('FORBIDDEN on unreadable file', async () => {
    const p = join(dir, 'locked'); writeFileSync(p, 'x'); chmodSync(p, 0o000)
    const r = await safeReadFile(p)
    if (process.getuid?.() === 0) return // root bypasses perms
    expect(r._unsafeUnwrapErr().tag).toBe('FORBIDDEN')
  })
  it('INTERNAL_ERROR on other errors (EISDIR)', async () => {
    expect((await safeReadFile(dir))._unsafeUnwrapErr().tag).toBe('INTERNAL_ERROR')
  })
  it('safeWriteFile NOT_FOUND when parent dir is missing', async () => {
    const f = (await safeWriteFile(join(dir, 'nope', 'x.txt'), 'hi'))._unsafeUnwrapErr()
    expect(f.tag).toBe('NOT_FOUND'); expect(f.metadata.code).toBe('ENOENT')
  })
  it('cleanup', () => rmSync(dir, { recursive: true, force: true }))
})

describe('safeEnv', () => {
  it('returns value when set', () => {
    process.env.FAULT_TEST_VAR = 'v'
    expect(safeEnv('FAULT_TEST_VAR')._unsafeUnwrap()).toBe('v')
  })
  it('CONFIGURATION_ERROR when missing', () => {
    delete process.env.FAULT_TEST_MISSING
    const f = safeEnv('FAULT_TEST_MISSING')._unsafeUnwrapErr()
    expect(f.tag).toBe('CONFIGURATION_ERROR'); expect(f.metadata.name).toBe('FAULT_TEST_MISSING')
  })
  it('CONFIGURATION_ERROR when empty', () => {
    process.env.FAULT_TEST_EMPTY = ''
    expect(safeEnv('FAULT_TEST_EMPTY').isErr()).toBe(true)
  })
})
