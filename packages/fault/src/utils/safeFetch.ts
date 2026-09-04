import { errAsync, ResultAsync } from '../result-async';
import { Fault } from '../fault';
import type { FaultTag } from '../fault';

/**
 * Safely perform a fetch request, returning a ResultAsync type
 *
 * Wraps the native fetch API to return a ResultAsync instead of throwing errors.
 * Handles network errors, HTTP error responses, and JSON parsing errors.
 * Categorizes errors into appropriate Fault tags for precise error handling.
 *
 * @template T - The expected type of the response data
 * @param input - URL or string to fetch
 * @param init - Optional RequestInit options (headers, method, body, etc.)
 * @returns ResultAsync<T, Fault> - Either the parsed response or a Fault error
 *
 * @example Basic GET request
 * import { safeFetch } from '@itterno/fault'
 *
 * const result = await safeFetch<{ id: number; name: string }>('https://api.example.com/users/1')
 *
 * result.match(
 *   (user) => console.log('User:', user),
 *   (fault) => console.error('Error:', fault.message)
 * )
 *
 * @example POST with JSON body
 * const result = await safeFetch<{ id: number }>(
 *   'https://api.example.com/users',
 *   {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ name: 'John', email: 'john@example.com' })
 *   }
 * )
 *
 * result.match(
 *   (newUser) => console.log('Created:', newUser.id),
 *   (fault) => {
 *     if (fault.tag === 'VALIDATION_ERROR') {
 *       console.error('Invalid input:', fault.details)
 *     } else if (fault.tag === 'NETWORK_ERROR') {
 *       console.error('Network issue:', fault.message)
 *     }
 *   }
 * )
 *
 * @example Chaining with Zod validation
 * import { safeZodParse, okAsync } from '@itterno/fault'
 * import { z } from 'zod'
 *
 * const userSchema = z.object({
 *   id: z.number(),
 *   name: z.string(),
 *   email: z.string().email()
 * })
 *
 * const fetchAndValidateUser = (userId: number) =>
 *   safeFetch<unknown>(`https://api.example.com/users/${userId}`)
 *     .andThen((data) => safeZodParse(userSchema, data).asyncAndThen((user) => okAsync(user)))
 *
 * @example Error handling with status codes
 * const result = await safeFetch('https://api.example.com/data')
 *
 * result.match(
 *   (data) => console.log('Success:', data),
 *   (fault) => {
 *     switch (fault.tag) {
 *       case 'VALIDATION_ERROR': // 4xx client errors
 *         console.error('Client error:', fault.metadata.httpStatus)
 *         break
 *       case 'NOT_FOUND': // 404 specifically
 *         console.error('Resource not found')
 *         break
 *       case 'INTERNAL_ERROR': // 5xx server errors
 *         console.error('Server error:', fault.metadata.httpStatus)
 *         break
 *       case 'NETWORK_ERROR':
 *         console.error('Network error:', fault.message)
 *         break
 *       case 'PARSE_ERROR':
 *         console.error('Invalid response:', fault.message)
 *         break
 *     }
 *   }
 * )
 *
 * @example With error capture
 * const result = await safeFetch('https://api.example.com/data')
 *
 * result.match(
 *   (data) => console.log('Success:', data),
 *   (fault) => {
 *     // Capture to OpenTelemetry or Sentry if available
 *     fault.capture()
 *     throw fault
 *   }
 * )
 *
 * @example Response metadata access
 * const result = await safeFetch<{ message: string }>('https://api.example.com/data')
 *
 * result.match(
 *   (data) => console.log(data.message),
 *   (fault) => {
 *     // Access response headers
 *     const headers = fault.metadata.httpHeaders as Record<string, string> | undefined
 *     const contentType = headers?.['content-type']
 *
 *     // Access response body
 *     const body = fault.metadata.httpBody
 *
 *     // Access status code
 *     const status = fault.metadata.httpStatus as number | undefined
 *   }
 * )
 *
 * @see safeZodParse - For validating API responses
 * @see Fault - For error handling patterns
 */
export function safeFetch<T = unknown>(
    input: URL | string,
    init?: RequestInit
): ResultAsync<T, Fault> {
    return ResultAsync.fromPromise(fetch(input, init), (error: unknown): Fault => {
        const err = error instanceof Error ? error : new Error(String(error));
        return new Fault(err)
            .withTag('NETWORK_ERROR')
            .withDescription(
                'Network request failed',
                'Unable to connect to the server. Please check your internet connection.'
            )
            .withMetadata('originalError', err.message);
    }).andThen((response: Response) => {
        // It's a response but not 2XX
        if (!response.ok) {
            // Parse the JSON as it might contain some useful info
            return ResultAsync.fromSafePromise(
                // Since we don't care about parse errors we can use `fromSafePromise`
                // and just add a catch, which suppresses JSON parse errors
                response.json().catch(() => undefined)
            ).andThen((json: unknown) => {
                // Map status codes to specific tags
                let tag: FaultTag = 'HTTP_ERROR';
                if (response.status === 404) {
                    tag = 'NOT_FOUND';
                } else if (response.status >= 400 && response.status < 500) {
                    tag = 'VALIDATION_ERROR';
                } else if (response.status >= 500) {
                    tag = 'INTERNAL_ERROR';
                }

                // Store response headers as plain object
                const headersObj: Record<string, string> = {};
                response.headers.forEach((value: string, key: string) => {
                    headersObj[key] = value;
                });

                const fault = new Fault(`HTTP ${response.status}: ${response.statusText}`)
                    .withTag(tag)
                    .withMetadata('httpStatus', response.status)
                    .withMetadata('httpStatusText', response.statusText)
                    .withMetadata('httpHeaders', headersObj);

                if (json !== undefined) {
                    fault.withMetadata('httpBody', json);
                }

                return errAsync(fault);
            });
        }

        // Response is 2XX - return the parsed JSON with an assigned optional type
        return ResultAsync.fromPromise(response.json() as Promise<T>, (error: unknown): Fault => {
            const err = error instanceof Error ? error : new Error(String(error));
            return new Fault(err)
                .withTag('PARSE_ERROR')
                .withDescription(
                    'Failed to parse response',
                    'The server returned an invalid response. Please try again.'
                )
                .withMetadata('originalError', err.message);
        });
    });
}
