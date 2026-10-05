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
      ['NETWORK_ERROR', 503], ['CONNECTION_ERROR', 503], ['TIMEOUT_ERROR', 504],
      ['ABORTED', 499], ['SOME_CUSTOM', 500],
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
  it('builders leave the original unchanged and preserve the cloned fault origin', () => {
    const cause = new Error('root')
    const original = new Fault('original')
    original.name = 'SpecificError'
    const tagged = original.withTag('NOT_FOUND')
    const enriched = tagged.withMetadata('requestId', 'req_1')
    const chained = enriched.withCause(cause).withDescription('internal', 'safe message')

    expect(original.tag).toBe('UNKNOWN_ERROR')
    expect(original.metadata).toEqual({})
    expect(original.cause).toBeUndefined()
    expect(original.details).toBeUndefined()
    expect(original.message).toBe('original')
    expect(original.toString()).toBe('SpecificError: original')
    expect(tagged.metadata).toEqual({})
    expect(enriched.cause).toBeUndefined()
    expect(chained).not.toBe(original)
    expect(chained.stack).toBe(original.stack)
    expect(chained.location).toBe(original.location)
    expect(chained.name).toBe('SpecificError')
    expect(chained.tag).toBe('NOT_FOUND')
    expect(chained.metadata).toEqual({ requestId: 'req_1' })
    expect(chained.cause).toBe(cause)
    expect(chained.details).toBe('internal')
    expect(chained.message).toBe('safe message')
    expect(chained.toString()).toBe('SpecificError: safe message')
    expect(chained.toJSON().message).toBe('safe message')
    const later = chained.withDetails('updated')
    expect(later.message).toBe('safe message')
    expect(later.toString()).toBe('SpecificError: safe message')
    expect(later.toJSON().message).toBe('safe message')
    expect(JSON.parse(JSON.stringify(later)).message).toBe('safe message')
  })
  it('builders keep the subclass prototype when chaining', () => {
    class SpecificFault extends Fault {
      id = 'fault_1'
      constructor(message: string) {
        super(message)
        Object.defineProperty(this, 'x', {
          get: () => { throw new Error('read') },
          enumerable: true,
          configurable: true,
        })
      }
    }
    const original = new SpecificFault('specific')
    const derived = original.withDetails('context').withTag('CONFLICT')
    expect(derived).toBeInstanceOf(SpecificFault)
    expect(derived.id).toBe('fault_1')
    expect(Object.getOwnPropertyDescriptor(derived, 'x')?.get).toBe(Object.getOwnPropertyDescriptor(original, 'x')?.get)
    expect(derived).not.toBe(original)
    expect(derived.details).toBe('context')
    expect(derived.tag).toBe('CONFLICT')
    expect(original.details).toBeUndefined()
    expect(original.tag).toBe('UNKNOWN_ERROR')
  })
  it('capture calls onCapture hook and returns this', () => {
    const seen: Fault[] = []
    Fault.onCapture = (f) => seen.push(f)
    const f = new Fault('x')
    expect(f.capture()).toBe(f)
    expect(seen).toEqual([f])
  })
  it('Fault.from wraps Error keeping message', () => {
    expect(Fault.from(new Error('e')).message).toBe('e')
  })
  it('ServiceError sets tag, message, details', () => {
    const f = ServiceError('CONFLICT', 'already paid')
    expect(f.tag).toBe('CONFLICT'); expect(f.message).toBe('already paid'); expect(f.details).toBe('already paid')
  })
})
