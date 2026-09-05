import { Fault } from '../fault';
import type { DatabaseError as PgDatabaseError } from 'pg';

/**
 * Check if an error is a PostgreSQL error
 */
function isPostgresError(error: unknown): error is PgDatabaseError {
    return (
        error instanceof Error &&
        'code' in error &&
        typeof (error as PgDatabaseError).code === 'string'
    );
}

/**
 * Extract field name from PostgreSQL error detail message
 * Examples:
 * - "Key (email)=(test@example.com) already exists."
 * - "Key (user_id, org_id)=(123, 456) already exists."
 */
function extractFieldFromDetail(detail: string | undefined): string | null {
    if (!detail) return null;

    const keyRegex = /Key \(([^)]+)\)=/;
    const match = detail.match(keyRegex);

    if (match && match[1]) {
        // Handle composite keys by taking the first field
        const fields = match[1].split(',').map((f) => f.trim());
        return fields[0] || null;
    }

    return null;
}

/**
 * Parse common PostgreSQL errors into Fault instances
 * @param error - The error to parse
 * @returns A Fault instance with appropriate tag and context
 *
 * @example
 * import { parsePgError } from '@itterno/fault/pg';
 * try {
 *   await db.insert(users).values(userData);
 * } catch (error) {
 *   const fault = parsePgError(error);
 *   // fault will have appropriate tag and user-friendly message
 * }
 */
export function parsePgError(error: PgDatabaseError): Fault {
    if (!isPostgresError(error)) {
        // Not a PostgreSQL error, return generic database error
        return new Fault(error as Error)
            .withTag('DATABASE_ERROR')
            .withDescription('Database operation failed', 'An unexpected database error occurred.');
    }

    const pgError = error;
    const code = pgError.code || 'UNKNOWN';

    // Create base fault with original error
    const fault = new Fault(pgError)
        .withCause(error)
        .withMetadata('pgCode', code)
        .withMetadata('pgDetail', pgError.detail)
        .withMetadata('pgTable', pgError.table)
        .withMetadata('pgColumn', pgError.column)
        .withMetadata('pgConstraint', pgError.constraint)
        .withMetadata('pgSchema', pgError.schema);

    // Parse based on error code
    // Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
    switch (code) {
        // Class 23 - Integrity Constraint Violation
        case '23505': {
            // Unique violation
            const field = extractFieldFromDetail(pgError.detail);
            const fieldName = field || pgError.column || pgError.constraint || 'field';

            return fault
                .withTag('UNIQUE_CONSTRAINT_ERROR')
                .withDescription(
                    `Unique constraint violation on ${fieldName}`,
                    `This ${fieldName} is already in use. Please choose a different value.`
                )
                .withMetadata('field', fieldName);
        }

        case '23503': {
            // Foreign key violation
            const field = pgError.column || pgError.constraint || 'field';

            return fault
                .withTag('FOREIGN_KEY_ERROR')
                .withDescription(
                    `Foreign key constraint violation on ${field}`,
                    'The referenced record does not exist or cannot be deleted because other records depend on it.'
                )
                .withMetadata('field', field);
        }

        case '23502': {
            // Not null violation
            const field = pgError.column || 'field';

            return fault
                .withTag('VALIDATION_ERROR')
                .withDescription(
                    `Required field ${field} is missing`,
                    `The field '${field}' is required and cannot be empty.`
                )
                .withMetadata('field', field);
        }

        case '23514': {
            // Check constraint violation
            const constraint = pgError.constraint || 'constraint';

            return fault
                .withTag('VALIDATION_ERROR')
                .withDescription(
                    `Check constraint ${constraint} violation`,
                    'The provided value does not meet the required constraints.'
                );
        }

        // Class 42 - Syntax Error or Access Rule Violation
        case '42P01': {
            // Undefined table
            return fault
                .withTag('DATABASE_ERROR')
                .withDescription(
                    `Table ${pgError.table || 'unknown'} does not exist`,
                    'A database configuration error occurred. Please contact support.'
                );
        }

        case '42703': {
            // Undefined column
            return fault
                .withTag('DATABASE_ERROR')
                .withDescription(
                    `Column ${pgError.column || 'unknown'} does not exist`,
                    'A database configuration error occurred. Please contact support.'
                );
        }

        // Class 57 - Operator Intervention
        case '57014': {
            // Query canceled
            return fault
                .withTag('DATABASE_ERROR')
                .withDescription(
                    'Database query was canceled',
                    'The operation took too long and was canceled. Please try again.'
                );
        }

        // Class 08 - Connection Exception
        case '08000':
        case '08001':
        case '08003':
        case '08004':
        case '08006':
        case '08007':
        case 'ECONNREFUSED':
        case 'ENOTFOUND':
        case 'ETIMEDOUT': {
            // Connection errors
            return fault
                .withTag('CONNECTION_ERROR')
                .withDescription(
                    'Database connection failed',
                    'Unable to connect to the database. Please try again later.'
                );
        }

        // Class 40 - Transaction Rollback
        case '40001':
        case '40P01': {
            // Serialization failure / deadlock detected
            return fault
                .withTag('TRANSACTION_ROLLBACK_ERROR')
                .withDescription(
                    'Transaction conflict detected',
                    'The operation conflicted with another transaction. Please try again.'
                );
        }

        // Default case - generic database error
        default: {
            return fault
                .withTag('DATABASE_ERROR')
                .withDescription(
                    `Database error: ${code}`,
                    'A database error occurred. Please try again or contact support if the problem persists.'
                );
        }
    }
}
