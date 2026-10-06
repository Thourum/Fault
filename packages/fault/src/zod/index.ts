import { err, ok } from '../result'
import type { Result } from '../result'
import { z } from 'zod'
import { Fault } from '../fault'

/** Convert a ZodError into a VALIDATION_ERROR Fault. */
export function fromZodError(error: z.ZodError): Fault {
    const first = error.issues[0]
    return new Fault(`Validation failed: ${first?.message ?? 'invalid input'}`)
        .withTag('VALIDATION_ERROR')
        .withMetadata({
            zodIssues: error.issues,
            issueCount: error.issues.length,
            fieldErrors: z.flattenError(error).fieldErrors,
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
export function safeZodParse<TSchema extends z.ZodType>(
    schema: TSchema
): (data: unknown) => Result<z.infer<TSchema>, Fault>

/**
 * Safely parse data with a Zod schema, returning a Result.
 *
 * @example
 * const result = safeZodParse(schema, { email: 'test@example.com' })
 */
export function safeZodParse<TSchema extends z.ZodType>(
    schema: TSchema,
    data: unknown
): Result<z.infer<TSchema>, Fault>
export function safeZodParse<TSchema extends z.ZodType>(
    schema: TSchema,
    ...rest: [] | [data: unknown]
): ((data: unknown) => Result<z.infer<TSchema>, Fault>) | Result<z.infer<TSchema>, Fault> {
    const parse = (data: unknown): Result<z.infer<TSchema>, Fault> => {
        const result = schema.safeParse(data)
        return result.success ? ok(result.data) : err(fromZodError(result.error))
    }
    // Check arity, not value: `safeZodParse(optionalSchema, undefined)` must parse, not curry.
    if (rest.length === 0) return parse
    return parse(rest[0])
}
