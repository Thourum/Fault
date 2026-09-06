import { Logo } from './Logo'

export const GITHUB_URL = 'https://github.com/Thourum/Fault'
export const NPM_URL = 'https://www.npmjs.com/package/@thourum/fault'

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center gap-5 px-6 text-sm">
        <a href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <Logo /> fault
        </a>
        <a href={NPM_URL} className="font-mono text-xs text-muted hover:text-fg">
          v{__FAULT_VERSION__}
        </a>
        <div className="ml-auto flex items-center gap-6">
          <a href="/docs/" className="text-fg underline decoration-line underline-offset-4 hover:decoration-fg">Docs</a>
          <a href={GITHUB_URL} className="text-fg underline decoration-line underline-offset-4 hover:decoration-fg">GitHub</a>
        </div>
      </nav>
    </header>
  )
}
