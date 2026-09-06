import { MDXProvider } from '@mdx-js/react'
import { Nav } from '../shared/Nav'
import { Footer } from '../shared/Footer'
import { mdxComponents } from '../shared/mdx-components'
import { Sidebar } from './Sidebar'
import { SECTIONS } from './sections'

export function App() {
  return (
    <>
      <Nav />
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[14rem_1fr]">
        <Sidebar />
        <MDXProvider components={mdxComponents}>
          <main className="prose min-w-0 max-w-3xl">
            {SECTIONS.map(({ slug, Component }) => (
              <section key={slug} id={slug} className="scroll-mt-24">
                <Component />
              </section>
            ))}
          </main>
        </MDXProvider>
      </div>
      <Footer />
    </>
  )
}
