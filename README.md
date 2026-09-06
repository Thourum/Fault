<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/header/grid.svg?title=fault&subtitle=Result+types+with+rich%2C+traceable+errors&logo=typescript&mode=dark" />
    <img alt="fault" src="https://shieldcn.dev/header/grid.svg?title=fault&subtitle=Result+types+with+rich%2C+traceable+errors&logo=typescript&mode=light" />
  </picture>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@thourum/fault"><img alt="npm version" src="https://shieldcn.dev/npm/v/@thourum/fault.svg?variant=secondary" /></a>
  <a href="https://www.npmjs.com/package/@thourum/fault"><img alt="types" src="https://shieldcn.dev/npm/types/@thourum/fault.svg?variant=secondary" /></a>
  <a href="https://github.com/Thourum/Fault/blob/main/LICENSE"><img alt="license" src="https://shieldcn.dev/badge/license-MIT-blue.svg?variant=secondary" /></a>
  <a href="https://bun.sh"><img alt="bun" src="https://shieldcn.dev/badge/runtime-bun-000.svg?variant=secondary&logo=bun" /></a>
</p>

Docs and site: https://fault.itterno.dev (source in [`apps/site`](apps/site)).

`Result<T, Fault>` everywhere. A `Fault` carries tag, details, location, metadata and `cause`, and serialises with `toJSON()` — built so failures reach Sentry/OTel with *where*, *why* and *what data*. Inspired by [neverthrow](https://github.com/supermacro/neverthrow).

```sh
npm add @thourum/fault
```

```ts
import { ok, err, retry, Fault, ServiceError } from '@thourum/fault'
import { safeFetch } from '@thourum/fault/fetch'
import { safeZodParse } from '@thourum/fault/zod'

Fault.onCapture = (f) => Sentry.captureException(f, { extra: f.toJSON() })

const user = await retry(() => safeFetch('https://api.example.com/me'), { times: 3, delayMs: 200 })
  .andThen(safeZodParse(userSchema))
  .andThen((u) => (u.active ? ok(u) : err(ServiceError('FORBIDDEN', 'inactive'))))
  .orInspect((f) => f.capture())
```

| Subpath | Exports |
|---|---|
| `@thourum/fault` | `Result`, `ResultAsync`, `ok`, `err`, `Fault`, `ServiceError`, `retry`, … |
| `@thourum/fault/fetch` | `safeFetch` |
| `@thourum/fault/zod` | `safeZodParse`, `fromZodError` |
| `@thourum/fault/drizzle` | `safeDb`, `DatabaseError` |
| `@thourum/fault/pg` | `parsePgError` |
| `@thourum/fault/std` | `safeJsonParse`, `safeJsonStringify`, `safeReadFile`, `safeWriteFile`, `safeEnv` |

Zero runtime dependencies; `zod`, `drizzle-orm`, `pg` are optional peers. See [`packages/fault`](packages/fault) and [`examples/`](examples).

## Develop

```sh
cd packages/fault && bun install && bun run local-ci
```

MIT
