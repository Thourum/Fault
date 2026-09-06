import { Nav } from '../shared/Nav'
import { Footer } from '../shared/Footer'
import { Hero } from './sections/Hero'
import { Trace } from './sections/Trace'
import { WhyResult } from './sections/WhyResult'
import { Subpaths } from './sections/Subpaths'

export function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Trace />
        <WhyResult />
        <Subpaths />
      </main>
      <Footer />
    </>
  )
}
