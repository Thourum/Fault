import GettingStarted from '../content/getting-started.mdx'
import Result from '../content/result.mdx'
import ResultAsync from '../content/result-async.mdx'
import Fault from '../content/fault.mdx'
import Retry from '../content/retry.mdx'
import Fetch from '../content/fetch.mdx'
import Zod from '../content/zod.mdx'
import DrizzlePg from '../content/drizzle-pg.mdx'
import Std from '../content/std.mdx'
import ErrorTracing from '../content/error-tracing.mdx'
import Integrations from '../content/integrations.mdx'
import Agents from '../content/agents.mdx'

export const SECTIONS = [
  { slug: 'getting-started', title: 'Getting started', Component: GettingStarted },
  { slug: 'result', title: 'Result', Component: Result },
  { slug: 'result-async', title: 'ResultAsync', Component: ResultAsync },
  { slug: 'fault', title: 'Fault', Component: Fault },
  { slug: 'retry', title: 'retry', Component: Retry },
  { slug: 'fetch', title: '/fetch', Component: Fetch },
  { slug: 'zod', title: '/zod', Component: Zod },
  { slug: 'drizzle-pg', title: '/drizzle & /pg', Component: DrizzlePg },
  { slug: 'std', title: '/std', Component: Std },
  { slug: 'error-tracing', title: 'Error tracing', Component: ErrorTracing },
  { slug: 'integrations', title: 'Integrations', Component: Integrations },
  { slug: 'agents', title: 'For AI agents', Component: Agents },
] as const
