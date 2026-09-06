import { useEffect, useRef, useState } from 'react'
import { SECTIONS } from './sections'

export function Sidebar() {
  const [active, setActive] = useState<string>(SECTIONS[0].slug)
  const intersecting = useRef(new Set<string>())

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.slug)).filter((e): e is HTMLElement => !!e)
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) intersecting.current.add(entry.target.id)
          else intersecting.current.delete(entry.target.id)
        })
        const next = SECTIONS.find((section) => intersecting.current.has(section.slug))
        if (next) setActive(next.slug)
      },
      { rootMargin: '-15% 0px -70% 0px' },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [])

  const list = (
    <ul className="space-y-1 text-sm">
      {SECTIONS.map((s) => (
        <li key={s.slug}>
          <a
            href={`#${s.slug}`}
            aria-current={active === s.slug ? 'location' : undefined}
            className={[
              'block rounded px-2 py-1 font-mono',
              active === s.slug ? 'bg-surface text-fg' : 'text-muted hover:text-fg',
            ].join(' ')}
          >
            {s.title}
          </a>
        </li>
      ))}
    </ul>
  )

  return (
    <>
      <details className="mb-6 lg:hidden">
        <summary className="cursor-pointer text-sm text-muted">Sections</summary>
        <div className="mt-2">{list}</div>
      </details>
      <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto lg:block">{list}</aside>
    </>
  )
}
