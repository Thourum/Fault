import { useState, type ReactNode } from 'react'
import './landing.css'

const GITHUB_URL = 'https://github.com/Thourum/Fault'

export function Hero({ children }: { children: ReactNode }) {
  return (
    <section className="ld ld-hero">
      <h1 className="ld-h1">Errors that know where, why, and with what data.</h1>
      <div className="ld-hero-grid">
        <div>
          <p className="ld-lead">
            Result types for TypeScript. Every failure is a <code>Fault</code> carrying tag, details, location,
            metadata and cause, and it serialises straight into Sentry or OTel.
          </p>
          {Array.isArray(children) ? children[0] : children}
          <div className="ld-actions">
            <a href="/getting-started" className="ld-btn ld-btn-primary">Read the docs</a>
            <a href={GITHUB_URL} className="ld-btn">GitHub</a>
          </div>
        </div>
        {Array.isArray(children) ? children.slice(1) : null}
      </div>
    </section>
  )
}

const RESET_MS = 1500

export function Install({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), RESET_MS)
    } catch {
      // clipboard denied — nothing visible happens
    }
  }
  return (
    <div className="ld-install">
      <span aria-hidden className="ld-muted">$</span>
      <span>{command}</span>
      <button type="button" onClick={copy} aria-live="polite" aria-label={copied ? 'Copied' : 'Copy command'} className="ld-copy">
        {copied ? 'copied' : 'copy'}
      </button>
    </div>
  )
}

// A rail beside the code block colouring each line by the Result branch it runs on:
// `and*` steps run on Ok, `or*` steps on Err. Line numbers are 1-based.
export function Rail({ ok, err, lines, children }: { ok: number[]; err: number[]; lines: number; children: ReactNode }) {
  return (
    <figure className="ld-rail-wrap">
      <ol aria-hidden className="ld-rail">
        {Array.from({ length: lines }, (_, i) => i + 1).map((n) => {
          const tone = ok.includes(n) ? 'ok' : err.includes(n) ? 'err' : ''
          return (
            <li key={n} className="ld-rail-line">
              <span className={['ld-tick', tone && `ld-tick-${tone}`].filter(Boolean).join(' ')} />
            </li>
          )
        })}
      </ol>
      <div className="ld-code">{children}</div>
      <figcaption className="ld-legend">
        <span><i className="ld-tick ld-tick-ok" /> runs when Ok</span>
        <span><i className="ld-tick ld-tick-err" /> runs when Err</span>
      </figcaption>
    </figure>
  )
}

// Each row: what you call on the left, which toJSON() key it lands in on the right.
const LINKS = [
  ['withTag', 'tag, statusCode'],
  ['withDetails', 'details'],
  ['withMetadata', 'metadata'],
  ['withCause', 'cause'],
] as const

export function Trace({ children }: { children: ReactNode }) {
  const [build, json] = Array.isArray(children) ? children : [children, null]
  return (
    <section className="ld ld-band">
      <div className="ld-inner">
        <div className="ld-split">
          <h2 className="ld-h2">One object. The whole story.</h2>
          <p className="ld-lead">
            Build the failure once. <code>toJSON()</code> is what Sentry, OTel and your logger receive.{' '}
            <code>location</code> is filled in for you.
          </p>
        </div>
        <div className="ld-trace">
          <div className="ld-code">
            <p className="ld-caption">What you write</p>
            {build}
          </div>
          <ul className="ld-links" aria-hidden>
            {LINKS.map(([from, to]) => (
              <li key={from}>
                <span className="ld-err">.{from}</span>
                <span className="ld-link-line" />
                <span className="ld-muted">{to}</span>
              </li>
            ))}
          </ul>
          <div className="ld-code">
            <p className="ld-caption">What your logger gets</p>
            {json}
          </div>
        </div>
      </div>
    </section>
  )
}

const POINTS = [
  ['No unknown in catch', 'Every failure is a Fault. Narrow by tag, not by instanceof roulette, and the type system knows what can fail.'],
  ['and* runs on Ok, or* on Err', 'andThen, andCheck, andInspect on the success path; orElse, orInspect on the failure path. One rule reads any chain.'],
  ['One hook to observability', 'Set Fault.onCapture once, call .capture() anywhere. toJSON() is exactly what your logger sees.'],
] as const

export function Why() {
  return (
    <section className="ld">
      <dl className="ld-why">
        {POINTS.map(([title, body]) => (
          <div key={title}>
            <dt>{title}</dt>
            <dd>{body}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

const ROWS = [
  ['@thourum/fault', 'Result, ResultAsync, ok, err, Fault, ServiceError, retry', '', '/core/result'],
  ['@thourum/fault/fetch', 'safeFetch', '', '/integrations/fetch'],
  ['@thourum/fault/zod', 'safeZodParse, fromZodError', 'zod', '/integrations/zod'],
  ['@thourum/fault/drizzle', 'safeDb, DatabaseError', 'drizzle-orm, pg', '/integrations/drizzle-pg'],
  ['@thourum/fault/pg', 'parsePgError, isPostgresError', 'pg', '/integrations/drizzle-pg'],
  ['@thourum/fault/std', 'safeJsonParse, safeJsonStringify, safeReadFile, safeWriteFile, safeEnv', '', '/integrations/std'],
] as const

export function Subpaths() {
  return (
    <section className="ld ld-last">
      <div className="ld-split">
        <h2 className="ld-h2">Zero dependencies. Integrations on subpaths.</h2>
        <p className="ld-lead">
          The core has no runtime dependencies. Each integration lives on its own import path and only asks for the peer
          it wraps.
        </p>
      </div>
      <table className="ld-table">
        <thead>
          <tr><th>Import</th><th>Exports</th><th>Peer</th></tr>
        </thead>
        <tbody>
          {ROWS.map(([path, exports, peer, href]) => (
            <tr key={path}>
              <td><a href={href}><code>{path}</code></a></td>
              <td className="ld-muted">{exports}</td>
              <td><code className="ld-muted">{peer || 'none'}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
