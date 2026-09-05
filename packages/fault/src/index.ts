/**
 * @itterno/fault - Production-ready error handling for Node.js and TypeScript
 *
 * A comprehensive error handling library that combines Result types (from neverthrow)
 * with a powerful Fault error class that provides rich context preservation.
 *
 * @example Quick start
 * import { ok, err, Result } from '@itterno/fault'
 * import { Fault } from '@itterno/fault'
 * import { safeFetch, safeZodParse, safeDb } from '@itterno/fault'
 *
 * function validateUser(data: unknown): Result<User, Fault> {
 *   return safeZodParse(userSchema, data)
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
