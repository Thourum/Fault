import { err, ok } from '../result'
import type { Result } from '../result'
import type { z, ZodError, ZodSchema } from 'zod'
import { Fault } from '../fault'

/** Convert a ZodError into a VALIDATION_ERROR Fault. */
export function fromZodError(error: ZodError): Fault {
    const first = error.issues[0]
    return new Fault(`Validation failed: ${first?.message ?? 'invalid input'}`)
        .withTag('VALIDATION_ERROR')
        .withMetadata({
            zodIssues: error.issues,
            issueCount: error.issues.length,
            fieldErrors: error.flatten().fieldErrors,
        })
        .withCause(error)
}

/**
 * Safely parse data with a Zod schema, returning a Result.
 *
 * @example
 * const parseUser = safeZodParse(userSchema)
 * const result = parseUser({ id: 1, email: 'john@example.com', name: 'John' })
 */
export function safeZodParse<TSchema extends ZodSchema>(
    schema: TSchema
): (data: unknown) => Result<z.infer<TSchema>, Fault>

/**
 * Safely parse data with a Zod schema, returning a Result.
 *
 * @example
 * const result = safeZodParse(schema, { email: 'test@example.com' })
 */
export function safeZodParse<TSchema extends ZodSchema>(
    schema: TSchema,
    data: unknown
): Result<z.infer<TSchema>, Fault>
export function safeZodParse<TSchema extends ZodSchema>(
    schema: TSchema,
    data?: unknown
): ((data: unknown) => Result<z.infer<TSchema>, Fault>) | Result<z.infer<TSchema>, Fault> {
    if (data === undefined) {
        return (data: unknown) => {
            const result = schema.safeParse(data)
            return result.success ? ok(result.data) : err(fromZodError(result.error))
        }
    } else {
        const result = schema.safeParse(data)
        return result.success ? ok(result.data) : err(fromZodError(result.error))
    }
}
