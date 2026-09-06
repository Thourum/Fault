const ROWS = [
  ['@thourum/fault', 'Result, ResultAsync, ok, err, Fault, ServiceError, retry', '—', '/docs/#result'],
  ['@thourum/fault/fetch', 'safeFetch', '—', '/docs/#fetch'],
  ['@thourum/fault/zod', 'safeZodParse, fromZodError', 'zod', '/docs/#zod'],
  ['@thourum/fault/drizzle', 'safeDb, DatabaseError', 'drizzle-orm, pg', '/docs/#drizzle-pg'],
  ['@thourum/fault/pg', 'parsePgError, isPostgresError', 'pg', '/docs/#drizzle-pg'],
  ['@thourum/fault/std', 'safeJsonParse, safeJsonStringify, safeReadFile, safeWriteFile, safeEnv', '—', '/docs/#std'],
] as const

export function Subpaths() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <h2 className="text-2xl font-semibold tracking-tight">Zero dependencies. Integrations on subpaths.</h2>
      <p className="mt-2 max-w-xl text-muted">Install only the peers you use.</p>
      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-muted">
            <th className="py-2 font-medium">Import</th>
            <th className="py-2 font-medium">Exports</th>
            <th className="py-2 font-medium">Peer</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([path, exports, peer, href]) => (
            <tr key={path} className="border-b border-line/60 hover:bg-surface">
              <td className="py-3 pr-4 font-mono">
                <a href={href} className="text-fg hover:text-accent">{path}</a>
              </td>
              <td className="py-3 pr-4 text-muted">{exports}</td>
              <td className="py-3 font-mono text-muted">{peer}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
