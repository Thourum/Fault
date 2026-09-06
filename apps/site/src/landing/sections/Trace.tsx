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
    <section className="border-y border-line bg-surface/60">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-16">
          <h2 className="text-4xl font-semibold leading-none tracking-tight">One object. The whole story.</h2>
          <p className="max-w-[52ch] text-lg leading-relaxed text-muted">
            Build the failure once. <code className="font-mono text-[0.9em] text-fg">toJSON()</code> is what Sentry,
            OTel and your logger receive. <code className="font-mono text-[0.9em] text-fg">location</code> is filled
            in for you.
          </p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-[1fr_auto_1.2fr] lg:gap-6">
          <div className="min-w-0">
            <p className="mb-3 text-sm text-muted">What you write</p>
            <TraceBuild components={mdxComponents} />
          </div>

          <ul className="hidden self-center lg:block" aria-hidden>
            {LINKS.map(([from, to]) => (
              <li key={from} className="flex items-center gap-3 py-2.5 font-mono text-xs">
                <span className="text-err">.{from}</span>
                <span className="h-px w-12 bg-err/50" />
                <span className="text-muted">{to}</span>
              </li>
            ))}
          </ul>

          <div className="min-w-0">
            <p className="mb-3 text-sm text-muted">What your logger gets</p>
            <TraceJson components={mdxComponents} />
          </div>
        </div>
      </div>
    </section>
  )
}
