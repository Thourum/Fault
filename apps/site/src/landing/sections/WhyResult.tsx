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
    <section className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-3">
      {POINTS.map((p) => (
        <div key={p.title}>
          <h3 className="font-mono text-base text-fg">{p.title}</h3>
          <p className="mt-3 text-sm leading-6 text-muted">{p.body}</p>
        </div>
      ))}
    </section>
  )
}
