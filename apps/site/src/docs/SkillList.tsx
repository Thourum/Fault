import type { ComponentProps } from 'react'
import { MDXProvider } from '@mdx-js/react'
import ErrorHandling from '../../../../skills/fault-error-handling/SKILL.md'
import FromTryCatch from '../../../../skills/fault-from-try-catch/SKILL.md'
import FromNeverthrow from '../../../../skills/fault-from-neverthrow/SKILL.md'
import { mdxComponents } from '../shared/mdx-components'

const SKILLS = [
  { slug: 'fault-error-handling', Component: ErrorHandling },
  { slug: 'fault-from-try-catch', Component: FromTryCatch },
  { slug: 'fault-from-neverthrow', Component: FromNeverthrow },
] as const

// Skill files are standalone documents (h1 + h2). Demote two levels so they
// nest under the "For AI agents" h2 without changing the source files.
const demoted = {
  ...mdxComponents,
  h1: (p: ComponentProps<'h3'>) => <h3 {...p} />,
  h2: (p: ComponentProps<'h4'>) => <h4 {...p} />,
  h3: (p: ComponentProps<'h5'>) => <h5 {...p} />,
}

export function SkillList() {
  return (
    <MDXProvider components={demoted}>
      {SKILLS.map(({ slug, Component }) => (
        <article key={slug} id={slug} className="mt-16 border-t border-fg pt-2 scroll-mt-24">
          <p className="font-mono text-xs text-muted">skills/{slug}/SKILL.md</p>
          <Component />
        </article>
      ))}
    </MDXProvider>
  )
}
