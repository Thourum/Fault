# fault — Phase 1: subpath packaging, zero-dep core, tooling

Date: 2026-09-04
Status: approved in chat, pending spec review

## Positioning

`@itterno/fault` is inspired by neverthrow (and Rust's `Result`, a little
effect-ts) but differs in two ways:

1. **Errors are `Fault`s, not `unknown`.** Every helper returns
   `Result<T, Fault>`; a `Fault` carries tag, details, capture location,
   metadata and the native `cause` chain, and serialises via `toJSON()`.
2. **Built for tracing.** `Fault` is designed to be handed to Sentry, OTel or
   any similar tool with full context intact — `capture()` routes through one
   `Fault.onCapture` hook, `location` is recorded at construction, causes nest.
   The point is that a failure deep in a chain reaches your error tracker with
   *where*, *why* and *what data* — not just a message.

Integrations (`/fetch`, `/zod`, `/drizzle`, …) exist so the common failure
points of popular libraries become typed `Fault`s instead of thrown surprises.

## Goal

`@itterno/fault` is a neverthrow-style `Result`/`ResultAsync` library plus a
`Fault` error class with context (tag, details, location, metadata, cause).
Today the core hard-depends on `zod`, `drizzle-orm` and `pg`, has no build,
no `exports`, and no tests for anything beyond the forked neverthrow suite.

Phase 1 turns it into a publishable single package where:

- the root entry has **zero runtime dependencies**;
- integrations live under **subpath exports** with optional peer deps;
- there is a build, a typecheck, a test suite and an exports check.

Out of scope (later phases, each with its own short spec): Standard Schema
(`/schema`), Prisma, Stripe, better-auth, auth.js, OTel/Sentry auto-detect,
CJS output, monorepo/changesets.

## 1. Package layout

One package, `packages/fault`, no workspace. Subpath exports:

| Import                    | Exports                                                                        | Peer deps (optional)      |
|---------------------------|--------------------------------------------------------------------------------|---------------------------|
| `@itterno/fault`          | neverthrow fork with the §2b renames (`Result`, `ResultAsync`, `ok`, `err`, `okAsync`, `errAsync`, `fromThrowable`, `fromPromise`, `fromSafePromise`, `fromAsyncThrowable`, `safeTry`, combine helpers) + `Fault`, `FaultTag`, `ServiceError`, `retry` | none                      |
| `@itterno/fault/fetch`    | `safeFetch`                                                                    | none (global `fetch`)     |
| `@itterno/fault/zod`      | `safeZodParse`, `fromZodError`                                                 | `zod`                     |
| `@itterno/fault/drizzle`  | `safeDb`, `DatabaseError`                                                      | `drizzle-orm`, `pg`       |
| `@itterno/fault/pg`       | `parsePgError`                                                                 | `pg` (types only)         |
| `@itterno/fault/std`      | `safeJsonParse`, `safeJsonStringify`, `safeReadFile`, `safeWriteFile`, `safeEnv` | none (node stdlib)        |

Source layout:

```
src/
  index.ts            root entry
  result.ts, result-async.ts, fault.ts, _internals/   (unchanged locations)
  fetch/index.ts
  zod/index.ts
  drizzle/index.ts
  pg/index.ts
  std/index.ts
```

`src/utils/` is removed; each file moves into its subpath dir. Subpaths import
core via relative paths (`../result`, `../fault`), never via the package name.

`package.json`:

- `"type": "module"`, ESM only.
- `exports`: one entry per row above → `{ "types": "./dist/<name>.d.ts", "default": "./dist/<name>.js" }`. Root is `./dist/index.*`.
- `peerDependencies`: `zod`, `drizzle-orm`, `pg`; all `peerDependenciesMeta.optional: true`.
- `dependencies`: empty. Remove `pg-error`, `@types/pg` (→ devDependencies).
- `files: ["dist"]`, remove `private: true`, remove legacy `main`/`module`.

## 2. Core changes (`src/fault.ts`)

- Remove `Fault.fromZod` → becomes `fromZodError(error: ZodError): Fault` in `zod/index.ts`.
- Remove `DatabaseError` → `drizzle/index.ts` (it already only unwraps drizzle wrappers and delegates to `parsePgError` from `../pg/index.js`).
- Remove all imports of `zod`, `drizzle-orm/errors`, `pg`.
- `capture()`: drop the CJS `require('@opentelemetry/api')` / `require('@sentry/node')` probing (broken under `type: module`). Replace with a static hook:

  ```ts
  static onCapture: ((fault: Fault) => void) | undefined
  capture(): this { Fault.onCapture?.(this); return this }
  ```

  Users wire OTel/Sentry themselves. Auto-detect via `await import()` is a later phase if wanted.
- Add `withCause(cause: unknown): this` and an object overload `withMetadata(data: Record<string, unknown>): this`.
- `with*` methods **mutate and return `this`** (as today). So `.orInspect((f) => f.withMetadata({...}).capture())` enriches the same Fault the caller receives.
- `FaultTag` gains: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `RATE_LIMITED`, `PAYMENT_FAILED`, `EXTERNAL_ERROR`, `CONFIGURATION_ERROR`, plus the tags `/pg` already emits (`UNIQUE_CONSTRAINT_ERROR`, `FOREIGN_KEY_ERROR`, `CONNECTION_ERROR`, `TRANSACTION_ROLLBACK_ERROR`). `statusCode` maps them: 400 BAD_REQUEST/FOREIGN_KEY_ERROR, 401 UNAUTHORIZED, 402 PAYMENT_FAILED, 403 FORBIDDEN, 409 CONFLICT/UNIQUE_CONSTRAINT_ERROR, 429 RATE_LIMITED, 502 EXTERNAL_ERROR, 503 CONNECTION_ERROR, else 500.
- Everything else (`#tag`, `#details`, `#location`, `#metadata`, `cause`, getters, `toJSON`, `static from`, `ServiceError`) unchanged.

## 2b. Combinator renames (`Result` / `ResultAsync`)

neverthrow's `andTee` / `orTee` / `andThrough` are hard to read. Rule for
this library: **`and*` runs on the Ok path, `or*` runs on the Err path**;
the suffix says what happens to the value.

| neverthrow       | fault             | Behaviour                                                        |
|------------------|-------------------|------------------------------------------------------------------|
| `map`            | `map`             | Ok → transform value                                             |
| `mapErr`         | `mapErr`          | Err → transform error                                            |
| `andThen`        | `andThen`         | Ok → chain another Result                                        |
| `orElse`         | `orElse`          | Err → recover with another Result                                |
| `andTee`         | `andInspect`      | Ok → side effect, value passes through, thrown errors swallowed  |
| `orTee`          | `orInspect`       | Err → side effect, error passes through, thrown errors swallowed |
| `andThrough`     | `andCheck`        | Ok → run a Result; if it's Err, fail with that Err; else keep original value |
| `unwrapOr`       | `unwrapOr`        | unchanged                                                        |
| `match`          | `match`           | unchanged                                                        |
| `_unsafeUnwrap`  | `_unsafeUnwrap`   | unchanged                                                        |
| `asyncAndThen` … | `asyncAndThen` …  | unchanged                                                        |

Old names are removed, not aliased — v0.1, no external consumers yet. The
forked tests are renamed accordingly. `typecheck-tests.ts` updated.

`andInspect`/`orInspect` swallow exceptions thrown by `f` (neverthrow
behaviour, kept): a side effect must never turn an Ok into an Err or replace
the original Err. Consequence: a throwing `onCapture` hook is dropped
silently — wrap your hook in its own try/catch + fallback logger if that
matters.

Added to core (zero deps):

- `retry<T, E>(fn: () => ResultAsync<T, E>, opts: { times: number; delayMs?: number; when?: (e: E) => boolean }): ResultAsync<T, E>` —
  `times` is the **total number of attempts** (`times: 3` = at most 3 calls
  to `fn`). Re-runs while `fn` returns Err and `when(e)` is true (default:
  always); resolves with the last Err. Fixed delay; backoff is a later phase.

## 3. Tooling

| Concern    | Tool                                   | Script                                        |
|------------|----------------------------------------|-----------------------------------------------|
| Build      | `tsdown` (ESM + d.ts, 6 entries)       | `build: tsdown`                               |
| Typecheck  | `tsgo` (`@typescript/native-preview`)  | `typecheck: tsgo --noEmit && tsgo --noEmit -p tests/tsconfig.tests.json` |
| Tests      | `bun test`                             | `test: bun test`                              |
| Exports    | `@arethetypeswrong/cli`                | `check:exports: attw --pack`                  |
| CI local   |                                        | `local-ci: bun run typecheck && bun run test && bun run build && bun run check:exports` |

`tsdown.config.ts`: `entry: { index, fetch, zod, drizzle, pg, std }`, `format: ['esm']`, `dts: true`, `platform: 'node'`, `external` = peer deps. `tsconfig.json`: `strict: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler` (extensionless relative imports; tsdown emits the resolved graph).

Existing neverthrow tests (`index.test.ts`, `safe-try.test.ts`) are ported from `vitest`/`testdouble` to `bun:test` (`mock()`); `typecheck-tests.ts` stays as a `--noEmit` target. `bun.lock` regenerated from the new `package.json`.

## 4. Integration behaviour

All helpers return `Result<T, Fault>` / `ResultAsync<T, Fault>`. Tags are from the existing `FaultTag` union; `metadata` carries the raw source info.

### `/fetch` — `safeFetch<T = unknown>(input, init?)`

Fix the current tag mapping (all 4xx → `VALIDATION_ERROR` is wrong):

| Condition                  | Tag                 |
|----------------------------|---------------------|
| `fetch` throws             | `NETWORK_ERROR`     |
| 400                        | `BAD_REQUEST`       |
| 401 / 403                  | `UNAUTHORIZED` / `FORBIDDEN` |
| 404                        | `NOT_FOUND`         |
| 429                        | `RATE_LIMITED`      |
| other 4xx                  | `BAD_REQUEST`       |
| 5xx                        | `INTERNAL_ERROR`    |
| 2xx, non-empty body not JSON | `PARSE_ERROR`     |

Body handling on 2xx: `204`, or empty body, or no `content-type: application/json` → resolves `Ok(undefined as T)`. Otherwise `response.json()`; failure → `PARSE_ERROR`. This is what makes fire-and-forget webhook calls (§7.2) work. On 4xx/5xx the body is read as text and JSON-parsed if possible; either form lands in `metadata.httpBody`.

Metadata: `httpStatus`, `httpStatusText`, `httpHeaders`, `httpBody`. `T` stays an unchecked cast; pair with `/zod` for validation (the example does this). Network-error and parse-error Faults carry the thrown error as `cause`.

### `/zod` — `safeZodParse(schema)(data)` / `safeZodParse(schema, data)`, `fromZodError(err)`

Unchanged semantics; `fromZodError` is the old `Fault.fromZod` (tag `VALIDATION_ERROR`, issues in `details`/`metadata`). Trim JSDoc to a reasonable size.

### `/pg` — `parsePgError(error: pg.DatabaseError): Fault`

Unchanged SQLSTATE mapping — connection failures (class `08xxx`, `ECONNREFUSED`, …) → `CONNECTION_ERROR`; unique/FK violations → `UNIQUE_CONSTRAINT_ERROR`/`FOREIGN_KEY_ERROR`; serialization/deadlock → `TRANSACTION_ROLLBACK_ERROR`; not-null/check → `VALIDATION_ERROR`; everything else → `DATABASE_ERROR`. So "retry connection-ish failures" means `tag === 'CONNECTION_ERROR'`. The original pg error is attached as `cause`. Type-only import of `pg`.

### `/drizzle` — `safeDb<T>(promise)`, `DatabaseError(cause)`

Unchanged; `DatabaseError` moved here from `fault.ts`.

### `/std` — new

| Function                                | Tag on failure                                               |
|-----------------------------------------|--------------------------------------------------------------|
| `safeJsonParse<T = unknown>(text)`       | `PARSE_ERROR`                                                |
| `safeJsonStringify(value, space?)`       | `PARSE_ERROR` (cycles, BigInt)                               |
| `safeReadFile(path, encoding = 'utf8')`  | `NOT_FOUND` (ENOENT), `FORBIDDEN` (EACCES/EPERM), else `INTERNAL_ERROR`; metadata `{ code, path }` |
| `safeWriteFile(path, data)`              | same mapping as read                                         |
| `safeEnv(name)`                          | `CONFIGURATION_ERROR` when missing or empty; metadata `{ name }` |

`safeReadFile`/`safeWriteFile` use `node:fs/promises` and return `ResultAsync`. The rest are sync `Result`.

## 5. Tests (all `bun test`, in `tests/`)

- `fault.test.ts`: constructor, every `with*` (incl. `withCause`), getters, `statusCode` map, `toJSON` with nested Fault cause, `location` extraction, `onCapture` hook, `from`, `ServiceError`.
- `retry.test.ts`: succeeds first try, succeeds on nth, exhausts and returns last Err, `when` predicate stops early, `delayMs` honoured (wall-clock lower bound; `bun:test` has no fake timers).
- `combinators.test.ts`: `andInspect` / `orInspect` / `andCheck` on `Result` and `ResultAsync` — pass-through of value, swallowing of thrown side-effect errors, `andCheck` propagating Err.
- `fetch.test.ts`: mock global `fetch`; one case per row of the tag table plus success and non-JSON body.
- `zod.test.ts`: curried + direct forms, success, failure shape, `fromZodError`.
- `pg.test.ts`: one case per SQLSTATE branch incl. unique-violation field extraction, fallback.
- `drizzle.test.ts`: `safeDb` ok/err; `DatabaseError` unwrapping each drizzle wrapper and non-pg cause.
- `std.test.ts`: each function success + each failure tag (fs via temp dir).
- Ported `index.test.ts`, `safe-try.test.ts` still pass.

## 6. Docs

- `packages/fault/README.md`: replace bun stub with install, root usage, one snippet per subpath, `onCapture` wiring example.
- Root `README.md`: replace neverthrow copy with a short pointer to the package.
- `examples/safeFetchExample.ts`: import from `@itterno/fault/fetch` and `@itterno/fault/zod`.
- `CLAUDE.md`: keep bun conventions; drop the `Bun.sql` over `pg` line (contradicts `/pg`).

## 7. Usage examples

These are the target developer experience and become `examples/payment.ts`
and `examples/createPost.ts`. They must typecheck against the finished
package (imports use the package name via a tsconfig path alias). The
snippets below omit app scaffolding — `z` import, drizzle `db`/`users`/`posts`
table definitions, and `declare const` stubs for `logger`, `stripeKey`, `s3`,
`bucket`, `webhookUrl`, `hash` — the example files add those. Anything else
they need that this spec doesn't define is a spec bug.

### 7.1 Charge a user

```ts
import { ok, err, retry, Fault, ServiceError } from "@itterno/fault"
import { safeDb } from "@itterno/fault/drizzle"
import { safeFetch } from "@itterno/fault/fetch"
import { safeZodParse } from "@itterno/fault/zod"
import * as Sentry from "@sentry/node"

Fault.onCapture = (fault) => Sentry.captureException(fault, { extra: fault.toJSON() })

const paymentIntentSchema = z.object({ id: z.string(), status: z.enum(["succeeded", "requires_action", "failed"]) })

export function chargeUser(userId: string, amountCents: number) {
  return retry(
    () => safeDb(db.query.users.findFirst({ where: eq(users.id, userId) })),
    { times: 3, delayMs: 200, when: (f) => f.tag === "CONNECTION_ERROR" },   // never retry constraint/logic failures
  )
    .andThen((user) => (user ? ok(user) : err(ServiceError("NOT_FOUND", `user ${userId} not found`))))
    .andThen((user) => (user.paidAt ? err(ServiceError("CONFLICT", "already paid")) : ok(user)))
    .andThen((user) =>
      safeFetch("https://api.stripe.com/v1/payment_intents", {
        method: "POST",
        headers: { Authorization: `Bearer ${stripeKey}` },
        body: new URLSearchParams({ amount: String(amountCents), currency: "eur", customer: user.stripeId }),
      })
        .andThen(safeZodParse(paymentIntentSchema))
        .map((intent) => ({ user, intent })),
    )
    .andThen(({ user, intent }) =>
      intent.status === "failed"
        ? err(ServiceError("PAYMENT_FAILED", "stripe declined").withMetadata({ intentId: intent.id }))
        : ok({ user, intent }),
    )
    .andInspect(({ user, intent }) =>
      logger.info("payment ok", { userId: hash(user.id), intent: intent.id, amountCents }),
    )
    .orInspect((fault) => fault.withMetadata({ userId: hash(userId), amountCents }).capture())
}
```

What this shows: retry with a predicate, turning `null` into a typed
`NOT_FOUND`, business rules as `err`, `safeFetch` → `safeZodParse` composition,
`andInspect` for success logging with anonymised data, `orInspect` as the one
place every failure is captured — no try/catch, and the error tracker gets tag,
location, cause, metadata.

### 7.2 Create a post with an image and notify a webhook

```ts
import { retry, fromPromise, ServiceError } from "@itterno/fault"
import { safeDb } from "@itterno/fault/drizzle"
import { safeFetch } from "@itterno/fault/fetch"
import { safeZodParse } from "@itterno/fault/zod"

const postInput = z.object({ text: z.string().min(1).max(5000), file: z.instanceof(File) })

const uploadToS3 = (file: File) => {
  const key = crypto.randomUUID()
  return fromPromise(
    s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: file.stream() })),
    (e) => ServiceError("EXTERNAL_ERROR", "s3 upload failed").withCause(e),
  )
    .orInspect((f) => logger.warn("upload failed", { tag: f.tag }))   // only S3 failures reach this
    .map(() => key)
}

export function createPost(authorId: string, raw: unknown) {
  return safeZodParse(postInput, raw)
    .asyncAndThen(({ text, file }) => uploadToS3(file).map((imageKey) => ({ text, imageKey })))
    .andThen(({ text, imageKey }) =>
      safeDb(db.insert(posts).values({ authorId, text, imageKey }).returning()).map((rows) => rows[0]!),
    )
    .andCheck((post) =>
      retry(
        () => safeFetch(webhookUrl, { method: "POST", body: JSON.stringify({ event: "post.created", id: post.id }) }),
        { times: 5, delayMs: 500, when: (f) => f.tag === "NETWORK_ERROR" || f.tag === "INTERNAL_ERROR" },
      ),
    )
    .orInspect((fault) => fault.withMetadata({ authorId: hash(authorId) }).capture())
}
```

What this shows: `fromPromise` with a `Fault`-producing error mapper for an
SDK we don't wrap, `orInspect` scoped inside the helper so it only sees S3
failures, `asyncAndThen` to cross from `Result` into `ResultAsync`,
`andCheck` for a side call whose failure should fail the chain but whose value
is discarded (the webhook's `204`/empty body resolves Ok per §4), `retry` on
a webhook with a tag predicate.

## Acceptance

`bun run local-ci` is green: typecheck (src + type tests + `examples/*.ts`), all tests, build emits 6 `.js` + 6 `.d.ts`, `attw --pack` reports no problems. Installing the tarball in a fresh project with no `zod`/`drizzle-orm`/`pg` and importing `@itterno/fault` and `@itterno/fault/fetch` works. `andTee`/`orTee`/`andThrough` no longer appear anywhere in `src/`.
