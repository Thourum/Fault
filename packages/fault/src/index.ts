/**
 * @thourum/fault - Production-ready error handling for Node.js and TypeScript
 *
 * Result types (from neverthrow) plus a Fault error class with rich context.
 * Root exports are core-only. Integrations live on subpaths:
 * `@thourum/fault/fetch`, `/zod`, `/drizzle`, `/pg`, `/std`.
 *
 * @example Quick start
 * import { ok, err, Result, Fault } from '@thourum/fault'
 *
 * function greet(name: string): Result<string, Fault> {
 *   if (!name) return err(new Fault('name required').withTag('VALIDATION_ERROR'))
 *   return ok(`hello ${name}`)
 * }
 *
 * @packageDocumentation
 */

// Re-export neverthrow Result types
export { Result, ok, Ok, err, Err, fromThrowable, safeTry } from './result';
export {
  ResultAsync,
  okAsync,
  errAsync,
  fromAsyncThrowable,
  fromPromise,
  fromSafePromise,
} from './result-async';

// Export Fault and related utilities
export { Fault, ServiceError, type FaultTag } from './fault';
export { retry, type RetryOptions } from './retry';
