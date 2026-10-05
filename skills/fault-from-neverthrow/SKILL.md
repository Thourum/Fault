---
name: fault-from-neverthrow
description: Use when migrating a codebase from neverthrow to @thourum/fault, renaming tee/through methods, or replacing custom error unions with Fault.
---

# Migrate neverthrow to fault

```ts
// before
import { ok, err, Result, ResultAsync } from 'neverthrow'
// after
import { ok, err, Result, ResultAsync, Fault, ServiceError, retry } from '@thourum/fault'
```

## Identical APIs

These names and roles match neverthrow. Import them from `@thourum/fault`.

`ok`, `err`, `okAsync`, `errAsync`, `Result`, `ResultAsync`, `Ok`, `Err`, `fromThrowable`, `fromPromise`, `fromSafePromise`, `fromAsyncThrowable`, `safeTry`, `Result.combine`, `Result.combineWithAllErrors`, `ResultAsync.combine`, `ResultAsync.combineWithAllErrors`, `map`, `mapErr`, `andThen`, `orElse`, `match`, `unwrapOr`, `isOk`, `isErr`, `asyncAndThen`, `asyncMap`

`isOk` / `isErr` / `asyncAndThen` / `asyncMap` live on `Result` only. `ResultAsync` has no `isOk` / `isErr` — `await` it first.

## Rename table

neverthrow names are gone. fault renamed the tee/through family:

| neverthrow | fault | keeps `T`? | inner `Err` propagates? | throws from `f` |
|---|---|---|---|---|
| `andTee` | `andInspect` | yes | n/a (not a Result) | swallowed |
| `orTee` | `orInspect` | yes | n/a | swallowed |
| `andThrough` | `andCheck` | yes (discards inner Ok) | yes | not swallowed |
| `asyncAndThrough` | `asyncAndCheck` | yes | yes | not swallowed |

```ts
ok(user)
  .andInspect((u) => log(u.id))             // side effect on Ok; value unchanged
  .orInspect((e) => e.capture())            // side effect on Err; error unchanged
  .andCheck((u) => validate(u))             // Ok(user) if validate Ok; else validate's Err
  .asyncAndCheck((u) => checkQuota(u))      // Result only; ResultAsync uses andCheck
```

`andCheck` / `asyncAndCheck`: on Ok, run `f`. Inner Ok is discarded and the original `T` is kept. Inner Err replaces the result.

`asyncAndCheck` exists on `Result` only. On `ResultAsync`, `andCheck` already accepts `Result | ResultAsync`.

`_unsafeUnwrap` / `_unsafeUnwrapErr` still exist on `Result` (`Ok` / `Err`). They are absent on `ResultAsync` — `await` then unwrap, or use `match` / `expect(r).toEqual(ok(x))` in tests.

## Error type: `E = Fault`

neverthrow leaves `E` free. fault's convention is `Result<T, Fault>`.

```ts
// before
type AppError =
  | { kind: 'NotFound'; id: string }
  | { kind: 'Conflict'; reason: string }

function findUser(id: string): Result<User, AppError> {
  return user ? ok(user) : err({ kind: 'NotFound', id })
}

if (result.isErr()) {
  switch (result.error.kind) {
    case 'NotFound': return notFound()
    case 'Conflict': return conflict()
  }
}

// after
function findUser(id: string): Result<User, Fault> {
  return user
    ? ok(user)
    : err(ServiceError('NOT_FOUND', `user ${id} not found`).withMetadata('id', id))
}

if (result.isErr()) {
  if (result.error.tag === 'NOT_FOUND') return notFound()
  if (result.error.tag === 'CONFLICT') return conflict()
}
```

`ServiceError(tag, message, description?)` is `new Fault(message).withTag(tag).withDescription(description ?? message)`.

`FaultTag` is a predefined union plus `(string & {})` for custom tags. Narrow with `fault.tag`, not `e.kind`.

## Wrap foreign errors

```ts
// before
.mapErr((e) => new MyError(e))

// after — Fault.from takes Error | string
.mapErr((e) => Fault.from(e).withTag('PARSE_ERROR').withCause(e))
```

## Observability

```ts
Fault.onCapture = (f) => Sentry.captureException(f, { extra: f.toJSON() })

return loadUser(id).orInspect((f) => f.capture())
```

`capture()` calls `Fault.onCapture` if set and returns the same fault. See docs: Fault (`capture` / `toJSON`) and Error tracing.

## retry (fault-only)

neverthrow has no equivalent.

```ts
retry(() => fetchThing(), {
  times: 3,
  delayMs: 200,
  when: (f) => f.tag === 'CONNECTION_ERROR',
})
```

`retry<T, E>(fn: () => ResultAsync<T, E>, opts: RetryOptions<E>): ResultAsync<T, E | Fault>`

`times` is total attempts. A synchronous throw from `fn`, rejected `ResultAsync`, or throw from `when` resolves to `Err(Fault)` tagged `UNKNOWN_ERROR`, with the thrown value as cause, and stops retrying. To retry expected thrown failures, map them into tagged `Err` values with `fromAsyncThrowable` first. See docs: retry.

## Gotchas

- `await resultAsync` yields `Result<T, E>`, not `T`. `ResultAsync` is `PromiseLike<Result<T, E>>`.
- `ResultAsync` has no `isOk` / `isErr` / `asyncAndThen` / `asyncMap` / `asyncAndCheck` / `_unsafeUnwrap`. Await, then use Result methods; use `andThen` / `map` / `andCheck` on the async side.
- `err('x')` uses the string-literal overload (`Err<never, 'x'>`). Prefer `err(ServiceError('TAG', 'x'))` so `E` stays `Fault`.
- `andInspect` / `orInspect` swallow throws from `f`. `andCheck` does not.

## Checklist

- Rewrite `from 'neverthrow'` → `from '@thourum/fault'`.
- Rename `andTee` / `orTee` / `andThrough` / `asyncAndThrough`.
- Change signatures to `Result<T, Fault>` / `ResultAsync<T, Fault>`.
- Replace `{ kind }` unions with `ServiceError` / `withTag`; branch on `fault.tag`.
- Route `mapErr` wrappers through `Fault.from(...).withTag(...).withCause(...)`.
- Set `Fault.onCapture` once; call `.capture()` at the request/job edge.
- Await `ResultAsync` before `isOk` / `isErr` / `_unsafeUnwrap`.
- Add `retry` on transient tags (`CONNECTION_ERROR`, `NETWORK_ERROR`) where you used to hand-roll loops.
