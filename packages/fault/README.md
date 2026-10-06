# @thourum/fault

Result types with rich `Fault` errors, built for error tracing. Inspired by [neverthrow](https://github.com/supermacro/neverthrow).

- `Result<T, Fault>` everywhere — no `unknown` errors.
- `Fault` carries tag, details, location, metadata and `cause`; `toJSON()` for your logger.
- `Fault.onCapture` — one hook to send every failure to Sentry / OTel.
- Integrations as subpaths with optional peers: `/fetch`, `/zod`, `/drizzle`, `/pg`, `/std`.

## Install

```sh
npm add @thourum/fault          # or bun add
npm add zod@^4                  # only if you use @thourum/fault/zod (Zod >=4.0.0)
npm add drizzle-orm pg          # only if you use @thourum/fault/drizzle
```

## Core

```ts
import { ok, err, ResultAsync, Fault, ServiceError, retry } from '@thourum/fault'

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
| `@thourum/fault/fetch` | `safeFetch(url, init?)` → `ResultAsync<Response, Fault>` (body untouched); `safeFetchJSON<T>(url, init?)` → `ResultAsync<T, Fault>` (always parses JSON). HTTP, network, timeout, abort and parse failures become tagged Faults |
| `@thourum/fault/zod` | `safeZodParse(schema)(data)` / `safeZodParse(schema, data)`, `fromZodError(e)` |
| `@thourum/fault/drizzle` | `safeDb(promise)`, `DatabaseError(cause)` — pg codes → specific tags; query SQL/params in metadata, inner driver message in Fault message, original error as cause |
| `@thourum/fault/pg` | `parsePgError(pgError)` — known codes → specific messages/tags, unknown errors → real driver message |
| `@thourum/fault/std` | `safeJsonParse`, `safeJsonStringify`, `safeReadFile`, `safeWriteFile`, `safeEnv` |

See `examples/payment.ts` and `examples/createPost.ts` for end-to-end flows.

## Develop

```sh
bun install
bun run local-ci   # typecheck, test, build, exports check
```
