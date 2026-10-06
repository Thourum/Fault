---
name: fault-error-handling
description: "Use when writing new TypeScript functions or services in a codebase that uses @thourum/fault — defining signatures, choosing tags, chaining Results, wrapping throwers, and capturing faults."
---

# Error handling with fault

`and*` runs on Ok. `or*` runs on Err. `E` is always `Fault`.

## Signatures

```ts
function parsePort(raw: string): Result<number, Fault>
function charge(id: string): ResultAsync<Receipt, Fault>
function fullName(user: User): string
```

Sync fallible → `Result<T, Fault>`. Async fallible → `ResultAsync<T, Fault>`. Infallible → plain `T`.

Never `Promise<Result<...>>`. Never `async function` that returns a Result. `ResultAsync` is `PromiseLike<Result<T, E>>`, so `await` yields `Result`.

```ts
const result: Result<Receipt, Fault> = await charge(id)
```

## Constructing failures

```ts
err(new Fault('email required').withTag('VALIDATION_ERROR'))
err(new Fault(e).withTag('DATABASE_ERROR').withCause(e).withMetadata('userId', id))
err(ServiceError('NOT_FOUND', 'User not found', `id=${id}`))
```

`ServiceError(tag, message, description?)` is `new Fault(message).withTag(tag).withDescription(description ?? message)`. Use it for tag + message. The third arg becomes developer `details`, not a user-facing override.

Use `new Fault(...)` when wrapping an `Error`, attaching metadata/cause, or calling two-arg `withDescription(details, userMessage)`. Builders return a new Fault without changing the original; use `mapErr` to replace a Result's error.

`FaultTag` is a fixed union of SCREAMING_SNAKE tags plus `(string & {})` — `withTag` accepts any string; known tags autocomplete. `statusCode` is derived from the tag (default 500). Custom tags are 500.

## Tags

One tag per failure mode. Narrow at the boundary by `fault.tag`, not `instanceof`.

```ts
.withTag('VALIDATION_ERROR')
.withDetails('pg refused the connection')          // developer context
.withDescription(devDetails, 'Please try again')   // details + optional user message
.withMetadata('userId', id)                        // or withMetadata({ userId: id })
.withCause(e)                                      // wrap the thrown value
```

`withDetails` sets developer context only. `withDescription(details, message?)` sets the same details field; the second arg overrides the user-facing `message`.

## Reading a chain

```ts
ok(raw).andThen(parseEmail)           // transform, may fail → Result
ok(user).map((u) => u.id)             // transform, cannot fail
ok(user).andCheck(assertActive)       // validate; keep original value
ok(user).andInspect((u) => log(u.id)) // side effect on Ok
err(f).orInspect((e) => e.capture())  // side effect on Err
err(f).orElse(() => loadFallback())   // recover
err(f).mapErr((e) => e.withTag('INTERNAL_ERROR'))
result.match((v) => v, (f) => f.tag)
result.unwrapOr(0)
```

Same names exist on `ResultAsync`. There `andThen` / `orElse` / `andCheck` accept a `Result` or a `ResultAsync`. `match` and `unwrapOr` return a `Promise`.

## Mixing sync and async

On `Result` only:

```ts
ok(id).asyncAndThen(loadUser)     // (t) => ResultAsync<U, F>
ok(user).asyncMap(async (u) => u.email)
ok(user).asyncAndCheck(ensureUnique)  // async validate; keep value
```

`ResultAsync` has no `async*` methods — its `andThen` / `map` / `andCheck` already take sync or async callbacks.

```ts
loadUser(id).andThen((u) => ok(u.email))   // Result callback is fine
loadUser(id).andThen((u) => fetchBio(u))   // ResultAsync callback too
```

## Parallel and sequential

```ts
Result.combine([parseA(), parseB()])                 // first Err wins
Result.combineWithAllErrors([parseA(), parseB()])    // Err is Fault[]
ResultAsync.combine([loadA(), loadB()])
ResultAsync.combineWithAllErrors([loadA(), loadB()])
```

`safeTry` is Rust `?`. Sync generator → `Result`. Async generator → `ResultAsync`.

```ts
const r = safeTry(function* () {
  const user = yield* findUser(id)
  const tx = yield* debit(user, cents)
  return ok(toReceipt(tx))
})
```

```ts
const r = safeTry(async function* () {
  const user = yield* loadUser(id)
  return ok(user)
})
```

## Wrapping throwers

```ts
import { fromThrowable, fromPromise, fromAsyncThrowable, retry } from '@thourum/fault'
fromThrowable(JSON.parse, (e) => Fault.from(e as Error).withTag('PARSE_ERROR'))
fromPromise(fetch(url), (e) => Fault.from(e as Error).withTag('NETWORK_ERROR'))
fromAsyncThrowable(async (id) => db.find(id), (e) => Fault.from(e as Error).withTag('DATABASE_ERROR'))
retry(() => fetchThing(), { times: 3, delayMs: 200, when: (f) => f.tag === 'NETWORK_ERROR' })
```

`RetryOptions`: `times` (total attempts, required), `delayMs?` (default 0), `when?: (error: E) => boolean` (default always). `fn` must return `ResultAsync`; throws from `fn` or `when` become `Err(Fault)` with the thrown value as cause and stop retrying.

```ts
import { safeFetch, safeFetchJSON } from '@thourum/fault/fetch' // ResultAsync<Response, Fault> / ResultAsync<T, Fault>
import { safeZodParse } from '@thourum/fault/zod'         // Result<infer, Fault>
import { safeDb } from '@thourum/fault/drizzle'           // ResultAsync<T, Fault>; query/params in metadata
import { parsePgError } from '@thourum/fault/pg'          // Fault; unknown codes retain driver message
import { safeJsonParse, safeEnv } from '@thourum/fault/std' // Result<T, Fault>
```

## Capturing

Set once at app start. Call `.capture()` only at the edge (HTTP handler, job runner, CLI main). Never in library or service code. `toJSON()` is the payload.

```ts
Fault.onCapture = (f) => Sentry.captureException(f, { extra: f.toJSON() })

await charge(id).orInspect((f) => f.capture())
```

## Anti-patterns

- Throwing inside a Result-returning function. Return `err(...)`.
- `try` / `catch` around Result code. The Result is the error channel.
- `if (r.isErr())` ladders where `andThen` / `andCheck` read better.
- `_unsafeUnwrap` / `_unsafeUnwrapErr` outside tests. They exist on `Result` only and throw.
- `catch (e: unknown)` then `instanceof` to branch. Branch on `fault.tag`.
- `async function foo(): Promise<Result<T, Fault>>`. Return `ResultAsync`.
- `.capture()` in every layer. Once, at the edge.

## Template

```ts
export function chargeUser(id: string, cents: number): ResultAsync<Receipt, Fault> {
  if (cents <= 0) return errAsync(ServiceError('VALIDATION_ERROR', 'amount must be positive'))
  return loadUser(id)
    .andThen((user) => debit(user, cents))
    .map(toReceipt)
}
```
