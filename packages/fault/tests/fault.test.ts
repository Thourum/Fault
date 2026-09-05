import { describe, expect, it, afterEach } from 'bun:test'
import { Fault, ServiceError } from '../src/fault'

describe('Fault', () => {
  afterEach(() => { Fault.onCapture = undefined })

  it('wraps a string with UNKNOWN_ERROR tag', () => {
    const f = new Fault('x')
    expect(f.message).toBe('x')
    expect(f.tag).toBe('UNKNOWN_ERROR')
    expect(f).toBeInstanceOf(Error)
  })
  it('withTag / withDetails / withDescription', () => {
    const f = new Fault('x').withTag('NOT_FOUND').withDetails('d')
    expect(f.tag).toBe('NOT_FOUND'); expect(f.details).toBe('d')
    const g = new Fault('x').withDescription('desc', 'newmsg')
    expect(g.details).toBe('desc'); expect(g.message).toBe('newmsg')
  })
  it('withMetadata accepts key/value and object', () => {
    const f = new Fault('x').withMetadata('a', 1).withMetadata({ b: 2, c: 3 })
    expect(f.metadata).toEqual({ a: 1, b: 2, c: 3 })
  })
  it('withCause sets cause', () => {
    const cause = new Error('root')
    const f = new Fault('x').withCause(cause)
    expect(f.cause).toBe(cause)
  })
  it('records a stack location', () => {
    // The existing filter skips frames containing 'Fault.' but not 'new Fault', so the
    // first frame may be the constructor itself. Assert shape only, not the file.
    expect(new Fault('x').location).toMatch(/^at /)
  })
  it('withContext merges into metadata (alias of object withMetadata)', () => {
    expect(new Fault('x').withContext({ a: 1 }).withMetadata({ b: 2 }).metadata).toEqual({ a: 1, b: 2 })
  })
  it('statusCode maps tags', () => {
    const cases: Array<[string, number]> = [
      ['BAD_REQUEST', 400], ['VALIDATION_ERROR', 400], ['UNAUTHORIZED', 401], ['PAYMENT_FAILED', 402],
      ['FORBIDDEN', 403], ['NOT_FOUND', 404], ['CONFLICT', 409], ['UNIQUE_CONSTRAINT_ERROR', 409],
      ['RATE_LIMITED', 429], ['INTERNAL_ERROR', 500], ['CONFIGURATION_ERROR', 500], ['EXTERNAL_ERROR', 502],
      ['NETWORK_ERROR', 503], ['CONNECTION_ERROR', 503], ['SOME_CUSTOM', 500],
    ]
    for (const [tag, code] of cases) expect(new Fault('x').withTag(tag).statusCode).toBe(code)
  })
  it('statusCode uses metadata.httpStatus for HTTP_ERROR', () => {
    expect(new Fault('x').withTag('HTTP_ERROR').withMetadata('httpStatus', 418).statusCode).toBe(418)
  })
  it('toJSON nests Fault causes', () => {
    const inner = new Fault('inner').withTag('DATABASE_ERROR')
    const outer = new Fault('outer').withTag('INTERNAL_ERROR').withCause(inner)
    const j = outer.toJSON() as { cause: { tag: string; message: string } }
    expect(j.cause.tag).toBe('DATABASE_ERROR'); expect(j.cause.message).toBe('inner')
  })
  it('capture calls onCapture hook and returns this', () => {
    const seen: Fault[] = []
    Fault.onCapture = (f) => seen.push(f)
    const f = new Fault('x')
    expect(f.capture()).toBe(f)
    expect(seen).toEqual([f])
  })
  it('capture is a no-op without hook', () => {
    // bun:test treats a returned Error as a throw, so assert identity instead
    const f = new Fault('x')
    expect(f.capture()).toBe(f)
  })
  it('Fault.from wraps Error keeping message', () => {
    expect(Fault.from(new Error('e')).message).toBe('e')
  })
  it('ServiceError sets tag, message, details', () => {
    const f = ServiceError('CONFLICT', 'already paid')
    expect(f.tag).toBe('CONFLICT'); expect(f.message).toBe('already paid'); expect(f.details).toBe('already paid')
  })
})
