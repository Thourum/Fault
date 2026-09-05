# @itterno/fault

Result types with rich `Fault` errors, built for error tracing. Inspired by [neverthrow](https://github.com/supermacro/neverthrow).

- `Result<T, Fault>` everywhere — no `unknown` errors.
- `Fault` carries tag, details, location, metadata and `cause`; `toJSON()` for your logger.
- `Fault.onCapture` — one hook to send every failure to Sentry / OTel.
- Integrations as subpaths with optional peers: `/fetch`, `/zod`, `/drizzle`, `/pg`, `/std`.

## Install

```sh
bun add @itterno/fault          # or npm i
bun add zod                     # only if you use @itterno/fault/zod
bun add drizzle-orm pg          # only if you use @itterno/fault/drizzle
```

## Core

```ts
import { ok, err, ResultAsync, Fault, ServiceError, retry } from '@itterno/fault'

Fault.onCapture = (f) => Sentry.captureException(f, { extra: f.toJSON() })

const r = ok(1)
  .andInspect((v) => log(v))        // side effect on Ok, value passes through
  .orInspect((e) => e.capture())    // side effect on Err, error passes through
  .andCheck((v) => validate(v))     // run a Result; its Err fails the chain, its Ok is discarded
```

Naming rule: `and*` runs on the Ok path, `or*` on the Err path.

`retry(() => fetchThing(), { times: 3, delayMs: 200, when: (f) => f.tag === 'NETWORK_ERROR' })`

## Subpaths

| Import | Exports |
|---|---|
| `@itterno/fault/fetch` | `safeFetch(url, init?)` → `ResultAsync<T, Fault>`; 4xx/5xx and network errors become tagged Faults |
| `@itterno/fault/zod` | `safeZodParse(schema)(data)` / `safeZodParse(schema, data)`, `fromZodError(e)` |
| `@itterno/fault/drizzle` | `safeDb(promise)`, `DatabaseError(cause)` — pg SQLSTATE → tags like `UNIQUE_CONSTRAINT_ERROR` |
| `@itterno/fault/pg` | `parsePgError(pgError)` |
| `@itterno/fault/std` | `safeJsonParse`, `safeJsonStringify`, `safeReadFile`, `safeWriteFile`, `safeEnv` |

See `examples/payment.ts` and `examples/createPost.ts` for end-to-end flows.

## Develop

```sh
bun install
bun run local-ci   # typecheck, test, build, exports check
```
