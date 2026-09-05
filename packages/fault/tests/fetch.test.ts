import { afterEach, describe, expect, it } from 'bun:test'
import { safeFetch } from '../src/fetch'

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

const stub = (status: number, body: string, headers: Record<string, string> = { 'content-type': 'application/json' }) => {
  globalThis.fetch = (async () => new Response(body, { status, headers })) as unknown as typeof fetch
}

describe('safeFetch', () => {
  it('returns parsed JSON on 2xx', async () => {
    stub(200, '{"a":1}')
    expect((await safeFetch<{ a: number }>('http://x'))._unsafeUnwrap()).toEqual({ a: 1 })
  })
  it.each([[400, 'BAD_REQUEST'], [401, 'UNAUTHORIZED'], [403, 'FORBIDDEN'], [404, 'NOT_FOUND'], [429, 'RATE_LIMITED'], [418, 'BAD_REQUEST'], [500, 'INTERNAL_ERROR'], [503, 'INTERNAL_ERROR']])(
    'status %i → %s', async (status, tag) => {
      stub(status, '{"error":"x"}')
      const f = (await safeFetch('http://x'))._unsafeUnwrapErr()
      expect(f.tag).toBe(tag)
      expect(f.metadata.httpStatus).toBe(status)
      expect(f.metadata.httpBody).toEqual({ error: 'x' })
    })
  it('NETWORK_ERROR when fetch throws', async () => {
    globalThis.fetch = (async () => { throw new TypeError('ECONNREFUSED') }) as unknown as typeof fetch
    const f = (await safeFetch('http://x'))._unsafeUnwrapErr()
    expect(f.tag).toBe('NETWORK_ERROR')
    expect(f.cause).toBeInstanceOf(TypeError)
  })
  it('PARSE_ERROR when 2xx JSON body is malformed', async () => {
    stub(200, '{not json')
    const f = (await safeFetch('http://x'))._unsafeUnwrapErr()
    expect(f.tag).toBe('PARSE_ERROR')
    expect(f.cause).toBeInstanceOf(SyntaxError)
  })
  it.each([
    ['204', 204, '', { 'content-type': 'application/json' }],
    ['empty body', 200, '', { 'content-type': 'application/json' }],
    ['non-JSON content-type', 200, 'ok', { 'content-type': 'text/plain' }],
  ])('Ok(undefined) on 2xx with %s', async (_, status, body, headers) => {
    stub(status, body, headers)
    expect((await safeFetch('http://x'))._unsafeUnwrap()).toBeUndefined()
  })
  it('error body that is not JSON is kept as text', async () => {
    stub(500, 'oops', { 'content-type': 'text/plain' })
    expect((await safeFetch('http://x'))._unsafeUnwrapErr().metadata.httpBody).toBe('oops')
  })
  it('parses JSON when content-type casing differs', async () => {
    stub(200, '{"a":1}', { 'content-type': 'Application/JSON; charset=utf-8' })
    expect((await safeFetch<{ a: number }>('http://x'))._unsafeUnwrap()).toEqual({ a: 1 })
  })
  it.each([200, 500])('NETWORK_ERROR when body read rejects (status %i)', async (status) => {
    const boom = new Error('body stream broke')
    globalThis.fetch = (async () => {
      const res = new Response('{}', { status, headers: { 'content-type': 'application/json' } })
      res.text = () => Promise.reject(boom)
      return res
    }) as unknown as typeof fetch
    const f = (await safeFetch('http://x'))._unsafeUnwrapErr()
    expect(f.tag).toBe('NETWORK_ERROR'); expect(f.cause).toBe(boom)
  })
})
