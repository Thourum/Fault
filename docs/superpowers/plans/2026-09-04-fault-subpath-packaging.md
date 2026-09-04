# fault Phase 1 — Subpath Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `packages/fault` into a publishable ESM package with a zero-dependency core, six subpath exports (`.`, `/fetch`, `/zod`, `/drizzle`, `/pg`, `/std`), renamed combinators, a `retry` helper, and full test coverage.

**Architecture:** Single package, no workspace. Core (`src/index.ts`) = neverthrow fork + `Fault`. Each integration is `src/<name>/index.ts`, importing core relatively, with its third-party dependency as an optional peer. tsdown emits one ESM bundle + `.d.ts` per entry; tsgo typechecks; bun runs tests.

**Tech Stack:** TypeScript (strict), Bun (`bun test`, `bun install`), tsdown, `@typescript/native-preview` (tsgo), `@arethetypeswrong/cli`, zod v3, drizzle-orm, pg.

**Spec:** `docs/superpowers/specs/2026-09-04-fault-subpath-packaging-design.md`

## Global Constraints

- Package name `@itterno/fault`, `"type": "module"`, ESM only — no CJS output.
- Root entry has **zero runtime dependencies**. `dependencies` must be `{}`.
- `zod`, `drizzle-orm`, `pg` are `peerDependencies` with `peerDependenciesMeta.<name>.optional: true`.
- Subpath files import core via relative paths (`../index.js`, `../fault.js`), never `@itterno/fault`.
- Combinator naming: `and*` runs on Ok, `or*` runs on Err. `andTee`→`andInspect`, `orTee`→`orInspect`, `andThrough`→`andCheck`. Old names removed, no aliases.
- All helpers return `Result<T, Fault>` / `ResultAsync<T, Fault>`.
- Tests use `bun:test` only (no vitest, no testdouble).
- Work in `packages/fault/` unless a path says otherwise. All commands below run from `packages/fault/`.
- Commit after every task with conventional-commit messages.

---

## File map

| Path | Action | Responsibility |
|---|---|---|
| `package.json` | rewrite | exports, peers, scripts |
| `tsconfig.json` | rewrite | strict, NodeNext |
| `tsdown.config.ts` | create | 6 entries, esm, dts |
| `tests/tsconfig.tests.json` | rewrite | typecheck tests + examples |
| `src/result.ts` | modify | rename combinators |
| `src/result-async.ts` | modify | rename combinators |
| `src/retry.ts` | create | `retry()` |
| `src/fault.ts` | modify | drop zod/drizzle/pg, `onCapture`, `withCause`, tags |
| `src/index.ts` | modify | core-only exports |
| `src/fetch/index.ts` | move from `src/utils/safeFetch.ts` | `safeFetch` |
| `src/zod/index.ts` | move from `src/utils/safeZodParse.ts` | `safeZodParse`, `fromZodError` |
| `src/pg/index.ts` | move from `src/utils/pg-error-parser.ts` | `parsePgError` |
| `src/drizzle/index.ts` | move from `src/utils/safeDrizzle.ts` | `safeDb`, `DatabaseError` |
| `src/std/index.ts` | create | json/fs/env helpers |
| `tests/*.test.ts` | create/modify | see tasks |
| `README.md`, `../../README.md`, `CLAUDE.md` | rewrite | docs |
| `../../examples/*.ts` | create/modify | payment, createPost, safeFetch |

---

### Task 1: Tooling bootstrap and test-runner port

**Files:**
- Modify: `packages/fault/package.json`
- Modify: `packages/fault/tsconfig.json`
- Create: `packages/fault/tsdown.config.ts`
- Modify: `packages/fault/tests/tsconfig.tests.json`
- Modify: `packages/fault/tests/index.test.ts:1,18,753`
- Modify: `packages/fault/tests/safe-try.test.ts:13`

**Interfaces:**
- Produces: scripts `test`, `typecheck`, `build`, `check:exports`, `local-ci`. Later tasks assume `bun test tests/<file>` works and `bun run typecheck` checks `src/` + `tests/`.

- [ ] **Step 1: Rewrite `package.json`**

```json
{
  "name": "@itterno/fault",
  "version": "0.1.0",
  "description": "Result types with rich Fault errors built for error tracing. Inspired by neverthrow.",
  "type": "module",
  "files": ["dist"],
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./fetch": { "types": "./dist/fetch.d.ts", "default": "./dist/fetch.js" },
    "./zod": { "types": "./dist/zod.d.ts", "default": "./dist/zod.js" },
    "./drizzle": { "types": "./dist/drizzle.d.ts", "default": "./dist/drizzle.js" },
    "./pg": { "types": "./dist/pg.d.ts", "default": "./dist/pg.js" },
    "./std": { "types": "./dist/std.d.ts", "default": "./dist/std.js" }
  },
  "scripts": {
    "build": "tsdown",
    "typecheck": "tsgo --noEmit -p tsconfig.json && tsgo --noEmit -p tests/tsconfig.tests.json",
    "test": "bun test",
    "check:exports": "attw --pack . --profile esm-only",
    "local-ci": "bun run typecheck && bun run test && bun run build && bun run check:exports"
  },
  "dependencies": {},
  "peerDependencies": {
    "drizzle-orm": ">=0.30.0",
    "pg": ">=8.0.0",
    "zod": ">=3.20.0"
  },
  "peerDependenciesMeta": {
    "drizzle-orm": { "optional": true },
    "pg": { "optional": true },
    "zod": { "optional": true }
  },
  "devDependencies": {
    "@arethetypeswrong/cli": "latest",
    "@types/bun": "latest",
    "@types/node": "latest",
    "@types/pg": "latest",
    "@typescript/native-preview": "latest",
    "drizzle-orm": "^0.44.6",
    "pg": "^8.16.3",
    "tsdown": "latest",
    "typescript": "latest",
    "zod": "^3.20.0"
  },
  "keywords": ["result", "error-handling", "neverthrow", "fault", "typescript"],
  "license": "MIT"
}
```

Keep `private: true` out — the acceptance criterion installs the tarball.

- [ ] **Step 2: Rewrite `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM"],
    "types": ["bun-types"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "skipLibCheck": true,
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src/**/*.ts"]
}
```

`DOM` lib is for `fetch`/`Response`/`Headers` types in `/fetch`.

- [ ] **Step 3: Create `tsdown.config.ts`**

```ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    fetch: 'src/fetch/index.ts',
    zod: 'src/zod/index.ts',
    drizzle: 'src/drizzle/index.ts',
    pg: 'src/pg/index.ts',
    std: 'src/std/index.ts',
  },
  format: ['esm'],
  platform: 'node',
  dts: true,
  clean: true,
})
```

Peer deps are externalised by default. The subpath source files don't exist yet — `build` will fail until Task 10; that's expected.

- [ ] **Step 4: Rewrite `tests/tsconfig.tests.json`**

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": "../.."
  },
  "include": ["./**/*.ts", "../src/**/*.ts", "../../examples/*.ts"]
}
```

`examples/*.ts` import `@itterno/fault/...` — that alias is added in Task 11. Until then the examples dir only contains `safeFetchExample.ts`, which imports relatively and will break in Task 10 when `src/utils` is deleted; Task 11 fixes it. If typecheck fails on examples before Task 11, that's expected — run `tsgo --noEmit -p tsconfig.json` alone.

- [ ] **Step 5: Install and verify tools resolve**

Run: `rm -rf node_modules bun.lock && bun install && bunx tsgo --version && bunx tsdown --version && bunx attw --version`
Expected: three version strings, no errors.

- [ ] **Step 6: Port `tests/index.test.ts` to bun:test**

Line 1: delete `import * as td from 'testdouble'`.
Line 18: replace `import { vitest, describe, expect, it } from 'vitest'` with `import { describe, expect, it, mock } from 'bun:test'`.
Search the file for `vitest.fn(` and replace each with `mock(`. Search for `vi.fn(` likewise.
Line ~753: replace `td.object<ITestInterface>()` with `({} as ITestInterface)` (it's only used as an opaque value).

Run: `grep -n "vitest\|testdouble\|td\." tests/index.test.ts`
Expected: no output.

- [ ] **Step 7: Port `tests/safe-try.test.ts`**

Line 13: replace `import { describe, expect, test } from 'vitest'` with `import { describe, expect, test } from 'bun:test'`.

- [ ] **Step 8: Run the forked suite**

Run: `bun test tests/index.test.ts tests/safe-try.test.ts`
Expected: all pass. If a `.toHaveBeenCalled*` matcher differs, bun:test supports the same jest-style matchers on `mock()` — fix the specific call site, don't rewrite tests.

- [ ] **Step 9: Typecheck src (tests will still fail on strict — see next step)**

Run: `bunx tsgo --noEmit -p tsconfig.json`
Expected: errors are possible because `strict` is now on and the fork was `strict: false`. Fix each with the narrowest change (add `!`, `as`, or a type annotation). Do not change runtime behaviour. Then run `bunx tsgo --noEmit -p tests/tsconfig.tests.json` and fix likewise (ignore `examples/` errors for now).

- [ ] **Step 10: Commit**

```bash
git add -A packages/fault/package.json packages/fault/tsconfig.json packages/fault/tsdown.config.ts packages/fault/tests packages/fault/bun.lock packages/fault/src
git commit -m "chore: bootstrap tsdown/tsgo/bun tooling, port tests to bun:test, enable strict"
```

---

### Task 2: Rename combinators

**Files:**
- Modify: `packages/fault/src/result.ts:185-219,341-359,439-454`
- Modify: `packages/fault/src/result-async.ts:210-288`
- Modify: `packages/fault/tests/index.test.ts` (describe titles L105,137,162,364,376,980,1067,1092 + call sites)
- Modify: `packages/fault/tests/typecheck-tests.ts` (15 `andThrough` sites)
- Create: `packages/fault/tests/combinators.test.ts`

**Interfaces:**
- Produces on `Result<T,E>` and `ResultAsync<T,E>`:
  - `andInspect(f: (t: T) => unknown): Result<T, E>` — Ok: call f, swallow throws, return same Ok. Err: passthrough.
  - `orInspect(f: (e: E) => unknown): Result<T, E>` — Err: call f, swallow throws, return same Err. Ok: passthrough.
  - `andCheck<F>(f: (t: T) => Result<unknown, F>): Result<T, E | F>` — Ok: run f; if Err return that Err else original Ok. Err: passthrough. (Keep the `R extends Result` overload that exists on `andThrough`.)
  - ResultAsync versions accept `Result | ResultAsync` from f and return `ResultAsync`.

- [ ] **Step 1: Write failing test `tests/combinators.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import { ok, err, okAsync, errAsync } from '../src'

describe('andInspect', () => {
  it('runs f on Ok and passes value through', () => {
    let seen: number | undefined
    const r = ok(2).andInspect((v) => { seen = v })
    expect(seen).toBe(2)
    expect(r._unsafeUnwrap()).toBe(2)
  })
  it('swallows errors thrown by f', () => {
    const r = ok(2).andInspect(() => { throw new Error('boom') })
    expect(r.isOk()).toBe(true)
  })
  it('skips f on Err', () => {
    let called = false
    const r = err('e').andInspect(() => { called = true })
    expect(called).toBe(false)
    expect(r._unsafeUnwrapErr()).toBe('e')
  })
  it('works on ResultAsync', async () => {
    let seen: number | undefined
    const r = await okAsync(3).andInspect(async (v) => { seen = v })
    expect(seen).toBe(3)
    expect(r._unsafeUnwrap()).toBe(3)
  })
})

describe('orInspect', () => {
  it('runs f on Err and passes error through', () => {
    let seen: string | undefined
    const r = err('e').orInspect((e) => { seen = e })
    expect(seen).toBe('e')
    expect(r._unsafeUnwrapErr()).toBe('e')
  })
  it('swallows errors thrown by f', () => {
    const r = err('e').orInspect(() => { throw new Error('boom') })
    expect(r.isErr()).toBe(true)
  })
  it('skips f on Ok', () => {
    let called = false
    ok(1).orInspect(() => { called = true })
    expect(called).toBe(false)
  })
  it('works on ResultAsync', async () => {
    let seen: string | undefined
    const r = await errAsync('e').orInspect(async (e) => { seen = e })
    expect(seen).toBe('e')
    expect(r._unsafeUnwrapErr()).toBe('e')
  })
})

describe('andCheck', () => {
  it('keeps original value when f returns Ok', () => {
    const r = ok(5).andCheck(() => ok('ignored'))
    expect(r._unsafeUnwrap()).toBe(5)
  })
  it('fails with Err from f', () => {
    const r = ok(5).andCheck(() => err('checkfail'))
    expect(r._unsafeUnwrapErr()).toBe('checkfail')
  })
  it('skips f on Err', () => {
    let called = false
    const r = err('e').andCheck(() => { called = true; return ok(1) })
    expect(called).toBe(false)
    expect(r._unsafeUnwrapErr()).toBe('e')
  })
  it('works on ResultAsync with ResultAsync-returning f', async () => {
    const r = await okAsync(5).andCheck(() => errAsync('cf'))
    expect(r._unsafeUnwrapErr()).toBe('cf')
    const r2 = await okAsync(5).andCheck(() => okAsync('x'))
    expect(r2._unsafeUnwrap()).toBe(5)
  })
})
```

- [ ] **Step 2: Run, verify fails**

Run: `bun test tests/combinators.test.ts`
Expected: FAIL — `andInspect is not a function`.

- [ ] **Step 3: Rename in `src/result.ts`**

Rename every identifier `andTee` → `andInspect`, `orTee` → `orInspect`, `andThrough` → `andCheck` (interface declarations, Ok impl, Err impl, JSDoc text). `asyncAndThrough` → `asyncAndCheck`. Bodies unchanged. Update JSDoc wording: "Inspect" for the side-effect ones, "Check" for the gate.

Run: `grep -n "Tee\|Through" src/result.ts` → Expected: no output.

- [ ] **Step 4: Rename in `src/result-async.ts`**

Same three renames at L210–288, including JSDoc. `grep -n "Tee\|Through" src/result-async.ts` → no output.

- [ ] **Step 5: Rename in tests**

`sed -i '' 's/asyncAndThrough/asyncAndCheck/g; s/andThrough/andCheck/g; s/andTee/andInspect/g; s/orTee/orInspect/g' tests/index.test.ts tests/typecheck-tests.ts`

- [ ] **Step 6: Run all tests and typecheck**

Run: `bun test && bunx tsgo --noEmit -p tsconfig.json`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/fault/src/result.ts packages/fault/src/result-async.ts packages/fault/tests
git commit -m "refactor: rename andTee/orTee/andThrough to andInspect/orInspect/andCheck"
```

---

### Task 3: Decouple `Fault` core

**Files:**
- Modify: `packages/fault/src/fault.ts`
- Create: `packages/fault/tests/fault.test.ts`

**Interfaces:**
- Produces (in `src/fault.ts`):
  - `type FaultTag` = existing union **plus** `'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'RATE_LIMITED' | 'CONFLICT' | 'CONFIGURATION_ERROR' | 'EXTERNAL_ERROR' | 'PAYMENT_FAILED' | 'UNIQUE_CONSTRAINT_ERROR' | 'FOREIGN_KEY_ERROR' | 'CONNECTION_ERROR' | 'TRANSACTION_ROLLBACK_ERROR'`, keeping `(string & {})`.
  - `Fault.withCause(cause: unknown): this` — sets `this.cause`.
  - `Fault.withMetadata(key: string, value: unknown): this` **and** `withMetadata(data: Record<string, unknown>): this` (overload).
  - `static onCapture: ((fault: Fault) => void) | undefined`; `capture(): this` calls it.
  - `statusCode` additions: `BAD_REQUEST`→400, `UNAUTHORIZED`→401, `FORBIDDEN`→403, `CONFLICT`→409, `UNIQUE_CONSTRAINT_ERROR`→409, `RATE_LIMITED`→429, `PAYMENT_FAILED`→402, `EXTERNAL_ERROR`→502, `CONNECTION_ERROR`→503, `CONFIGURATION_ERROR`→500, `FOREIGN_KEY_ERROR`→400, `TRANSACTION_ROLLBACK_ERROR`→500.
  - Removed: `Fault.fromZod`, `DatabaseError`, all imports of zod/drizzle/pg, module-level `otel`/`sentry`.
- `ServiceError(type, message, description?)` unchanged.

- [ ] **Step 1: Write failing test `tests/fault.test.ts`**

```ts
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
  it('records location from stack', () => {
    expect(new Fault('x').location).toMatch(/fault\.test\.ts/)
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
    expect(() => new Fault('x').capture()).not.toThrow()
  })
  it('Fault.from wraps Error keeping message', () => {
    expect(Fault.from(new Error('e')).message).toBe('e')
  })
  it('ServiceError sets tag, message, details', () => {
    const f = ServiceError('CONFLICT', 'already paid')
    expect(f.tag).toBe('CONFLICT'); expect(f.message).toBe('already paid'); expect(f.details).toBe('already paid')
  })
})
```

- [ ] **Step 2: Run, verify fails**

Run: `bun test tests/fault.test.ts`
Expected: FAIL (module import of `zod`/`drizzle-orm` may succeed since devDeps exist, but `withCause`, `onCapture`, object `withMetadata`, new status codes fail).

- [ ] **Step 3: Edit `src/fault.ts`**

1. Delete lines 1–4 (imports) and lines 7–8 (`let otel`, `let sentry`).
2. Delete `static fromZod` (L400–418) and `export function DatabaseError` (L498–543).
3. Replace `capture()` (L326–378) with:

```ts
    /** Hook invoked by `capture()`. Wire Sentry/OTel here, e.g.
     *  `Fault.onCapture = (f) => Sentry.captureException(f, { extra: f.toJSON() })` */
    static onCapture: ((fault: Fault) => void) | undefined;

    /** Send this fault to `Fault.onCapture` (if set) and return it unchanged. */
    capture(): this {
        Fault.onCapture?.(this);
        return this;
    }
```

4. After `withContext` (L238–250) add:

```ts
    /** Attach the underlying cause (any thrown value). */
    withCause(cause: unknown): this {
        (this as Error & { cause?: unknown }).cause = cause;
        return this;
    }
```

5. Replace `withMetadata(key: string, value: unknown): this` (L220) with overloads:

```ts
    withMetadata(key: string, value: unknown): this;
    withMetadata(data: Record<string, unknown>): this;
    withMetadata(keyOrData: string | Record<string, unknown>, value?: unknown): this {
        if (typeof keyOrData === 'string') {
            this.#metadata = { ...this.#metadata, [keyOrData]: value };
        } else {
            this.#metadata = { ...this.#metadata, ...keyOrData };
        }
        return this;
    }
```

6. Extend `FaultTag` (L431–448) — add these members before `(string & {})`:

```ts
    | 'BAD_REQUEST'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'CONFLICT'
    | 'RATE_LIMITED'
    | 'PAYMENT_FAILED'
    | 'EXTERNAL_ERROR'
    | 'CONFIGURATION_ERROR'
    | 'CONNECTION_ERROR'
    | 'UNIQUE_CONSTRAINT_ERROR'
    | 'FOREIGN_KEY_ERROR'
    | 'TRANSACTION_ROLLBACK_ERROR'
```

7. Extend the `statusCode` switch (L134–156) with:

```ts
            case 'BAD_REQUEST':
            case 'FOREIGN_KEY_ERROR':
                return 400;
            case 'UNAUTHORIZED':
                return 401;
            case 'PAYMENT_FAILED':
                return 402;
            case 'FORBIDDEN':
                return 403;
            case 'CONFLICT':
            case 'UNIQUE_CONSTRAINT_ERROR':
                return 409;
            case 'RATE_LIMITED':
                return 429;
            case 'EXTERNAL_ERROR':
                return 502;
            case 'CONNECTION_ERROR':
                return 503;
```

(`CONFIGURATION_ERROR` and `TRANSACTION_ROLLBACK_ERROR` fall to `default` 500.)

8. Remove the export of `DatabaseError` from `src/index.ts` line 31 (leave the rest; `index.ts` is fully rewritten in Task 10). The `utils/*` files still import `Fault.fromZod` / `DatabaseError` — they break here and are fixed in Tasks 5–8. Run `bun test tests/fault.test.ts` only.

- [ ] **Step 4: Run, verify passes**

Run: `bun test tests/fault.test.ts`
Expected: PASS.

- [ ] **Step 5: Confirm no external imports in core**

Run: `grep -n "from 'zod'\|from 'pg'\|drizzle-orm\|require(" src/fault.ts src/result.ts src/result-async.ts src/_internals/*.ts`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add packages/fault/src/fault.ts packages/fault/src/index.ts packages/fault/tests/fault.test.ts
git commit -m "refactor: zero-dep Fault core — drop zod/drizzle/pg, add onCapture, withCause, new tags"
```

---

### Task 4: `retry`

**Files:**
- Create: `packages/fault/src/retry.ts`
- Create: `packages/fault/tests/retry.test.ts`

**Interfaces:**
- Produces: `retry<T, E>(fn: () => ResultAsync<T, E>, opts: { times: number; delayMs?: number; when?: (e: E) => boolean }): ResultAsync<T, E>`. `times` = total attempts (≥1). Fixed delay between attempts.

- [ ] **Step 1: Write failing test `tests/retry.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import { okAsync, errAsync, ResultAsync } from '../src'
import { retry } from '../src/retry'

const failing = (failures: number) => {
  let n = 0
  return () => (n++ < failures ? errAsync<number, string>(`fail${n}`) : okAsync<number, string>(42))
}

describe('retry', () => {
  it('returns first Ok without retrying', async () => {
    let calls = 0
    const r = await retry(() => { calls++; return okAsync(1) }, { times: 3 })
    expect(r._unsafeUnwrap()).toBe(1); expect(calls).toBe(1)
  })
  it('succeeds on nth attempt', async () => {
    const r = await retry(failing(2), { times: 3 })
    expect(r._unsafeUnwrap()).toBe(42)
  })
  it('returns last Err after exhausting attempts', async () => {
    const r = await retry(failing(5), { times: 3 })
    expect(r._unsafeUnwrapErr()).toBe('fail3')
  })
  it('stops early when predicate is false', async () => {
    let calls = 0
    const r = await retry(() => { calls++; return errAsync<number, string>('fatal') }, { times: 5, when: (e) => e !== 'fatal' })
    expect(r._unsafeUnwrapErr()).toBe('fatal'); expect(calls).toBe(1)
  })
  it('waits delayMs between attempts', async () => {
    const t0 = Date.now()
    await retry(failing(2), { times: 3, delayMs: 30 })
    expect(Date.now() - t0).toBeGreaterThanOrEqual(55)
  })
  it('returns a ResultAsync (chainable)', async () => {
    const r = retry(failing(0), { times: 1 })
    expect(r).toBeInstanceOf(ResultAsync)
    expect(await r.map((v) => v + 1)._unsafeUnwrap()).toBe(43)
  })
})
```

- [ ] **Step 2: Run, verify fails**

Run: `bun test tests/retry.test.ts` → FAIL, cannot find `../src/retry`.

- [ ] **Step 3: Implement `src/retry.ts`**

```ts
import { ResultAsync } from './result-async.js'
import type { Result } from './result.js'

export interface RetryOptions<E> {
    /** Total attempts, including the first. */
    times: number
    /** Fixed delay between attempts in ms. Default 0. */
    delayMs?: number
    /** Retry only when this returns true for the error. Default: always. */
    when?: (error: E) => boolean
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Re-run `fn` while it returns Err (and `when(err)` holds), up to `times` attempts. */
export function retry<T, E>(fn: () => ResultAsync<T, E>, opts: RetryOptions<E>): ResultAsync<T, E> {
    const { times, delayMs = 0, when = () => true } = opts
    const run = async (): Promise<Result<T, E>> => {
        let last: Result<T, E> = await fn()
        for (let attempt = 1; attempt < times && last.isErr() && when(last.error); attempt++) {
            if (delayMs > 0) await sleep(delayMs)
            last = await fn()
        }
        return last
    }
    return new ResultAsync(run())
}
```

Add `export { retry, type RetryOptions } from './retry.js'` to `src/index.ts`.

- [ ] **Step 4: Run, verify passes**

Run: `bun test tests/retry.test.ts` → PASS. Then `bunx tsgo --noEmit -p tsconfig.json` (ignore errors originating in `src/utils/*` — they are removed in Tasks 5–8).

- [ ] **Step 5: Commit**

```bash
git add packages/fault/src/retry.ts packages/fault/src/index.ts packages/fault/tests/retry.test.ts
git commit -m "feat: add retry helper for ResultAsync"
```

---

### Task 5: `/pg` subpath

**Files:**
- Move: `packages/fault/src/utils/pg-error-parser.ts` → `packages/fault/src/pg/index.ts`
- Create: `packages/fault/tests/pg.test.ts`

**Interfaces:**
- Produces: `parsePgError(error: import('pg').DatabaseError): Fault` (unchanged). Type-only `pg` import.

- [ ] **Step 1: Write failing test `tests/pg.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import { DatabaseError } from 'pg'
import { parsePgError } from '../src/pg'

const pgErr = (code: string, extra: Partial<DatabaseError> = {}) =>
  Object.assign(new DatabaseError('pg failed', 1, 'error'), { code, ...extra })

describe('parsePgError', () => {
  it('23505 → UNIQUE_CONSTRAINT_ERROR with field from detail', () => {
    const f = parsePgError(pgErr('23505', { detail: 'Key (email)=(a@b.c) already exists.', constraint: 'users_email_key', table: 'users' }))
    expect(f.tag).toBe('UNIQUE_CONSTRAINT_ERROR')
    expect(f.metadata.field).toBe('email')
    expect(f.metadata.pgCode).toBe('23505')
    expect(f.statusCode).toBe(409)
  })
  it('23503 → FOREIGN_KEY_ERROR', () => expect(parsePgError(pgErr('23503', { detail: 'Key (user_id)=(1) is not present in table "users".' })).tag).toBe('FOREIGN_KEY_ERROR'))
  it('23502 → VALIDATION_ERROR with column', () => {
    const f = parsePgError(pgErr('23502', { column: 'name' }))
    expect(f.tag).toBe('VALIDATION_ERROR'); expect(f.metadata.field).toBe('name')
  })
  it('23514 → VALIDATION_ERROR', () => expect(parsePgError(pgErr('23514')).tag).toBe('VALIDATION_ERROR'))
  it.each(['42P01', '42703', '57014'])('%s → DATABASE_ERROR', (c) => expect(parsePgError(pgErr(c)).tag).toBe('DATABASE_ERROR'))
  it.each(['08000', '08001', '08003', '08004', '08006', '08007', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'])('%s → CONNECTION_ERROR', (c) =>
    expect(parsePgError(pgErr(c)).tag).toBe('CONNECTION_ERROR'))
  it.each(['40001', '40P01'])('%s → TRANSACTION_ROLLBACK_ERROR', (c) => expect(parsePgError(pgErr(c)).tag).toBe('TRANSACTION_ROLLBACK_ERROR'))
  it('unknown code → DATABASE_ERROR', () => expect(parsePgError(pgErr('99999')).tag).toBe('DATABASE_ERROR'))
  it('keeps original error as cause', () => {
    const e = pgErr('23505')
    expect(parsePgError(e).cause).toBe(e)
  })
})
```

- [ ] **Step 2: Run, verify fails**

Run: `bun test tests/pg.test.ts` → FAIL, cannot find `../src/pg`.

- [ ] **Step 3: Move and adjust**

```bash
mkdir -p src/pg && git mv src/utils/pg-error-parser.ts src/pg/index.ts
```

In `src/pg/index.ts`: change `import { Fault } from '../fault'` → `import { Fault } from '../fault.js'`. Where the base fault is built (`new Fault(pgError).withMetadata('pgCode', ...)` around old L62), append `.withCause(error)` so the original `DatabaseError` is the cause (the constructor copies `initial.cause`, not `initial`). Keep everything else.

- [ ] **Step 4: Run, verify passes**

Run: `bun test tests/pg.test.ts` → PASS. If the unique-violation `field` regex doesn't extract `email` from `Key (email)=(a@b.c) already exists.`, fix the regex to `/Key \(([^)]+)\)=/` and take group 1.

- [ ] **Step 5: Commit**

```bash
git add -A packages/fault/src/pg packages/fault/src/utils packages/fault/tests/pg.test.ts
git commit -m "refactor: move pg error parser to /pg subpath, attach cause"
```

---

### Task 6: `/zod` subpath

**Files:**
- Move: `packages/fault/src/utils/safeZodParse.ts` → `packages/fault/src/zod/index.ts`
- Create: `packages/fault/tests/zod.test.ts`

**Interfaces:**
- Produces:
  - `fromZodError(error: ZodError): Fault` — tag `VALIDATION_ERROR`, message `Validation failed: <first issue message>`, metadata `zodIssues`, `issueCount`, `fieldErrors`, cause = the ZodError.
  - `safeZodParse<S extends ZodSchema>(schema: S): (data: unknown) => Result<z.infer<S>, Fault>` and `safeZodParse(schema, data)` direct form (unchanged).

- [ ] **Step 1: Write failing test `tests/zod.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { safeZodParse, fromZodError } from '../src/zod'

const user = z.object({ name: z.string(), age: z.number().min(18) })

describe('safeZodParse', () => {
  it('curried form returns Ok on valid data', () => {
    const r = safeZodParse(user)({ name: 'a', age: 20 })
    expect(r._unsafeUnwrap()).toEqual({ name: 'a', age: 20 })
  })
  it('direct form returns Ok on valid data', () => {
    expect(safeZodParse(user, { name: 'a', age: 20 }).isOk()).toBe(true)
  })
  it('returns VALIDATION_ERROR Fault with issues on invalid data', () => {
    const f = safeZodParse(user, { name: 1, age: 5 })._unsafeUnwrapErr()
    expect(f.tag).toBe('VALIDATION_ERROR')
    expect(f.metadata.issueCount).toBe(2)
    expect((f.metadata.fieldErrors as Record<string, unknown>).age).toBeDefined()
    expect(f.statusCode).toBe(400)
  })
})

describe('fromZodError', () => {
  it('builds Fault from ZodError and keeps it as cause', () => {
    const res = user.safeParse({})
    if (res.success) throw new Error('expected failure')
    const f = fromZodError(res.error)
    expect(f.tag).toBe('VALIDATION_ERROR')
    expect(f.message).toMatch(/^Validation failed: /)
    expect(f.cause).toBe(res.error)
  })
})
```

- [ ] **Step 2: Run, verify fails**

Run: `bun test tests/zod.test.ts` → FAIL.

- [ ] **Step 3: Move and implement**

```bash
mkdir -p src/zod && git mv src/utils/safeZodParse.ts src/zod/index.ts
```

Edit `src/zod/index.ts`:
- Imports become:
  ```ts
  import { err, ok } from '../result.js'
  import type { Result } from '../result.js'
  import type { z, ZodError, ZodSchema } from 'zod'
  import { Fault } from '../fault.js'
  ```
- Add before `safeZodParse`:
  ```ts
  /** Convert a ZodError into a VALIDATION_ERROR Fault. */
  export function fromZodError(error: ZodError): Fault {
      const first = error.issues[0]
      return new Fault(`Validation failed: ${first?.message ?? 'invalid input'}`)
          .withTag('VALIDATION_ERROR')
          .withMetadata({
              zodIssues: error.issues,
              issueCount: error.issues.length,
              fieldErrors: error.flatten().fieldErrors,
          })
          .withCause(error)
  }
  ```
- Replace both `Fault.fromZod(result.error)` calls with `fromZodError(result.error)`.
- Cut the JSDoc on the overloads down to one paragraph + one example each.

- [ ] **Step 4: Run, verify passes**

Run: `bun test tests/zod.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A packages/fault/src/zod packages/fault/src/utils packages/fault/tests/zod.test.ts
git commit -m "refactor: move zod helpers to /zod subpath, add fromZodError"
```

---

### Task 7: `/drizzle` subpath

**Files:**
- Move: `packages/fault/src/utils/safeDrizzle.ts` → `packages/fault/src/drizzle/index.ts`
- Create: `packages/fault/tests/drizzle.test.ts`

**Interfaces:**
- Produces:
  - `DatabaseError(cause: unknown): Fault` — unwraps drizzle `TransactionRollbackError` / `DrizzleQueryError` / `DrizzleError` / plain `Error`; if the inner cause is a `pg.DatabaseError`, delegates to `parsePgError`; otherwise `DATABASE_ERROR` with the original as cause.
  - `safeDb<T>(promise: Promise<T>): ResultAsync<T, Fault>`.

- [ ] **Step 1: Write failing test `tests/drizzle.test.ts`**

```ts
import { describe, expect, it } from 'bun:test'
import { DrizzleError, DrizzleQueryError, TransactionRollbackError } from 'drizzle-orm/errors'
import { DatabaseError as PgDatabaseError } from 'pg'
import { safeDb, DatabaseError } from '../src/drizzle'

const pgUnique = Object.assign(new PgDatabaseError('dup', 1, 'error'), { code: '23505', detail: 'Key (email)=(x) already exists.' })

describe('DatabaseError', () => {
  it('DrizzleQueryError wrapping pg error → parsed pg fault', () => {
    const f = DatabaseError(new DrizzleQueryError('select 1', [], pgUnique))
    expect(f.tag).toBe('UNIQUE_CONSTRAINT_ERROR')
  })
  it('TransactionRollbackError wrapping pg error → parsed pg fault', () => {
    const e = new TransactionRollbackError()
    ;(e as Error & { cause?: unknown }).cause = pgUnique
    expect(DatabaseError(e).tag).toBe('UNIQUE_CONSTRAINT_ERROR')
  })
  it('TransactionRollbackError without pg cause → DATABASE_ERROR with cause', () => {
    const e = new TransactionRollbackError()
    const f = DatabaseError(e)
    expect(f.tag).toBe('DATABASE_ERROR'); expect(f.cause).toBe(e)
  })
  it('DrizzleError → DATABASE_ERROR', () => {
    expect(DatabaseError(new DrizzleError({ message: 'x' })).tag).toBe('DATABASE_ERROR')
  })
  it('plain Error → DATABASE_ERROR with cause', () => {
    const e = new Error('conn')
    const f = DatabaseError(e)
    expect(f.tag).toBe('DATABASE_ERROR'); expect(f.cause).toBe(e)
  })
  it('non-Error → DATABASE_ERROR with String(cause) message', () => {
    expect(DatabaseError('weird').message).toBe('weird')
  })
})

describe('safeDb', () => {
  it('resolves Ok', async () => expect((await safeDb(Promise.resolve([1]))).._unsafeUnwrap()).toEqual([1]))
  it('maps rejection through DatabaseError', async () => {
    const r = await safeDb(Promise.reject(new DrizzleQueryError('q', [], pgUnique)))
    expect(r._unsafeUnwrapErr().tag).toBe('UNIQUE_CONSTRAINT_ERROR')
  })
})
```

(Fix the typo `..` → `.` in the `resolves Ok` test when writing the file.)

- [ ] **Step 2: Run, verify fails**

Run: `bun test tests/drizzle.test.ts` → FAIL.

- [ ] **Step 3: Move and implement**

```bash
mkdir -p src/drizzle && git mv src/utils/safeDrizzle.ts src/drizzle/index.ts
```

Replace the file body with:

```ts
import { DrizzleError, DrizzleQueryError, TransactionRollbackError } from 'drizzle-orm/errors'
import { DatabaseError as PgDatabaseError } from 'pg'
import { ResultAsync } from '../result-async.js'
import { Fault } from '../fault.js'
import { parsePgError } from '../pg/index.js'

const pgCauseOf = (e: unknown): PgDatabaseError | undefined => {
    const cause = (e as { cause?: unknown } | undefined)?.cause
    return cause instanceof PgDatabaseError ? cause : undefined
}

/** Map any drizzle/pg/unknown rejection into a Fault. */
export function DatabaseError(cause: unknown): Fault {
    const pg = pgCauseOf(cause)
    if (pg) return parsePgError(pg)

    const label =
        cause instanceof TransactionRollbackError ? 'Transaction rollback error'
        : cause instanceof DrizzleQueryError ? 'Drizzle query error'
        : cause instanceof DrizzleError ? 'Drizzle error'
        : cause instanceof Error ? 'Database error'
        : 'Unknown database error'

    const message = cause instanceof Error ? cause.message : String(cause)
    return new Fault(message).withTag('DATABASE_ERROR').withDescription(label, message).withCause(cause)
}

/** Wrap a drizzle query promise into ResultAsync<T, Fault>. */
export function safeDb<T>(dbPromise: Promise<T>): ResultAsync<T, Fault> {
    return ResultAsync.fromPromise(dbPromise, DatabaseError)
}
```

Note `pg` is now a runtime import here (for `instanceof`) — that's fine, `/drizzle` declares `pg` as a peer.

- [ ] **Step 4: Run, verify passes**

Run: `bun test tests/drizzle.test.ts` → PASS. If `DrizzleQueryError` constructor signature differs in the installed version, check `node_modules/drizzle-orm/errors.d.ts` and adjust the test's construction (not the implementation).

- [ ] **Step 5: Commit**

```bash
git add -A packages/fault/src/drizzle packages/fault/src/utils packages/fault/tests/drizzle.test.ts
git commit -m "refactor: move drizzle helpers to /drizzle subpath, preserve cause"
```

---

### Task 8: `/fetch` subpath with corrected tag mapping

**Files:**
- Move: `packages/fault/src/utils/safeFetch.ts` → `packages/fault/src/fetch/index.ts`
- Create: `packages/fault/tests/fetch.test.ts`

**Interfaces:**
- Produces: `safeFetch<T = unknown>(input: URL | string, init?: RequestInit): ResultAsync<T, Fault>`. Tags per spec table: throw→`NETWORK_ERROR`, 400→`BAD_REQUEST`, 401→`UNAUTHORIZED`, 403→`FORBIDDEN`, 404→`NOT_FOUND`, 429→`RATE_LIMITED`, other 4xx→`BAD_REQUEST`, 5xx→`INTERNAL_ERROR`, non-JSON body→`PARSE_ERROR`. Metadata `httpStatus`, `httpStatusText`, `httpHeaders`, `httpBody`.

- [ ] **Step 1: Write failing test `tests/fetch.test.ts`**

```ts
import { afterEach, describe, expect, it } from 'bun:test'
import { safeFetch } from '../src/fetch'

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

const stub = (status: number, body: string, headers: Record<string, string> = { 'content-type': 'application/json' }) => {
  globalThis.fetch = (async () => new Response(body, { status, headers })) as typeof fetch
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
    globalThis.fetch = (async () => { throw new TypeError('ECONNREFUSED') }) as typeof fetch
    const f = (await safeFetch('http://x'))._unsafeUnwrapErr()
    expect(f.tag).toBe('NETWORK_ERROR')
    expect(f.cause).toBeInstanceOf(TypeError)
  })
  it('PARSE_ERROR when 2xx body is not JSON', async () => {
    stub(200, 'not json', { 'content-type': 'text/plain' })
    expect((await safeFetch('http://x'))._unsafeUnwrapErr().tag).toBe('PARSE_ERROR')
  })
  it('error body that is not JSON is kept as text', async () => {
    stub(500, 'oops', { 'content-type': 'text/plain' })
    expect((await safeFetch('http://x'))._unsafeUnwrapErr().metadata.httpBody).toBe('oops')
  })
})
```

- [ ] **Step 2: Run, verify fails**

Run: `bun test tests/fetch.test.ts` → FAIL.

- [ ] **Step 3: Move and fix**

```bash
mkdir -p src/fetch && git mv src/utils/safeFetch.ts src/fetch/index.ts
```

Edit `src/fetch/index.ts`:
- Imports: `import { errAsync, ResultAsync } from '../result-async.js'`, `import { Fault, type FaultTag } from '../fault.js'`.
- Replace the status→tag block (old L143–151) with:

```ts
const tagForStatus = (status: number): FaultTag => {
    if (status === 400) return 'BAD_REQUEST'
    if (status === 401) return 'UNAUTHORIZED'
    if (status === 403) return 'FORBIDDEN'
    if (status === 404) return 'NOT_FOUND'
    if (status === 429) return 'RATE_LIMITED'
    if (status >= 500) return 'INTERNAL_ERROR'
    return 'BAD_REQUEST'
}
```

(hoist it to module scope; call `tagForStatus(response.status)` where `tag` was computed).
- In the network-error mapper, chain `.withCause(err)` onto the Fault.
- In the error-response branch: read body as text, try `JSON.parse`, on failure keep the raw text as `httpBody`.
- In the parse-error branch, chain `.withCause(err)`.

- [ ] **Step 4: Run, verify passes**

Run: `bun test tests/fetch.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A packages/fault/src/fetch packages/fault/src/utils packages/fault/tests/fetch.test.ts
git commit -m "refactor: move safeFetch to /fetch subpath, fix 4xx tag mapping"
```

---

### Task 9: `/std` subpath

**Files:**
- Create: `packages/fault/src/std/index.ts`
- Create: `packages/fault/tests/std.test.ts`

**Interfaces:**
- Produces:
  - `safeJsonParse<T = unknown>(text: string): Result<T, Fault>` — `PARSE_ERROR`.
  - `safeJsonStringify(value: unknown, space?: number): Result<string, Fault>` — `PARSE_ERROR`.
  - `safeReadFile(path: string, encoding?: BufferEncoding): ResultAsync<string, Fault>` — default `'utf8'`.
  - `safeWriteFile(path: string, data: string | Uint8Array): ResultAsync<void, Fault>`.
  - `safeEnv(name: string): Result<string, Fault>` — `CONFIGURATION_ERROR` when missing/empty.
  - fs tag mapping: `ENOENT`→`NOT_FOUND`, `EACCES`/`EPERM`→`FORBIDDEN`, else `INTERNAL_ERROR`; metadata `{ code, path }`.

- [ ] **Step 1: Write failing test `tests/std.test.ts`**

```ts
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, chmodSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { safeJsonParse, safeJsonStringify, safeReadFile, safeWriteFile, safeEnv } from '../src/std'

describe('safeJsonParse', () => {
  it('parses valid JSON', () => expect(safeJsonParse<{ a: number }>('{"a":1}')._unsafeUnwrap()).toEqual({ a: 1 }))
  it('PARSE_ERROR on invalid JSON with cause', () => {
    const f = safeJsonParse('{')._unsafeUnwrapErr()
    expect(f.tag).toBe('PARSE_ERROR'); expect(f.cause).toBeInstanceOf(SyntaxError)
  })
})

describe('safeJsonStringify', () => {
  it('stringifies', () => expect(safeJsonStringify({ a: 1 })._unsafeUnwrap()).toBe('{"a":1}'))
  it('PARSE_ERROR on cycles', () => {
    const o: Record<string, unknown> = {}; o.self = o
    expect(safeJsonStringify(o)._unsafeUnwrapErr().tag).toBe('PARSE_ERROR')
  })
  it('PARSE_ERROR on BigInt', () => expect(safeJsonStringify({ n: 1n })._unsafeUnwrapErr().tag).toBe('PARSE_ERROR'))
})

describe('fs helpers', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fault-std-'))
  afterEach(() => { try { chmodSync(join(dir, 'locked'), 0o644) } catch {} })

  it('write then read round-trips', async () => {
    const p = join(dir, 'a.txt')
    expect((await safeWriteFile(p, 'hi')).isOk()).toBe(true)
    expect((await safeReadFile(p))._unsafeUnwrap()).toBe('hi')
  })
  it('NOT_FOUND on missing file', async () => {
    const f = (await safeReadFile(join(dir, 'nope')))._unsafeUnwrapErr()
    expect(f.tag).toBe('NOT_FOUND'); expect(f.metadata.code).toBe('ENOENT'); expect(f.metadata.path).toBe(join(dir, 'nope'))
  })
  it('FORBIDDEN on unreadable file', async () => {
    const p = join(dir, 'locked'); writeFileSync(p, 'x'); chmodSync(p, 0o000)
    const r = await safeReadFile(p)
    if (process.getuid?.() === 0) return // root bypasses perms
    expect(r._unsafeUnwrapErr().tag).toBe('FORBIDDEN')
  })
  it('INTERNAL_ERROR on other errors (EISDIR)', async () => {
    expect((await safeReadFile(dir))._unsafeUnwrapErr().tag).toBe('INTERNAL_ERROR')
  })
  it('cleanup', () => rmSync(dir, { recursive: true, force: true }))
})

describe('safeEnv', () => {
  it('returns value when set', () => {
    process.env.FAULT_TEST_VAR = 'v'
    expect(safeEnv('FAULT_TEST_VAR')._unsafeUnwrap()).toBe('v')
  })
  it('CONFIGURATION_ERROR when missing', () => {
    delete process.env.FAULT_TEST_MISSING
    const f = safeEnv('FAULT_TEST_MISSING')._unsafeUnwrapErr()
    expect(f.tag).toBe('CONFIGURATION_ERROR'); expect(f.metadata.name).toBe('FAULT_TEST_MISSING')
  })
  it('CONFIGURATION_ERROR when empty', () => {
    process.env.FAULT_TEST_EMPTY = ''
    expect(safeEnv('FAULT_TEST_EMPTY').isErr()).toBe(true)
  })
})
```

- [ ] **Step 2: Run, verify fails**

Run: `bun test tests/std.test.ts` → FAIL.

- [ ] **Step 3: Implement `src/std/index.ts`**

```ts
import { readFile, writeFile } from 'node:fs/promises'
import { Result, ok, err } from '../result.js'
import { ResultAsync } from '../result-async.js'
import { Fault, type FaultTag } from '../fault.js'

const parseFault = (e: unknown, what: string) =>
    new Fault(e instanceof Error ? e : String(e)).withTag('PARSE_ERROR').withDetails(what).withCause(e)

export function safeJsonParse<T = unknown>(text: string): Result<T, Fault> {
    return Result.fromThrowable(() => JSON.parse(text) as T, (e) => parseFault(e, 'JSON.parse failed'))()
}

export function safeJsonStringify(value: unknown, space?: number): Result<string, Fault> {
    return Result.fromThrowable(
        () => {
            const s = JSON.stringify(value, null, space)
            if (s === undefined) throw new TypeError('value is not JSON serialisable')
            return s
        },
        (e) => parseFault(e, 'JSON.stringify failed'),
    )()
}

const FS_TAGS: Record<string, FaultTag> = { ENOENT: 'NOT_FOUND', EACCES: 'FORBIDDEN', EPERM: 'FORBIDDEN' }

const fsFault = (path: string) => (e: unknown): Fault => {
    const code = (e as { code?: string }).code ?? 'UNKNOWN'
    return new Fault(e instanceof Error ? e : String(e))
        .withTag(FS_TAGS[code] ?? 'INTERNAL_ERROR')
        .withMetadata({ code, path })
        .withCause(e)
}

export function safeReadFile(path: string, encoding: BufferEncoding = 'utf8'): ResultAsync<string, Fault> {
    return ResultAsync.fromPromise(readFile(path, { encoding }), fsFault(path))
}

export function safeWriteFile(path: string, data: string | Uint8Array): ResultAsync<void, Fault> {
    return ResultAsync.fromPromise(writeFile(path, data), fsFault(path))
}

export function safeEnv(name: string): Result<string, Fault> {
    const v = process.env[name]
    if (v === undefined || v === '') {
        return err(new Fault(`Missing environment variable ${name}`).withTag('CONFIGURATION_ERROR').withMetadata({ name }))
    }
    return ok(v)
}
```

If `Result.fromThrowable` is not a static on the `Result` namespace in the fork, use the top-level `fromThrowable` export from `../result.js` instead.

- [ ] **Step 4: Run, verify passes**

Run: `bun test tests/std.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/fault/src/std packages/fault/tests/std.test.ts
git commit -m "feat: add /std subpath — safe JSON, fs, env helpers"
```

---

### Task 10: Core entry, build, exports check

**Files:**
- Modify: `packages/fault/src/index.ts`
- Delete: `packages/fault/src/utils/` (should be empty)
- Modify: `packages/fault/CLAUDE.md`

**Interfaces:**
- Produces: `@itterno/fault` root exports exactly: everything currently re-exported from `./result.js` and `./result-async.js`, plus `Fault`, `ServiceError`, `type FaultTag`, `retry`, `type RetryOptions`. No integration exports.

- [ ] **Step 1: Rewrite `src/index.ts`**

Keep the existing `result` / `result-async` export lines (L20–28). Replace everything from L31 down with:

```ts
export { Fault, ServiceError, type FaultTag } from './fault.js'
export { retry, type RetryOptions } from './retry.js'
```

Ensure all relative imports in `src/**` use `.js` extensions (NodeNext requires it): `grep -rn "from '\./\|from '\.\./" src | grep -v "\.js'"` → fix any hits.

- [ ] **Step 2: Remove `src/utils`**

Run: `rmdir src/utils` (must be empty; if not, a move was missed — go back to that task).

- [ ] **Step 3: Full typecheck + tests**

Run: `bunx tsgo --noEmit -p tsconfig.json && bun test`
Expected: clean, all green. (`tests/tsconfig.tests.json` still fails on `examples/` — fixed in Task 11.)

- [ ] **Step 4: Build**

Run: `bun run build && ls dist`
Expected: `index.js index.d.ts fetch.js fetch.d.ts zod.js zod.d.ts drizzle.js drizzle.d.ts pg.js pg.d.ts std.js std.d.ts` (tsdown may also emit `.d.mts`/shared chunk files — fine as long as the twelve above exist; if it emits `.mjs` instead of `.js`, set `outExtensions: () => ({ js: '.js', dts: '.d.ts' })` in `tsdown.config.ts`).

- [ ] **Step 5: Verify root bundle has no external imports**

Run: `grep -n "^import" dist/index.js`
Expected: no lines importing `zod`, `pg`, or `drizzle-orm` (only `node:` builtins at most, ideally none).

- [ ] **Step 6: Exports check**

Run: `bun run check:exports`
Expected: no problems. If it complains about `types` ordering, ensure `"types"` is the first key in each `exports` entry (it is in Task 1's JSON).

- [ ] **Step 7: Tarball smoke test**

```bash
bun pm pack --destination /tmp
mkdir -p /tmp/fault-smoke && cd /tmp/fault-smoke && rm -rf * && echo '{"name":"smoke","type":"module"}' > package.json
bun add /tmp/itterno-fault-0.1.0.tgz
cat > smoke.mjs <<'EOF'
import { ok, Fault, retry } from '@itterno/fault'
import { safeFetch } from '@itterno/fault/fetch'
import { safeJsonParse } from '@itterno/fault/std'
console.log(ok(1).isOk(), new Fault('x').tag, typeof retry, typeof safeFetch, safeJsonParse('{}').isOk())
EOF
node smoke.mjs
cd -
```

Expected: `true UNKNOWN_ERROR function function true`. Note no `zod`/`pg`/`drizzle-orm` installed in `/tmp/fault-smoke`.

- [ ] **Step 8: Update `CLAUDE.md`**

Remove the line recommending `Bun.sql` over `pg`. Add under a `## Project` heading:

```
- Core (`src/index.ts`) must stay dependency-free. Integrations live in `src/<name>/index.ts` and import core relatively with `.js` extensions.
- `bun run local-ci` before committing.
```

- [ ] **Step 9: Commit**

```bash
git add -A packages/fault/src packages/fault/CLAUDE.md packages/fault/.gitignore
git commit -m "feat: core-only root entry, subpath build, exports verified"
```

(Make sure `dist/` is in `.gitignore`; add it if not.)

---

### Task 11: Docs and examples

**Files:**
- Modify: `examples/safeFetchExample.ts`
- Create: `examples/payment.ts`, `examples/createPost.ts`, `examples/tsconfig.json`
- Modify: `packages/fault/tests/tsconfig.tests.json`
- Rewrite: `packages/fault/README.md`, `README.md` (repo root)

**Interfaces:**
- Consumes: everything from Tasks 2–10 by package name via a `paths` alias.

- [ ] **Step 1: Create `examples/tsconfig.json`**

```json
{
  "extends": "../packages/fault/tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@itterno/fault": ["../packages/fault/src/index.ts"],
      "@itterno/fault/*": ["../packages/fault/src/*/index.ts"]
    },
    "types": ["bun-types"]
  },
  "include": ["./*.ts"]
}
```

Remove `"../../examples/*.ts"` from `packages/fault/tests/tsconfig.tests.json` `include` and change the `typecheck` script in `package.json` to:

`"typecheck": "tsgo --noEmit -p tsconfig.json && tsgo --noEmit -p tests/tsconfig.tests.json && tsgo --noEmit -p ../../examples/tsconfig.json"`

- [ ] **Step 2: Rewrite `examples/safeFetchExample.ts`**

```ts
import { safeFetch } from '@itterno/fault/fetch'
import { safeZodParse } from '@itterno/fault/zod'
import { z } from 'zod'

const userSchema = z.object({ name: z.string(), age: z.number().min(18) })

const result = await safeFetch('https://api.example.com/users/1').andThen(safeZodParse(userSchema))

result.match(
  (data) => console.log(data),
  (error) => console.error(error.toJSON()),
)
```

- [ ] **Step 3: Create `examples/payment.ts`**

Copy §7.1 of the spec verbatim, then add the minimal declarations it needs at the top so it typechecks without a real app:

```ts
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/node-postgres'

declare const Sentry: { captureException: (e: unknown, ctx?: unknown) => void }
declare const logger: { info: (msg: string, data?: unknown) => void }
declare const stripeKey: string
const hash = (s: string) => Bun.hash(s).toString(16)

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  stripeId: text('stripe_id').notNull(),
  paidAt: timestamp('paid_at'),
})
const db = drizzle(process.env.DATABASE_URL ?? '', { schema: { users } })
```

Then the spec's imports and `chargeUser` body unchanged. Remove `errAsync` from the import if unused.

- [ ] **Step 4: Create `examples/createPost.ts`**

Copy §7.2 verbatim, with the same style of declarations:

```ts
import { z } from 'zod'
import { pgTable, text, serial } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/node-postgres'

declare const logger: { warn: (msg: string, data?: unknown) => void }
declare const bucket: string
declare const webhookUrl: string
declare const s3: { send: (cmd: unknown) => Promise<{ $metadata: { requestId?: string } }> }
declare class PutObjectCommand { constructor(input: { Bucket: string; Key: string; Body: unknown }) }
const hash = (s: string) => Bun.hash(s).toString(16)

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  authorId: text('author_id').notNull(),
  text: text('text').notNull(),
  imageKey: text('image_key').notNull(),
})
const db = drizzle(process.env.DATABASE_URL ?? '', { schema: { posts } })
```

Remove `ok`, `err`, `errAsync` from the spec's import if unused.

- [ ] **Step 5: Typecheck examples**

Run: `cd packages/fault && bun run typecheck`
Expected: clean. Any error inside `chargeUser`/`createPost` is either a plan bug (fix the example to match the real API and note it in the commit message) or a real API gap — if the latter, stop and report rather than hacking the example.

- [ ] **Step 6: Rewrite `packages/fault/README.md`**

```markdown
# @itterno/fault

Result types with rich `Fault` errors, built for error tracing. Inspired by [neverthrow](https://github.com/supermacro/neverthrow).

- `Result<T, Fault>` everywhere — no `unknown` errors.
- `Fault` carries tag, details, location, metadata and `cause`; `toJSON()` for your logger.
- `Fault.onCapture` — one hook to send every failure to Sentry / OTel.
- Integrations as subpaths with optional peers: `/fetch`, `/zod`, `/drizzle`, `/pg`, `/std`.

## Install

    bun add @itterno/fault          # or npm i
    bun add zod                     # only if you use @itterno/fault/zod
    bun add drizzle-orm pg          # only if you use @itterno/fault/drizzle

## Core

    import { ok, err, ResultAsync, Fault, ServiceError, retry } from '@itterno/fault'

    Fault.onCapture = (f) => Sentry.captureException(f, { extra: f.toJSON() })

    const r = ok(1)
      .andInspect((v) => log(v))        // side effect on Ok, value passes through
      .orInspect((e) => e.capture())    // side effect on Err, error passes through
      .andCheck((v) => validate(v))     // run a Result; its Err fails the chain, its Ok is discarded

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

    bun install
    bun run local-ci   # typecheck, test, build, exports check
```

(Use fenced code blocks in the real file; indented here to avoid nesting.)

- [ ] **Step 7: Rewrite root `README.md`**

```markdown
# fault

Monorepo for [`@itterno/fault`](packages/fault) — Result types with rich, traceable `Fault` errors.

- `packages/fault` — the library
- `examples/` — usage examples (`payment.ts`, `createPost.ts`); `examples/neverthrow` and `examples/effect` are vendored reference repos
```

- [ ] **Step 8: Full local CI**

Run: `cd packages/fault && bun run local-ci`
Expected: all four stages green.

- [ ] **Step 9: Commit**

```bash
git add examples packages/fault/README.md packages/fault/package.json packages/fault/tests/tsconfig.tests.json README.md
git commit -m "docs: README, examples for payment and post creation flows"
```

---

## Self-review

- **Spec coverage:** §1 layout → T1, T5–T10. §2 core → T3. §2b renames → T2; `retry` → T4. §3 tooling → T1, T10. §4 fetch/zod/pg/drizzle/std → T8/T6/T5/T7/T9. §5 tests → each task + `combinators.test.ts` (T2), `retry.test.ts` (T4). §6 docs → T10 (CLAUDE.md), T11. §7 examples → T11. Acceptance → T10 steps 4–7, T11 step 8, T2 grep.
- **Type consistency:** `withMetadata(object)` overload defined T3, used T6/T9/T11. `withCause` defined T3, used T5–T9. `tagForStatus` local to T8. `FaultTag` additions in T3 cover every tag used in T5 (`UNIQUE_CONSTRAINT_ERROR`, `FOREIGN_KEY_ERROR`, `CONNECTION_ERROR`, `TRANSACTION_ROLLBACK_ERROR`), T8 (`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMITED`), T9 (`CONFIGURATION_ERROR`), T11 (`CONFLICT`, `PAYMENT_FAILED`, `EXTERNAL_ERROR`). Spec example uses `withMetadata({ intentId })` object form — supported.
- **Known deviation from spec:** spec's example `retry` predicate checks `f.tag === "DATABASE_ERROR"` for "connection-ish" failures; with the pg parser the connection tag is `CONNECTION_ERROR`. T11 may adjust the example predicate to `f.tag === 'CONNECTION_ERROR' || f.tag === 'DATABASE_ERROR'` — note it in the commit.
