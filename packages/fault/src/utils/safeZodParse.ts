import { err, ok } from '../result';
import type { Result } from '../result';
import type { z, ZodSchema } from 'zod';
import { Fault } from '../fault';

/**
 * Safely parse data with a Zod schema, returning a Result type
 *
 * Provides type-safe validation using Zod schemas without throwing errors.
 * Returns a Result that can be pattern-matched or chained with other operations.
 * Supports both curried (single schema) and direct (schema + data) usage.
 *
 * @template TSchema - The Zod schema type
 * @param schema - The Zod schema to validate against
 * @returns A function that takes data and returns Result<T, Fault>
 *
 * @example Curried usage (recommended for reuse)
 * import { safeZodParse } from '@itterno/fault'
 * import { z } from 'zod'
 *
 * const userSchema = z.object({
 *   id: z.number(),
 *   email: z.string().email(),
 *   name: z.string().min(1)
 * })
 *
 * const parseUser = safeZodParse(userSchema)
 *
 * const result = parseUser({ id: 1, email: 'john@example.com', name: 'John' })
 *
 * result.match(
 *   (user) => console.log('Valid user:', user),
 *   (fault) => console.error('Validation errors:', fault.metadata.fieldErrors)
 * )
 */
export function safeZodParse<TSchema extends ZodSchema>(
    schema: TSchema
): (data: unknown) => Result<z.infer<TSchema>, Fault>;

/**
 * Safely parse data with a Zod schema, returning a Result type
 *
 * Provides type-safe validation using Zod schemas without throwing errors.
 * Returns a Result that can be pattern-matched or chained with other operations.
 * Supports both curried (single schema) and direct (schema + data) usage.
 *
 * @template TSchema - The Zod schema type
 * @param schema - The Zod schema to validate against
 * @param data - The data to validate
 * @returns Result<T, Fault> - Either the validated data or a Fault error
 *
 * @example Direct usage (single validation)
 * import { safeZodParse } from '@itterno/fault'
 * import { z } from 'zod'
 *
 * const schema = z.object({ email: z.string().email() })
 * const result = safeZodParse(schema, { email: 'test@example.com' })
 *
 * result.match(
 *   (data) => console.log('Valid:', data),
 *   (fault) => {
 *     if (fault.tag === 'VALIDATION_ERROR') {
 *       const errors = fault.metadata.fieldErrors
 *       console.error('Field errors:', errors)
 *     }
 *   }
 * )
 *
 * @example With Result chaining
 * const schema = z.object({ name: z.string(), age: z.number() })
 * const result = safeZodParse(schema, unknownData)
 *   .andThen((data) => {
 *     if (data.age < 18) {
 *       return err(new Fault('Must be 18 or older').withTag('VALIDATION_ERROR'))
 *     }
 *     return ok(data)
 *   })
 *
 * @example Accessing validation errors
 * const schema = z.object({
 *   email: z.string().email(),
 *   password: z.string().min(8)
 * })
 *
 * const result = safeZodParse(schema, userData)
 *
 * result.match(
 *   (validated) => console.log('Success:', validated),
 *   (fault) => {
 *     const fieldErrors = fault.metadata.fieldErrors as Record<string, string[]> | undefined
 *     const issues = fault.metadata.zodIssues as z.ZodIssue[] | undefined
 *
 *     fieldErrors?.email?.forEach(msg => console.error('Email:', msg))
 *     fieldErrors?.password?.forEach(msg => console.error('Password:', msg))
 *   }
 * )
 *
 * @example With safeFetch
 * import { safeFetch } from '@itterno/fault'
 *
 * const userSchema = z.object({ id: z.number(), name: z.string() })
 *
 * const fetchUser = (userId: number) =>
 *   safeFetch<unknown>(`/api/users/${userId}`)
 *     .andThen((data) => safeZodParse(userSchema, data).asyncAndThen(u => okAsync(u)))
 *
 * @example Request body validation in API handlers
 * const createUserSchema = z.object({
 *   email: z.string().email(),
 *   name: z.string().min(1),
 *   age: z.number().min(0).max(150)
 * })
 *
 * const validateCreateUserRequest = (body: unknown) =>
 *   safeZodParse(createUserSchema, body)
 *
 * // In Express middleware
 * app.post('/users', (req, res) => {
 *   validateCreateUserRequest(req.body).match(
 *     (validated) => {
 *       // Create user with validated data
 *       createUser(validated)
 *         .then(user => res.status(201).json(user))
 *         .catch(err => res.status(500).json({ error: err.message }))
 *     },
 *     (fault) => {
 *       res.status(400).json({
 *         error: fault.message,
 *         fieldErrors: fault.metadata.fieldErrors
 *       })
 *     }
 *   )
 * })
 *
 * @see Fault.fromZod - Used internally to convert Zod errors
 * @see safeFetch - Commonly used with API responses
 * @see https://zod.dev/ - Zod documentation
 */
// eslint-disable-next-line no-redeclare
export function safeZodParse<TSchema extends ZodSchema>(
    schema: TSchema,
    data: unknown
): Result<z.infer<TSchema>, Fault>;
// eslint-disable-next-line no-redeclare
export function safeZodParse<TSchema extends ZodSchema>(
    schema: TSchema,
    data?: unknown
): ((data: unknown) => Result<z.infer<TSchema>, Fault>) | Result<z.infer<TSchema>, Fault> {
    if (data === undefined) {
        return (data: unknown) => {
            const result = schema.safeParse(data);
            return result.success ? ok(result.data) : err(Fault.fromZod(result.error));
        };
    } else {
        const result = schema.safeParse(data);
        return result.success ? ok(result.data) : err(Fault.fromZod(result.error));
    }
}
