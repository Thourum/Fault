import { z } from 'zod';
import { parsePgError } from './utils/pg-error-parser';
import { DrizzleError, DrizzleQueryError, TransactionRollbackError } from 'drizzle-orm/errors';
import { DatabaseError as PgDatabaseError } from 'pg';

// Optional lazy-loaded observability integrations
let otel: any; // eslint-disable-line @typescript-eslint/no-explicit-any
let sentry: any; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Fault is an error handling class providing rich context preservation
 * and safe error reporting in applications. It combines debugging
 * capabilities with secure user communication patterns.
 *
 * @example Using with neverthrow Result types
 * import { err, ok } from '@itterno/fault'
 *
 * function validateUser(data: unknown): Result<User, Fault> {
 *   if (!data) {
 *     return err(new Fault('User data required').withTag('VALIDATION_ERROR'))
 *   }
 *   return ok(userData)
 * }
 *
 * @example Capturing errors to observability backends
 * const result = await someOperation()
 * if (result.isErr()) {
 *   // Capture to OpenTelemetry or Sentry (if available)
 *   result.error.capture()
 *   throw result.error
 * }
 */
export class Fault extends Error {
    #tag: FaultTag;
    #details?: string;
    #message?: string;
    #location?: string;
    #metadata: Record<string, unknown> = {};

    /**
     * Create a new Fault instance
     * @param initial `Error` | `string` - The initial error or message
     *
     * @example Create from error message
     * const error = new Fault('This is a test error');
     *
     * @example Create from Error object
     * const error = new Fault(new Error('This is a test error'));
     *
     * @example Chain with methods
     * const error = new Fault('This is a test error')
     *   .withTag('DATABASE_ERROR')
     *   .withDetails('Failed to connect to database')
     *   .withMetadata('userId', 123)
     *   .withContext({ attemptCount: 3, lastAttempt: new Date() });
     */
    constructor(initial: Error | string | Fault) {
        const isInitialError = initial instanceof Error;

        super(isInitialError ? initial.message : String(initial), {
            cause: isInitialError ? (initial as Error & { cause?: unknown }).cause : undefined,
        });

        // Fix instanceof issues with extending Error
        Object.setPrototypeOf(this, new.target.prototype);

        // Capture location (only first non-Fault line)
        const stackLines = this.stack?.split('\n') || [];
        // Skip the Error: message line and any lines from the Fault class
        const locationLine = stackLines.find(
            (line) => line.trim().startsWith('at') && !line.includes('Fault.')
        );

        this.#location = locationLine?.trim() || undefined;
        this.#tag = 'UNKNOWN_ERROR';
    }

    /**
     * Create a new Fault from an error or message
     * @param initial - Error or message string to convert
     * @returns New Fault instance
     */
    static from(initial: Error | string): Fault {
        return new Fault(initial);
    }

    /**
     * Get the tag associated with this fault
     * @returns The FaultTag used for categorization
     */
    get tag(): FaultTag | undefined {
        return this.#tag;
    }

    /**
     * Get the details (additional context for developers)
     * @returns Developer-facing details about the error
     */
    get details(): string | undefined {
        return this.#details;
    }

    /**
     * Get the message (safe for user display)
     * Falls back to original error message if no custom message is set
     * @returns User-facing or original error message
     */
    override get message(): string {
        return this.#message ?? super.message;
    }

    /**
     * Get the location where the fault originated
     * @returns Stack trace location string
     */
    get location(): string | undefined {
        return this.#location;
    }

    /**
     * Get the metadata associated with this fault
     * @returns Copy of metadata object to prevent mutation
     */
    get metadata(): Record<string, unknown> {
        // Return a copy to prevent mutation
        return { ...this.#metadata };
    }

    /**
     * HTTP status code based on the tag
     * Provides appropriate HTTP status for API error responses
     * @returns HTTP status code (default 500)
     */
    get statusCode(): number {
        switch (this.#tag) {
            case 'VALIDATION_ERROR':
                return 400;
            case 'AUTHENTICATION_ERROR':
                return 401;
            case 'AUTHORIZATION_ERROR':
                return 403;
            case 'NOT_FOUND':
                return 404;
            case 'NETWORK_ERROR':
                return 503;
            case 'PARSE_ERROR':
            case 'HTTP_ERROR':
                // For HTTP errors, check if we stored the status in metadata
                return (this.#metadata.httpStatus as number) ?? 500;
            case 'DATABASE_ERROR':
            case 'INTERNAL_ERROR':
            case 'UNKNOWN_ERROR':
            default:
                return 500;
        }
    }

    /**
     * Add a tag to classify this error
     * @param tag - One of the predefined FaultTags or custom string
     * @returns this for method chaining
     *
     * @example
     * new Fault('error').withTag('AUTHENTICATION_ERROR')
     *
     * @example Custom tags
     * new Fault('error').withTag('CUSTOM_PAYMENT_ERROR')
     */
    withTag(tag: FaultTag): this {
        this.#tag = tag;
        return this;
    }

    /**
     * Add details and an optional user-facing message to this error
     * @param details Detailed description for logging/debugging (developer-facing)
     * @param message Optional custom message shown to users; if omitted, original error message is used
     * @returns this for method chaining
     *
     * @example
     * new Fault(err)
     *   .withDescription(
     *     'Failed to connect to PostgreSQL database: connection timeout',
     *     'Database is temporarily unavailable. Please try again.'
     *   )
     */
    withDescription(details: string, message?: string): this {
        this.#details = details;
        if (message !== undefined) {
            // This assignment is necessary to override the Error.message property
            // The getter will use this value instead of the value from super.message
            this.#message = message;
            // Also need to update the inherited message property for toString() to work correctly
            super.message = message;
        }
        return this;
    }

    /**
     * Add details (developer context) to this error
     * @param details Detailed description for logging/debugging
     * @returns this for method chaining
     */
    withDetails(details: string): this {
        this.#details = details;
        return this;
    }

    /**
     * Add a single piece of metadata to this error
     * @param key - Metadata key
     * @param value - Metadata value
     * @returns this for method chaining
     *
     * @example
     * new Fault('error')
     *   .withMetadata('userId', 123)
     *   .withMetadata('operation', 'CREATE_USER')
     */
    withMetadata(key: string, value: unknown): this {
        this.#metadata[key] = value;
        return this;
    }

    /**
     * Add multiple pieces of metadata to this error
     * @param data - Object containing metadata key-value pairs
     * @returns this for method chaining
     *
     * @example
     * new Fault('error').withContext({
     *   userId: 123,
     *   operation: 'CREATE_USER',
     *   timestamp: new Date(),
     *   attemptCount: 3
     * })
     */
    withContext(data: Record<string, unknown>): this {
        for (const [key, value] of Object.entries(data)) {
            this.#metadata[key] = value;
        }
        return this;
    }

    /**
     * Serialize this error for logging
     * @returns Object representation suitable for JSON serialization
     *
     * @example
     * logger.error(fault.toJSON())
     */
    toJSON(): Record<string, unknown> {
        let causeValue = (this as Error & { cause?: unknown }).cause;

        if (causeValue instanceof Error) {
            if (causeValue instanceof Fault) {
                causeValue = causeValue.toJSON();
            } else {
                causeValue = {
                    name: causeValue.name,
                    message: causeValue.message,
                    stack: causeValue.stack,
                };
            }
        }

        return {
            name: this.name,
            message: this.message,
            details: this.#details,
            tag: this.#tag,
            statusCode: this.statusCode,
            location: this.#location,
            metadata: { ...this.#metadata },
            cause: causeValue,
            stack: this.stack,
        };
    }

    /**
     * Get the cause chain of errors
     * @returns Array of errors from this fault to the root cause
     *
     * @example
     * const chain = fault.getCauseChain();
     * chain.forEach(error => console.log(error.message))
     */
    getCauseChain(): Array<Error | unknown> {
        const chain: Array<Error | unknown> = [];
        let current: unknown = this;

        while (current instanceof Error) {
            chain.push(current);
            current = (current as Error & { cause?: unknown }).cause;
        }

        if (current) {
            chain.push(current);
        }
        return chain;
    }

    /**
     * Capture this fault to observability backends (OpenTelemetry or Sentry)
     * Only call when you cannot recover from the error.
     * This method gracefully degrades if neither OpenTelemetry nor Sentry is available.
     * @returns this for chaining
     *
     * @example Using with neverthrow
     * const result = await someOperation()
     * if (result.isErr()) {
     *   // Only capture if we can't recover
     *   result.error.capture()
     *   throw result.error
     * }
     *
     * @example With logging
     * result.match(
     *   (data) => console.log('Success:', data),
     *   (error) => {
     *     error.capture()
     *     logger.error(error.toJSON())
     *   }
     * )
     */
    capture(): this {
        // Try OpenTelemetry first
        if (!otel) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
                otel = require('@opentelemetry/api');
            } catch {
                // OpenTelemetry not available
            }
        }

        if (otel) {
            try {
                const tracer = otel.trace.getTracer('fault');
                tracer.startActiveSpan('error.capture', (span: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                    span.recordException(this);
                    span.setStatus({ code: otel.SpanStatusCode.ERROR });
                    span.end();
                });
            } catch {
                // Error recording to OpenTelemetry, continue to Sentry
            }
        }

        // Fallback to Sentry if available
        if (!sentry) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
                sentry = require('@sentry/node');
            } catch {
                // Sentry not available
            }
        }

        if (sentry) {
            try {
                sentry.captureException(this, {
                    contexts: {
                        fault: {
                            tag: this.#tag,
                            details: this.#details,
                            location: this.#location,
                            metadata: this.#metadata,
                        },
                    },
                });
            } catch {
                // Error capturing to Sentry, silently ignore
            }
        }

        return this;
    }

    /**
     * Create a Fault from a Zod validation error
     * @param error - The ZodError instance
     * @returns A new Fault instance with validation details
     *
     * @example Using with safeZodParse
     * import { safeZodParse } from '@itterno/fault'
     * import { z } from 'zod'
     *
     * const schema = z.object({ email: z.string().email() })
     * const result = safeZodParse(schema)({ email: 'invalid' })
     *
     * result.match(
     *   (data) => console.log('Valid:', data),
     *   (fault) => {
     *     console.log(fault.metadata.fieldErrors)
     *     // { email: ['Invalid email'] }
     *   }
     * )
     */
    static fromZod(error: unknown): Fault {
        if (!(error instanceof z.ZodError)) {
            return new Fault('Validation failed')
                .withTag('VALIDATION_ERROR')
                .withMetadata('error', error);
        }

        // Format issues into a user-friendly message
        const firstIssue = error.issues[0];
        const message = firstIssue?.message || 'Validation failed';

        const fault = new Fault(`Validation failed: ${message}`)
            .withTag('VALIDATION_ERROR')
            .withMetadata('zodIssues', error.issues)
            .withMetadata('issueCount', error.issues.length)
            .withMetadata('fieldErrors', error.flatten().fieldErrors);

        return fault;
    }
}

/**
 * Core fault tags for categorizing errors
 * Supports both predefined tags and custom string tags for extensibility
 *
 * @example Using predefined tags
 * new Fault('error').withTag('AUTHENTICATION_ERROR')
 *
 * @example Using custom tags
 * new Fault('error').withTag('CUSTOM_PAYMENT_ERROR')
 */
export type FaultTag =
    // Auth errors
    | 'AUTHENTICATION_ERROR'
    | 'AUTHORIZATION_ERROR'
    // Resource errors
    | 'NOT_FOUND'
    | 'DATABASE_ERROR'
    // Network/API errors
    | 'NETWORK_ERROR'
    | 'PARSE_ERROR'
    | 'HTTP_ERROR'
    // Data errors
    | 'VALIDATION_ERROR'
    // Catch-all errors
    | 'INTERNAL_ERROR'
    | 'UNKNOWN_ERROR'
    // Allow custom tags while keeping autocomplete for predefined ones
    | (string & {});

/**
 * Create a Fault instance with a specific tag and message
 * Shorthand for common error creation patterns
 *
 * @param type - The error tag/classification
 * @param message - The error message
 * @param description - Optional detailed description for developers
 * @returns Fault instance ready to use or throw
 *
 * @example
 * if (!user) {
 *   throw ServiceError('NOT_FOUND', 'User not found', `User ID: ${userId}`)
 * }
 *
 * @example With Result pattern
 * return err(ServiceError('VALIDATION_ERROR', 'Invalid email format'))
 */
export const ServiceError = (type: FaultTag, message: string, description?: string) =>
    new Fault(message).withTag(type).withDescription(description ?? message);

/**
 * Create a Fault from a Drizzle or PostgreSQL error
 * Handles DrizzleQueryError, TransactionRollbackError, and PostgreSQL DatabaseError
 *
 * @param cause - The error to convert (from Drizzle or pg)
 * @returns Fault with appropriate tag, message, and metadata
 *
 * @example Using with neverthrow in database operations
 * import { ResultAsync, ok, err, DatabaseError } from '@itterno/fault'
 *
 * try {
 *   const user = await db.insert(users).values(userData).returning()
 *   return ok(user)
 * } catch (error) {
 *   return err(DatabaseError(error))
 * }
 *
 * @example With safeDb utility (recommended)
 * import { safeDb } from '@itterno/fault'
 *
 * const result = await safeDb(db.insert(users).values(userData).returning())
 * result.match(
 *   (user) => console.log('Created:', user),
 *   (fault) => console.error('Error:', fault.message)
 * )
 *
 * @see https://github.com/drizzle-team/drizzle-orm/discussions/916
 */
export function DatabaseError(cause: unknown): Fault {
    if (cause instanceof TransactionRollbackError) {
        const causedByError = (cause as unknown as { cause?: unknown }).cause;
        if (causedByError instanceof PgDatabaseError) {
            return parsePgError(causedByError as PgDatabaseError);
        }
        const message = (cause as unknown as { message?: string }).message ?? 'Transaction rollback error';
        return new Fault(message)
            .withTag('DATABASE_ERROR')
            .withDescription('Transaction rollback error', message);
    }

    // Check for DrizzleQueryError which wraps PostgreSQL errors
    if (cause instanceof DrizzleQueryError) {
        // The actual PostgreSQL error is in error.cause
        const causedByError = (cause as unknown as { cause?: unknown }).cause;
        if (causedByError instanceof PgDatabaseError) {
            return parsePgError(causedByError as PgDatabaseError);
        }

        const message = (cause as unknown as { message?: string }).message ?? 'Drizzle query error';
        return new Fault(message)
            .withTag('DATABASE_ERROR')
            .withDescription('Drizzle query error', message);
    }

    // Fallback for generic Drizzle errors or other Error instances
    if (cause instanceof DrizzleError || cause instanceof Error) {
        const causedByError = (cause as unknown as { cause?: unknown }).cause;
        if (
            Object.prototype.hasOwnProperty.call(cause, 'cause') &&
            causedByError instanceof PgDatabaseError
        ) {
            return parsePgError(causedByError as PgDatabaseError);
        }

        const message = (cause as unknown as { message?: string }).message ?? 'Drizzle error';
        return new Fault(message)
            .withTag('DATABASE_ERROR')
            .withDescription('Drizzle error', message);
    }

    return new Fault(String(cause))
        .withTag('DATABASE_ERROR')
        .withDescription('Unknown database error', String(cause));
}
