import { afterEach, describe, expect, it } from 'bun:test'
import { safeFetch, safeFetchJSON } from '../src/fetch'

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

const stub = (status: number, body: string | null, headers: Record<string, string> = { 'content-type': 'application/json' }) => {
  globalThis.fetch = (async () => new Response(body, { status, statusText: 'Example status', headers })) as unknown as typeof fetch
}

describe('safeFetch', () => {
  it('returns a Response with its body untouched on 2xx', async () => {
    stub(200, '{"a":1}')
    const response = (await safeFetch('http://x'))._unsafeUnwrap()
    expect(response).toBeInstanceOf(Response)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"a":1}')
  })
  it.each([[400, 'BAD_REQUEST'], [401, 'UNAUTHORIZED'], [403, 'FORBIDDEN'], [404, 'NOT_FOUND'], [409, 'BAD_REQUEST'], [422, 'BAD_REQUEST'], [429, 'RATE_LIMITED'], [418, 'BAD_REQUEST'], [500, 'INTERNAL_ERROR'], [503, 'INTERNAL_ERROR']])(
    'status %i → %s', async (status, tag) => {
      stub(status, '{"error":"x"}')
      const f = (await safeFetch('http://x'))._unsafeUnwrapErr()
      expect(f.tag).toBe(tag)
      expect(f.metadata.httpStatus).toBe(status)
      expect(f.metadata.httpBody).toEqual({ error: 'x' })
    })
  it('keeps response headers and plain-text body in HTTP fault metadata', async () => {
    stub(401, 'oops', { 'content-type': 'text/plain', 'set-cookie': 'sid=abc', 'x-request-id': 'r1' })
    const f = (await safeFetch('http://x'))._unsafeUnwrapErr()
    expect(f.metadata.httpStatusText).toBe('Example status')
    expect(f.metadata.httpBody).toBe('oops')
    expect(f.metadata.httpHeaders).toEqual({ 'content-type': 'text/plain', 'set-cookie': 'sid=abc', 'x-request-id': 'r1' })
  })
  it.each([
    ['TimeoutError', 'TIMEOUT_ERROR', 'The request timed out.'],
    ['AbortError', 'ABORTED', 'The request was aborted.'],
  ])('maps a %s fetch rejection to %s', async (name, tag, message) => {
    const cause = new Error(name)
    cause.name = name
    globalThis.fetch = (async () => { throw cause }) as unknown as typeof fetch
    const f = (await safeFetch('http://x'))._unsafeUnwrapErr()
    expect(f.tag).toBe(tag)
    expect(f.message).toBe(message)
    expect(f.cause).toBe(cause)
  })
  it('maps other fetch rejections to NETWORK_ERROR', async () => {
    const cause = new TypeError('ECONNREFUSED')
    globalThis.fetch = (async () => { throw cause }) as unknown as typeof fetch
    const f = (await safeFetch('http://x'))._unsafeUnwrapErr()
    expect(f.tag).toBe('NETWORK_ERROR')
    expect(f.message).toBe('Unable to connect to the server. Please check your internet connection.')
    expect(f.cause).toBe(cause)
  })
  it('maps body-read rejection on HTTP errors to NETWORK_ERROR', async () => {
    const cause = new Error('body stream broke')
    globalThis.fetch = (async () => {
      const response = new Response('{}', { status: 500 })
      response.text = () => Promise.reject(cause)
      return response
    }) as unknown as typeof fetch
    const f = (await safeFetch('http://x'))._unsafeUnwrapErr()
    expect(f.tag).toBe('NETWORK_ERROR')
    expect(f.cause).toBe(cause)
  })
  it.each([
    ['TimeoutError', 'TIMEOUT_ERROR'],
    ['AbortError', 'ABORTED'],
  ])('maps a %s rejection while reading an HTTP error body to %s', async (name, tag) => {
    const cause = new Error('body stream broke')
    cause.name = name
    globalThis.fetch = (async () => {
      const response = new Response('{}', { status: 500 })
      response.text = () => Promise.reject(cause)
      return response
    }) as unknown as typeof fetch
    const f = (await safeFetch('http://x'))._unsafeUnwrapErr()
    expect(f.tag).toBe(tag)
    expect(f.cause).toBe(cause)
  })
  it('maps synchronous body-read throws on HTTP errors to NETWORK_ERROR', async () => {
    const cause = new Error('body method threw')
    globalThis.fetch = (async () => {
      const response = new Response('{}', { status: 500 })
      response.text = () => { throw cause }
      return response
    }) as unknown as typeof fetch
    const f = (await safeFetch('http://x'))._unsafeUnwrapErr()
    expect(f.tag).toBe('NETWORK_ERROR')
    expect(f.cause).toBe(cause)
  })
})

describe('safeFetchJSON', () => {
  it('parses JSON regardless of content-type', async () => {
    stub(200, '{"a":1}', { 'content-type': 'text/plain' })
    expect((await safeFetchJSON<{ a: number }>('http://x'))._unsafeUnwrap()).toEqual({ a: 1 })
  })
  it('returns PARSE_ERROR with SyntaxError cause and status for malformed JSON', async () => {
    stub(200, '{not json')
    const f = (await safeFetchJSON('http://x'))._unsafeUnwrapErr()
    expect(f.tag).toBe('PARSE_ERROR')
    expect(f.cause).toBeInstanceOf(SyntaxError)
    expect(f.metadata.httpStatus).toBe(200)
  })
  it.each([200, 204])('returns PARSE_ERROR for empty body (status %i)', async (status) => {
    stub(status, status === 204 ? null : '')
    const f = (await safeFetchJSON('http://x'))._unsafeUnwrapErr()
    expect(f.tag).toBe('PARSE_ERROR')
    expect(f.metadata.httpStatus).toBe(status)
  })
  it('passes through HTTP faults without parsing an error body as a success', async () => {
    stub(404, '{"error":"missing"}')
    const f = (await safeFetchJSON('http://x'))._unsafeUnwrapErr()
    expect(f.tag).toBe('NOT_FOUND')
    expect(f.metadata.httpBody).toEqual({ error: 'missing' })
  })
  it.each([
    ['TimeoutError', 'TIMEOUT_ERROR', 'The request timed out.'],
    ['AbortError', 'ABORTED', 'The request was aborted.'],
    ['Error', 'NETWORK_ERROR', 'Unable to connect to the server. Please check your internet connection.'],
  ])('maps a %s body-read rejection to %s', async (name, tag, message) => {
    const cause = new Error('body stream broke')
    cause.name = name
    globalThis.fetch = (async () => {
      const response = new Response('{}', { status: 200 })
      response.text = () => Promise.reject(cause)
      return response
    }) as unknown as typeof fetch
    const f = (await safeFetchJSON('http://x'))._unsafeUnwrapErr()
    expect(f.tag).toBe(tag)
    expect(f.message).toBe(message)
    expect(f.cause).toBe(cause)
  })
  it('maps synchronous body-read throws on success to NETWORK_ERROR', async () => {
    const cause = new Error('body method threw')
    globalThis.fetch = (async () => {
      const response = new Response('{}', { status: 200 })
      response.text = () => { throw cause }
      return response
    }) as unknown as typeof fetch
    const f = (await safeFetchJSON('http://x'))._unsafeUnwrapErr()
    expect(f.tag).toBe('NETWORK_ERROR')
    expect(f.cause).toBe(cause)
  })
})
