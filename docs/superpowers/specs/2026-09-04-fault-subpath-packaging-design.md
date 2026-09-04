# fault — Phase 1: subpath packaging, zero-dep core, tooling

Date: 2026-09-04
Status: approved in chat, pending spec review

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
| `@itterno/fault`          | everything from neverthrow fork (`Result`, `ResultAsync`, `ok`, `err`, `okAsync`, `errAsync`, `fromThrowable`, `fromPromise`, `fromSafePromise`, `fromAsyncThrowable`, `safeTry`, combine helpers) + `Fault`, `FaultTag`, `ServiceError` | none                      |
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
core via `../index.js` (relative), never via the package name.

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
- Everything else (`#tag`, `#details`, `#location`, `#metadata`, `cause`, `with*` chain, getters, `statusCode` map, `toJSON`, `static from`, `FaultTag`, `ServiceError`) unchanged.

## 3. Tooling

| Concern    | Tool                                   | Script                                        |
|------------|----------------------------------------|-----------------------------------------------|
| Build      | `tsdown` (ESM + d.ts, 6 entries)       | `build: tsdown`                               |
| Typecheck  | `tsgo` (`@typescript/native-preview`)  | `typecheck: tsgo --noEmit && tsgo --noEmit -p tests/tsconfig.tests.json` |
| Tests      | `bun test`                             | `test: bun test`                              |
| Exports    | `@arethetypeswrong/cli`                | `check:exports: attw --pack`                  |
| CI local   |                                        | `local-ci: bun run typecheck && bun run test && bun run build && bun run check:exports` |

`tsdown.config.ts`: `entry: { index, fetch, zod, drizzle, pg, std }`, `format: ['esm']`, `dts: true`, `platform: 'node'`, `external` = peer deps. `tsconfig.json`: `strict: true`, `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`.

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
| body not JSON              | `PARSE_ERROR`       |

Metadata: `httpStatus`, `httpStatusText`, `httpHeaders`, `httpBody` (as now). `T` stays an unchecked cast; pair with `/zod` or `/schema` for validation (the example already does this). Add any tags missing from `FaultTag`.

### `/zod` — `safeZodParse(schema)(data)` / `safeZodParse(schema, data)`, `fromZodError(err)`

Unchanged semantics; `fromZodError` is the old `Fault.fromZod` (tag `VALIDATION_ERROR`, issues in `details`/`metadata`). Trim JSDoc to a reasonable size.

### `/pg` — `parsePgError(error: pg.DatabaseError): Fault`

Unchanged SQLSTATE mapping. Type-only import of `pg`.

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

- `fault.test.ts`: constructor, every `with*`, getters, `statusCode` map, `toJSON` with nested Fault cause, `location` extraction, `onCapture` hook, `from`, `ServiceError`.
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

## Acceptance

`bun run local-ci` is green: typecheck (src + type tests), all tests, build emits 6 `.js` + 6 `.d.ts`, `attw --pack` reports no problems. Installing the tarball in a fresh project with no `zod`/`drizzle-orm`/`pg` and importing `@itterno/fault` and `@itterno/fault/fetch` works.
