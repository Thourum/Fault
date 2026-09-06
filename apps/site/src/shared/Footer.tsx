import { GITHUB_URL, NPM_URL } from './Nav'

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-8 text-sm text-muted">
        <span>MIT License</span>
        <a href={GITHUB_URL} className="hover:text-fg">GitHub</a>
        <a href={NPM_URL} className="hover:text-fg">npm</a>
        <span className="ml-auto">
          Inspired by <a href="https://github.com/supermacro/neverthrow" className="hover:text-fg">neverthrow</a>
        </span>
      </div>
    </footer>
  )
}
