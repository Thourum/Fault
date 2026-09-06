const POINTS = [
  {
    title: 'No unknown in catch',
    body: 'Every failure is a Fault. Narrow by tag, not by instanceof roulette, and the type system knows what can fail.',
  },
  {
    title: 'and* runs on Ok, or* on Err',
    body: 'andThen, andCheck, andInspect on the success path; orElse, orInspect on the failure path. One rule reads any chain.',
  },
  {
    title: 'One hook to observability',
    body: 'Set Fault.onCapture once, call .capture() anywhere. toJSON() is exactly what your logger sees.',
  },
] as const

export function WhyResult() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <dl className="grid gap-x-10 gap-y-12 md:grid-cols-3">
        {POINTS.map((p) => (
          <div key={p.title} className="border-t border-fg pt-5">
            <dt className="text-xl font-medium tracking-tight">{p.title}</dt>
            <dd className="mt-3 max-w-[38ch] leading-relaxed text-muted">{p.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
