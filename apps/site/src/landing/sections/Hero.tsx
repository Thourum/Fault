import HeroChain from '../snippets/hero-chain.mdx'
import { mdxComponents } from '../../shared/mdx-components'
import { CopyButton } from '../../shared/CopyButton'
import { GITHUB_URL } from '../../shared/Nav'

const INSTALL = 'bun add @thourum/fault'

// 1-based line numbers in hero-chain.mdx. `and*` steps run on Ok, `or*` on Err;
// the rail beside the code colours each line by the branch it runs on.
const OK_LINES = [9, 10]
const ERR_LINES = [11]
const LINE_COUNT = 11

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-24 pb-20">
      <h1 className="max-w-3xl text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[0.98] tracking-[-0.03em]">
        Errors that know where, why, and with what data.
      </h1>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-16">
        <div>
          <p className="text-lg leading-relaxed text-muted">
            Result types for TypeScript. Every failure is a{' '}
            <code className="font-mono text-[0.9em] text-fg">Fault</code> carrying tag, details, location,
            metadata and cause, and it serialises straight into Sentry or OTel.
          </p>
          <div className="mt-8 flex items-center gap-3 border border-fg bg-surface px-4 py-3 font-mono text-sm">
            <span className="text-muted" aria-hidden>$</span>
            <span>{INSTALL}</span>
            <span className="ml-auto">
              <CopyButton getText={() => INSTALL} />
            </span>
          </div>
          <div className="mt-4 flex gap-3">
            <a href="/docs/" className="bg-fg px-4 py-2 text-sm font-medium text-bg hover:bg-fg/85">
              Read the docs
            </a>
            <a href={GITHUB_URL} className="border border-line px-4 py-2 text-sm text-fg hover:border-fg">
              GitHub
            </a>
          </div>
        </div>

        <figure className="relative min-w-0 lg:pl-8">
          <ol
            aria-hidden
            className="absolute top-0 left-0 hidden h-full w-8 lg:block"
            style={{ paddingBlock: 'var(--code-pad)' }}
          >
            {Array.from({ length: LINE_COUNT }, (_, i) => i + 1).map((n) => {
              const tone = OK_LINES.includes(n) ? 'bg-ok' : ERR_LINES.includes(n) ? 'bg-err' : 'bg-line'
              const wide = OK_LINES.includes(n) || ERR_LINES.includes(n)
              return (
                <li key={n} className="flex items-center" style={{ height: 'var(--code-lh)' }}>
                  <span className={[wide ? 'h-0.5 w-6' : 'h-px w-2', tone].join(' ')} />
                </li>
              )
            })}
          </ol>
          <HeroChain components={mdxComponents} />
          <figcaption className="mt-3 flex gap-6 text-sm text-muted">
            <span className="flex items-center gap-2">
              <span className="h-0.5 w-6 bg-ok" aria-hidden /> runs when Ok
            </span>
            <span className="flex items-center gap-2">
              <span className="h-0.5 w-6 bg-err" aria-hidden /> runs when Err
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
