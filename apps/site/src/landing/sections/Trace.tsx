import TraceBuild from '../snippets/trace-build.mdx'
import TraceJson from '../snippets/trace-json.mdx'
import { mdxComponents } from '../../shared/mdx-components'

// Each row: what you call on the left, which key it lands in on the right.
const LINKS = [
  ['withTag', 'tag, statusCode'],
  ['withDetails', 'details'],
  ['withMetadata', 'metadata'],
  ['withCause', 'cause'],
] as const

export function Trace() {
  return (
    <section className="border-y border-line bg-surface/40">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight">One object. The whole story.</h2>
        <p className="mt-3 max-w-xl text-muted">
          Build the failure once. <code className="font-mono text-fg">toJSON()</code> is what Sentry, OTel and your
          logger receive, and <code className="font-mono text-fg">location</code> is filled in for you.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_auto_1.2fr] lg:items-start">
          <div>
            <p className="mb-2 font-mono text-xs text-muted">what you write</p>
            <TraceBuild components={mdxComponents} />
          </div>

          <ul className="hidden self-center lg:block" aria-hidden>
            {LINKS.map(([from, to]) => (
              <li key={from} className="flex items-center gap-2 py-2 font-mono text-xs">
                <span className="text-accent">.{from}</span>
                <span className="h-px w-10 bg-line" />
                <span className="text-muted">{to}</span>
              </li>
            ))}
          </ul>

          <div>
            <p className="mb-2 font-mono text-xs text-muted">what your logger gets</p>
            <TraceJson components={mdxComponents} />
          </div>
        </div>
      </div>
    </section>
  )
}
