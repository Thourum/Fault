import { ResultAsync } from '../result-async';
import { DatabaseError } from '../fault';
import type { Fault } from '../fault';

/**
 * Safely execute a Drizzle database operation
 *
 * Wraps any Drizzle query (insert, select, update, delete, etc.) in a ResultAsync type,
 * providing type-safe error handling without try/catch blocks.
 *
 * @template T - The success type returned by the database operation
 * @param dbPromise - A Drizzle query promise (from insert, select, update, delete, etc.)
 * @returns ResultAsync<T, Fault> - Either the operation result or a Fault error
 *
 * @example Basic usage with select
 * import { ok, err, safeDb } from '@itterno/fault'
 *
 * const result = await safeDb(db.select().from(users).where(eq(users.id, 123)))
 *
 * result.match(
 *   (users) => console.log('Found users:', users),
 *   (fault) => console.error('Query failed:', fault.message)
 * )
 *
 * @example With insert
 * const result = await safeDb(
 *   db.insert(users).values({ name: 'John' }).returning()
 * )
 *
 * result.match(
 *   (newUser) => console.log('Created:', newUser),
 *   (fault) => {
 *     if (fault.tag === 'VALIDATION_ERROR') {
 *       console.error('Invalid data:', fault.details)
 *     } else if (fault.tag === 'DATABASE_ERROR') {
 *       console.error('Database error:', fault.message)
 *     }
 *   }
 * )
 *
 * @example With update
 * const result = await safeDb(
 *   db.update(users)
 *     .set({ name: 'Jane' })
 *     .where(eq(users.id, 123))
 *     .returning()
 * )
 *
 * @example Chaining with other operations
 * const result = await safeDb(db.select().from(users))
 *   .map((users) => users.filter((u) => u.active))
 *   .andThen((activeUsers) =>
 *     safeDb(db.update(users).set({ lastSeen: new Date() }))
 *       .map(() => activeUsers)
 *   )
 *   .match(
 *     (users) => console.log('Updated active users:', users),
 *     (fault) => fault.capture()
 *   )
 *
 * @example Error handling with specific fault tags
 * const createUser = (userData: unknown) =>
 *   safeZodParse(userSchema, userData)
 *     .asyncAndThen((validated) =>
 *       safeDb(db.insert(users).values(validated).returning())
 *     )
 *     .mapErr((fault) => {
 *       if (fault.tag === 'VALIDATION_ERROR') {
 *         return { status: 400, message: 'Invalid user data' }
 *       }
 *       return { status: 500, message: 'Database error' }
 *     })
 *
 * @see DatabaseError - The error handler used internally
 * @see https://orm.drizzle.team/ - Drizzle ORM documentation
 */
export function safeDb<T>(dbPromise: Promise<T>): ResultAsync<T, Fault> {
    return ResultAsync.fromPromise(dbPromise, DatabaseError);
}
