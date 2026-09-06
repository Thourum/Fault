import HeroChain from '../snippets/hero-chain.mdx'
import { mdxComponents } from '../../shared/mdx-components'
import { CopyButton } from '../../shared/CopyButton'
import { GITHUB_URL } from '../../shared/Nav'

const INSTALL = 'bun add @thourum/fault'

export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-6 pt-20 pb-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
      <div>
        <p className="font-mono text-sm text-accent">Result&lt;T, Fault&gt;</p>
        <h1 className="mt-4 max-w-xl text-5xl font-semibold leading-[1.05] tracking-tight">
          Errors that know where, why, and with what data.
        </h1>
        <p className="mt-5 max-w-lg text-lg text-muted">
          Result types for TypeScript with a <code className="font-mono text-fg">Fault</code> that carries tag,
          details, location, metadata and cause, and serialises for Sentry and OTel.
        </p>
        <div className="mt-8 flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 font-mono text-sm">
          <span className="text-muted">$</span>
          <span>{INSTALL}</span>
          <span className="ml-auto">
            <CopyButton getText={() => INSTALL} />
          </span>
        </div>
        <div className="mt-6 flex gap-3">
          <a href="/docs/" className="rounded-md bg-fg px-4 py-2 text-sm font-medium text-bg">
            Read the docs
          </a>
          <a href={GITHUB_URL} className="rounded-md border border-line px-4 py-2 text-sm text-muted hover:text-fg">
            GitHub
          </a>
        </div>
      </div>
      <HeroChain components={mdxComponents} />
    </section>
  )
}
