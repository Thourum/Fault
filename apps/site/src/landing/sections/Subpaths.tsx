const ROWS = [
  ['@thourum/fault', 'Result, ResultAsync, ok, err, Fault, ServiceError, retry', '', '/docs/#result'],
  ['@thourum/fault/fetch', 'safeFetch', '', '/docs/#fetch'],
  ['@thourum/fault/zod', 'safeZodParse, fromZodError', 'zod', '/docs/#zod'],
  ['@thourum/fault/drizzle', 'safeDb, DatabaseError', 'drizzle-orm, pg', '/docs/#drizzle-pg'],
  ['@thourum/fault/pg', 'parsePgError, isPostgresError', 'pg', '/docs/#drizzle-pg'],
  ['@thourum/fault/std', 'safeJsonParse, safeJsonStringify, safeReadFile, safeWriteFile, safeEnv', '', '/docs/#std'],
] as const

export function Subpaths() {
  return (
    <section className="mx-auto max-w-6xl overflow-x-auto px-6 pb-28">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-16">
        <h2 className="text-4xl font-semibold leading-none tracking-tight">Zero dependencies. Integrations on subpaths.</h2>
        <p className="max-w-[52ch] text-lg leading-relaxed text-muted">
          The core has no runtime dependencies. Each integration lives on its own import path and only asks for the
          peer it wraps.
        </p>
      </div>
      <table className="mt-12 w-full text-sm">
        <thead>
          <tr className="border-b border-fg text-left">
            <th className="py-2 pr-4 font-medium">Import</th>
            <th className="py-2 pr-4 font-medium">Exports</th>
            <th className="py-2 font-medium">Peer</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([path, exports, peer, href]) => (
            <tr key={path} className="border-b border-line">
              <td className="py-3 pr-4 font-mono whitespace-nowrap">
                <a href={href} className="text-fg underline decoration-line underline-offset-4 hover:decoration-fg">{path}</a>
              </td>
              <td className="py-3 pr-4 text-muted">{exports}</td>
              <td className="py-3 font-mono text-muted">{peer || <span className="text-line">none</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
